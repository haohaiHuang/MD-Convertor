import { randomUUID } from "node:crypto";
import { JSDOM } from "jsdom";
import { preparePastedContent, type PastedContentInput } from "@/lib/paste";
import { embedImages } from "@/lib/images";
import { AppError } from "@/lib/errors";
import { makePasteFilename, MAX_MARKDOWN_BYTES, pastedContentToMarkdown } from "@/lib/markdown";
import { rasterizePastedMermaid } from "@/lib/paste-mermaid";
import type { ConversionWarning, ConvertResponse } from "@/types/conversion";

export type PastedConversionInput = PastedContentInput & {
  sourceUrl?: string;
};

function normalizeSourceUrl(value: string | undefined): string {
  const normalized = value?.trim() || "";
  if (!normalized) return "";
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new AppError(400, "INVALID_SOURCE_URL", "来源 URL 必须是无凭据的 HTTP(S) 地址。");
  }
  if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.username || parsed.password) {
    throw new AppError(400, "INVALID_SOURCE_URL", "来源 URL 必须是无凭据的 HTTP(S) 地址。");
  }
  return parsed.toString();
}

function uniqueWarnings(warnings: ConversionWarning[]): ConversionWarning[] {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.code}:${warning.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type PastedMarkdownBudgetCommon = {
  title: string;
  sourceUrl?: string;
  convertedAt: string;
  maxBytes?: number;
};

export type PastedMarkdownBudgetInput =
  | (PastedMarkdownBudgetCommon & {
      mode: "html";
      html: string;
      embeddedImageCount: number;
      omittedImageCount: number;
    })
  | (PastedMarkdownBudgetCommon & {
      mode: "text";
      text: string;
      embeddedImageCount?: number;
      omittedImageCount?: number;
    });

export type PastedMarkdownBudgetResult = {
  markdown: string;
  outputBytes: number;
  embeddedImageCount: number;
  omittedImageCount: number;
  imageBudgetExceeded: boolean;
};

type MarkdownDataImageMatch = {
  start: number;
  end: number;
  cleaned: string;
  replacement: string;
  byteLength: number;
  cleanedByteLength: number;
  replacementByteLength: number;
};

function markRealDataImages(html: string): { html: string; markers: string[] } {
  const dom = new JSDOM(`<body>${html}</body>`);
  try {
    const markers: string[] = [];
    const seed = `PIMG${randomUUID().replaceAll("-", "")}`;
    let suffix = 0;
    dom.window.document.querySelectorAll<HTMLImageElement>("img[src]").forEach((image) => {
      const source = image.getAttribute("src")?.trim() ?? "";
      if (!/^data:image\/(?:jpeg|png|webp|gif|avif);base64,/i.test(source)) return;
      let marker = `${seed}X${suffix++}`;
      while (html.includes(marker) || markers.includes(marker)) {
        marker = `${seed}X${suffix++}`;
      }
      const alt = image.getAttribute("alt")?.trim() ?? "";
      image.setAttribute("alt", alt ? `${alt} ${marker}` : marker);
      markers.push(marker);
    });
    return { html: dom.window.document.body.innerHTML, markers };
  } finally {
    dom.window.close();
  }
}

function parseMarkdownDataImage(
  markdown: string,
  start: number,
  closeBracket: number,
  markers: string[],
): MarkdownDataImageMatch | null {
  let cursor = closeBracket + 2;
  while (/\s/.test(markdown[cursor] ?? "")) cursor += 1;
  const sourceMatch = /^data:image\/(?:jpeg|png|webp|gif|avif);base64,/i.exec(markdown.slice(cursor));
  if (!sourceMatch) return null;
  cursor += sourceMatch[0].length;
  const payloadStart = cursor;
  while (/[A-Za-z0-9+/]/.test(markdown[cursor] ?? "")) cursor += 1;
  if (cursor === payloadStart) return null;
  let padding = 0;
  while (padding < 2 && markdown[cursor] === "=") {
    cursor += 1;
    padding += 1;
  }
  while (/\s/.test(markdown[cursor] ?? "")) cursor += 1;
  if (markdown[cursor] !== ")") {
    const quote = markdown[cursor];
    if (quote !== '"' && quote !== "'") return null;
    cursor += 1;
    let closed = false;
    while (cursor < markdown.length) {
      if (markdown[cursor] === "\\") {
        cursor += 2;
        continue;
      }
      if (markdown[cursor] === quote) {
        cursor += 1;
        closed = true;
        break;
      }
      cursor += 1;
    }
    if (!closed) return null;
    while (/\s/.test(markdown[cursor] ?? "")) cursor += 1;
    if (markdown[cursor] !== ")") return null;
  }

  const end = cursor + 1;
  const rawAlt = markdown.slice(start + 2, closeBracket);
  const marker = markers.find((value) => rawAlt.includes(value));
  if (!marker) return null;
  const altWithoutMarker = markers.reduce((value, valueToRemove) => value.replace(valueToRemove, ""), rawAlt).trim();
  const alt = altWithoutMarker;
  const cleaned = `${markdown.slice(start, start + 2)}${alt}${markdown.slice(closeBracket, end)}`;
  const replacement = `[图片：${alt || "图片"}]`;
  return {
    start,
    end,
    cleaned,
    replacement,
    byteLength: Buffer.byteLength(markdown.slice(start, end)),
    cleanedByteLength: Buffer.byteLength(cleaned),
    replacementByteLength: Buffer.byteLength(replacement),
  };
}

function findMarkdownDataImages(markdown: string, markers: string[]): MarkdownDataImageMatch[] {
  const matches: MarkdownDataImageMatch[] = [];
  for (const marker of markers) {
    const markerIndex = markdown.indexOf(marker);
    if (markerIndex < 0) continue;
    const start = markdown.lastIndexOf("![", markerIndex);
    if (start < 0) continue;
    let closeBracket = markdown.indexOf("](", markerIndex);
    while (closeBracket >= 0) {
      const parsed = parseMarkdownDataImage(markdown, start, closeBracket, [marker]);
      if (parsed) {
        matches.push(parsed);
        break;
      }
      closeBracket = markdown.indexOf("](", closeBracket + 2);
    }
  }
  return matches.sort((left, right) => left.start - right.start);
}

export function renderPastedMarkdownWithinBudget(
  options: PastedMarkdownBudgetInput,
): PastedMarkdownBudgetResult {
  const maxBytes = options.maxBytes ?? MAX_MARKDOWN_BYTES;
  const markedHtml = options.mode === "html" ? markRealDataImages(options.html) : { html: "", markers: [] };
  const embeddedHtml = markedHtml.html;
  const markers = markedHtml.markers;
  let embeddedImageCount = options.embeddedImageCount ?? 0;
  let omittedImageCount = options.omittedImageCount ?? 0;
  let imageBudgetExceeded = false;
  const render = (): string => options.mode === "text"
    ? pastedContentToMarkdown({
        mode: "text",
        text: options.text,
        title: options.title,
        sourceUrl: options.sourceUrl?.trim() || undefined,
        convertedAt: options.convertedAt,
      })
    : pastedContentToMarkdown({
        mode: "html",
        html: embeddedHtml,
        title: options.title,
        sourceUrl: options.sourceUrl?.trim() || undefined,
        convertedAt: options.convertedAt,
      });
  let markdown = render();
  let outputBytes = Buffer.byteLength(markdown);

  const realImages = findMarkdownDataImages(markdown, markers);
  let cleanedBytes = outputBytes;
  for (const image of realImages) {
    cleanedBytes += image.cleanedByteLength - image.byteLength;
  }
  let bytesAfterDrop = cleanedBytes;
  let droppedCount = 0;
  if (bytesAfterDrop > maxBytes) {
    for (let index = realImages.length - 1; index >= 0 && bytesAfterDrop > maxBytes; index -= 1) {
      const image = realImages[index];
      bytesAfterDrop -= image.cleanedByteLength - image.replacementByteLength;
      droppedCount += 1;
    }
    if (bytesAfterDrop > maxBytes) {
      throw new AppError(413, "OUTPUT_TOO_LARGE", "转换结果的正文超过 20 MiB，无法生成文件。");
    }
  }

  const droppedStarts = new Set(realImages.slice(realImages.length - droppedCount).map((image) => image.start));
  if (realImages.length > 0) {
    let cursor = 0;
    let reducedMarkdown = "";
    for (const image of realImages) {
      reducedMarkdown += markdown.slice(cursor, image.start);
      reducedMarkdown += droppedStarts.has(image.start) ? image.replacement : image.cleaned;
      cursor = image.end;
    }
    reducedMarkdown += markdown.slice(cursor);
    markdown = reducedMarkdown;
  }
  for (const marker of markers) {
    markdown = markdown.replaceAll(marker, "");
  }
  outputBytes = Buffer.byteLength(markdown);
  if (outputBytes > maxBytes) {
    throw new AppError(413, "OUTPUT_TOO_LARGE", "转换结果的正文超过 20 MiB，无法生成文件。");
  }
  embeddedImageCount = Math.max(0, embeddedImageCount - droppedCount);
  omittedImageCount += droppedCount;
  imageBudgetExceeded = droppedCount > 0;

  return { markdown, outputBytes, embeddedImageCount, omittedImageCount, imageBudgetExceeded };
}

export async function convertPastedContent(
  input: PastedConversionInput,
  signal: AbortSignal,
): Promise<ConvertResponse> {
  signal.throwIfAborted();
  const sourceUrl = normalizeSourceUrl(input.sourceUrl);
  const mermaid = await rasterizePastedMermaid(input.html, signal);
  const prepared = preparePastedContent({ ...input, html: mermaid.html });
  signal.throwIfAborted();
  const embedded = prepared.mode === "html"
    ? await embedImages(prepared.html, sourceUrl || undefined, signal, MAX_MARKDOWN_BYTES, {
        mode: "paste",
        sourcePriority: "lazy-first",
        allowDataUri: true,
      })
    : {
        html: "",
        warnings: [],
        stats: { sourceImageCount: 0, embeddedImageCount: 0, omittedImageCount: 0 },
      };
  signal.throwIfAborted();
  if (!prepared.text.trim() && embedded.stats.embeddedImageCount === 0) {
    throw new AppError(422, "NO_USABLE_CONTENT", "粘贴内容没有可转换的正文或图片。");
  }
  const convertedAtDate = new Date();
  const convertedAt = convertedAtDate.toISOString();
  const budget = prepared.mode === "text"
    ? renderPastedMarkdownWithinBudget({
        mode: "text",
        text: prepared.text,
        title: prepared.title,
        sourceUrl: sourceUrl || undefined,
        convertedAt,
        embeddedImageCount: 0,
        omittedImageCount: 0,
      })
    : renderPastedMarkdownWithinBudget({
        mode: "html",
        html: embedded.html,
        title: prepared.title,
        sourceUrl: sourceUrl || undefined,
        convertedAt,
        embeddedImageCount: embedded.stats.embeddedImageCount,
        omittedImageCount: embedded.stats.omittedImageCount,
      });
  signal.throwIfAborted();
  const warnings = [...mermaid.warnings, ...(prepared.warnings ?? []), ...embedded.warnings];
  if (budget.imageBudgetExceeded) {
    warnings.push({ code: "IMAGE_BUDGET_EXCEEDED", message: "部分图片会使文件超过 20 MiB，已保留替代文本。" });
  }
  signal.throwIfAborted();
  return {
    title: prepared.title,
    filename: makePasteFilename(prepared.title, convertedAtDate),
    markdown: budget.markdown,
    warnings: uniqueWarnings(warnings),
    meta: {
      sourceUrl,
      convertedAt,
      extractionMode: "paste",
      outputBytes: budget.outputBytes,
      textChars: prepared.textLength,
      sourceImageCount: embedded.stats.sourceImageCount + mermaid.omittedImageCount,
      embeddedImageCount: budget.embeddedImageCount,
      omittedImageCount: budget.omittedImageCount + mermaid.omittedImageCount,
    },
  };
}
