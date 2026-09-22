/**
 * Channel names and value limits shared by the main process and the bridges.
 *
 * `electron/preload.cjs` cannot require this file: Electron sandboxed preloads only
 * resolve built-in modules, so the preload repeats these values and
 * `electron/preload.test.cjs` asserts the copies stay in sync.
 */
const CHANNELS = Object.freeze({
  set: "md-convertor:secrets:set",
  clear: "md-convertor:secrets:clear",
  status: "md-convertor:secrets:status",
  selectDirectory: "md-convertor:output:select-directory",
  saveFile: "md-convertor:output:save-file",
});

const PROVIDER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const MAX_SECRET_LENGTH = 8192;

function isValidProviderId(value) {
  return typeof value === "string" && PROVIDER_ID_PATTERN.test(value);
}

/** A file name only — no separators, no traversal, no home shorthand. */
function isValidOutputFilename(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 255
    && !value.includes("/")
    && !value.includes("\\")
    && !value.includes("..");
}

/**
 * Absolute POSIX directory path without traversal or home-shorthand segments.
 * Deliberately light (no node:path in the sandbox preload); main re-checks with
 * real path semantics.
 *
 * A tilde is home shorthand only when it *starts* a segment. iCloud Drive lives
 * under `com~apple~CloudDocs`, so rejecting every tilde made the directories that
 * real users pick unusable.
 */
function isAbsoluteDirPath(value) {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return false;
  }
  return !value.split("/").some((segment) => segment === ".." || segment.startsWith("~"));
}

module.exports = {
  CHANNELS,
  PROVIDER_ID_PATTERN,
  MAX_SECRET_LENGTH,
  isValidProviderId,
  isValidOutputFilename,
  isAbsoluteDirPath,
};
