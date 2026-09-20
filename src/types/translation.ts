/** Shared shape of the two translation endpoints (FSD §1.2). */

export type BlockLanguage = "target" | "other" | "unknown" | "skipped";

export type TranslationAnalysis = {
  targetLanguage: string;
  /** Characters of translatable prose; skipped blocks never count. */
  totalChars: number;
  targetChars: number;
  ratio: number;
  blocks: { index: number; language: BlockLanguage; chars: number }[];
};

export type TranslationScope = "all" | "non-target";

export type AnalyzeMeta = {
  targetLanguage: string;
  /** Model id used for the call, or null when the local CLI default applies. */
  model: string | null;
  durationMs: number;
};

export type RunMeta = AnalyzeMeta & {
  scope: TranslationScope;
  batches: number;
  translatedBlocks: number;
};

export type AnalyzeResponse = {
  analysis: TranslationAnalysis;
  warnings: string[];
  meta: AnalyzeMeta;
};

export type RunResponse = {
  markdown: string;
  warnings: string[];
  meta: RunMeta;
};
