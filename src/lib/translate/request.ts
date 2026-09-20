import { AppError } from "@/lib/errors";
import { readField } from "@/lib/local-api";
import { isBcp47 } from "@/types/settings";
import type { BlockLanguage, TranslationAnalysis, TranslationScope } from "@/types/translation";

const BLOCK_LANGUAGES: readonly BlockLanguage[] = ["target", "other", "unknown", "skipped"];

function invalid(code: string, message: string): AppError {
  return new AppError(400, code, message);
}

/** Reads the two fields both translate endpoints start from. */
function readCommon(body: unknown): { markdown: string; targetLanguage: string } {
  const markdown = readField(body, "markdown");
  if (typeof markdown !== "string") {
    throw invalid("INVALID_REQUEST_BODY", "markdown 字段无效。");
  }

  const targetLanguage = readField(body, "targetLanguage");
  if (typeof targetLanguage !== "string" || !isBcp47(targetLanguage.trim())) {
    throw invalid("INVALID_TARGET_LANGUAGE", "目标语言标记无效。");
  }

  return { markdown, targetLanguage: targetLanguage.trim() };
}

export function readAnalyzeBody(body: unknown): { markdown: string; targetLanguage: string } {
  return readCommon(body);
}

/**
 * The client echoes the analysis it received; only the fields the engine reads
 * are trusted, and a malformed one is rejected instead of being half-used.
 */
function readAnalysis(body: unknown): TranslationAnalysis {
  const analysis = readField(body, "analysis");
  const targetLanguage = readField(analysis, "targetLanguage");
  const blocks = readField(analysis, "blocks");
  if (typeof targetLanguage !== "string" || !Array.isArray(blocks)) {
    throw invalid("INVALID_ANALYSIS", "analysis 字段无效。");
  }

  const totalChars = readField(analysis, "totalChars");
  const targetChars = readField(analysis, "targetChars");
  const ratio = readField(analysis, "ratio");
  if (!Number.isFinite(totalChars) || !Number.isFinite(targetChars) || !Number.isFinite(ratio)) {
    throw invalid("INVALID_ANALYSIS", "analysis 字段无效。");
  }

  return {
    targetLanguage,
    totalChars: totalChars as number,
    targetChars: targetChars as number,
    ratio: ratio as number,
    blocks: blocks.map((entry) => {
      const index = readField(entry, "index");
      const language = readField(entry, "language");
      const chars = readField(entry, "chars");
      if (!Number.isInteger(index) || !BLOCK_LANGUAGES.includes(language as BlockLanguage) || !Number.isFinite(chars)) {
        throw invalid("INVALID_ANALYSIS", "analysis 字段无效。");
      }
      return { index: index as number, language: language as BlockLanguage, chars: chars as number };
    }),
  };
}

export function readRunBody(body: unknown): {
  markdown: string;
  targetLanguage: string;
  analysis: TranslationAnalysis;
  scope: TranslationScope;
} {
  const scope = readField(body, "scope");
  if (scope !== "all" && scope !== "non-target") {
    throw invalid("INVALID_SCOPE", "scope 字段无效。");
  }
  return { ...readCommon(body), analysis: readAnalysis(body), scope };
}
