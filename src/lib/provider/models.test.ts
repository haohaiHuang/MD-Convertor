import type { LookupAddress } from "node:dns";
import { describe, expect, it, vi } from "vitest";
import type { AppError } from "@/lib/errors";
import type { ProviderFetch, ProviderLookup } from "./endpoint";
import { listProviderModels } from "./models";

const API_KEY = "sk-super-secret-value";

function lookupOk(address = "93.184.216.34") {
  return vi.fn<ProviderLookup>(async () => [{ address, family: 4 }] as LookupAddress[]);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
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

describe("listProviderModels", () => {
  it("reads model ids from an OpenAI-compatible endpoint", async () => {
    const fetchImpl = vi.fn<ProviderFetch>(async () => jsonResponse({ object: "list", data: [{ id: "gpt-4o" }, { id: "o4-mini" }] }));
    const models = await listProviderModels({
      baseUrl: "https://api.example.com/v1",
      apiKey: API_KEY,
      deps: { fetch: fetchImpl as unknown as typeof fetch, lookup: lookupOk() },
    });

    expect(models).toEqual(["gpt-4o", "o4-mini"]);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url.href).toBe("https://api.example.com/v1/models");
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${API_KEY}`);
    expect(init.method).toBe("GET");
  });

  it("tolerates a trailing slash on the configured base URL", async () => {
    const fetchImpl = vi.fn<ProviderFetch>(async () => jsonResponse({ data: [{ id: "gpt-4o" }] }));
    await listProviderModels({
      baseUrl: "http://127.0.0.1:11434/v1/",
      apiKey: API_KEY,
      deps: { fetch: fetchImpl as unknown as typeof fetch },
    });
    expect(fetchImpl.mock.calls[0][0].href).toBe("http://127.0.0.1:11434/v1/models");
  });

  it("deduplicates and drops unusable entries", async () => {
    const fetchImpl = vi.fn<ProviderFetch>(async () =>
      jsonResponse({ data: [{ id: "a" }, { id: "a" }, { id: "" }, { id: 42 }, {}, null, { id: " b " }] }));
    const models = await listProviderModels({
      baseUrl: "https://api.example.com/v1",
      apiKey: API_KEY,
      deps: { fetch: fetchImpl as unknown as typeof fetch, lookup: lookupOk() },
    });
    expect(models).toEqual(["a", "b"]);
  });

  it("returns an empty list when the provider offers no models", async () => {
    const fetchImpl = vi.fn<ProviderFetch>(async () => jsonResponse({ data: [] }));
    await expect(listProviderModels({
      baseUrl: "https://api.example.com/v1",
      apiKey: API_KEY,
      deps: { fetch: fetchImpl as unknown as typeof fetch, lookup: lookupOk() },
    })).resolves.toEqual([]);
  });

  it("requires a resolved key", async () => {
    const fetchImpl = vi.fn<ProviderFetch>(async () => jsonResponse({ data: [] }));
    const error = await expectAppError(() => listProviderModels({
      baseUrl: "https://api.example.com/v1",
      apiKey: "   ",
      deps: { fetch: fetchImpl as unknown as typeof fetch, lookup: lookupOk() },
    }));

    expect(error).toMatchObject({ status: 409, code: "TRANSLATE_NOT_CONFIGURED" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps a provider error status to a redacted message", async () => {
    const fetchImpl = vi.fn<ProviderFetch>(async () => new Response(`unauthorized ${API_KEY}`, { status: 401 }));
    const error = await expectAppError(() => listProviderModels({
      baseUrl: "https://api.example.com/v1",
      apiKey: API_KEY,
      deps: { fetch: fetchImpl as unknown as typeof fetch, lookup: lookupOk() },
    }));

    expect(error).toMatchObject({ status: 502, code: "TRANSLATE_PROVIDER_ERROR" });
    expect(error.message).toContain("401");
    expect(error.message).toContain("api.example.com");
    expect(error.message).not.toContain(API_KEY);
    expect(error.message).not.toContain("unauthorized");
  });

  it.each([
    ["a malformed body", new Response("not json", { status: 200 })],
    ["a missing data array", jsonResponse({ object: "list" })],
  ])("maps %s to a provider error", async (_label, response) => {
    const fetchImpl = vi.fn<ProviderFetch>(async () => response);
    const error = await expectAppError(() => listProviderModels({
      baseUrl: "https://api.example.com/v1",
      apiKey: API_KEY,
      deps: { fetch: fetchImpl as unknown as typeof fetch, lookup: lookupOk() },
    }));
    expect(error).toMatchObject({ status: 502, code: "TRANSLATE_PROVIDER_ERROR" });
    expect(error.message).not.toContain(API_KEY);
  });

  it("maps a network failure to a provider error", async () => {
    const fetchImpl = vi.fn<ProviderFetch>(async () => {
      throw Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:9"), { name: "TypeError" });
    });
    const error = await expectAppError(() => listProviderModels({
      baseUrl: "http://127.0.0.1:9/v1",
      apiKey: API_KEY,
      deps: { fetch: fetchImpl as unknown as typeof fetch },
    }));
    expect(error).toMatchObject({ status: 502, code: "TRANSLATE_PROVIDER_ERROR" });
    expect(error.message).not.toContain(API_KEY);
  });

  it("maps an aborted request to a provider error", async () => {
    const fetchImpl = vi.fn<ProviderFetch>(async () => {
      throw Object.assign(new Error("This operation was aborted"), { name: "AbortError" });
    });
    const error = await expectAppError(() => listProviderModels({
      baseUrl: "https://api.example.com/v1",
      apiKey: API_KEY,
      deps: { fetch: fetchImpl as unknown as typeof fetch, lookup: lookupOk() },
    }));
    expect(error).toMatchObject({ status: 502, code: "TRANSLATE_PROVIDER_ERROR" });
  });

  it("refuses a cross-host redirect", async () => {
    const fetchImpl = vi.fn<ProviderFetch>(async () =>
      new Response(null, { status: 302, headers: { location: "https://attacker.example/v1/models" } }));
    const error = await expectAppError(() => listProviderModels({
      baseUrl: "https://api.example.com/v1",
      apiKey: API_KEY,
      deps: { fetch: fetchImpl as unknown as typeof fetch, lookup: lookupOk() },
    }));
    expect(error).toMatchObject({ status: 502, code: "TRANSLATE_PROVIDER_ERROR" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects a blocked endpoint before sending the key anywhere", async () => {
    const fetchImpl = vi.fn<ProviderFetch>(async () => jsonResponse({ data: [] }));
    const error = await expectAppError(() => listProviderModels({
      baseUrl: "http://169.254.169.254/latest/meta-data",
      apiKey: API_KEY,
      deps: { fetch: fetchImpl as unknown as typeof fetch },
    }));
    expect(error).toMatchObject({ status: 403, code: "PROVIDER_TARGET_BLOCKED" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
