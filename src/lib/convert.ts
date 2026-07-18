import { AppError, toAppError } from "@/lib/errors";
import { renderDynamicPage } from "@/lib/browser";
import { extractBodyFallback, extractReadable } from "@/lib/extract";
import { fetchHtml } from "@/lib/fetcher";
import { embedImages, omitLastEmbeddedImage } from "@/lib/images";
import { htmlToMarkdown, makeFilename, MAX_MARKDOWN_BYTES } from "@/lib/markdown";
import { detectPageAccessIssue } from "@/lib/page-access";
import { parsePublicHttpUrl } from "@/lib/security/url";
import type { ConversionWarning, ConvertResponse, ExtractedContent, ExtractionMode } from "@/types/conversion";

function uniqueWarnings(warnings: ConversionWarning[]): ConversionWarning[] {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.code}:${warning.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function renderMarkdownWithinBudget(options: {
  html: string;
  title: string;
  sourceUrl: string;
  convertedAt: string;
  embeddedImageCount: number;
  omittedImageCount: number;
  maxBytes?: number;
}): {
  markdown: string;
  outputBytes: number;
  embeddedImageCount: number;
  omittedImageCount: number;
  imageBudgetExceeded: boolean;
} {
  const maxBytes = options.maxBytes ?? MAX_MARKDOWN_BYTES;
  let embeddedHtml = options.html;
  let embeddedImageCount = options.embeddedImageCount;
  let omittedImageCount = options.omittedImageCount;
  let imageBudgetExceeded = false;
  let markdown = htmlToMarkdown(embeddedHtml, options.title, options.sourceUrl, options.convertedAt);
  let outputBytes = Buffer.byteLength(markdown);

  while (outputBytes > maxBytes) {
    const reduced = omitLastEmbeddedImage(embeddedHtml);
    if (!reduced.omitted) {
      throw new AppError(413, "OUTPUT_TOO_LARGE", "转换结果的正文超过 20 MiB，无法生成文件。");
    }
    embeddedHtml = reduced.html;
    embeddedImageCount -= 1;
    omittedImageCount += 1;
    imageBudgetExceeded = true;
    markdown = htmlToMarkdown(embeddedHtml, options.title, options.sourceUrl, options.convertedAt);
    outputBytes = Buffer.byteLength(markdown);
  }

  return { markdown, outputBytes, embeddedImageCount, omittedImageCount, imageBudgetExceeded };
}

export async function convertUrlToMarkdown(inputUrl: string, signal: AbortSignal): Promise<ConvertResponse> {
  signal.throwIfAborted();
  const parsedUrl = parsePublicHttpUrl(inputUrl);
  const warnings: ConversionWarning[] = [];
  let originalHtml = "";
  let sourceUrl = parsedUrl.toString();
  let directError: unknown;

  try {
    const directSignal = AbortSignal.any([signal, AbortSignal.timeout(12_000)]);
    const fetched = await fetchHtml(sourceUrl, directSignal);
    originalHtml = fetched.html;
    sourceUrl = fetched.finalUrl.toString();
  } catch (error) {
    if (signal.aborted) throw error;
    directError = error;
    if (error instanceof AppError && [400, 403, 413, 422].includes(error.status)) throw error;
  }

  let pageAccessIssue = originalHtml ? detectPageAccessIssue(originalHtml, sourceUrl) : null;
  let extracted: ExtractedContent | null = originalHtml && !pageAccessIssue
    ? extractReadable(originalHtml, sourceUrl)
    : null;
  let extractionMode: ExtractionMode = "direct";

  if (!extracted || extracted.textLength < 300) {
    try {
      const browserSignal = AbortSignal.any([signal, AbortSignal.timeout(20_000)]);
      const renderedHtml = await renderDynamicPage(sourceUrl, browserSignal);
      if (Buffer.byteLength(renderedHtml) > 5 * 1024 * 1024) {
        throw new AppError(413, "SOURCE_TOO_LARGE", "动态网页内容超过允许的大小。");
      }
      const renderedAccessIssue = detectPageAccessIssue(renderedHtml, sourceUrl);
      if (renderedAccessIssue) {
        if (!extracted) pageAccessIssue = renderedAccessIssue;
      } else {
        pageAccessIssue = null;
        const rendered = extractReadable(renderedHtml, sourceUrl);
        if (rendered && rendered.textLength >= (extracted?.textLength ?? 0)) {
          extracted = rendered;
          originalHtml = renderedHtml;
          extractionMode = "browser";
        }
      }
    } catch (error) {
      if (signal.aborted || (error instanceof AppError && error.status === 413)) throw error;
      warnings.push({
        code: "BROWSER_FALLBACK_FAILED",
        message: "动态渲染未能完成，已使用当前可读取的网页内容。",
      });
    }
  }

  if (!extracted || extracted.textLength < 50) {
    if (pageAccessIssue) throw pageAccessIssue;
    if (!originalHtml) throw toAppError(directError);
    const fallback = extractBodyFallback(originalHtml, sourceUrl);
    if (fallback.textLength < 50) {
      throw new AppError(422, "NO_USABLE_CONTENT", "该网页没有足够的可转换内容。");
    }
    extracted = fallback;
    extractionMode = "body-fallback";
    warnings.push({
      code: "LOW_CONFIDENCE_EXTRACTION",
      message: "未能明确识别网页正文，结果可能包含额外页面内容。",
    });
  }

  const nonImageBudget = Buffer.byteLength(extracted.html) + 16 * 1024;
  const imageBudget = Math.max(0, MAX_MARKDOWN_BYTES - nonImageBudget);
  const embedded = await embedImages(extracted.html, sourceUrl, signal, imageBudget);
  signal.throwIfAborted();
  warnings.push(...embedded.warnings);

  const convertedAt = new Date().toISOString();
  const fitted = renderMarkdownWithinBudget({
    html: embedded.html,
    title: extracted.title,
    sourceUrl,
    convertedAt,
    embeddedImageCount: embedded.stats.embeddedImageCount,
    omittedImageCount: embedded.stats.omittedImageCount,
  });
  if (fitted.imageBudgetExceeded) {
    warnings.push({
      code: "IMAGE_BUDGET_EXCEEDED",
      message: "部分图片会使文件超过 20 MiB，已保留替代文本。",
    });
  }

  return {
    title: extracted.title,
    filename: makeFilename(extracted.title),
    markdown: fitted.markdown,
    warnings: uniqueWarnings(warnings),
    meta: {
      sourceUrl,
      convertedAt,
      extractionMode,
      outputBytes: fitted.outputBytes,
      textChars: extracted.textLength,
      sourceImageCount: embedded.stats.sourceImageCount,
      embeddedImageCount: fitted.embeddedImageCount,
      omittedImageCount: fitted.omittedImageCount,
    },
  };
}
