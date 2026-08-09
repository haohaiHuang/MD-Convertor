import { JSDOM } from "jsdom";
import sharp from "sharp";
import { AppError } from "@/lib/errors";
import { fetchPublicResource } from "@/lib/fetcher";
import type { ConversionWarning } from "@/types/conversion";

const MAX_IMAGES = 30;
const MAX_SOURCE_IMAGE_BYTES = 8 * 1024 * 1024;
const OPTIMIZE_THRESHOLD_BYTES = 2 * 1024 * 1024;
const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const DATA_URI_TYPES = new Map<string, { format: string; compression?: string }>([
  ["image/jpeg", { format: "jpeg" }],
  ["image/png", { format: "png" }],
  ["image/webp", { format: "webp" }],
  ["image/gif", { format: "gif" }],
  ["image/avif", { format: "heif", compression: "av1" }],
]);

export function shouldOptimizeImage(byteLength: number, width = 0, height = 0): boolean {
  return byteLength > OPTIMIZE_THRESHOLD_BYTES || width > 2048 || height > 2048;
}

type PreparedImage = {
  element: HTMLImageElement;
  dataUri?: string;
  warning?: ConversionWarning;
  animatedReduced?: boolean;
};

export type ImageEmbeddingStats = {
  sourceImageCount: number;
  embeddedImageCount: number;
  omittedImageCount: number;
};

export type ImageEmbeddingStrategy =
  | {
      mode: "link";
      sourcePriority: "src-first";
      allowDataUri: false;
    }
  | {
      mode: "paste";
      sourcePriority: "lazy-first";
      allowDataUri: true;
    };

function imagePlaceholder(element: HTMLImageElement): Text {
  const label = element.alt.trim() || "图片";
  return element.ownerDocument.createTextNode(`[图片：${label}]`);
}

function parseDataUri(rawSource: string): { buffer: Buffer; contentType: string } | null {
  const match = /^data:(image\/(?:jpeg|png|webp|gif|avif));base64,([A-Za-z0-9+/]*={0,2})$/i.exec(rawSource);
  if (!match) return null;
  const contentType = match[1].toLowerCase();
  const payload = match[2];
  if (!payload || payload.length % 4 !== 0 || payload.length > Math.ceil((MAX_SOURCE_IMAGE_BYTES * 4) / 3) + 4) {
    return null;
  }
  const buffer = Buffer.from(payload, "base64");
  if (!buffer.byteLength || buffer.byteLength > MAX_SOURCE_IMAGE_BYTES || buffer.toString("base64") !== payload) {
    return null;
  }
  return { buffer, contentType };
}

type ProcessedImage = {
  dataUri?: string;
  warning?: ConversionWarning;
  animatedReduced?: boolean;
};

async function processImageBuffer(
  buffer: Buffer,
  contentType: string,
  options: {
    validateDeclaredFormat: boolean;
    placeholderEligible: boolean;
    invalidFormatWarning?: ConversionWarning;
  },
): Promise<ProcessedImage> {
  const metadata = await sharp(buffer, { animated: true }).metadata();
  if (options.validateDeclaredFormat) {
    const expected = DATA_URI_TYPES.get(contentType);
    if (!expected || metadata.format !== expected.format ||
      (expected.compression && metadata.compression !== expected.compression)) {
      return {
        warning: options.invalidFormatWarning ?? {
          code: "IMAGE_DATA_INVALID",
          message: "有一张内嵌图片格式与声明不一致，已保留替代文本。",
        },
      };
    }
  }
  if (options.placeholderEligible && buffer.byteLength < 1024) {
    return {
      warning: { code: "IMAGE_PLACEHOLDER", message: "图片未在浏览器中加载，请滚动到图片位置后重新复制。" },
    };
  }

  let outputBuffer = buffer;
  let outputType = contentType;
  let animatedReduced = false;
  const needsOptimization = shouldOptimizeImage(
    buffer.byteLength,
    metadata.width ?? 0,
    metadata.height ?? 0,
  );
  if (needsOptimization) {
    animatedReduced = (metadata.pages ?? 1) > 1;
    outputBuffer = await sharp(buffer, { page: 0 })
      .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    outputType = "image/webp";
  }
  return {
    dataUri: `data:${outputType};base64,${outputBuffer.toString("base64")}`,
    animatedReduced,
  };
}

async function prepareDataUriImage(
  element: HTMLImageElement,
  rawSource: string,
  signal: AbortSignal,
  placeholderEligible: boolean,
): Promise<PreparedImage> {
  const parsed = parseDataUri(rawSource);
  if (!parsed) {
    return {
      element,
      warning: { code: "IMAGE_DATA_INVALID", message: "有一张内嵌图片数据无效，已保留替代文本。" },
    };
  }

  try {
    signal.throwIfAborted();
    const processed = await processImageBuffer(parsed.buffer, parsed.contentType, {
      validateDeclaredFormat: true,
      placeholderEligible,
    });
    signal.throwIfAborted();
    return { element, ...processed };
  } catch {
    signal.throwIfAborted();
    return {
      element,
      warning: { code: "IMAGE_DATA_INVALID", message: "有一张内嵌图片元数据无效，已保留替代文本。" },
    };
  }
}

async function prepareImage(
  element: HTMLImageElement,
  sourceUrl: string | undefined,
  signal: AbortSignal,
  strategy: ImageEmbeddingStrategy,
): Promise<PreparedImage> {
  const rawSource = (strategy.sourcePriority === "lazy-first"
    ? element.hasAttribute("data-src")
      ? element.getAttribute("data-src") ?? ""
      : element.hasAttribute("data-lazy-src")
        ? element.getAttribute("data-lazy-src") ?? ""
        : element.getAttribute("src") || ""
    : element.getAttribute("src") || element.getAttribute("data-src") || element.getAttribute("data-lazy-src") || "").trim();
  const isDataSource = strategy.allowDataUri ? /^data:/i.test(rawSource) : rawSource.startsWith("data:");
  if (!rawSource || isDataSource) {
    if (isDataSource && strategy.allowDataUri) {
      const hasLazySource = element.hasAttribute("data-src") || element.hasAttribute("data-lazy-src");
      return prepareDataUriImage(element, rawSource, signal, !hasLazySource);
    }
    const hasLazySource = strategy.sourcePriority === "lazy-first" &&
      (element.hasAttribute("data-src") || element.hasAttribute("data-lazy-src"));
    return {
      element,
      warning: {
        code: hasLazySource ? "IMAGE_SOURCE_INVALID" : "IMAGE_SOURCE_MISSING",
        message: hasLazySource
          ? "有一张懒加载图片地址无效，已保留替代文本。"
          : "有一张图片缺少可用地址，已保留替代文本。",
      },
    };
  }

  let absoluteUrl: URL;
  try {
    absoluteUrl = sourceUrl ? new URL(rawSource, sourceUrl) : new URL(rawSource);
  } catch {
    return {
      element,
      warning: {
        code: strategy.mode === "link" ? "IMAGE_FETCH_FAILED" : "IMAGE_SOURCE_INVALID",
        message: strategy.mode === "link"
          ? "有一张图片无法安全获取，已保留替代文本。"
          : "有一张图片地址无效或缺少来源地址，已保留替代文本。",
      },
    };
  }
  if (strategy.mode === "paste" && absoluteUrl.protocol !== "http:" && absoluteUrl.protocol !== "https:") {
    return {
      element,
      warning: { code: "IMAGE_SOURCE_INVALID", message: "有一张图片协议不受支持，已保留替代文本。" },
    };
  }

  try {
    const result = await fetchPublicResource(absoluteUrl, {
      signal,
      maxBytes: MAX_SOURCE_IMAGE_BYTES,
      accept: "image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9",
    });

    if (!SUPPORTED_TYPES.has(result.contentType)) {
      return {
        element,
        warning: { code: "IMAGE_TYPE_UNSUPPORTED", message: "有一张图片格式不受支持，已保留替代文本。" },
      };
    }

    const processed = await processImageBuffer(result.buffer, result.contentType, {
      validateDeclaredFormat: true,
      placeholderEligible: false,
      invalidFormatWarning: {
        code: "IMAGE_TYPE_UNSUPPORTED",
        message: "有一张图片的实际格式与声明不一致或不受支持，已保留替代文本。",
      },
    });
    return { element, ...processed };
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof AppError && error.status === 413) {
      return {
        element,
        warning: { code: "IMAGE_TOO_LARGE", message: "有一张图片超过 8 MiB，已保留替代文本。" },
      };
    }
    return {
      element,
      warning: { code: "IMAGE_FETCH_FAILED", message: "有一张图片无法安全获取，已保留替代文本。" },
    };
  }
}

async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, async () => {
      while (cursor < values.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await mapper(values[index]);
      }
    }),
  );
  return results;
}

export async function embedImages(
  html: string,
  sourceUrl: string | undefined,
  signal: AbortSignal,
  totalBudgetBytes: number,
  strategy: ImageEmbeddingStrategy,
): Promise<{ html: string; warnings: ConversionWarning[]; stats: ImageEmbeddingStats }> {
  signal.throwIfAborted();
  const normalizedSourceUrl = sourceUrl?.trim() || undefined;
  const dom = normalizedSourceUrl
    ? new JSDOM(`<body>${html}</body>`, { url: normalizedSourceUrl })
    : new JSDOM(`<body>${html}</body>`);
  try {
    const warnings: ConversionWarning[] = [];
    const allImages = Array.from(dom.window.document.querySelectorAll("img"));
    const selectedImages = allImages.slice(0, MAX_IMAGES);

    for (const element of allImages.slice(MAX_IMAGES)) {
      element.replaceWith(imagePlaceholder(element));
    }
    if (allImages.length > MAX_IMAGES) {
      warnings.push({ code: "IMAGE_COUNT_LIMIT", message: `网页包含超过 ${MAX_IMAGES} 张图片，额外图片已省略。` });
    }

    const prepared = await mapWithConcurrency(selectedImages, 4, (element) =>
      prepareImage(element, normalizedSourceUrl, signal, strategy),
    );
    signal.throwIfAborted();
    let usedBytes = 0;
    let embeddedImageCount = 0;

    for (const item of prepared) {
      if (item.warning || !item.dataUri) {
        if (item.warning) warnings.push(item.warning);
        item.element.replaceWith(imagePlaceholder(item.element));
        continue;
      }
      const bytes = Buffer.byteLength(item.dataUri);
      if (usedBytes + bytes > totalBudgetBytes) {
        warnings.push({ code: "IMAGE_BUDGET_EXCEEDED", message: "部分图片会使文件超过 20 MiB，已保留替代文本。" });
        item.element.replaceWith(imagePlaceholder(item.element));
        continue;
      }
      usedBytes += bytes;
      embeddedImageCount += 1;
      item.element.setAttribute("src", item.dataUri);
      item.element.removeAttribute("srcset");
      item.element.removeAttribute("data-src");
      item.element.removeAttribute("data-lazy-src");
      if (item.animatedReduced) {
        warnings.push({ code: "ANIMATION_REDUCED", message: "一张过大的动图已压缩为静态首帧。" });
      }
    }

    return {
      html: dom.window.document.body.innerHTML,
      warnings,
      stats: {
        sourceImageCount: allImages.length,
        embeddedImageCount,
        omittedImageCount: allImages.length - embeddedImageCount,
      },
    };
  } finally {
    dom.window.close();
  }
}

export function omitLastEmbeddedImage(html: string): { html: string; omitted: boolean } {
  const dom = new JSDOM(`<body>${html}</body>`);
  const images = Array.from(dom.window.document.querySelectorAll<HTMLImageElement>('img[src^="data:image/"]'));
  const image = images.at(-1);
  if (!image) {
    dom.window.close();
    return { html, omitted: false };
  }
  image.replaceWith(imagePlaceholder(image));
  const output = dom.window.document.body.innerHTML;
  dom.window.close();
  return { html: output, omitted: true };
}
