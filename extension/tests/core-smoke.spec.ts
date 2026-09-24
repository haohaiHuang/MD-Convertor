import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

// Runs the esbuild bundle in a real page context, which is the only thing that proves the core
// has no Node-only dependency left (jsdom/domino would throw here, not in vitest).
const projectRoot = path.resolve(__dirname, "../..");
const fixturePath = path.join(projectRoot, "extension/tests/fixtures/article.html");
const corePath = path.join(projectRoot, "extension/dist-test/core.js");
const convertedAt = "2026-09-24T00:00:00.000Z";

type SmokeResult = {
  title: string;
  markdown: string;
  images: { index: number; url: string; placeholder: string }[];
};

test("the core bundle converts an article inside a real page", async ({ page }) => {
  await page.setContent(readFileSync(fixturePath, "utf8"));
  await page.addScriptTag({ path: corePath });

  const result = (await page.evaluate((timestamp) => {
    const core = (
      globalThis as unknown as {
        mdConvertorCore?: {
          buildArticle: (document: Document, sourceUrl: string, deps: unknown) => unknown;
        };
      }
    ).mdConvertorCore;
    if (!core) return null;

    return core.buildArticle(document, "https://example.com/post", {
      sanitize: (html: string) => html,
      now: () => timestamp,
    });
  }, convertedAt)) as SmokeResult | null;

  expect(result).not.toBeNull();
  expect(result?.title).toContain("示例文章标题");
  expect(result?.images).toEqual([
    { index: 1, url: "https://example.com/images/lazy.png", placeholder: "md-convertor-image-1" },
  ]);
  expect(result?.markdown).toContain(`> 转换时间：${convertedAt}`);
  expect(result?.markdown).toContain("md-convertor-image-1");
  expect(result?.markdown).toContain("| 列A |");
  expect(result?.markdown).not.toContain("javascript:");
  expect(result?.markdown).not.toContain("<script");
});
