import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["e2e/**", "tests/live/**", "node_modules/**", "extension/tests/**/*.spec.ts"],
    coverage: {
      reporter: ["text", "html"],
      include: [
        "src/lib/**/*.ts",
        "src/app/api/convert/route.ts",
        "src/app/api/translate/analyze/route.ts",
        "src/app/api/translate/run/route.ts",
        "extension/src/**/*.ts",
      ],
      // `content.ts` / `worker.ts` are browser-only entry points (DOM + `chrome.*`); they are
      // exercised by `npm run test:extension`, which produces no vitest coverage. Everything
      // worth measuring lives behind an injected `deps` in `worker-run.ts` et al.
      exclude: [
        "src/**/*.test.ts",
        "src/types/**",
        "extension/src/**/*.test.ts",
        "extension/src/content.ts",
        "extension/src/worker.ts",
      ],
      thresholds: {
        "extension/src/convert/extract.ts": { lines: 90, branches: 80, functions: 100, statements: 90 },
        "extension/src/convert/images.ts": { lines: 90, branches: 80, functions: 100, statements: 90 },
        "extension/src/convert/markdown.ts": { lines: 90, branches: 80, functions: 100, statements: 90 },
        "extension/src/convert/naming.ts": { lines: 90, branches: 80, functions: 100, statements: 90 },
        "src/lib/api-security.ts": { lines: 80, branches: 70, functions: 100, statements: 80 },
        "src/lib/browser.ts": { lines: 90, branches: 80, functions: 50, statements: 90 },
        "src/lib/browser-proxy.ts": { lines: 85, branches: 75, functions: 90, statements: 85 },
        "src/lib/convert.ts": { lines: 85, branches: 50, functions: 100, statements: 85 },
        "src/lib/rate-limit.ts": { lines: 80, branches: 80, functions: 100, statements: 80 },
        "src/lib/security/url.ts": { lines: 80, branches: 75, functions: 100, statements: 80 },
        "src/lib/translate/analysis.ts": { lines: 95, branches: 90, functions: 100, statements: 95 },
        "src/lib/translate/client.ts": { lines: 95, branches: 90, functions: 100, statements: 95 },
        "src/lib/translate/decision.ts": { lines: 95, branches: 90, functions: 100, statements: 95 },
        "src/lib/translate/filename.ts": { lines: 95, branches: 90, functions: 100, statements: 95 },
        "src/lib/translate/prompt.ts": { lines: 95, branches: 85, functions: 100, statements: 95 },
        "src/lib/translate/request.ts": { lines: 95, branches: 90, functions: 100, statements: 95 },
        "src/lib/translate/run.ts": { lines: 95, branches: 85, functions: 100, statements: 95 },
        "src/lib/translate/segment.ts": { lines: 90, branches: 75, functions: 100, statements: 90 },
        "src/lib/translate/provider/local-cli.ts": { lines: 95, branches: 90, functions: 100, statements: 95 },
        "src/lib/translate/provider/openai-compatible.ts": { lines: 95, branches: 90, functions: 100, statements: 95 },
        "src/lib/translate/provider/provider.ts": { lines: 95, branches: 90, functions: 100, statements: 95 },
        "src/lib/translate/provider/test-provider.ts": { lines: 85, branches: 85, functions: 100, statements: 85 },
        "src/app/api/convert/route.ts": { lines: 75, branches: 70, functions: 100, statements: 75 },
        "src/app/api/translate/analyze/route.ts": { lines: 90, branches: 80, functions: 100, statements: 90 },
        "src/app/api/translate/run/route.ts": { lines: 90, branches: 80, functions: 100, statements: 90 },
      },
    },
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
