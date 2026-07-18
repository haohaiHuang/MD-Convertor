import { chromium } from "playwright";
import { describe, expect, it } from "vitest";
import { convertUrlToMarkdown } from "@/lib/convert";
import { MAX_MARKDOWN_BYTES } from "@/lib/markdown";
import { DESKTOP_USER_AGENT } from "@/lib/user-agent";

const DEFAULT_LIVE_URL = "https://mp.weixin.qq.com/s/uFxJIK83ZEgW5QMjogujSw";
const CHUNK_SIZE = 80;

function comparableText(value: string): string {
  return value.normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, "").toLocaleLowerCase("zh-CN");
}

function sourceCoverage(sourceText: string, markdown: string): number {
  const source = comparableText(sourceText);
  const converted = comparableText(markdown.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, ""));
  if (!source) return 0;

  let coveredChars = 0;
  for (let start = 0; start < source.length; start += CHUNK_SIZE) {
    const chunk = source.slice(start, start + CHUNK_SIZE);
    if (converted.includes(chunk)) coveredChars += chunk.length;
  }
  return coveredChars / source.length;
}

describe("release-gate live webpage comparison", () => {
  it("matches the reviewed WeChat article in the same run", async () => {
    const sourceUrl = process.env.MD_CONVERTOR_LIVE_URL || DEFAULT_LIVE_URL;
    const browser = await chromium.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
    });

    let source: { title: string; text: string; imageCount: number };
    try {
      const context = await browser.newContext({ locale: "zh-CN", userAgent: DESKTOP_USER_AGENT });
      const page = await context.newPage();
      await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      const content = page.locator("#js_content");
      await expect.poll(async () => content.count()).toBe(1);
      source = await content.evaluate((element) => ({
        title: document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content.trim()
          || document.title.trim(),
        text: element.textContent || "",
        imageCount: Array.from(element.querySelectorAll("img")).filter((image) =>
          Boolean(image.getAttribute("data-src")?.trim() || image.getAttribute("src")?.trim()),
        ).length,
      }));
      await context.close();
    } finally {
      await browser.close();
    }

    const result = await convertUrlToMarkdown(sourceUrl, AbortSignal.timeout(60_000));
    const dataUriCount = result.markdown.match(/data:image\/(?:jpeg|png|webp|gif|avif);base64,/gi)?.length ?? 0;
    const coverage = sourceCoverage(source.text, result.markdown);

    if (coverage < 0.95) {
      console.info(JSON.stringify({
        coverage,
        sourceTextChars: comparableText(source.text).length,
        extractionMode: result.meta.extractionMode,
        convertedTextChars: result.meta.textChars,
        sourceImageCount: source.imageCount,
        convertedSourceImageCount: result.meta.sourceImageCount,
        embeddedImageCount: result.meta.embeddedImageCount,
        warningCodes: result.warnings.map((warning) => warning.code),
      }));
    }

    expect(result.title).toBe(source.title);
    expect(coverage).toBeGreaterThanOrEqual(0.95);
    expect(dataUriCount).toBe(Math.min(source.imageCount, 30));
    expect(result.meta.sourceImageCount).toBe(source.imageCount);
    expect(result.meta.embeddedImageCount).toBe(dataUriCount);
    expect(result.meta.outputBytes).toBeLessThanOrEqual(MAX_MARKDOWN_BYTES);
  });
});
