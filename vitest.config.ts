import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["e2e/**", "tests/live/**", "node_modules/**"],
    coverage: {
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts", "src/app/api/convert/route.ts"],
      exclude: ["src/**/*.test.ts", "src/types/**"],
      thresholds: {
        "src/lib/api-security.ts": { lines: 80, branches: 70, functions: 100, statements: 80 },
        "src/lib/browser.ts": { lines: 90, branches: 80, functions: 50, statements: 90 },
        "src/lib/browser-proxy.ts": { lines: 85, branches: 75, functions: 90, statements: 85 },
        "src/lib/convert.ts": { lines: 85, branches: 50, functions: 100, statements: 85 },
        "src/lib/rate-limit.ts": { lines: 80, branches: 80, functions: 100, statements: 80 },
        "src/lib/security/url.ts": { lines: 80, branches: 75, functions: 100, statements: 80 },
        "src/app/api/convert/route.ts": { lines: 75, branches: 70, functions: 100, statements: 75 },
      },
    },
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
