import { describe, expect, it, vi } from "vitest";
import { resolvePinnedTunnelTarget } from "./browser-proxy";
import type { ResolvedTarget } from "./security/url";

describe("browser proxy DNS pinning", () => {
  it("connects to the validated address instead of resolving the hostname again", async () => {
    let reboundAddress = "93.184.216.34";
    const resolver = vi.fn(async (input: string | URL): Promise<ResolvedTarget> => {
      const url = new URL(input.toString());
      const result = { url, address: reboundAddress, family: 4 as const };
      reboundAddress = "127.0.0.1";
      return result;
    });

    const target = await resolvePinnedTunnelTarget("attacker.example:443", resolver);

    expect(resolver).toHaveBeenCalledOnce();
    expect(target.options).toMatchObject({
      host: "93.184.216.34",
      port: 443,
      family: 4,
    });
    expect(target.options.host).not.toBe(reboundAddress);
  });

  it("rejects an invalid tunnel port before connecting", async () => {
    const resolver = vi.fn();
    await expect(resolvePinnedTunnelTarget("example.com:99999", resolver)).rejects.toMatchObject({
      status: 400,
    });
    expect(resolver).not.toHaveBeenCalled();
  });

});
