import { defineConfig, devices } from "@playwright/test";

// Smoke-only config for the extension core. Deliberately separate from `playwright.config.ts`:
// the core is pure DOM code, so there is no `webServer`, no baseURL and no desktop projects.
// `MD_CONVERTOR_EXTENSION_CHROMIUM_ARGS` lets a sandboxed shell pass `--no-sandbox,--disable-gpu`.
const chromiumArgs = (process.env.MD_CONVERTOR_EXTENSION_CHROMIUM_ARGS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export default defineConfig({
  testDir: "./extension/tests",
  // `extension/tests/extension-build.test.mjs` is a vitest file that lives in this directory;
  // only the browser smoke specs belong to Playwright.
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: chromiumArgs.length > 0 ? { launchOptions: { args: chromiumArgs } } : {},
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
