import type { BlockLanguage, TranslationAnalysis } from "@/types/translation";
import type { Segment } from "./segment";

/** `zh-Hans` and `zh` are the same language for our purposes; `zh-Hans` and `en` are not. */
export function primarySubtag(tag: string): string {
  return tag.trim().toLowerCase().split("-")[0] ?? "";
}

export function isTargetLanguage(candidate: string, targetLanguage: string): boolean {
  const primary = primarySubtag(candidate);
  return primary !== "" && primary === primarySubtag(targetLanguage);
}

/**
 * Turns segment languages into the analysis the UI thresholds run on
 * (FSD §1.2, §5). Blocks that never reach the model — fenced code, images,
 * links, HTML, blank lines — are reported as `skipped` with zero characters,
 * so the ratio only ever measures real prose.
 */
export function buildAnalysis(
  segments: readonly Segment[],
  languages: ReadonlyMap<number, string>,
  targetLanguage: string,
): TranslationAnalysis {
  const blocks: TranslationAnalysis["blocks"] = [];
  let totalChars = 0;
  let targetChars = 0;

  for (const segment of segments) {
    const language = classify(segment, languages.get(segment.index), targetLanguage);
    const chars = language === "skipped" ? 0 : segment.text.length;
    if (language !== "skipped") {
      totalChars += chars;
      if (language === "target") {
        targetChars += chars;
      }
    }
    blocks.push({ index: segment.index, language, chars });
  }

  return {
    targetLanguage,
    totalChars,
    targetChars,
    ratio: totalChars === 0 ? 0 : targetChars / totalChars,
    blocks,
  };
}

function classify(segment: Segment, tag: string | undefined, targetLanguage: string): BlockLanguage {
  if (segment.kind === "skip" || segment.text.trim() === "") {
    return "skipped";
  }
  if (tag === undefined || tag.trim() === "") {
    return "unknown";
  }
  return isTargetLanguage(tag, targetLanguage) ? "target" : "other";
}

export function countTranslatableChars(segments: readonly Segment[]): number {
  return segments.reduce((total, segment) => total + segment.text.length, 0);
}
