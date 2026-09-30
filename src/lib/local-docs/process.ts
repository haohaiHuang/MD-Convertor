/**
 * Local document pipeline (FSD §4.4–§4.6): dedup first, then inline images, then an
 * optional translation — in that order, so the model never sees image bytes.
 *
 * Read-only by design (V1): the product is *returned*, never written. The renderer owns
 * the write through `outputBridge().saveFile()`, so a failed write cannot corrupt a source.
 */
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { AppError } from "@/lib/errors";
import { analyzeTranslation, runTranslation } from "@/lib/translate/run";
import { decideTranslation } from "@/lib/translate/decision";
import type { AnalyzeResponse, RunResponse, TranslationScope } from "@/types/translation";
import type { ConversionWarning } from "@/types/conversion";
import { buildDocMarker, decideLocalDoc, localDocFilename, parseDocMarker, stripDocMarker } from "./dedup";
import { inlineLocalDocImages, type InlineImageStats } from "./inline-images";
import { isMarkdownFileName, isSafeDirectoryPath, requireSafeDirectoryPath } from "./paths";

export type ProcessLocalDocInput = {
  /** Absolute path of the source `.md`. */
  sourcePath: unknown;
  /** Directory the product would be written to (the renderer does the writing). */
  outputDir: unknown;
  /** Rebuild even when the product is up to date. */
  force?: unknown;
  translate?: unknown;
  /** Active BCP-47 language; the caller falls back to the stored setting. */
  targetLanguage?: unknown;
  signal: AbortSignal;
};

export type ProcessDeps = {
  inlineImages?: typeof inlineLocalDocImages;
  analyze?: typeof analyzeTranslation;
  translate?: typeof runTranslation;
};

export type ProcessLocalDocResult =
  | { skipped: true; reason: "processed" }
  | {
      skipped: false;
      markdown: string;
      filename: string;
      /** Hash of the *source*: the marker describes the input, not the product. */
      sha256: string;
      warnings: ConversionWarning[];
      stats: InlineImageStats;
      translation: { ran: boolean; scope: TranslationScope | null };
    };

const SOURCE_FS_MESSAGES: Record<string, string> = {
  ENOENT: "源文件不存在。",
  EACCES: "没有读取权限。",
  EPERM: "没有读取权限。",
  EISDIR: "只能处理 .md 文件。",
};

function requireSourcePath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/")) {
    throw new AppError(400, "INVALID_FILE_PATH", "文件路径不合法。");
  }
  if (!isSafeDirectoryPath(path.dirname(value)) || !isMarkdownFileName(path.basename(value))) {
    throw new AppError(400, "INVALID_FILE_PATH", "文件路径不合法。");
  }
  return value;
}

async function statSource(sourcePath: string): Promise<{ size: number; mtimeMs: number }> {
  try {
    const stats = await stat(sourcePath);
    if (!stats.isFile()) throw new AppError(400, "INVALID_FILE_PATH", "文件路径不合法。");
    return { size: stats.size, mtimeMs: stats.mtimeMs };
  } catch (error) {
    if (error instanceof AppError) throw error;
    const code = (error as NodeJS.ErrnoException | null)?.code;
    if (code && SOURCE_FS_MESSAGES[code]) throw new AppError(400, code, SOURCE_FS_MESSAGES[code]);
    throw new AppError(500, "READ_FAILED", "无法读取该文件。");
  }
}

/** A missing or unreadable product simply means "nothing processed yet". */
async function readProduct(outputPath: string): Promise<string | null> {
  try {
    return await readFile(outputPath, "utf8");
  } catch {
    return null;
  }
}

export async function processLocalDoc(
  input: ProcessLocalDocInput,
  deps: ProcessDeps = {},
): Promise<ProcessLocalDocResult> {
  const { signal } = input;
  signal.throwIfAborted();

  const sourcePath = requireSourcePath(input.sourcePath);
  const outputDir = requireSafeDirectoryPath(input.outputDir);
  const filename = localDocFilename(path.basename(sourcePath));
  const outputPath = path.join(outputDir, filename);
  const source = await statSource(sourcePath);

  // The renderer's view of "already processed" is recomputed here: the server does not
  // trust a state the client could have carried over from another directory.
  const existing = await readProduct(outputPath);
  const marker = existing === null ? null : parseDocMarker(existing);
  const needsWork = input.force === true || decideLocalDoc(marker, { source: sourcePath, ...source }, outputPath) !== "skip";

  // Read once, only when needed: a skipped document is never even opened.
  let contents: Buffer | null = null;
  const readSource = async (): Promise<Buffer> => (contents ??= await readFile(sourcePath));
  const sha256 = async (): Promise<string> =>
    createHash("sha256").update(await readSource()).digest("hex");

  if (!needsWork) {
    return { skipped: true, reason: "processed" };
  }
  if (input.force !== true && marker?.sha256 === await sha256()) {
    return { skipped: true, reason: "processed" };
  }

  const text = (await readSource()).toString("utf8");
  const inline = await (deps.inlineImages ?? inlineLocalDocImages)(text, {
    sourceDir: path.dirname(sourcePath),
    signal,
  });

  let body = inline.markdown;
  const warnings: ConversionWarning[] = [...inline.warnings];
  let translation: { ran: boolean; scope: TranslationScope | null } = { ran: false, scope: null };

  if (input.translate === true) {
    // The marker is application state: the model must never see it, and must not echo it back.
    body = stripDocMarker(body);
    if (typeof input.targetLanguage !== "string" || !input.targetLanguage) {
      throw new AppError(400, "INVALID_TARGET_LANGUAGE", "目标语言不合法。");
    }
    const targetLanguage = input.targetLanguage;
    const analyze = deps.analyze ?? analyzeTranslation;
    const run = deps.translate ?? runTranslation;
    const analyzed: AnalyzeResponse = await analyze({ markdown: body, targetLanguage, signal });
    const decision = decideTranslation(analyzed.analysis);
    if (decision.action !== "skip") {
      const scope: TranslationScope = decision.action === "translate-all" ? "all" : "non-target";
      const translated: RunResponse = await run({
        markdown: body,
        targetLanguage,
        analysis: analyzed.analysis,
        scope,
        signal,
      });
      body = translated.markdown;
      translation = { ran: true, scope };
    }
  }

  const hash = await sha256();
  const newMarker = buildDocMarker({
    source: sourcePath,
    ...source,
    sha256: hash,
    outputPath,
    processedAt: new Date().toISOString(),
  });

  return {
    skipped: false,
    markdown: `${newMarker}\n${body}`,
    filename,
    sha256: hash,
    warnings,
    stats: inline.stats,
    translation,
  };
}
