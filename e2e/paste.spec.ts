import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const pasteConvertedAt = "2026-08-09T00:00:00.000Z";
const pasteBodyMarkdown = "这是一段粘贴正文。";

const pasteResponse = {
  title: "粘贴测试文章",
  filename: "粘贴测试文章.md",
  markdown: `# 粘贴测试文章\n\n> 转换时间：${pasteConvertedAt}\n\n${pasteBodyMarkdown}`,
  warnings: [{ code: "IMAGE_FETCH_FAILED", message: "一张图片未能内嵌，已保留替代文本。" }],
  meta: {
    sourceUrl: "",
    convertedAt: pasteConvertedAt,
    extractionMode: "paste",
    outputBytes: 512,
    textChars: 13,
    sourceImageCount: 2,
    embeddedImageCount: 1,
    omittedImageCount: 1,
  },
};

type PasteRequest = {
  html?: string;
  text?: string;
  sourceUrl?: string;
};

function responseForPasteRequest(request: PasteRequest) {
  const sourceUrl = request.sourceUrl?.trim() || "";
  const markdown = sourceUrl
    ? `# 粘贴测试文章\n\n> 来源：[${sourceUrl}](<${sourceUrl}>)\n> 转换时间：${pasteResponse.meta.convertedAt}\n\n${pasteBodyMarkdown}`
    : pasteResponse.markdown;
  return {
    ...pasteResponse,
    markdown,
    meta: { ...pasteResponse.meta, sourceUrl },
  };
}

let pasteRequests: PasteRequest[] = [];

type SlowFetchState = {
  requestStarted: boolean;
  abortSeen: boolean;
};

test.beforeEach(async ({ page }) => {
  pasteRequests = [];
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (window as typeof window & { copiedMarkdown?: string }).copiedMarkdown = value;
        },
      },
    });
  });
  await page.route("**/api/convert-paste", async (route) => {
    const request = route.request().postDataJSON() as PasteRequest;
    pasteRequests.push(request);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(responseForPasteRequest(request)),
    });
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "富文本转换" }).click();
});

async function pasteIntoTextarea(
  page: import("@playwright/test").Page,
  html: string,
  text: string,
): Promise<void> {
  const textarea = page.getByLabel("粘贴的正文内容");
  await textarea.evaluate((element, payload) => {
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: {
        getData: (type: string) => type === "text/html" ? payload.html : type === "text/plain" ? payload.text : "",
      },
    });
    element.dispatchEvent(event);
  }, { html, text });
}

test("rich text paste converts with statistics, preview, warning, copy, and download", async ({ page }) => {
  const html = "<h1>粘贴测试文章</h1><p>这是一段粘贴正文。</p>";
  const text = "粘贴测试文章\n\n这是一段粘贴正文。";
  await pasteIntoTextarea(page, html, text);

  await expect(page.getByText("已识别富文本内容（约 17 字符），将转换为 Markdown")).toBeVisible();
  await page.getByRole("button", { name: "转换为 MD" }).click();

  await expect(page.getByRole("heading", { name: "转换完成", level: 2 })).toBeVisible();
  const stats = page.getByLabel("转换结果统计");
  await expect(stats).toContainText("512 B");
  await expect(stats).toContainText("13");
  await expect(stats).toContainText("1 / 2 张");
  await expect(page.getByLabel("Markdown 预览")).toContainText("这是一段粘贴正文。");
  await expect(page.getByText("一张图片未能内嵌，已保留替代文本。")).toBeVisible();
  expect(pasteRequests).toEqual([{ html, text }]);

  await page.getByRole("button", { name: "复制", exact: true }).click();
  await expect(page.getByRole("button", { name: "已复制" })).toBeVisible();
  const copied = await page.evaluate(() => (window as typeof window & { copiedMarkdown?: string }).copiedMarkdown);
  expect(copied).toBe(pasteResponse.markdown);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(pasteResponse.filename);
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  expect(await readFile(downloadPath!, "utf8")).toBe(pasteResponse.markdown);
});

test("plain text paste shows the fallback hint and omits HTML and source fields", async ({ page }) => {
  const text = "纯文本粘贴内容\n第二行";
  await pasteIntoTextarea(page, "", text);

  await expect(page.getByText("未检测到富文本格式，将按纯文本转换")).toBeVisible();
  await page.getByRole("button", { name: "转换为 MD" }).click();
  await expect(page.getByRole("heading", { name: "转换完成", level: 2 })).toBeVisible();
  expect(pasteRequests).toEqual([{ text }]);
});

test("editing pasted rich text switches to edited mode and omits HTML", async ({ page }) => {
  await pasteIntoTextarea(page, "<p>捕获富文本</p>", "捕获富文本");
  const textarea = page.getByLabel("粘贴的正文内容");
  await textarea.fill("手工修改后的正文");

  await expect(page.getByText("内容已修改，将按纯文本转换")).toBeVisible();
  await page.getByRole("button", { name: "转换为 MD" }).click();
  await expect(page.getByRole("heading", { name: "转换完成", level: 2 })).toBeVisible();
  expect(pasteRequests).toEqual([{ text: "手工修改后的正文" }]);
});

test("a second paste replaces the first HTML and plain-text snapshot", async ({ page }) => {
  await pasteIntoTextarea(page, "<p>第一段</p>", "第一段");
  await pasteIntoTextarea(page, "<h1>第二段</h1>", "第二段");

  await expect(page.getByLabel("粘贴的正文内容")).toHaveValue("第二段");
  await expect(page.getByText("已识别富文本内容（约 3 字符），将转换为 Markdown")).toBeVisible();
  await page.getByRole("button", { name: "转换为 MD" }).click();
  await expect(page.getByRole("heading", { name: "转换完成", level: 2 })).toBeVisible();
  expect(pasteRequests).toEqual([{ html: "<h1>第二段</h1>", text: "第二段" }]);
});

test("source URL is trimmed before a paste request is submitted", async ({ page }) => {
  await pasteIntoTextarea(page, "<p>有来源正文</p>", "有来源正文");
  await page.getByLabel("来源 URL（可选）").fill("  https://example.com/article  ");
  await page.getByRole("button", { name: "转换为 MD" }).click();
  await expect(page.getByRole("heading", { name: "转换完成", level: 2 })).toBeVisible();
  const preview = page.getByLabel("Markdown 预览");
  await expect(preview).toContainText("来源");
  await expect(preview).toContainText("转换时间：2026-08-09T00:00:00.000Z");
  await expect(preview.getByRole("link", { name: "https://example.com/article" })).toBeVisible();
  const previewText = await preview.innerText();
  expect(previewText.indexOf("粘贴测试文章")).toBeLessThan(previewText.indexOf("来源"));
  expect(previewText.indexOf("来源")).toBeLessThan(previewText.indexOf("转换时间"));

  expect(pasteRequests).toEqual([{
    html: "<p>有来源正文</p>",
    text: "有来源正文",
    sourceUrl: "https://example.com/article",
  }]);
});

test("blank source URL is omitted from a paste request", async ({ page }) => {
  await pasteIntoTextarea(page, "<p>无来源正文</p>", "无来源正文");
  await page.getByLabel("来源 URL（可选）").fill("   ");
  await page.getByRole("button", { name: "转换为 MD" }).click();
  await expect(page.getByRole("heading", { name: "转换完成", level: 2 })).toBeVisible();
  const preview = page.getByLabel("Markdown 预览");
  await expect(preview).toContainText("转换时间：2026-08-09T00:00:00.000Z");
  await expect(preview).not.toContainText("来源：");
  const previewText = await preview.innerText();
  expect(previewText.indexOf("粘贴测试文章")).toBeLessThan(previewText.indexOf("转换时间"));

  expect(pasteRequests).toEqual([{ html: "<p>无来源正文</p>", text: "无来源正文" }]);
});

test("blocks a real UTF-8 JSON payload over 5 MiB before making a request", async ({ page }) => {
  const oversizedText = "中".repeat(1_747_624);
  await pasteIntoTextarea(page, "", oversizedText);

  await expect(page.getByText("粘贴内容超过 5 MiB，请减少内容后重试。")).toBeVisible();
  await expect(page.getByRole("button", { name: "转换为 MD" })).toBeDisabled();
  expect(pasteRequests).toEqual([]);
});

test("shows a Chinese error when the paste service responds with 413", async ({ page }) => {
  await page.unroute("**/api/convert-paste");
  await page.route("**/api/convert-paste", async (route) => {
    const request = route.request().postDataJSON() as PasteRequest;
    pasteRequests.push(request);
    await route.fulfill({
      status: 413,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "REQUEST_TOO_LARGE", message: "请求内容过大。" } }),
    });
  });

  const html = "<p>小正文</p>";
  const text = "小正文";
  await pasteIntoTextarea(page, html, text);
  await page.getByRole("button", { name: "转换为 MD" }).click();

  await expect(page.getByText("请求内容过大。", { exact: true })).toBeVisible();
  expect(pasteRequests).toEqual([{ html, text }]);
});

test("disables tabs during a slow paste conversion and preserves editable input after stop", async ({ page }) => {
  await page.evaluate(() => {
    const state: SlowFetchState = { requestStarted: false, abortSeen: false };
    (window as typeof window & { pasteFetchState?: SlowFetchState }).pasteFetchState = state;
    window.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => (
      new Promise<Response>((_resolve, reject) => {
        state.requestStarted = true;
        init?.signal?.addEventListener("abort", () => {
          state.abortSeen = true;
          reject(new DOMException("The operation was aborted.", "AbortError"));
        }, { once: true });
      })
    )) as typeof window.fetch;
  });

  const textarea = page.getByLabel("粘贴的正文内容");
  const source = page.getByLabel("来源 URL（可选）");
  await pasteIntoTextarea(page, "<p>慢请求正文</p>", "慢请求正文");
  await source.fill("https://example.com/slow");
  await page.getByRole("button", { name: "转换为 MD" }).click();

  await expect(page.getByRole("tab", { name: "链接转换" })).toBeDisabled();
  await expect(page.getByRole("tab", { name: "富文本转换" })).toBeDisabled();
  await expect(textarea).toHaveAttribute("readonly", "");
  await expect(source).toHaveAttribute("readonly", "");
  await expect.poll(async () => page.evaluate(() => (
    (window as typeof window & { pasteFetchState?: SlowFetchState }).pasteFetchState?.requestStarted ?? false
  ))).toBe(true);

  await page.getByRole("button", { name: "停止转换" }).click();
  await expect.poll(async () => page.evaluate(() => (
    (window as typeof window & { pasteFetchState?: SlowFetchState }).pasteFetchState?.abortSeen ?? false
  ))).toBe(true);
  await expect(page.getByText("已停止转换，粘贴内容已保留，可修改后重新开始。")).toBeVisible();
  await expect(textarea).toHaveValue("慢请求正文");
  await expect(source).toHaveValue("https://example.com/slow");
  await expect(textarea).not.toHaveAttribute("readonly", "");
  await expect(source).not.toHaveAttribute("readonly", "");

  await textarea.fill("停止后可编辑");
  await source.fill("https://example.com/edited");
  await expect(textarea).toHaveValue("停止后可编辑");
  await expect(source).toHaveValue("https://example.com/edited");
});
