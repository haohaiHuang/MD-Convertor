import type { TranslationAnalysis } from "@/types/translation";

/** PRD §4.2 (Q5.3): >= 97% needs no translation, >= 70% asks the user first. */
export const SKIP_RATIO = 0.97;
export const CONFIRM_RATIO = 0.7;

export type TranslationDecision =
  | { action: "skip"; reason: "target-language" | "empty"; percent: number }
  | { action: "confirm"; percent: number }
  | { action: "translate-all" };

/**
 * S5 decision seam (PRD §4.2). `ratio` is the raw fraction; the returned
 * `percent` is only for display. An empty prose body also has `ratio === 0`,
 * so it must be recognised before the ratio is compared.
 */
export function decideTranslation(analysis: TranslationAnalysis): TranslationDecision {
  const percent = Math.round(analysis.ratio * 100);
  if (analysis.totalChars === 0) return { action: "skip", reason: "empty", percent };
  if (analysis.ratio >= SKIP_RATIO) return { action: "skip", reason: "target-language", percent };
  if (analysis.ratio >= CONFIRM_RATIO) return { action: "confirm", percent };
  return { action: "translate-all" };
}
