import type { LookupAddress } from "node:dns";
import { describe, expect, it, vi } from "vitest";
import type { AppError } from "@/lib/errors";
import { resolvePublicTarget } from "@/lib/security/url";
import {
  MAX_PROVIDER_REDIRECTS,
  fetchProviderEndpoint,
  isAllowedProviderAddress,
  parseProviderUrl,
  resolveProviderTarget,
  type ProviderFetch,
  type ProviderLookup,
} from "./endpoint";

function lookupReturning(addresses: string[]): ProviderLookup {
  return vi.fn<ProviderLookup>(async () =>
    addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })) as LookupAddress[],
  );
}

async function expectAppError(run: () => Promise<unknown>): Promise<AppError> {
  try {
    await run();
  } catch (error) {
    const appError = error as AppError;
    expect(appError.name).toBe("AppError");
    return appError;
  }
  throw new Error("expected an AppError");
}

function expectSyncError(run: () => unknown): AppError {
  try {
    run();
  } catch (error) {
    const appError = error as AppError;
    expect(appError.name).toBe("AppError");
    return appError;
  }
  throw new Error("expected an AppError");
}

describe("isAllowedProviderAddress", () => {
  it.each([
    "127.0.0.1",
    "::1",
    "10.1.2.3",
    "172.16.4.9",
    "192.168.1.9",
    "100.64.0.7",
    "fd00::1",
    "8.8.8.8",
    "2606:4700::1111",
  ])("allows %s", (address) => {
    expect(isAllowedProviderAddress(address)).toBe(true);
  });

  it.each([
    ["0.0.0.0", "unspecified IPv4"],
    ["::", "unspecified IPv6"],
    ["169.254.169.254", "cloud metadata"],
    ["169.254.1.1", "other link-local address"],
    ["::ffff:169.254.169.254", "IPv4-mapped metadata"],
    ["fd00:ec2::254", "AWS IPv6 metadata"],
    ["100.100.100.200", "Alibaba metadata"],
    ["fe80::1", "IPv6 link-local"],
    ["224.0.0.1", "IPv4 multicast"],
    ["ff02::1", "IPv6 multicast"],
    ["255.255.255.255", "broadcast"],
    ["240.0.0.1", "reserved"],
    ["not-an-ip", "garbage input"],
  ])("rejects %s (%s)", (address) => {
    expect(isAllowedProviderAddress(address)).toBe(false);
  });
});

describe("parseProviderUrl", () => {
  it("accepts an https API root and trims surrounding whitespace", () => {
    expect(parseProviderUrl("  https://api.openai.com/v1  ").href).toBe("https://api.openai.com/v1");
  });

  it("accepts a loopback proxy", () => {
    expect(parseProviderUrl("http://127.0.0.1:11434/v1").href).toBe("http://127.0.0.1:11434/v1");
  });

  it.each([
    [""],
    ["   "],
    ["not a url"],
    ["file:///etc/passwd"],
    ["ftp://example.com/v1"],
    ["javascript:alert(1)"],
    [`https://example.com/${"a".repeat(2100)}`],
  ])("rejects %s as an invalid URL", (input) => {
    expect(expectSyncError(() => parseProviderUrl(input))).toMatchObject({ status: 400, code: "INVALID_PROVIDER_URL" });
  });

  it("rejects a URL that carries credentials", () => {
    expect(expectSyncError(() => parseProviderUrl("https://user:secret@api.example.com/v1")))
      .toMatchObject({ status: 400, code: "PROVIDER_URL_CREDENTIALS" });
  });
});

describe("resolveProviderTarget", () => {
  it("rejects a metadata address literal without asking DNS", async () => {
    const lookup = lookupReturning([]);
    const error = await expectAppError(() => resolveProviderTarget("http://169.254.169.254/latest", { lookup }));
    expect(error).toMatchObject({ status: 403, code: "PROVIDER_TARGET_BLOCKED" });
    expect(lookup).not.toHaveBeenCalled();
  });

  it("keeps a loopback provider usable, unlike the public-web fetch policy", async () => {
    const target = await resolveProviderTarget("http://127.0.0.1:11434/v1");
    expect(target).toMatchObject({ address: "127.0.0.1", family: 4 });

    const webError = await expectAppError(() => resolvePublicTarget("http://127.0.0.1:11434/v1"));
    expect(webError).toMatchObject({ status: 403, code: "PRIVATE_TARGET" });
  });

  it("allows a hostname that resolves into the private network", async () => {
    const lookup = lookupReturning(["192.168.1.5"]);
    const target = await resolveProviderTarget("http://gateway.lan/v1", { lookup });
    expect(target).toMatchObject({ address: "192.168.1.5", family: 4 });
    expect(lookup).toHaveBeenCalledWith("gateway.lan", { all: true, verbatim: true });
  });

  it("rejects a hostname when any resolved address is blocked", async () => {
    const lookup = lookupReturning(["10.0.0.9", "169.254.169.254"]);
    const error = await expectAppError(() => resolveProviderTarget("http://metadata.internal/v1", { lookup }));
    expect(error).toMatchObject({ status: 403, code: "PROVIDER_TARGET_BLOCKED" });
  });

  it("maps DNS failure to a provider error", async () => {
    const lookup = vi.fn(async () => {
      throw new Error("ENOTFOUND");
    });
    const error = await expectAppError(() =>
      resolveProviderTarget("https://missing.example/v1", { lookup: lookup as never }));
    expect(error).toMatchObject({ status: 502, code: "TRANSLATE_PROVIDER_ERROR" });
  });
});

describe("fetchProviderEndpoint", () => {
  function jsonResponse(status: number, headers: Record<string, string> = {}) {
    return new Response(status === 200 ? "{}" : "", { status, headers });
  }

  it("follows a same-host redirect and validates every hop", async () => {
    const lookup = lookupReturning(["93.184.216.34"]);
    const fetchImpl = vi.fn<ProviderFetch>(async (input: URL) =>
      input.pathname === "/v1/models"
        ? jsonResponse(302, { location: "/v1/models/" })
        : jsonResponse(200));
    const response = await fetchProviderEndpoint(new URL("https://api.example.com/v1/models"), {}, {
      fetch: fetchImpl,
      lookup,
    });

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls.map(([input]) => (input as URL).href)).toEqual([
      "https://api.example.com/v1/models",
      "https://api.example.com/v1/models/",
    ]);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it("refuses a redirect to another host without calling it", async () => {
    const lookup = lookupReturning(["93.184.216.34"]);
    const fetchImpl = vi.fn(async () => jsonResponse(302, { location: "https://attacker.example/v1/models" }));
    const error = await expectAppError(() =>
      fetchProviderEndpoint(new URL("https://api.example.com/v1/models"), {}, {
        fetch: fetchImpl,
        lookup,
      }));

    expect(error).toMatchObject({ status: 502, code: "TRANSLATE_PROVIDER_ERROR" });
    expect(error.message).not.toContain("Bearer");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("refuses a redirect that downgrades the scheme on the same host", async () => {
    const lookup = lookupReturning(["93.184.216.34"]);
    const fetchImpl = vi.fn(async () => jsonResponse(307, { location: "http://api.example.com/v1/models" }));
    const error = await expectAppError(() =>
      fetchProviderEndpoint(new URL("https://api.example.com/v1/models"), {}, {
        fetch: fetchImpl,
        lookup,
      }));
    expect(error).toMatchObject({ status: 502, code: "TRANSLATE_PROVIDER_ERROR" });
  });

  it("stops after the redirect limit", async () => {
    const lookup = lookupReturning(["93.184.216.34"]);
    const fetchImpl = vi.fn<ProviderFetch>(async (input: URL) =>
      jsonResponse(302, { location: `${input.pathname}x` }));
    const error = await expectAppError(() =>
      fetchProviderEndpoint(new URL("https://api.example.com/v1/models"), {}, {
        fetch: fetchImpl,
        lookup,
      }));

    expect(error).toMatchObject({ status: 502, code: "TRANSLATE_PROVIDER_ERROR" });
    expect(fetchImpl).toHaveBeenCalledTimes(MAX_PROVIDER_REDIRECTS + 1);
  });

  it("returns a non-redirect response untouched", async () => {
    const lookup = lookupReturning(["93.184.216.34"]);
    const fetchImpl = vi.fn(async () => jsonResponse(500));
    const response = await fetchProviderEndpoint(new URL("https://api.example.com/v1/models"), {}, {
      fetch: fetchImpl,
      lookup,
    });
    expect(response.status).toBe(500);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
