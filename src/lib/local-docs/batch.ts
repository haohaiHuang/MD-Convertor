/**
 * Planning and bookkeeping for the local-document batch (S3).
 *
 * Pure: no I/O, no Node built-ins, no React — the homepage panel bundles this into the
 * browser, so everything worth testing lives here instead of inside the component.
 */
import type { LocalDocState } from "./dedup";
import type { ScannedLocalDoc } from "./scan";

export type BatchRowStatus =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "done"; embedded: number; kept: number }
  | { phase: "skipped" }
  | { phase: "failed"; message: string };

export type BatchRow = {
  /** The scan's file name; unique inside one directory, so it doubles as the row key. */
  id: string;
  name: string;
  size: number;
  mtimeMs: number;
  state: LocalDocState;
  checked: boolean;
  /** Set when the user ticks the row: an already-processed document is dispatched with `force`
   *  even though its state is `skip`. Ticking is what replaces the old 重新处理 button (L4). */
  forced: boolean;
  status: BatchRowStatus;
};

export type BatchRefusal = "no-bridge" | "no-output" | "same-dir";

export type BatchPlan = {
  rows: BatchRow[];
  /** Non-null ⇒ 一键转换 stays disabled and the panel explains why. */
  refusal: BatchRefusal | null;
  /** Set with `same-dir`: what the one-click fix writes to the output setting. */
  suggestedOutputDir: string | null;
};

export type BatchSummary = {
  done: number;
  skipped: number;
  failed: number;
  embeddedImages: number;
  keptImages: number;
};

export type BatchPlanInput = {
  inputDir: string | null;
  outputDir: string | null;
  hasBridge: boolean;
};

function withoutTrailingSlash(dirPath: string): string {
  return dirPath.replace(/\/+$/, "") || "/";
}

/** Same directory, not the same string: the user's trailing slash (or lack of one) is noise. */
export function isSameDirectory(left: string, right: string): boolean {
  return withoutTrailingSlash(left) === withoutTrailingSlash(right);
}

/** `<输入目录>/processed` — the one-click way out of the same-directory refusal. */
export function processedOutputDir(inputDir: string): string {
  return `${withoutTrailingSlash(inputDir)}/processed`;
}

/**
 * Turns a scan into the list the panel renders. Refusals never hide the rows: an empty
 * panel would leave the user with no idea what is wrong.
 */
export function planBatch(files: readonly ScannedLocalDoc[], input: BatchPlanInput): BatchPlan {
  const rows: BatchRow[] = files.map((file) => ({
    id: file.name,
    name: file.name,
    size: file.size,
    mtimeMs: file.mtimeMs,
    state: file.state,
    checked: file.state !== "skip",
    forced: false,
    status: { phase: "idle" },
  }));

  if (!input.hasBridge) return { rows, refusal: "no-bridge", suggestedOutputDir: null };
  if (!input.outputDir) return { rows, refusal: "no-output", suggestedOutputDir: null };
  if (input.inputDir && isSameDirectory(input.inputDir, input.outputDir)) {
    return { rows, refusal: "same-dir", suggestedOutputDir: processedOutputDir(input.inputDir) };
  }
  return { rows, refusal: null, suggestedOutputDir: null };
}

/** Immutable single-row patch; an unknown id is a no-op rather than a mid-run exception. */
export function applyRowStatus(
  rows: readonly BatchRow[],
  id: string,
  patch: Partial<Omit<BatchRow, "id">>,
): BatchRow[] {
  return rows.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry));
}

/** The next row to dispatch: checked, and not started yet. */
export function nextPending(rows: readonly BatchRow[]): BatchRow | null {
  return rows.find((entry) => entry.checked && entry.status.phase === "idle") ?? null;
}

export function summarize(rows: readonly BatchRow[]): BatchSummary {
  const summary: BatchSummary = { done: 0, skipped: 0, failed: 0, embeddedImages: 0, keptImages: 0 };
  for (const entry of rows) {
    if (entry.status.phase === "done") {
      summary.done += 1;
      summary.embeddedImages += entry.status.embedded;
      summary.keptImages += entry.status.kept;
    } else if (entry.status.phase === "skipped") {
      summary.skipped += 1;
    } else if (entry.status.phase === "failed") {
      summary.failed += 1;
    }
  }
  return summary;
}
