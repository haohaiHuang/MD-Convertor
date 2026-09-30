/**
 * Server-side directory/file guard for local document processing.
 *
 * Kept in parity with `electron/preload-contract.cjs` (`isAbsoluteDirPath`): the preload
 * runs in a sandbox that cannot require this file, so both sides carry their own copy and
 * `paths.parity.test.ts` fails if they drift. Neither side is allowed to trust the other.
 */
import { AppError } from "@/lib/errors";

/** Absolute POSIX directory path without traversal or home-shorthand segments. */
export function isSafeDirectoryPath(value: unknown): value is string {
  if (typeof value !== "string" || !value.startsWith("/")) return false;
  // A tilde is home shorthand only when it starts a segment: iCloud Drive lives under
  // `com~apple~CloudDocs`, so rejecting every tilde would refuse the directories users pick.
  return !value.split("/").some((segment) => segment === ".." || segment.startsWith("~"));
}

/** A bare `.md` file name — no separators, no traversal. */
export function isMarkdownFileName(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 255
    && /\.md$/i.test(value)
    && !value.includes("/")
    && !value.includes("\\")
    && !value.includes("..");
}

/**
 * Validated absolute directory path, or a 400. Both local-docs pipelines (scan, process) guard
 * their directories through here so the refusal stays identical.
 */
export function requireSafeDirectoryPath(value: unknown): string {
  if (!isSafeDirectoryPath(value)) throw new AppError(400, "INVALID_DIR_PATH", "目录不合法。");
  return value;
}
