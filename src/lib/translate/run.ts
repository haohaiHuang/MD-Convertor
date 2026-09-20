import { AppError } from "@/lib/errors";
import { readSettings as readSettingsFromStore } from "@/lib/settings/store";
import type { Settings } from "@/types/settings";
import type { AnalyzeResponse, RunResponse, TranslationAnalysis, TranslationScope } from "@/types/translation";
import { buildAnalysis } from "./analysis";
import {
  TRANSLATE_BATCH_MAX_BLOCKS,
  TRANSLATE_BATCH_MAX_CHARS,
  TRANSLATE_MAX_PROSE_CHARS,
  TRANSLATE_TASK_TIMEOUT_MS,
  translateTaskTimeoutMs,
} from "./limits";
import {
  createModelCaller,
  resolveEffectiveModel,
  type EffectiveModelConfig,
  type ModelCallDeps,
  type ModelEnv,
} from "./provider/provider";
import { requestAnalyze, requestTranslation, type PromptBlock } from "./prompt";
import { assertBlockAlignment, reassemble, segmentMarkdown, translatableSegments, type Segment } from "./segment";

export const NO_TRANSLATABLE_BLOCKS = "没有需要翻译的段落。";

export type TranslateDeps = {
  readSettings?: () => Promise<Settings>;
  env?: ModelEnv;
  deps?: ModelCallDeps;
  taskTimeoutMs?: number;
  callTimeoutMs?: number;
  now?: () => number;
};

export type AnalyzeOptions = {
  markdown: string;
  targetLanguage: string;
  signal?: AbortSignal;
  deps?: TranslateDeps;
};

export type RunOptions = AnalyzeOptions & {
  analysis: TranslationAnalysis;
  scope: TranslationScope;
};

/** Analyse and translate share one slot: the local server serves one user. */
let taskInFlight = false;

/** Test hook: the lock is process-wide, so each test starts from a free slot. */
export function resetTaskLock(): void {
  taskInFlight = false;
}

export function batchBlocks(blocks: readonly PromptBlock[]): PromptBlock[][] {
  const batches: PromptBlock[][] = [];
  let current: PromptBlock[] = [];
  let chars = 0;

  for (const block of blocks) {
    if (current.length > 0 && (current.length >= TRANSLATE_BATCH_MAX_BLOCKS || chars + block.t.length > TRANSLATE_BATCH_MAX_CHARS)) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(block);
    chars += block.t.length;
  }
  if (current.length > 0) {
    batches.push(current);
  }
  return batches;
}

async function withTask<T>(
  deps: TranslateDeps,
  signal: AbortSignal | undefined,
  task: (signal: AbortSignal) => Promise<T>,
  taskTimeoutMs?: number,
): Promise<T> {
  if (taskInFlight) {
    throw new AppError(429, "TRANSLATE_BUSY", "已有翻译任务正在进行，请稍候。");
  }
  taskInFlight = true;

  const deadline = AbortSignal.timeout(deps.taskTimeoutMs ?? taskTimeoutMs ?? TRANSLATE_TASK_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
  try {
    return await task(combined);
  } catch (error) {
    if (deadline.aborted && !signal?.aborted) {
      throw new AppError(504, "TRANSLATE_TIMEOUT", "翻译任务超时，请重试。");
    }
    if (error instanceof AppError) {
      throw error;
    }
    if (signal?.aborted) {
      throw new AppError(499, "TRANSLATE_CANCELLED", "已取消翻译。");
    }
    throw new AppError(502, "TRANSLATE_PROVIDER_ERROR", "模型调用失败，请重试。");
  } finally {
    taskInFlight = false;
  }
}

function stale(): AppError {
  return new AppError(409, "TRANSLATE_ANALYSIS_STALE", "文档已变化，请重新判定。");
}

function proseCheck(segments: readonly Segment[], chars: number): void {
  if (segments.length === 0) {
    throw new AppError(400, "TRANSLATE_EMPTY_INPUT", "这篇文档没有可翻译的正文。");
  }
  if (chars > TRANSLATE_MAX_PROSE_CHARS) {
    throw new AppError(413, "TRANSLATE_INPUT_TOO_LARGE", "正文过长，请先删减或分段转换后再翻译。");
  }
}

function toPromptBlocks(segments: readonly Segment[]): PromptBlock[] {
  return segments.map((segment) => ({ i: segment.index, t: segment.text }));
}

function modelLabel(config: EffectiveModelConfig): string | null {
  return config.model;
}

async function callerFor(
  deps: TranslateDeps,
  signal: AbortSignal,
): Promise<{ call: ReturnType<typeof createModelCaller>; config: EffectiveModelConfig }> {
  const settings = await (deps.readSettings ?? readSettingsFromStore)();
  const config = resolveEffectiveModel(settings, deps.env);
  const call = createModelCaller(config, { deps: deps.deps, signal, timeoutMs: deps.callTimeoutMs });
  return { call, config };
}

/** Labels every block and reports how much of the prose is already in the target language. */
export async function analyzeTranslation({
  markdown,
  targetLanguage,
  signal,
  deps = {},
}: AnalyzeOptions): Promise<AnalyzeResponse> {
  // Segmentation and batching are pure work: they run before the lock so the
  // deadline can be sized from the real batch count (FSD §5).
  const segments = segmentMarkdown(markdown);
  const translatable = translatableSegments(segments);
  proseCheck(translatable, translatable.reduce((total, segment) => total + segment.text.length, 0));
  const batches = batchBlocks(toPromptBlocks(translatable));

  return withTask(
    deps,
    signal,
    async (taskSignal) => {
      const started = (deps.now ?? Date.now)();
      const { call, config } = await callerFor(deps, taskSignal);
      const languages = new Map<number, string>();
      for (const batch of batches) {
        for (const entry of await requestAnalyze(call, batch)) {
          languages.set(entry.i, entry.lang);
        }
      }

      return {
        analysis: buildAnalysis(segments, languages, targetLanguage),
        warnings: [],
        meta: { targetLanguage, model: modelLabel(config), durationMs: (deps.now ?? Date.now)() - started },
      };
    },
    translateTaskTimeoutMs(batches.length),
  );
}

/** Translates the blocks selected by `scope` and reassembles the document byte for byte. */
export async function runTranslation({
  markdown,
  targetLanguage,
  analysis,
  scope,
  signal,
  deps = {},
}: RunOptions): Promise<RunResponse> {
  const segments = segmentMarkdown(markdown);
  assertBlockAlignment(segments, analysis.blocks);
  if (analysis.targetLanguage !== targetLanguage) {
    throw stale();
  }

  const translatable = translatableSegments(segments);
  const proseChars = translatable.reduce((total, segment) => total + segment.text.length, 0);
  proseCheck(translatable, proseChars);

  const languages = new Map(analysis.blocks.map((block) => [block.index, block.language]));
  const selected = translatable.filter(
    (segment) => scope === "all" || languages.get(segment.index) !== "target",
  );
  const chars = selected.reduce((total, segment) => total + segment.text.length, 0);
  if (chars > TRANSLATE_MAX_PROSE_CHARS) {
    throw new AppError(413, "TRANSLATE_INPUT_TOO_LARGE", "正文过长，请先删减或分段转换后再翻译。");
  }

  const batches = batchBlocks(toPromptBlocks(selected));

  return withTask(
    deps,
    signal,
    async (taskSignal) => {
      const started = (deps.now ?? Date.now)();
      const { call, config } = await callerFor(deps, taskSignal);
      const meta = { targetLanguage, model: modelLabel(config), scope };
      if (selected.length === 0) {
        return {
          markdown,
          warnings: [NO_TRANSLATABLE_BLOCKS],
          meta: { ...meta, batches: 0, translatedBlocks: 0, durationMs: (deps.now ?? Date.now)() - started },
        };
      }

      const translations = new Map<number, string>();
      for (const batch of batches) {
        for (const entry of await requestTranslation(call, batch, targetLanguage)) {
          translations.set(entry.i, entry.t);
        }
      }

      return {
        markdown: reassemble(segments, translations),
        warnings: [],
        meta: {
          ...meta,
          batches: batches.length,
          translatedBlocks: selected.length,
          durationMs: (deps.now ?? Date.now)() - started,
        },
      };
    },
    translateTaskTimeoutMs(batches.length),
  );
}
