import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { AppError } from "@/lib/errors";
import { fetchPublicResource } from "@/lib/fetcher";
import { MAX_IMAGES, MAX_SOURCE_IMAGE_BYTES, embedImageBuffer, mapWithConcurrency } from "@/lib/images";
import { MAX_MARKDOWN_BYTES } from "@/lib/markdown";
import type { ConversionWarning } from "@/types/conversion";
import { scanImageRefs, type ImageRef } from "./scan-refs";

/**
 * Markdown-level image inliner (FSD §4.4): only the URL span of a reference is replaced, so a
 * document never goes through md → HTML → Turndown. Anything that cannot be inlined keeps its
 * original reference and gains a warning; the web-page embedder's limits are reused, not re-invented.
 */

export type FetchResource = (
  url: URL,
  options: { signal: AbortSignal; maxBytes: number; accept: string },
) => Promise<{ buffer: Buffer; contentType: string; finalUrl: URL }>;

export type InlineImageDeps = {
  /** Defaults to the SSRF-checked `fetchPublicResource`; tests point it at a local fixture. */
  fetchResource?: FetchResource;
  /** Defaults to the real embedder; tests swap it to hit the document budget cheaply. */
  embed?: typeof embedImageBuffer;
};

export type InlineLocalDocImagesOptions = {
  /** Root for relative references: the directory holding the source `.md`. */
  sourceDir: string;
  signal: AbortSignal;
  deps?: InlineImageDeps;
};

export type InlineImageStats = {
  /** References replaced by a data URI. */
  embedded: number;
  /** Non-embedded references left untouched: failures, over-limit, over-budget. */
  kept: number;
};

export type InlineLocalDocImagesResult = {
  markdown: string;
  warnings: ConversionWarning[];
  stats: InlineImageStats;
};

const CONCURRENCY = 4;
const ACCEPT = "image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9";
/** Extensions of the formats the embedder accepts; Node has no built-in extension → media type map. */
const LOCAL_TYPES = new Map<string, string>([
  [".avif", "image/avif"],
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

const MAX_IMAGE_MIB = MAX_SOURCE_IMAGE_BYTES / 1024 / 1024;
const MAX_MARKDOWN_MIB = MAX_MARKDOWN_BYTES / 1024 / 1024;

type Embed = (buffer: Buffer, contentType: string) => Promise<{ dataUri?: string }>;
type ResolvedRef = { ok: true; dataUri: string } | { ok: false; warning: ConversionWarning };

function sourceInvalid(): ConversionWarning {
  return { code: "IMAGE_SOURCE_INVALID", message: "有一张图片的路径无效，已保留原引用。" };
}

function typeUnsupported(): ConversionWarning {
  return { code: "IMAGE_TYPE_UNSUPPORTED", message: "有一张图片的格式不受支持，已保留原引用。" };
}

function tooLarge(): ConversionWarning {
  return { code: "IMAGE_TOO_LARGE", message: `有一张图片超过 ${MAX_IMAGE_MIB} MiB，已保留原引用。` };
}

function unreadable(local: boolean): ConversionWarning {
  return {
    code: "IMAGE_FETCH_FAILED",
    message: local ? "有一张本地图片读取失败，已保留原引用。" : "有一张图片无法安全获取，已保留原引用。",
  };
}

/** Absolute paths and `..` escapes are refused: a document may only reach its own directory tree. */
function resolveLocalPath(target: string, sourceDir: string): string | null {
  const raw = target.trim();
  if (!raw) return null;

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // A stray `%` is a legitimate filename character; fall back to the raw text.
  }

  if (path.isAbsolute(decoded) || decoded.startsWith("//") || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(decoded)) {
    return null;
  }

  const root = path.resolve(sourceDir);
  const resolved = path.resolve(root, decoded);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

async function inlineLocalRef(target: string, sourceDir: string, embed: Embed): Promise<ResolvedRef> {
  const resolved = resolveLocalPath(target, sourceDir);
  if (!resolved) return { ok: false, warning: sourceInvalid() };

  const contentType = LOCAL_TYPES.get(path.extname(resolved).toLowerCase());
  if (!contentType) return { ok: false, warning: typeUnsupported() };

  let buffer: Buffer;
  try {
    const info = await stat(resolved);
    if (!info.isFile()) return { ok: false, warning: unreadable(true) };
    if (info.size > MAX_SOURCE_IMAGE_BYTES) return { ok: false, warning: tooLarge() };
    buffer = await readFile(resolved);
  } catch {
    return { ok: false, warning: unreadable(true) };
  }
  if (buffer.byteLength > MAX_SOURCE_IMAGE_BYTES) return { ok: false, warning: tooLarge() };

  try {
    const processed = await embed(buffer, contentType);
    return processed.dataUri ? { ok: true, dataUri: processed.dataUri } : { ok: false, warning: typeUnsupported() };
  } catch {
    return { ok: false, warning: typeUnsupported() };
  }
}

async function inlineRemoteRef(
  target: string,
  signal: AbortSignal,
  fetchResource: FetchResource,
  embed: Embed,
): Promise<ResolvedRef> {
  try {
    const result = await fetchResource(new URL(target), {
      signal,
      maxBytes: MAX_SOURCE_IMAGE_BYTES,
      accept: ACCEPT,
    });
    // The embedder also rejects content types outside the supported set.
    const processed = await embed(result.buffer, result.contentType);
    return processed.dataUri ? { ok: true, dataUri: processed.dataUri } : { ok: false, warning: typeUnsupported() };
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof AppError && error.status === 413) return { ok: false, warning: tooLarge() };
    return { ok: false, warning: unreadable(false) };
  }
}

export async function inlineLocalDocImages(
  markdownText: string,
  options: InlineLocalDocImagesOptions,
): Promise<InlineLocalDocImagesResult> {
  const { sourceDir, signal, deps = {} } = options;
  const embed = deps.embed ?? embedImageBuffer;
  const fetchResource = deps.fetchResource ?? fetchPublicResource;

  signal.throwIfAborted();
  const text = String(markdownText);
  const warnings: ConversionWarning[] = [];

  // `data:` references are already inline: never read, never counted.
  const candidates = scanImageRefs(text).filter((ref) => !/^data:/i.test(ref.target));
  const attempted = candidates.slice(0, MAX_IMAGES);
  if (candidates.length > MAX_IMAGES) {
    warnings.push({
      code: "IMAGE_COUNT_LIMIT",
      message: `文档包含超过 ${MAX_IMAGES} 张图片，额外图片已保留原引用。`,
    });
  }

  const resolved = await mapWithConcurrency(attempted, CONCURRENCY, (ref: ImageRef) => {
    signal.throwIfAborted();
    return /^https?:/i.test(ref.target)
      ? inlineRemoteRef(ref.target, signal, fetchResource, embed)
      : inlineLocalRef(ref.target, sourceDir, embed);
  });

  // Budget accounting walks document order over byte deltas: no full re-encode per image.
  let size = Buffer.byteLength(text, "utf8");
  const replacements: { targetStart: number; targetEnd: number; dataUri: string }[] = [];
  for (const [index, ref] of attempted.entries()) {
    const outcome = resolved[index];
    if (!outcome.ok) {
      warnings.push(outcome.warning);
      continue;
    }
    const added = Buffer.byteLength(outcome.dataUri, "utf8") - Buffer.byteLength(ref.target, "utf8");
    if (size + added > MAX_MARKDOWN_BYTES) {
      warnings.push({
        code: "IMAGE_BUDGET_EXCEEDED",
        message: `部分图片会使文件超过 ${MAX_MARKDOWN_MIB} MiB，已保留原引用。`,
      });
      continue;
    }
    size += added;
    replacements.push({ targetStart: ref.targetStart, targetEnd: ref.targetEnd, dataUri: outcome.dataUri });
  }

  const markdown = replacements
    .sort((left, right) => right.targetStart - left.targetStart)
    .reduce(
      (text, replacement) =>
        `${text.slice(0, replacement.targetStart)}${replacement.dataUri}${text.slice(replacement.targetEnd)}`,
      text,
    );

  return {
    markdown,
    warnings,
    stats: { embedded: replacements.length, kept: candidates.length - replacements.length },
  };
}
