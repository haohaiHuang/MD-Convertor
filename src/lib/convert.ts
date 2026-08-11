import { AppError, toAppError } from "@/lib/errors";
import { renderDynamicPage } from "@/lib/browser";
import type { GeneratedBrowserImage } from "@/lib/browser";
import { extractBodyFallback, extractReadable } from "@/lib/extract";
import { fetchHtml } from "@/lib/fetcher";
import { embedImages, omitLastEmbeddedImage } from "@/lib/images";
import { htmlToMarkdown, makeFilename, MAX_MARKDOWN_BYTES } from "@/lib/markdown";
import { requiresMermaidRendering } from "@/lib/mermaid";
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
  let generatedImages: GeneratedBrowserImage[] = [];
  const mermaidRenderingRequired = requiresMermaidRendering(originalHtml);

  if (!extracted || extracted.textLength < 300 || mermaidRenderingRequired) {
    try {
      const browserSignal = AbortSignal.any([signal, AbortSignal.timeout(20_000)]);
      const renderedPage = await renderDynamicPage(sourceUrl, browserSignal);
      const renderedHtml = renderedPage.html;
      warnings.push(...renderedPage.warnings);
      if (Buffer.byteLength(renderedHtml) > 5 * 1024 * 1024) {
        throw new AppError(413, "SOURCE_TOO_LARGE", "动态网页内容超过允许的大小。");
      }
      const renderedAccessIssue = detectPageAccessIssue(renderedHtml, sourceUrl);
      if (renderedAccessIssue) {
        if (!extracted) pageAccessIssue = renderedAccessIssue;
      } else {
        pageAccessIssue = null;
        const rendered = extractReadable(renderedHtml, sourceUrl);
        const directTextLength = extracted?.textLength ?? 0;
        const preservesGeneratedMermaid = renderedPage.generatedImages.length > 0
          && rendered !== null
          && rendered.textLength >= directTextLength * 0.95;
        if (rendered && (rendered.textLength >= directTextLength || preservesGeneratedMermaid)) {
          extracted = rendered;
          originalHtml = renderedHtml;
          extractionMode = "browser";
          generatedImages = renderedPage.generatedImages;
        }
      }
    } catch (error) {
      if (signal.aborted || (error instanceof AppError && error.status === 413)) throw error;
      if (mermaidRenderingRequired) {
        warnings.push({
          code: "MERMAID_RENDER_FAILED",
          message: "网页中的 Mermaid 图表未能安全栅格化，结果中可能缺少该图表。",
        });
      }
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
  const trustedDataUris = new Map<string, string>();
  for (const generatedImage of generatedImages) {
    trustedDataUris.set(generatedImage.placeholderUrl, generatedImage.dataUri);
    trustedDataUris.set(new URL(generatedImage.placeholderUrl, sourceUrl).toString(), generatedImage.dataUri);
  }
  const embedded = await embedImages(extracted.html, sourceUrl, signal, imageBudget, {
    mode: "link",
    sourcePriority: "src-first",
    allowDataUri: false,
    ...(trustedDataUris.size > 0 ? { trustedDataUris } : {}),
  });
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
