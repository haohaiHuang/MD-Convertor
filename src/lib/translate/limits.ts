/**
 * Translation limits and timeouts (FSD §5). Every ceiling the pipeline enforces
 * lives here so the routes, the batching and the providers cannot drift apart.
 */
export const TRANSLATE_MAX_PROSE_CHARS = 200_000;

export const TRANSLATE_BATCH_MAX_BLOCKS = 20;

export const TRANSLATE_BATCH_MAX_CHARS = 8_000;

/**
 * One model call. Cloud reasoning models emit thousands of reasoning tokens
 * before the answer (measured: 38-60s for a single small batch), so a 60s
 * ceiling cut every call off mid-body. The task budget below uses this same
 * value, so raising it also stretches the whole-task deadline.
 */
export const TRANSLATE_CALL_TIMEOUT_MS = 180_000;

/**
 * Floor for a whole task, kept for short documents: one call plus overhead.
 * A fixed ceiling does not work for long articles, because batching counts
 * blocks as well as characters: a 9,000-character article of 150 short
 * paragraphs becomes eight batches and needs far more than two minutes.
 */
export const TRANSLATE_TASK_TIMEOUT_MS = 120_000;

/** Room for configuration lookup, the last batch and reassembly. */
export const TRANSLATE_TASK_BASE_TIMEOUT_MS = 30_000;

/**
 * Total task budget: one call ceiling per batch plus fixed overhead, never
 * below `TRANSLATE_TASK_TIMEOUT_MS`. Each batch is still cut off by
 * `TRANSLATE_CALL_TIMEOUT_MS`, so a stuck call cannot hold the task open.
 */
export function translateTaskTimeoutMs(batchCount: number): number {
  return Math.max(TRANSLATE_TASK_TIMEOUT_MS, batchCount * TRANSLATE_CALL_TIMEOUT_MS + TRANSLATE_TASK_BASE_TIMEOUT_MS);
}

/**
 * Request body ceiling for the two translate endpoints. The body carries the
 * converted document, which may hold base64 images, so it is sized off the
 * 20 MiB markdown ceiling plus room for JSON escaping.
 */
export const TRANSLATE_MAX_REQUEST_BYTES = 40 * 1024 * 1024;
