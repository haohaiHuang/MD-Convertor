import { beforeEach, describe, expect, it, vi } from "vitest";

const dns = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: dns.lookup }));

import { resolvePublicTarget } from "./url";

beforeEach(() => dns.lookup.mockReset());

describe("public target resolution", () => {
  it("returns one validated public address for the connection", async () => {
    dns.lookup.mockResolvedValue([
      { address: "1.1.1.1", family: 4 },
      { address: "2606:4700:4700::1111", family: 6 },
    ]);
    await expect(resolvePublicTarget("https://example.com/article")).resolves.toMatchObject({
      address: "1.1.1.1",
      family: 4,
    });
  });

  it("rejects the whole hostname if any DNS answer is private", async () => {
    dns.lookup.mockResolvedValue([
      { address: "1.1.1.1", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);
    await expect(resolvePublicTarget("https://attacker.example")).rejects.toMatchObject({
      status: 403,
      code: "PRIVATE_TARGET",
    });
  });

  it("validates a literal address without another DNS lookup", async () => {
    await expect(resolvePublicTarget("https://8.8.8.8/path")).resolves.toMatchObject({
      address: "8.8.8.8",
      family: 4,
    });
    expect(dns.lookup).not.toHaveBeenCalled();
  });
});
