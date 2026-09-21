import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    root: process.cwd(),
  },
  // Next.js traces Playwright's static requires but not the `browsers.json` data file that
  // `playwright-core` reads while loading, so the standalone server alone could not import
  // Playwright at all. Packaging hid that by re-copying the full package.
  outputFileTracingIncludes: {
    "/api/convert": ["node_modules/playwright-core/browsers.json"],
  },
};

export default nextConfig;
