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
const linkImageStrategy = {
  mode: "link",
  sourcePriority: "src-first",
  allowDataUri: false,
} as const;
const pasteImageStrategy = {
  mode: "paste",
  sourcePriority: "lazy-first",
  allowDataUri: true,
} as const;

describe("image embedding", () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
      linkImageStrategy,
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
      linkImageStrategy,
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
      linkImageStrategy,
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
      linkImageStrategy,
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
      linkImageStrategy,
    );
    expect(result.warnings.some((warning) => warning.code === "IMAGE_TYPE_UNSUPPORTED")).toBe(true);
    expect(result.stats).toEqual({ sourceImageCount: 1, embeddedImageCount: 0, omittedImageCount: 1 });
  });

  it("rejects a remote SVG payload disguised as a supported raster image", async () => {
    vi.mocked(fetchPublicResource).mockResolvedValueOnce({
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'),
      contentType: "image/png",
      finalUrl: new URL("https://cdn.example.com/disguised.png"),
    });

    const result = await embedImages(
      '<img src="/disguised.png" alt="伪装矢量图">',
      "https://example.com/article",
      new AbortController().signal,
      1024 * 1024,
      linkImageStrategy,
    );

    expect(result.html).toContain("图片：伪装矢量图");
    expect(result.html).not.toContain("data:image/png;base64,");
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "IMAGE_TYPE_UNSUPPORTED" }));
    expect(result.stats).toEqual({ sourceImageCount: 1, embeddedImageCount: 0, omittedImageCount: 1 });
  });

  it("embeds at most thirty images", async () => {
    const html = Array.from({ length: 31 }, (_, index) => `<img src="/${index}.png" alt="图${index}">`).join("");
    const result = await embedImages(
      html,
      "https://example.com/article",
      new AbortController().signal,
      1024 * 1024,
      linkImageStrategy,
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
      linkImageStrategy,
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
      linkImageStrategy,
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

  it("prefers a lazy source over a placeholder src in paste mode", async () => {
    const result = await embedImages(
      '<img src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" data-src="/real.png" alt="懒加载图片">',
      "https://example.com/article",
      new AbortController().signal,
      1024 * 1024,
      pasteImageStrategy,
    );

    expect(fetchPublicResource).toHaveBeenCalledWith(
      new URL("https://example.com/real.png"),
      expect.objectContaining({ maxBytes: 8 * 1024 * 1024 }),
    );
    expect(result.html).toContain("data:image/png;base64,");
    expect(result.warnings).toHaveLength(0);
  });

  it("uses data-lazy-src when data-src is absent", async () => {
    const result = await embedImages(
      '<img src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" data-lazy-src="/real-lazy.png" alt="第二懒加载图片">',
      "https://example.com/article",
      new AbortController().signal,
      1024 * 1024,
      pasteImageStrategy,
    );

    expect(fetchPublicResource).toHaveBeenCalledWith(
      new URL("https://example.com/real-lazy.png"),
      expect.objectContaining({ maxBytes: 8 * 1024 * 1024 }),
    );
    expect(result.html).toContain("data:image/png;base64,");
    expect(result.warnings).toHaveLength(0);
  });

  it("validates and embeds a lazy data URI in paste mode", async () => {
    const dataUri = `data:image/png;base64,${onePixelPng.toString("base64")}`;
    const result = await embedImages(
      `<img src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" data-src="${dataUri}" alt="内嵌图片">`,
      "https://example.com/article",
      new AbortController().signal,
      1024 * 1024,
      pasteImageStrategy,
    );

    expect(result.html).toContain(`src="${dataUri}"`);
    expect(result.warnings).toHaveLength(0);
    expect(fetchPublicResource).not.toHaveBeenCalled();
  });

  it.each([
    ["image/jpeg", "jpeg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
    ["image/gif", "gif"],
    ["image/avif", "avif"],
  ] as const)("embeds paste data URI format %s", async (contentType, format) => {
    const image = await sharp({
      create: { width: 2, height: 2, channels: 4, background: { r: 20, g: 40, b: 60, alpha: 1 } },
    }).toFormat(format).toBuffer();
    const result = await embedImages(
      `<img data-src="data:${contentType};base64,${image.toString("base64")}" alt="粘贴格式">`,
      "https://example.com/article",
      new AbortController().signal,
      1024 * 1024,
      pasteImageStrategy,
    );

    expect(result.html).toContain(`data:${contentType};base64,`);
    expect(result.stats.embeddedImageCount).toBe(1);
    expect(result.warnings).toHaveLength(0);
    expect(fetchPublicResource).not.toHaveBeenCalled();
  });

  it("rejects a HEIF payload declared as AVIF when Sharp reports non-AV1 compression", async () => {
    const avif = await sharp({
      create: { width: 2, height: 2, channels: 4, background: { r: 20, g: 40, b: 60, alpha: 1 } },
    }).avif().toBuffer();
    const metadata = vi.fn().mockResolvedValue({
      format: "heif",
      compression: "hevc",
      width: 2,
      height: 2,
    });
    const fakeSharp = vi.fn(() => ({ metadata }));
    vi.doMock("sharp", () => ({ default: fakeSharp }));
    vi.resetModules();

    try {
      const { embedImages: isolatedEmbedImages } = await import("./images");
      const result = await isolatedEmbedImages(
        `<img data-src="data:image/avif;base64,${avif.toString("base64")}" alt="HEIF 伪装">`,
        "https://example.com/article",
        new AbortController().signal,
        1024 * 1024,
        pasteImageStrategy,
      );

      expect(result.html).toContain("图片：HEIF 伪装");
      expect(result.warnings).toContainEqual(expect.objectContaining({ code: "IMAGE_DATA_INVALID" }));
    } finally {
      vi.doUnmock("sharp");
      vi.resetModules();
    }
  });

  it("accepts a case-insensitive data URI scheme for lazy images", async () => {
    const dataUri = `DATA:image/png;base64,${onePixelPng.toString("base64")}`;
    const result = await embedImages(
      `<img data-lazy-src="${dataUri}" alt="大小写 URI">`,
      "https://example.com/article",
      new AbortController().signal,
      1024 * 1024,
      pasteImageStrategy,
    );

    expect(result.html).toContain("data:image/png;base64,");
    expect(result.warnings).toHaveLength(0);
    expect(fetchPublicResource).not.toHaveBeenCalled();
  });

  it("fetches absolute images without a source URL and degrades relative images", async () => {
    const result = await embedImages(
      '<img src="https://cdn.example.com/absolute.png" alt="绝对图片"><img src="/relative.png" alt="相对图片">',
      undefined,
      new AbortController().signal,
      1024 * 1024,
      pasteImageStrategy,
    );

    expect(fetchPublicResource).toHaveBeenCalledWith(
      new URL("https://cdn.example.com/absolute.png"),
      expect.objectContaining({ maxBytes: 8 * 1024 * 1024 }),
    );
    expect(fetchPublicResource).toHaveBeenCalledTimes(1);
    expect(result.html).toContain("data:image/png;base64,");
    expect(result.html).toContain("图片：相对图片");
    expect(result.warnings.some((warning) => warning.code === "IMAGE_SOURCE_INVALID")).toBe(true);
  });

  it("does not fall back when a lazy source attribute is blank", async () => {
    const result = await embedImages(
      '<img src="/placeholder.png" data-src="   " alt="空懒加载地址">',
      "https://example.com/article",
      new AbortController().signal,
      1024 * 1024,
      pasteImageStrategy,
    );

    expect(fetchPublicResource).not.toHaveBeenCalled();
    expect(result.html).toContain("图片：空懒加载地址");
    expect(result.warnings.some((warning) => warning.code === "IMAGE_SOURCE_INVALID")).toBe(true);
  });

  it("rejects malformed Base64 and mismatched data image formats", async () => {
    const result = await embedImages(
      '<img data-src="data:image/png;base64,not?base64" alt="非法编码"><img data-src="data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nKAAAAAASUVORK5CYII=" alt="格式不符">',
      "https://example.com/article",
      new AbortController().signal,
      1024 * 1024,
      pasteImageStrategy,
    );

    expect(result.html).toContain("图片：非法编码");
    expect(result.html).toContain("图片：格式不符");
    expect(result.warnings.filter((warning) => warning.code === "IMAGE_DATA_INVALID")).toHaveLength(2);
    expect(fetchPublicResource).not.toHaveBeenCalled();
  });

  it("rejects data images whose decoded bytes exceed eight MiB", async () => {
    const payload = Buffer.alloc(8 * 1024 * 1024 + 1).toString("base64");
    const result = await embedImages(
      `<img data-src="data:image/png;base64,${payload}" alt="超大内嵌图">`,
      "https://example.com/article",
      new AbortController().signal,
      1024 * 1024,
      pasteImageStrategy,
    );

    expect(result.html).toContain("图片：超大内嵌图");
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "IMAGE_DATA_INVALID" }));
    expect(fetchPublicResource).not.toHaveBeenCalled();
  });

  it("treats only a tiny src data image as an unloaded placeholder", async () => {
    const dataUri = `data:image/png;base64,${onePixelPng.toString("base64")}`;
    const result = await embedImages(
      `<img src="${dataUri}" alt="占位图"><img data-src="${dataUri}" alt="懒加载图">`,
      "https://example.com/article",
      new AbortController().signal,
      1024 * 1024,
      pasteImageStrategy,
    );

    expect(result.html).toContain("图片：占位图");
    expect(result.html).toContain(`src="${dataUri}"`);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "IMAGE_PLACEHOLDER" }));
    expect(result.stats).toEqual({ sourceImageCount: 2, embeddedImageCount: 1, omittedImageCount: 1 });
  });

  it("optimizes oversized paste data images to WebP", async () => {
    const widePng = await sharp({
      create: { width: 2049, height: 1, channels: 4, background: { r: 20, g: 40, b: 60, alpha: 1 } },
    }).png().toBuffer();
    const result = await embedImages(
      `<img data-src="data:image/png;base64,${widePng.toString("base64")}" alt="宽内嵌图">`,
      "https://example.com/article",
      new AbortController().signal,
      1024 * 1024,
      pasteImageStrategy,
    );

    expect(result.html).toContain("data:image/webp;base64,");
    expect(result.warnings).toHaveLength(0);
  });

  it("reduces an oversized animated paste data image to its first frame", async () => {
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
    const result = await embedImages(
      `<img data-src="data:image/gif;base64,${animatedGif.toString("base64")}" alt="动图">`,
      "https://example.com/article",
      new AbortController().signal,
      1024 * 1024,
      pasteImageStrategy,
    );

    expect(result.html).toContain("data:image/webp;base64,");
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "ANIMATION_REDUCED" }));
  });

  it.each(["file:///tmp/photo.png", "blob:https://example.com/id", "javascript:alert(1)"])(
    "rejects unsupported image protocol %s",
    async (source) => {
      const result = await embedImages(
        `<img src="${source}" alt="非法协议">`,
        "https://example.com/article",
        new AbortController().signal,
        1024 * 1024,
        pasteImageStrategy,
      );

      expect(result.html).toContain("图片：非法协议");
      expect(result.warnings).toContainEqual(expect.objectContaining({ code: "IMAGE_SOURCE_INVALID" }));
      expect(fetchPublicResource).not.toHaveBeenCalled();
    },
  );

  it("keeps link-mode data URI sources skipped", async () => {
    const dataUri = `data:image/png;base64,${onePixelPng.toString("base64")}`;
    const result = await embedImages(
      `<img src="${dataUri}" alt="链接模式内嵌图">`,
      "https://example.com/article",
      new AbortController().signal,
      1024 * 1024,
      linkImageStrategy,
    );

    expect(result.html).toContain("图片：链接模式内嵌图");
    expect(result.html).not.toContain("data:image/");
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "IMAGE_SOURCE_MISSING" }));
    expect(fetchPublicResource).not.toHaveBeenCalled();
  });

  it.each([
    "https://",
    "file:///tmp/photo.png",
    "blob:https://example.com/id",
    "javascript:alert(1)",
    "DATA:image/png;base64,AAAA",
  ])("keeps link-mode fetch failures for an invalid source %s", async (source) => {
    vi.mocked(fetchPublicResource).mockRejectedValueOnce(new Error("source rejected"));
    const result = await embedImages(
      `<img src="${source}" alt="链接失败">`,
      "https://example.com/article",
      new AbortController().signal,
      1024 * 1024,
      linkImageStrategy,
    );

    expect(result.html).toContain("图片：链接失败");
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "IMAGE_FETCH_FAILED" }));
  });

  it.each([
    "http://127.0.0.1/private.png",
    "http://192.168.0.1/private.png",
    "http://169.254.169.254/latest/meta-data/",
  ])("passes paste remote target %s to the SSRF-protected fetcher", async (source) => {
    vi.mocked(fetchPublicResource).mockRejectedValueOnce(new Error("private target rejected"));
    const result = await embedImages(
      `<img src="${source}" alt="私网图片">`,
      undefined,
      new AbortController().signal,
      1024 * 1024,
      pasteImageStrategy,
    );

    expect(fetchPublicResource).toHaveBeenCalledWith(
      new URL(source),
      expect.objectContaining({ maxBytes: 8 * 1024 * 1024 }),
    );
    expect(result.html).toContain("图片：私网图片");
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "IMAGE_FETCH_FAILED" }));
  });

  it("does not retry a placeholder src when a lazy fetch fails", async () => {
    vi.mocked(fetchPublicResource).mockRejectedValueOnce(new Error("lazy fetch failed"));
    const result = await embedImages(
      '<img src="https://example.com/placeholder.png" data-src="https://cdn.example.com/real.png" alt="真实图片">',
      "https://example.com/article",
      new AbortController().signal,
      1024 * 1024,
      pasteImageStrategy,
    );

    expect(fetchPublicResource).toHaveBeenCalledWith(
      new URL("https://cdn.example.com/real.png"),
      expect.objectContaining({ maxBytes: 8 * 1024 * 1024 }),
    );
    expect(fetchPublicResource).toHaveBeenCalledTimes(1);
    expect(result.html).toContain("图片：真实图片");
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "IMAGE_FETCH_FAILED" }));
  });

  it("propagates cancellation from an image fetch", async () => {
    const controller = new AbortController();
    vi.mocked(fetchPublicResource).mockImplementationOnce(async (_url, options) => {
      controller.abort();
      options.signal.throwIfAborted();
      return {
        buffer: onePixelPng,
        contentType: "image/png",
        finalUrl: new URL("https://cdn.example.com/photo.png"),
      };
    });

    await expect(embedImages(
      '<img src="/photo.png" alt="取消图片">',
      "https://example.com/article",
      controller.signal,
      1024 * 1024,
      linkImageStrategy,
    )).rejects.toThrow();
  });

  it("counts embedded paste data URI bytes against the image budget", async () => {
    const dataUri = `data:image/png;base64,${onePixelPng.toString("base64")}`;
    const result = await embedImages(
      `<img data-src="${dataUri}" alt="预算图片">`,
      "https://example.com/article",
      new AbortController().signal,
      1,
      pasteImageStrategy,
    );

    expect(result.html).toContain("图片：预算图片");
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "IMAGE_BUDGET_EXCEEDED" }));
    expect(result.stats).toEqual({ sourceImageCount: 1, embeddedImageCount: 0, omittedImageCount: 1 });
  });
});
