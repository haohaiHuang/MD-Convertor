import { JSDOM } from "jsdom";
import sharp from "sharp";
import { AppError } from "@/lib/errors";
import { fetchPublicResource } from "@/lib/fetcher";
import type { ConversionWarning } from "@/types/conversion";

const MAX_IMAGES = 30;
const MAX_SOURCE_IMAGE_BYTES = 8 * 1024 * 1024;
const OPTIMIZE_THRESHOLD_BYTES = 2 * 1024 * 1024;
const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

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

function imagePlaceholder(element: HTMLImageElement): Text {
  const label = element.alt.trim() || "图片";
  return element.ownerDocument.createTextNode(`[图片：${label}]`);
}

async function prepareImage(
  element: HTMLImageElement,
  sourceUrl: string,
  signal: AbortSignal,
): Promise<PreparedImage> {
  const rawSource =
    element.getAttribute("src") ||
    element.getAttribute("data-src") ||
    element.getAttribute("data-lazy-src") ||
    "";
  if (!rawSource || rawSource.startsWith("data:")) {
    return {
      element,
      warning: { code: "IMAGE_SOURCE_MISSING", message: "有一张图片缺少可用地址，已保留替代文本。" },
    };
  }

  try {
    const absoluteUrl = new URL(rawSource, sourceUrl);
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

    let buffer = result.buffer;
    let contentType = result.contentType;
    let animatedReduced = false;
    const metadata = await sharp(buffer, { animated: true }).metadata();
    const needsOptimization = shouldOptimizeImage(
      buffer.byteLength,
      metadata.width ?? 0,
      metadata.height ?? 0,
    );

    if (needsOptimization) {
      animatedReduced = (metadata.pages ?? 1) > 1;
      buffer = await sharp(buffer, { page: 0 })
        .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
      contentType = "image/webp";
    }

    return {
      element,
      dataUri: `data:${contentType};base64,${buffer.toString("base64")}`,
      animatedReduced,
    };
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
  sourceUrl: string,
  signal: AbortSignal,
  totalBudgetBytes: number,
): Promise<{ html: string; warnings: ConversionWarning[]; stats: ImageEmbeddingStats }> {
  const dom = new JSDOM(`<body>${html}</body>`, { url: sourceUrl });
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
    prepareImage(element, sourceUrl, signal),
  );
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

  const output = dom.window.document.body.innerHTML;
  dom.window.close();
  return {
    html: output,
    warnings,
    stats: {
      sourceImageCount: allImages.length,
      embeddedImageCount,
      omittedImageCount: allImages.length - embeddedImageCount,
    },
  };
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
