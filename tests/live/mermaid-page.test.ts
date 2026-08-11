import { chromium } from "playwright";
import { describe, expect, it } from "vitest";
import { convertUrlToMarkdown } from "@/lib/convert";
import { convertPastedContent } from "@/lib/convert-paste";
import { MAX_MARKDOWN_BYTES } from "@/lib/markdown";
import { DESKTOP_USER_AGENT } from "@/lib/user-agent";

const DEFAULT_MERMAID_LIVE_URL =
  "https://walkinglabs.github.io/learn-harness-engineering/zh/lectures/lecture-02-what-a-harness-actually-is/";

describe("release-gate live Mermaid preservation", () => {
  it("preserves the reviewed client-rendered WalkingLabs diagram as a safe raster image", async () => {
    const sourceUrl = process.env.MD_CONVERTOR_MERMAID_LIVE_URL || DEFAULT_MERMAID_LIVE_URL;
    const result = await convertUrlToMarkdown(sourceUrl, AbortSignal.timeout(60_000));
    const rasterDataUriCount = result.markdown
      .match(/data:image\/(?:jpeg|png|webp|gif|avif);base64,/gi)?.length ?? 0;

    expect(result.meta.extractionMode).toBe("browser");
    expect(result.meta.textChars).toBeGreaterThan(1_000);
    expect(result.meta.sourceImageCount).toBeGreaterThanOrEqual(1);
    expect(result.meta.embeddedImageCount).toBeGreaterThanOrEqual(1);
    expect(rasterDataUriCount).toBeGreaterThanOrEqual(1);
    expect(result.meta.outputBytes).toBeLessThanOrEqual(MAX_MARKDOWN_BYTES);
    expect(result.markdown).not.toMatch(/<svg|data:image\/svg\+xml/i);
    expect(result.warnings.map((warning) => warning.code)).not.toContain("MERMAID_RENDER_FAILED");
  });

  it("preserves the Mermaid diagram from the reviewed page when its rendered content is pasted", async () => {
    const sourceUrl = process.env.MD_CONVERTOR_MERMAID_LIVE_URL || DEFAULT_MERMAID_LIVE_URL;
    const browser = await chromium.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
    });

    let clipboard: { html: string; text: string };
    try {
      const context = await browser.newContext({
        colorScheme: "dark",
        locale: "zh-CN",
        userAgent: DESKTOP_USER_AGENT,
      });
      const page = await context.newPage();
      await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await expect.poll(async () => page.locator("html").evaluate((element) =>
        element.classList.contains("dark"))).toBe(true);
      const content = page.locator("main");
      await expect.poll(async () => content.locator(".mermaid svg").count()).toBeGreaterThanOrEqual(1);
      clipboard = await content.evaluate((element) => ({
        html: element.innerHTML,
        text: element.textContent || "",
      }));
      await context.close();
    } finally {
      await browser.close();
    }

    const result = await convertPastedContent(
      { ...clipboard, sourceUrl },
      AbortSignal.timeout(60_000),
    );
    const rasterDataUriCount = result.markdown
      .match(/data:image\/(?:jpeg|png|webp|gif|avif);base64,/gi)?.length ?? 0;

    expect(result.meta.extractionMode).toBe("paste");
    expect(result.meta.textChars).toBeGreaterThan(1_000);
    expect(result.meta.sourceImageCount).toBeGreaterThanOrEqual(1);
    expect(result.meta.embeddedImageCount).toBeGreaterThanOrEqual(1);
    expect(rasterDataUriCount).toBeGreaterThanOrEqual(1);
    expect(result.meta.outputBytes).toBeLessThanOrEqual(MAX_MARKDOWN_BYTES);
    expect(result.markdown).not.toMatch(/<svg|data:image\/svg\+xml/i);
    expect(result.warnings.map((warning) => warning.code)).not.toContain("MERMAID_RENDER_UNAVAILABLE");
  });
});
