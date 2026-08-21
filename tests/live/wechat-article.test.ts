import { chromium } from "playwright";
import { describe, expect, it } from "vitest";
import { convertUrlToMarkdown } from "@/lib/convert";
import { MAX_MARKDOWN_BYTES } from "@/lib/markdown";
import { DESKTOP_USER_AGENT } from "@/lib/user-agent";
import { normalizeCodeBlockForComparison } from "../wechat-code-comparison";

const DEFAULT_LIVE_URL = "https://mp.weixin.qq.com/s/uFxJIK83ZEgW5QMjogujSw";
const CHUNK_SIZE = 80;

function comparableText(value: string): string {
  return value.normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, "").toLocaleLowerCase("zh-CN");
}

function sourceCoverage(sourceBlocks: string[], markdown: string): number {
  const converted = comparableText(markdown
    .replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, "")
    .replace(/```[^\n]*\n[\s\S]*?\n```/g, ""));
  const source = sourceBlocks.map(comparableText).filter(Boolean);
  const sourceChars = source.reduce((sum, block) => sum + block.length, 0);
  if (!sourceChars) return 0;

  let coveredChars = 0;
  for (const block of source) {
    for (let start = 0; start < block.length; start += CHUNK_SIZE) {
      const chunk = block.slice(start, start + CHUNK_SIZE);
      if (converted.includes(chunk)) coveredChars += chunk.length;
    }
  }
  return coveredChars / sourceChars;
}

describe("release-gate live webpage comparison", () => {
  it("matches the reviewed WeChat article in the same run", async () => {
    const sourceUrl = process.env.MD_CONVERTOR_LIVE_URL || DEFAULT_LIVE_URL;
    const browser = await chromium.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
    });

    let source: { title: string; proseBlocks: string[]; imageCount: number; codeBlocks: string[] };
    try {
      const context = await browser.newContext({ locale: "zh-CN", userAgent: DESKTOP_USER_AGENT });
      const page = await context.newPage();
      await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      const content = page.locator("#js_content");
      await expect.poll(async () => content.count()).toBe(1);
      source = await content.evaluate((element) => {
        return {
          title: document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content.trim()
            || document.title.trim(),
          proseBlocks: Array.from(element.children)
            .filter((node) => !node.matches(".code-snippet__fix") && !node.querySelector("pre"))
            .map((node) => node.textContent || ""),
          imageCount: Array.from(element.querySelectorAll("img")).filter((image) =>
            Boolean(image.getAttribute("data-src")?.trim() || image.getAttribute("src")?.trim()),
          ).length,
          codeBlocks: Array.from(element.querySelectorAll("pre")).map((pre) => {
            const codeNodes = Array.from(pre.children)
              .filter((node) => node.tagName.toLowerCase() === "code");
            const text = (node: Element): string => {
              const clone = node.cloneNode(true) as Element;
              clone.querySelectorAll("br").forEach((lineBreak) => {
                lineBreak.replaceWith(document.createTextNode("\n"));
              });
              return clone.textContent || "";
            };
            if (codeNodes.length > 1) return codeNodes.map(text).join("\n");
            return text(codeNodes[0] || pre);
          }),
        };
      });
      await context.close();
    } finally {
      await browser.close();
    }

    const result = await convertUrlToMarkdown(sourceUrl, AbortSignal.timeout(60_000));
    const dataUriCount = result.markdown.match(/data:image\/(?:jpeg|png|webp|gif|avif);base64,/gi)?.length ?? 0;
    const convertedCodeBlocks = Array.from(result.markdown.matchAll(/```[^\n]*\n([\s\S]*?)\n```/g)).map((match) => match[1]);
    const coverage = sourceCoverage(source.proseBlocks, result.markdown);

    if (coverage < 0.95) {
      console.info(JSON.stringify({
        coverage,
        sourceTextChars: source.proseBlocks.reduce((sum, block) => sum + comparableText(block).length, 0),
        extractionMode: result.meta.extractionMode,
        convertedTextChars: result.meta.textChars,
        sourceCodeBlockCount: source.codeBlocks.length,
        convertedCodeBlockCount: convertedCodeBlocks.length,
        sourceImageCount: source.imageCount,
        convertedSourceImageCount: result.meta.sourceImageCount,
        embeddedImageCount: result.meta.embeddedImageCount,
        warningCodes: result.warnings.map((warning) => warning.code),
      }));
    }

    expect(result.title).toBe(source.title);
    expect(coverage).toBeGreaterThanOrEqual(0.95);
    expect(convertedCodeBlocks.map(normalizeCodeBlockForComparison))
      .toEqual(source.codeBlocks.map(normalizeCodeBlockForComparison));
    expect(dataUriCount).toBe(Math.min(source.imageCount, 30));
    expect(result.meta.sourceImageCount).toBe(source.imageCount);
    expect(result.meta.embeddedImageCount).toBe(dataUriCount);
    expect(result.meta.outputBytes).toBeLessThanOrEqual(MAX_MARKDOWN_BYTES);
  });
});
