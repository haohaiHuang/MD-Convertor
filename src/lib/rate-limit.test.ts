import { describe, expect, it } from "vitest";
import { acquireConversionSlot, clientIpFromHeaders } from "./rate-limit";

describe("conversion rate limiting", () => {
  it("releases active slots idempotently", () => {
    const first = acquireConversionSlot("release-test");
    const second = acquireConversionSlot("release-test");
    expect(() => acquireConversionSlot("release-test")).toThrowError(
      expect.objectContaining({ status: 429, code: "RATE_LIMITED" }),
    );

    first();
    first();
    const third = acquireConversionSlot("release-test");
    second();
    third();
  });

  it("enforces the rolling request count after released conversions", () => {
    for (let index = 0; index < 10; index += 1) {
      acquireConversionSlot("window-test")();
    }
    expect(() => acquireConversionSlot("window-test")).toThrowError(
      expect.objectContaining({ status: 429, code: "RATE_LIMITED" }),
    );
  });

  it("enforces and releases the global concurrency limit", () => {
    const releases = [1, 2, 3, 4].map((index) => acquireConversionSlot(`global-${index}`));
    expect(() => acquireConversionSlot("global-5")).toThrowError(
      expect.objectContaining({ status: 429, code: "SERVER_BUSY" }),
    );
    releases[0]();
    const replacement = acquireConversionSlot("global-5");
    for (const release of releases.slice(1)) release();
    replacement();
  });
});

describe("client address selection", () => {
  it("ignores forwarded headers unless the proxy is trusted", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.8" });
    expect(clientIpFromHeaders(headers)).toBe("direct-client");
  });
});
