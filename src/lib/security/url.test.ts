import { describe, expect, it } from "vitest";
import { isPublicIpAddress, parsePublicHttpUrl } from "./url";

describe("URL security", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "0.0.0.0",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("rejects non-public address %s", (address) => {
    expect(isPublicIpAddress(address)).toBe(false);
  });

  it.each(["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])(
    "accepts public unicast address %s",
    (address) => expect(isPublicIpAddress(address)).toBe(true),
  );

  it("rejects unsafe schemes and credentials", () => {
    expect(() => parsePublicHttpUrl("file:///etc/passwd")).toThrow();
    expect(() => parsePublicHttpUrl("https://user:pass@example.com")).toThrow();
    expect(() => parsePublicHttpUrl("http://localhost/test")).toThrow();
  });

  it("normalizes a public HTTP URL", () => {
    expect(parsePublicHttpUrl(" https://example.com/article ").toString()).toBe(
      "https://example.com/article",
    );
  });
});
