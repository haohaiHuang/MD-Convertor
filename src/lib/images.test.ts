import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { AppError } from "./errors";
import { embedImages, omitLastEmbeddedImage, shouldOptimizeImage } from "./images";
import { fetchPublicResource } from "./fetcher";

vi.mock("./fetcher", () => ({
  fetchPublicResource: vi.fn(),
}));

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nKAAAAAASUVORK5CYII=",
  "base64",
);

describe("image embedding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchPublicResource).mockResolvedValue({
      buffer: onePixelPng,
      contentType: "image/png",
      finalUrl: new URL("https://cdn.example.com/photo.png"),
    });
  });

  it("embeds supported images as a data URI", async () => {
    const result = await embedImages(
      '<p><img src="/photo.png" alt="示例图片"></p>',
      "https://example.com/article",
      new AbortController().signal,
      1024 * 1024,
    );
    expect(result.html).toContain("data:image/png;base64,");
    expect(result.warnings).toHaveLength(0);
    expect(result.stats).toEqual({ sourceImageCount: 1, embeddedImageCount: 1, omittedImageCount: 0 });
    expect(fetchPublicResource).toHaveBeenCalledWith(
      new URL("https://example.com/photo.png"),
      expect.objectContaining({ maxBytes: 8 * 1024 * 1024 }),
    );
  });

  it.each([
    ["image/jpeg", "jpeg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
    ["image/gif", "gif"],
    ["image/avif", "avif"],
  ] as const)("embeds the supported %s format", async (contentType, format) => {
    const image = await sharp({
      create: { width: 2, height: 2, channels: 4, background: { r: 20, g: 40, b: 60, alpha: 1 } },
    }).toFormat(format).toBuffer();
    vi.mocked(fetchPublicResource).mockResolvedValueOnce({
      buffer: image,
      contentType,
      finalUrl: new URL(`https://cdn.example.com/image.${format}`),
    });

    const result = await embedImages(
      `<img src="/image.${format}" alt="格式测试">`,
      "https://example.com/article",
      new AbortController().signal,
      1024 * 1024,
    );

    expect(result.html).toContain(`data:${contentType};base64,`);
    expect(result.stats.embeddedImageCount).toBe(1);
  });

  it("keeps alt text when the file budget is exhausted", async () => {
    const result = await embedImages(
      '<img src="/photo.png" alt="示例图片">',
      "https://example.com/article",
      new AbortController().signal,
      1,
    );
    expect(result.html).toContain("图片：示例图片");
    expect(result.html).not.toContain("data:image/");
    expect(result.warnings.some((warning) => warning.code === "IMAGE_BUDGET_EXCEEDED")).toBe(true);
    expect(result.stats.omittedImageCount).toBe(1);
  });

  it("reports oversized source images separately", async () => {
    vi.mocked(fetchPublicResource).mockRejectedValueOnce(
      new AppError(413, "SOURCE_TOO_LARGE", "too large"),
    );
    const result = await embedImages(
      '<img src="/large.png" alt="超大图片">',
      "https://example.com/article",
      new AbortController().signal,
      1024 * 1024,
    );
    expect(result.warnings.some((warning) => warning.code === "IMAGE_TOO_LARGE")).toBe(true);
    expect(result.html).toContain("图片：超大图片");
  });

  it("keeps alt text for unsupported image formats", async () => {
    vi.mocked(fetchPublicResource).mockResolvedValueOnce({
      buffer: Buffer.from("<svg></svg>"),
      contentType: "image/svg+xml",
      finalUrl: new URL("https://cdn.example.com/image.svg"),
    });
    const result = await embedImages(
      '<img src="/image.svg" alt="矢量图">',
      "https://example.com/article",
      new AbortController().signal,
      1024 * 1024,
    );
    expect(result.warnings.some((warning) => warning.code === "IMAGE_TYPE_UNSUPPORTED")).toBe(true);
    expect(result.stats).toEqual({ sourceImageCount: 1, embeddedImageCount: 0, omittedImageCount: 1 });
  });

  it("embeds at most thirty images", async () => {
    const html = Array.from({ length: 31 }, (_, index) => `<img src="/${index}.png" alt="图${index}">`).join("");
    const result = await embedImages(
      html,
      "https://example.com/article",
      new AbortController().signal,
      1024 * 1024,
    );
    expect(result.stats).toEqual({ sourceImageCount: 31, embeddedImageCount: 30, omittedImageCount: 1 });
    expect(result.warnings.some((warning) => warning.code === "IMAGE_COUNT_LIMIT")).toBe(true);
    expect(fetchPublicResource).toHaveBeenCalledTimes(30);
  });

  it("converts images wider than 2048 pixels to WebP", async () => {
    const widePng = await sharp({
      create: { width: 2049, height: 1, channels: 4, background: { r: 20, g: 40, b: 60, alpha: 1 } },
    }).png().toBuffer();
    vi.mocked(fetchPublicResource).mockResolvedValueOnce({
      buffer: widePng,
      contentType: "image/png",
      finalUrl: new URL("https://cdn.example.com/wide.png"),
    });
    const result = await embedImages(
      '<img src="/wide.png" alt="宽图">',
      "https://example.com/article",
      new AbortController().signal,
      1024 * 1024,
    );
    expect(result.html).toContain("data:image/webp;base64,");
  });

  it("applies the two MiB optimization boundary exactly", () => {
    expect(shouldOptimizeImage(2 * 1024 * 1024, 2048, 2048)).toBe(false);
    expect(shouldOptimizeImage(2 * 1024 * 1024 + 1, 2048, 2048)).toBe(true);
  });

  it("reduces oversized animations to the first frame", async () => {
    const pixels = Buffer.alloc(2049 * 4 * 4);
    for (let pixel = 0; pixel < 2049 * 4; pixel += 1) {
      const offset = pixel * 4;
      pixels[offset] = pixel < 2049 * 2 ? 255 : 0;
      pixels[offset + 2] = pixel < 2049 * 2 ? 0 : 255;
      pixels[offset + 3] = 255;
    }
    const animatedGif = await sharp(pixels, {
      raw: { width: 2049, height: 4, channels: 4, pageHeight: 2 },
    }).gif({ delay: [100, 100], loop: 0 }).toBuffer();
    vi.mocked(fetchPublicResource).mockResolvedValueOnce({
      buffer: animatedGif,
      contentType: "image/gif",
      finalUrl: new URL("https://cdn.example.com/animated.gif"),
    });
    const result = await embedImages(
      '<img src="/animated.gif" alt="动图">',
      "https://example.com/article",
      new AbortController().signal,
      1024 * 1024,
    );
    expect(result.html).toContain("data:image/webp;base64,");
    expect(result.warnings.some((warning) => warning.code === "ANIMATION_REDUCED")).toBe(true);
  });

  it("removes the last embedded image first", () => {
    const result = omitLastEmbeddedImage(
      '<img src="data:image/png;base64,AAAA" alt="第一张"><img src="data:image/png;base64,BBBB" alt="第二张">',
    );
    expect(result.omitted).toBe(true);
    expect(result.html).toContain("data:image/png;base64,AAAA");
    expect(result.html).not.toContain("data:image/png;base64,BBBB");
    expect(result.html).toContain("图片：第二张");
  });
});
