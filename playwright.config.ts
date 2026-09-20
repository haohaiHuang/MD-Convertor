import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // The translation engine holds a process-wide task lock (429 TRANSLATE_BUSY), so two
  // specs that translate at the same time would race against that single slot. One worker
  // keeps the whole suite deterministic instead of leaving a load-dependent flake.
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    // Mirrors the Electron session header injection in electron/main.mjs so the e2e
    // run can exercise the real local API. Must match E2E_SESSION_TOKEN in
    // scripts/start-e2e-server.mjs.
    extraHTTPHeaders: { "x-md-convertor-token": "md-convertor-e2e-token" },
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  webServer: {
    command: "node scripts/start-e2e-server.mjs",
    url: "http://127.0.0.1:3000/health",
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 1_000 },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
