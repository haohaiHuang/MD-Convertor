/**
 * Server-side directory/file guard for local document processing.
 *
 * Kept in parity with `electron/preload-contract.cjs` (`isAbsoluteDirPath`): the preload
 * runs in a sandbox that cannot require this file, so both sides carry their own copy and
 * `paths.parity.test.ts` fails if they drift. Neither side is allowed to trust the other.
 */

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

/** Requested directory, or the system Downloads directory when the request omits one. */
export function resolveScanDir(dirPath: string | undefined, downloadsDir: string): string {
  return dirPath ?? downloadsDir;
}
