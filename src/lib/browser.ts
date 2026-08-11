import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { AppError } from "@/lib/errors";
import { createPinnedBrowserProxy } from "@/lib/browser-proxy";
import { DESKTOP_USER_AGENT } from "@/lib/user-agent";
import type { ConversionWarning } from "@/types/conversion";

export type GeneratedBrowserImage = {
  placeholderUrl: string;
  dataUri: string;
};

export type RenderedPage = {
  html: string;
  generatedImages: GeneratedBrowserImage[];
  warnings: ConversionWarning[];
};

export async function renderDynamicPage(url: string, signal: AbortSignal): Promise<RenderedPage> {
  const proxy = await createPinnedBrowserProxy(signal);
  try {
    const browser = await chromium.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
      proxy: { server: proxy.serverUrl },
    });
    const context = await browser.newContext({
      acceptDownloads: false,
      javaScriptEnabled: true,
      locale: "zh-CN",
      userAgent: DESKTOP_USER_AGENT,
    });
    const page = await context.newPage();
    const abort = () => void page.close().catch(() => undefined);
    signal.addEventListener("abort", abort, { once: true });

    try {
      await page.route("**/*", async (route) => {
        const resourceType = route.request().resourceType();
        const resourceUrl = route.request().url();
        const isGoogleFontsStylesheet = resourceType === "stylesheet"
          && resourceUrl.startsWith("https://fonts.googleapis.com/");
        if (resourceType === "font" || resourceType === "media" || isGoogleFontsStylesheet) {
          await route.abort("blockedbyclient");
          return;
        }
        await route.continue();
      });

      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
      if (!response) throw new AppError(502, "BROWSER_NAVIGATION", "动态网页未返回可用内容。");
      await page.waitForLoadState("networkidle", { timeout: 4_000 }).catch(() => undefined);
      const generatedImages: GeneratedBrowserImage[] = [];
      const warnings: ConversionWarning[] = [];
      const diagrams = page.locator(
        '.mermaid:has(svg, canvas), svg[id^="mermaid-"]:not(.mermaid svg), svg[aria-roledescription]:not(.mermaid svg)',
      );
      const diagramCount = await diagrams.count();
      const selectedDiagramCount = Math.min(diagramCount, 30);
      if (diagramCount > selectedDiagramCount) {
        for (let index = diagramCount - 1; index >= selectedDiagramCount; index -= 1) {
          await diagrams.nth(index).evaluate((element) => {
            const placeholder = element.ownerDocument.createElement("blockquote");
            placeholder.textContent = "Mermaid 图表未能安全转换";
            element.replaceWith(placeholder);
          }).catch(() => undefined);
        }
        warnings.push({
          code: "MERMAID_COUNT_LIMIT",
          message: "网页包含超过 30 张 Mermaid 图表，额外图表已保留占位文本。",
        });
      }
      for (let index = selectedDiagramCount - 1; index >= 0; index -= 1) {
        signal.throwIfAborted();
        const diagram = diagrams.nth(index);
        try {
          const hasRenderedContent = await diagram.locator("svg, canvas").count() > 0
            || await diagram.evaluate((element) => element.matches("svg, canvas"));
          if (!hasRenderedContent) {
            throw new Error("Mermaid diagram did not render");
          }
          const bounds = await diagram.boundingBox();
          if (!bounds || bounds.width <= 0 || bounds.height <= 0 || bounds.width > 4096 || bounds.height > 4096) {
            throw new Error("Mermaid diagram dimensions are unavailable or too large");
          }
          const screenshot = await diagram.screenshot({ type: "png", animations: "disabled" });
          if (screenshot.byteLength > 8 * 1024 * 1024) {
            throw new Error("Mermaid diagram screenshot is too large");
          }
          const placeholderUrl = `/.md-convertor/mermaid/${randomUUID()}.png`;
          await diagram.evaluate((element, replacement) => {
            const image = element.ownerDocument.createElement("img");
            image.src = replacement.placeholderUrl;
            image.alt = "Mermaid 图表";
            element.replaceWith(image);
          }, { placeholderUrl });
          generatedImages.push({
            placeholderUrl,
            dataUri: `data:image/png;base64,${screenshot.toString("base64")}`,
          });
        } catch {
          signal.throwIfAborted();
          await diagram.evaluate((element) => {
            const placeholder = element.ownerDocument.createElement("blockquote");
            placeholder.textContent = "Mermaid 图表未能安全转换";
            element.replaceWith(placeholder);
          }).catch(() => undefined);
          warnings.push({
            code: "MERMAID_RENDER_FAILED",
            message: "有一张 Mermaid 图表未能安全栅格化，已保留占位文本。",
          });
        }
      }
      return { html: await page.content(), generatedImages, warnings };
    } finally {
      signal.removeEventListener("abort", abort);
      await context.close().catch(() => undefined);
      await browser.close().catch(() => undefined);
    }
  } finally {
    await proxy.close();
  }
}
