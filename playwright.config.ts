import { defineConfig, devices } from "@playwright/test";

// Firefox applies its own macOS Seatbelt profile to its content process, and macOS refuses nested
// sandboxes: a process that is already sandboxed cannot call sandbox_init() again. Inside the agent
// sandbox Firefox therefore dies with `sandbox_init() failed with error "Operation not permitted"`
// and every case burns the 30s timeout. Firefox ships this switch for exactly that situation.
// `??=` keeps an explicit caller value, so the sandbox can be put back with
// `MOZ_DISABLE_CONTENT_SANDBOX=0 npm run test:e2e`. This does not weaken what the suite proves: it
// only loads pages served from 127.0.0.1:3000 out of this repository, so there is no untrusted
// content for the content-process sandbox to contain. The pref equivalent
// (`security.sandbox.content.level: 0`) does NOT work here - it was measured to kill the process.
process.env.MOZ_DISABLE_CONTENT_SANDBOX ??= "1";

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
