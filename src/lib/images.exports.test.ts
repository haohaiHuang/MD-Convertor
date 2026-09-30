import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { MAX_IMAGES, MAX_SOURCE_IMAGE_BYTES, embedImageBuffer, mapWithConcurrency } from "./images";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nKAAAAAASUVORK5CYII=",
  "base64",
);

describe("embedImageBuffer", () => {
  it("turns a supported buffer into a data URI", async () => {
    const result = await embedImageBuffer(onePixelPng, "image/png");

    expect(result.dataUri).toBe(`data:image/png;base64,${onePixelPng.toString("base64")}`);
    expect(result.warning).toBeUndefined();
  });

  it("reports a declared format that does not match the bytes", async () => {
    const result = await embedImageBuffer(onePixelPng, "image/jpeg");

    expect(result.dataUri).toBeUndefined();
    expect(result.warning?.code).toBe("IMAGE_TYPE_UNSUPPORTED");
  });

  it("re-encodes an oversized image to WebP", async () => {
    const wide = await sharp({
      create: { width: 2049, height: 1, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 1 } },
    }).png().toBuffer();

    const result = await embedImageBuffer(wide, "image/png");

    expect(result.dataUri?.startsWith("data:image/webp;base64,")).toBe(true);
  });
});

describe("exported image limits", () => {
  it("exposes the same limits the web-page embedding uses", () => {
    expect(MAX_IMAGES).toBe(30);
    expect(MAX_SOURCE_IMAGE_BYTES).toBe(8 * 1024 * 1024);
  });
});

describe("mapWithConcurrency", () => {
  it("never exceeds the limit and keeps the input order", async () => {
    let running = 0;
    let peak = 0;

    const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 1));
      running -= 1;
      return value * 2;
    });

    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});
