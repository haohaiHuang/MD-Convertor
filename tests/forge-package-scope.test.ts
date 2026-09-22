import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { isPackaged, projectRoot } from "./packaged-app-scope";

/**
 * What the running application actually reads: Electron resolves `main` from package.json and
 * loads the Electron-side modules through `import.meta.dirname` relative imports. Everything
 * else the repository contains is a development artifact.
 */
const RUNTIME_FILES = [
  "package.json",
  "electron",
  "electron/main.mjs",
  "electron/preload.cjs",
  "electron/preload-contract.cjs",
  "electron/env.mjs",
  "electron/output.mjs",
  "electron/runtime-secrets.mjs",
  "electron/server-binary.mjs",
  "electron/secrets.mjs",
];

const RUNTIME_MISSING_MESSAGE = "is read at runtime and must stay in the bundle";

describe("packaged app scope", () => {
  it.each(RUNTIME_FILES)("keeps %s", async (file) => {
    expect(await isPackaged(file), `${file} ${RUNTIME_MISSING_MESSAGE}`).toBe(true);
  });

  it("keeps the Electron-side test files out of the bundle", async () => {
    for (const file of ["electron/output.test.mjs", "electron/preload.test.cjs", "electron/preload-contract.test.cjs"]) {
      expect(await isPackaged(file), `${file} is a test and must not ship`).toBe(false);
    }
  });

  it("packages every module the Electron entry point imports", async () => {
    const entrySource = readFileSync(path.join(projectRoot, "electron", "main.mjs"), "utf8");
    const relativeImports = [...entrySource.matchAll(/\bfrom\s+"(\.\/[^"]+)"/g)].map((match) => match[1]);
    // Guard the guard: if the extraction regexp ever stops matching, this suite would silently
    // pass while checking nothing.
    expect(relativeImports.length).toBeGreaterThan(3);
    for (const importPath of relativeImports) {
      const packagedPath = `electron/${importPath.slice(2)}`;
      expect(await isPackaged(packagedPath), `${packagedPath} is imported by electron/main.mjs`).toBe(true);
    }
  });

  it.each([
    ["documentation", "docs/PRODUCT.md"],
    ["the release plan", "docs/features/default-save-path/S3-release.md"],
    ["application source", "src/app/page.tsx"],
    ["a unit test", "tests/app-icon.test.ts"],
    ["an end-to-end test", "e2e/home.spec.ts"],
    ["a maintenance script", "scripts/release-desktop.mjs"],
    ["agent scratch state", ".workbuddy/memory/2026-09-22.md"],
    ["workspace state", "PROGRESS.md"],
    ["a session handoff", "session-handoff.md"],
    ["the feature ledger", "feature_list.json"],
    ["agent instructions", "AGENTS.md"],
    ["a changelog", "CHANGELOG.md"],
    ["a localized changelog", "CHANGELOG.zh.md"],
    ["a readme", "README.md"],
    ["a verification entry point", "init.sh"],
    ["the packaging config", "forge.config.cjs"],
    ["the Next.js config", "next.config.ts"],
    ["the Playwright config", "playwright.config.ts"],
    ["the Vitest config", "vitest.config.ts"],
    ["a Vitest config", "vitest.live.config.ts"],
    ["the ESLint config", "eslint.config.mjs"],
    ["the TypeScript config", "tsconfig.json"],
    ["TypeScript build output", "tsconfig.tsbuildinfo"],
    ["Next.js ambient types", "next-env.d.ts"],
    ["the Next.js public directory", "public/icon.png"],
    ["icon build inputs", "assets/icon.icns"],
    ["the built frontend", ".next/BUILD_ID"],
    ["the prepared desktop server", ".desktop/server/server.js"],
    ["the dependency tree", "node_modules/turndown/lib/turndown.cjs"],
    ["a coverage report", "coverage/index.html"],
    ["a Playwright report", "playwright-report/index.html"],
    ["Playwright test output", "test-results/.last-run.json"],
  ])("leaves %s (%s) out of the bundle", async (_label, relativePath) => {
    expect(await isPackaged(relativePath), `${relativePath} is a development artifact`).toBe(false);
  });
});
