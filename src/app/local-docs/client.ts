/**
 * Local-document batch tooling (S3): the two read-only API calls plus the serial run loop.
 *
 * The loop takes `processDoc` / `saveFile` as arguments so it can be tested without a
 * server or a preload bridge — the same code runs in production and in `client.test.ts`.
 */
import { applyRowStatus, nextPending, withoutTrailingSlash, type BatchRow } from "@/lib/local-docs/batch";
import type { ProcessLocalDocResult } from "@/lib/local-docs/process";
import type { LocalDocsScanResult } from "@/lib/local-docs/scan";

import { outputCodeMessage, requestJson, type OutputResult } from "../settings/client";

export type ScanRequest = {
  /** Omitted = the system Downloads directory, resolved by the route (V6). */
  dirPath: string | null;
  /** Omitted = every file is reported as `new`. */
  outputDir: string | null;
};

export type ProcessRequest = {
  path: string;
  outputPath: string;
  force: boolean;
  translate: boolean;
  targetLanguage: string;
};

export type BatchRunContext = {
  inputDir: string;
  outputDir: string;
  translate: boolean;
  targetLanguage: string;
  processDoc(request: ProcessRequest): Promise<ProcessLocalDocResult>;
  saveFile(dirPath: string, filename: string, content: string): Promise<OutputResult>;
  onRows?(rows: BatchRow[]): void;
};

function compact(request: ScanRequest): string {
  const body: Record<string, string> = {};
  if (request.dirPath) body.dirPath = request.dirPath;
  if (request.outputDir) body.outputDir = request.outputDir;
  return JSON.stringify(body);
}

export function scanDirectory(request: ScanRequest): Promise<LocalDocsScanResult> {
  return requestJson<LocalDocsScanResult>("/api/local-docs/scan", { method: "POST", body: compact(request) });
}

export function processDocument(request: ProcessRequest): Promise<ProcessLocalDocResult> {
  return requestJson<ProcessLocalDocResult>("/api/local-docs/process", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

function joinDocPath(dirPath: string, name: string): string {
  return `${withoutTrailingSlash(dirPath)}/${name}`;
}

export function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * One document at a time: the write of row *n* is finished before row *n+1* starts. A row
 * that fails is marked and the run continues — a batch is not all-or-nothing.
 */
export async function runBatch(rows: readonly BatchRow[], ctx: BatchRunContext): Promise<BatchRow[]> {
  let current = [...rows];
  const publish = (): void => ctx.onRows?.(current);
  publish();

  for (;;) {
    const entry = nextPending(current);
    if (entry === null) break;

    current = applyRowStatus(current, entry.id, { status: { phase: "running" } });
    publish();

    try {
      const result = await ctx.processDoc({
        path: joinDocPath(ctx.inputDir, entry.name),
        outputPath: ctx.outputDir,
        force: entry.forced,
        translate: ctx.translate,
        targetLanguage: ctx.targetLanguage,
      });

      if (result.skipped) {
        current = applyRowStatus(current, entry.id, { status: { phase: "skipped" } });
      } else {
        const saved = await ctx.saveFile(ctx.outputDir, result.filename, result.markdown);
        if (!saved.ok) throw new Error(outputCodeMessage(saved.code, "文件写入失败。"));
        current = applyRowStatus(current, entry.id, {
          status: { phase: "done", embedded: result.stats.embedded, kept: result.stats.kept },
        });
      }
    } catch (error) {
      current = applyRowStatus(current, entry.id, {
        status: { phase: "failed", message: errorText(error, "处理失败。") },
      });
    }
    publish();
  }

  return current;
}
