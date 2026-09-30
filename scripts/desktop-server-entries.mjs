/**
 * What `scripts/prepare-desktop.mjs` copies into `.desktop/server`, and therefore the only
 * things the packaged app's `Contents/Resources/server` contains.
 *
 * `next build` (output: "standalone") mirrors the whole repository into `.next/standalone` —
 * `docs/`, `src/`, `tests/`, `PROGRESS.md`, and even `out/` + `.desktop/` when a build follows a
 * `desktop:make`. None of that is read at runtime, so the copy is an explicit whitelist instead
 * of the whole mirror: the bundle stays the same size no matter what state the repository is in.
 */
export const DESKTOP_SERVER_ENTRIES = Object.freeze([
  "server.js",
  "package.json",
  ".next",
  "node_modules",
]);

/** Copied in from outside the standalone mirror: the Playwright shell and the Next.js public directory. */
export const DESKTOP_SERVER_EXTRA_ENTRIES = Object.freeze(["public", "browser"]);

/** Every top-level entry of `.desktop/server`; asserted by tests/desktop-server-scope.test.mjs. */
export const DESKTOP_SERVER_SCOPE = Object.freeze([
  ...DESKTOP_SERVER_ENTRIES,
  ...DESKTOP_SERVER_EXTRA_ENTRIES,
]);

/** Entries the server, the bundled renderer and the extension download link need to resolve. */
export const DESKTOP_SERVER_REQUIRED_FILES = Object.freeze([
  "server.js",
  ".next/required-server-files.json",
  "public/md-convertor-extension.zip",
  "browser/chrome-headless-shell",
]);
