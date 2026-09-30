/**
 * Read-only scan of a local directory for `.md` documents and their dedup state.
 *
 * One level only (V7): subdirectories are the user's own structure, and an output's
 * `<title>.images/` sibling would be walked for nothing.
 */
import { open, readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AppError } from "@/lib/errors";
import { decideLocalDoc, localDocFilename, parseDocMarker, type LocalDocState } from "./dedup";
import { isMarkdownFileName, isSafeDirectoryPath } from "./paths";

export const MAX_SCANNED_FILES = 500;

/** The marker line is short; reading a whole multi-megabyte product just to see it is waste. */
const MARKER_READ_BYTES = 4096;

const FS_CODE_MESSAGES: Record<string, string> = {
  ENOENT: "目录不存在。",
  EACCES: "没有读取权限。",
  EPERM: "没有读取权限。",
  ENOTDIR: "扫描目录不合法。",
};

export type ScannedLocalDoc = {
  name: string;
  size: number;
  mtimeMs: number;
  state: LocalDocState;
};

export type LocalDocsScanResult = {
  dirPath: string;
  downloadsDir: string;
  files: ScannedLocalDoc[];
  truncated: boolean;
};

export type ScanLocalDocsInput = {
  /** Absolute directory to scan; omitted = the system Downloads directory. */
  dirPath?: unknown;
  /** Directory products are written to; omitted = every file is reported as `new`. */
  outputDir?: unknown;
};

/** The desktop app passes `app.getPath("downloads")` through the server environment (V6). */
export function defaultDownloadsDir(env: Record<string, string | undefined> = process.env): string {
  return env.MD_CONVERTOR_DOWNLOADS_DIR?.trim() || path.join(os.homedir(), "Downloads");
}

function asFsError(error: unknown, fallbackCode: string, fallbackMessage: string): AppError {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  if (code && FS_CODE_MESSAGES[code]) return new AppError(400, code, FS_CODE_MESSAGES[code]);
  return new AppError(500, fallbackCode, fallbackMessage);
}

function requireSafeDir(value: unknown, code: string, message: string): string {
  if (!isSafeDirectoryPath(value)) throw new AppError(400, code, message);
  return value;
}

/** First chunk of a file, or null when it does not exist. */
async function readFirstChunk(filePath: string): Promise<string | null> {
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(filePath, "r");
    const buffer = Buffer.alloc(MARKER_READ_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, MARKER_READ_BYTES, 0);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  } finally {
    await handle?.close();
  }
}

async function stateFor(name: string, sourcePath: string, stats: { size: number; mtimeMs: number }, outputDir: string | null): Promise<LocalDocState> {
  if (outputDir === null) return "new";
  const outputPath = path.join(outputDir, localDocFilename(name));
  const head = await readFirstChunk(outputPath);
  const marker = head === null ? null : parseDocMarker(head);
  return decideLocalDoc(marker, { source: sourcePath, size: stats.size, mtimeMs: stats.mtimeMs }, outputPath);
}

export async function scanLocalDocs(
  input: ScanLocalDocsInput,
  env: Record<string, string | undefined> = process.env,
): Promise<LocalDocsScanResult> {
  const downloadsDir = defaultDownloadsDir(env);
  const dirPath = requireSafeDir(input.dirPath ?? downloadsDir, "INVALID_DIR_PATH", "目录不合法。");
  const outputDir = input.outputDir === undefined
    ? null
    : requireSafeDir(input.outputDir, "INVALID_DIR_PATH", "目录不合法。");

  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    throw asFsError(error, "SCAN_FAILED", "无法读取该目录。");
  }

  const names = entries
    .filter((entry) => entry.isFile() && isMarkdownFileName(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "en"));

  const files: ScannedLocalDoc[] = [];
  for (const name of names.slice(0, MAX_SCANNED_FILES)) {
    const sourcePath = path.join(dirPath, name);
    let stats;
    try {
      stats = await stat(sourcePath);
    } catch {
      continue; // vanished between readdir and stat
    }
    files.push({
      name,
      size: stats.size,
      mtimeMs: stats.mtimeMs,
      state: await stateFor(name, sourcePath, stats, outputDir),
    });
  }

  return { dirPath, downloadsDir, files, truncated: names.length > MAX_SCANNED_FILES };
}
