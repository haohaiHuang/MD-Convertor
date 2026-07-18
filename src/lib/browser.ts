import { chromium } from "playwright";
import { AppError } from "@/lib/errors";
import { createPinnedBrowserProxy } from "@/lib/browser-proxy";
import { DESKTOP_USER_AGENT } from "@/lib/user-agent";

export async function renderDynamicPage(url: string, signal: AbortSignal): Promise<string> {
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
        if (resourceType === "font" || resourceType === "media") {
          await route.abort("blockedbyclient");
          return;
        }
        await route.continue();
      });

      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
      if (!response) throw new AppError(502, "BROWSER_NAVIGATION", "动态网页未返回可用内容。");
      await page.waitForLoadState("networkidle", { timeout: 4_000 }).catch(() => undefined);
      return await page.content();
    } finally {
      signal.removeEventListener("abort", abort);
      await context.close().catch(() => undefined);
      await browser.close().catch(() => undefined);
    }
  } finally {
    await proxy.close();
  }
}
