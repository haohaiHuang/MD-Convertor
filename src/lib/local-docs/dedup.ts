/**
 * Deduplication markers for local document processing.
 *
 * A processed output starts with one HTML comment line carrying the marker (V3). The
 * marker is the only state: no index file, no sidecar. Delete the output and the
 * document becomes "new" again.
 */
import { cleanFilenameStem } from "@/lib/markdown";

export type LocalDocSource = {
  source: string;
  size: number;
  mtimeMs: number;
};

export type DocMarker = LocalDocSource & {
  sha256: string;
  outputPath: string;
  processedAt: string;
};

export type LocalDocState = "new" | "skip" | "check";

const MARKER_PREFIX = "<!-- md-convertor: ";
const MARKER_MATCH = /^<!--\s*md-convertor:\s*(\{.*\})\s*-->$/;
const MARKER_KEYS = ["source", "size", "mtimeMs", "sha256", "outputPath", "processedAt"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value);
  return keys.length === MARKER_KEYS.length && MARKER_KEYS.every((key) => keys.includes(key));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function buildDocMarker(marker: DocMarker): string {
  return `${MARKER_PREFIX}${JSON.stringify({
    source: marker.source,
    size: marker.size,
    mtimeMs: marker.mtimeMs,
    sha256: marker.sha256,
    outputPath: marker.outputPath,
    processedAt: marker.processedAt,
  })} -->`;
}

/** Reads the marker line at the top of a processed document; malformed markers are "no marker". */
export function parseDocMarker(markdownText: string): DocMarker | null {
  const firstLine = String(markdownText).split("\n", 1)[0].trim();
  const match = MARKER_MATCH.exec(firstLine);
  if (!match) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1]);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || !hasExactKeys(parsed)) return null;

  const { source, size, mtimeMs, sha256, outputPath, processedAt } = parsed;
  if (!isNonEmptyString(source) || !isNonEmptyString(sha256) || !isNonEmptyString(outputPath)) return null;
  if (!isNonEmptyString(processedAt) || !isFiniteNumber(size) || !isFiniteNumber(mtimeMs)) return null;

  return { source, size, mtimeMs, sha256, outputPath, processedAt };
}

/** Drops the marker line so a translation model never sees it; a document without one is returned as-is. */
export function stripDocMarker(markdownText: string): string {
  if (parseDocMarker(markdownText) === null) return markdownText;
  const breakIndex = markdownText.indexOf("\n");
  return breakIndex === -1 ? "" : markdownText.slice(breakIndex + 1);
}

/**
 * `skip` = the output is this source's up-to-date product; `check` = the marker exists but
 * the source's size/mtime moved, so hashing decides (git checkout, iCloud sync).
 */
export function decideLocalDoc(
  marker: DocMarker | null,
  file: LocalDocSource,
  outputPath: string,
): LocalDocState {
  if (!marker) return "new";
  if (marker.source !== file.source || marker.outputPath !== outputPath) return "new";
  if (marker.size !== file.size || marker.mtimeMs !== file.mtimeMs) return "check";
  return "skip";
}

/**
 * Output name derived from the source name so a scan can predict the product path (V2).
 *
 * Cleaning is lossy (`?` and `*` both become `-`), so a name that had to change carries a short
 * deterministic hash of its original stem. Without it, two sources cleaned onto one name and the
 * second write silently overwrote the first — and the marker's `source` then flip-flopped, so the
 * lost document looked "new" on every later scan.
 */
export function localDocFilename(sourceFileName: string): string {
  const original = String(sourceFileName).replace(/\.md$/i, "");
  const cleaned = cleanFilenameStem(original);
  const base = cleaned.replace(/-+$/, "") || "document";
  if (cleaned === original) return `${cleaned || "document"}.md`;
  return `${base}-${stemHash(original)}.md`;
}

/** FNV-1a over UTF-16 code units: no `node:crypto`, so the name is identical in every runtime. */
function stemHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
