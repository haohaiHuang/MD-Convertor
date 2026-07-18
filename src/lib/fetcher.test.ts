import { describe, expect, it, vi } from "vitest";
import { createPinnedLookup, readLimitedBody } from "./fetcher";

describe("pinned DNS lookup", () => {
  it("returns an address array when Node requests all addresses", () => {
    const callback = vi.fn();

    createPinnedLookup("203.0.113.10", 4)("cdn.example.com", { all: true }, callback);

    expect(callback).toHaveBeenCalledWith(null, [{ address: "203.0.113.10", family: 4 }]);
  });

  it("returns one address when Node requests the legacy lookup shape", () => {
    const callback = vi.fn();

    createPinnedLookup("2001:db8::10", 6)("cdn.example.com", { all: false }, callback);

    expect(callback).toHaveBeenCalledWith(null, "2001:db8::10", 6);
  });
});

function bodyWithSize(size: number): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(size));
      controller.close();
    },
  });
}

describe("response size boundary", () => {
  const imageLimit = 8 * 1024 * 1024;

  it("accepts a body exactly at the eight MiB image limit", async () => {
    const result = await readLimitedBody(bodyWithSize(imageLimit), imageLimit);
    expect(result.byteLength).toBe(imageLimit);
  });

  it("rejects a body one byte above the eight MiB image limit", async () => {
    await expect(readLimitedBody(bodyWithSize(imageLimit + 1), imageLimit)).rejects.toMatchObject({
      status: 413,
      code: "SOURCE_TOO_LARGE",
    });
  });
});
