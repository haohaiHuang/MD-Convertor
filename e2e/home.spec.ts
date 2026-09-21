import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const OUTPUT_DIRECTORY = "/tmp/md-convertor-e2e-output";

const response = {
  title: "跨浏览器测试文章",
  filename: "跨浏览器测试文章.md",
  markdown: "# 跨浏览器测试文章\n\n> 来源：[https://example.com](https://example.com)\n\n这是一段测试正文。",
  warnings: [{ code: "TEST_WARNING", message: "这是一条转换提示。" }],
  meta: {
    sourceUrl: "https://example.com",
    convertedAt: "2026-07-18T00:00:00.000Z",
    extractionMode: "direct",
    outputBytes: 128,
    textChars: 16346,
    sourceImageCount: 30,
    embeddedImageCount: 27,
    omittedImageCount: 3,
  },
};

test.beforeEach(async ({ page }) => {
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
  await page.route("**/api/convert", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(response) });
  });
  await page.goto("/");
});

async function pasteIntoUrlInput(page: import("@playwright/test").Page, value: string) {
  const input = page.getByLabel("网页链接");
  await input.evaluate((element, pastedValue) => {
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: { getData: () => pastedValue },
    });
    element.dispatchEvent(event);
  }, value);
}

test("pasting a URL waits for explicit conversion", async ({ page }) => {
  let requestCount = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/convert")) requestCount += 1;
  });

  await pasteIntoUrlInput(page, "https://example.com/article");
  await expect(page.getByLabel("网页链接")).toHaveValue("https://example.com/article");
  expect(requestCount).toBe(0);

  await page.getByRole("button", { name: "转换", exact: true }).click();

  await expect(page.getByRole("heading", { name: "转换完成", level: 2 })).toBeVisible();
  await expect(page.getByLabel("Markdown 预览")).toContainText("这是一段测试正文");
  await expect(page.getByText("这是一条转换提示。")).toBeVisible();
  expect(requestCount).toBe(1);
});

test("supports keyboard submission and download", async ({ page }) => {
  await page.getByLabel("网页链接").fill("https://example.com/article");
  await page.getByLabel("网页链接").press("Enter");
  await expect(page.getByText("转换完成")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("跨浏览器测试文章.md");
});

test("stops an in-progress conversion and preserves the URL", async ({ page }) => {
  await page.unroute("**/api/convert");
  await page.evaluate(() => {
    window.fetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        }, { once: true });
      })) as typeof window.fetch;
  });

  const input = page.getByLabel("网页链接");
  await input.fill("https://example.com/slow");
  await page.getByRole("button", { name: "转换", exact: true }).click();
  await expect(input).toHaveAttribute("readonly", "");
  await expect(page.getByRole("button", { name: "清空链接" })).toBeDisabled();
  await page.getByRole("button", { name: "停止转换" }).click();

  await expect(page.getByText("已停止转换，可修改链接后重新开始。")).toBeVisible();
  await expect(input).toHaveValue("https://example.com/slow");
  await expect(input).not.toHaveAttribute("readonly", "");
});

test("suggests the paste mode when a link cannot be fetched", async ({ page }) => {
  await page.unroute("**/api/convert");
  await page.route("**/api/convert", async (route) => {
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "UPSTREAM_ERROR", message: "无法读取该网页，请确认网页可以公开访问。" },
        requestId: "test",
      }),
    });
  });

  await page.getByLabel("网页链接").fill("https://example.com/article");
  await page.getByRole("button", { name: "转换", exact: true }).click();

  await expect(page.getByText("无法读取该网页，请确认网页可以公开访问。")).toBeVisible();
  await page.getByRole("button", { name: "改用富文本粘贴" }).click();

  await expect(page.getByRole("tab", { name: "富文本转换" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("粘贴的正文内容")).toBeVisible();
  await expect(page.getByRole("button", { name: "改用富文本粘贴" })).toHaveCount(0);
});

test("rejects invalid pasted content without converting", async ({ page }) => {
  let requestCount = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/convert")) requestCount += 1;
  });

  await pasteIntoUrlInput(page, "这不是一个网页链接");
  await expect(page.getByText("请输入完整的 HTTP 或 HTTPS 网页链接。")).toBeVisible();
  await expect(page.getByRole("button", { name: "转换", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "改用富文本粘贴" })).toHaveCount(0);
  expect(requestCount).toBe(0);
});

test("clears the link validation and previous conversion result", async ({ page }) => {
  const input = page.getByLabel("网页链接");

  await input.fill("这不是一个网页链接");
  await expect(page.getByText("请输入完整的 HTTP 或 HTTPS 网页链接。")).toBeVisible();
  await page.getByRole("button", { name: "清空链接" }).click();
  await expect(input).toHaveValue("");
  await expect(page.getByText("请输入完整的 HTTP 或 HTTPS 网页链接。")).toHaveCount(0);

  await input.fill("https://example.com/article");
  await page.getByRole("button", { name: "转换", exact: true }).click();
  await expect(page.getByRole("heading", { name: "转换完成", level: 2 })).toBeVisible();
  await page.getByRole("button", { name: "清空链接" }).click();

  await expect(input).toHaveValue("");
  await expect(page.getByRole("heading", { name: "转换完成", level: 2 })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "转换", exact: true })).toBeDisabled();
});

test("shows user-facing statistics without repeating the article title", async ({ page }) => {
  await page.getByLabel("网页链接").fill("https://example.com/article");
  await page.getByRole("button", { name: "转换", exact: true }).click();

  await expect(page.getByRole("heading", { name: "转换完成", level: 2 })).toBeVisible();
  await expect(page.getByText("128 B")).toBeVisible();
  await expect(page.getByText("16,346")).toBeVisible();
  await expect(page.getByText("27 / 30 张")).toBeVisible();
  await expect(page.getByRole("heading", { name: "跨浏览器测试文章", level: 2 })).toHaveCount(0);
  await expect(page.getByLabel("Markdown 预览").getByRole("heading", { name: "跨浏览器测试文章", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "复制", exact: true }).click();
  await expect(page.getByRole("button", { name: "已复制" })).toBeVisible();
  const copied = await page.evaluate(() => (window as typeof window & { copiedMarkdown?: string }).copiedMarkdown);
  expect(copied).toBe(response.markdown);
});

for (const width of [960, 1180]) {
  test(`keeps the main title and subtitle on one line at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const title = page.getByRole("heading", { name: "把网页，变成一份干净的文档", level: 1 });
    const subtitle = page.getByText("粘贴网页链接，在本机提取正文和图片，生成 Markdown 文件。");

    for (const element of [title, subtitle]) {
      const dimensions = await element.evaluate((node) => {
        const style = getComputedStyle(node);
        return { height: node.getBoundingClientRect().height, lineHeight: Number.parseFloat(style.lineHeight) };
      });
      expect(dimensions.height).toBeLessThanOrEqual(dimensions.lineHeight * 1.1);
    }
  });
}

for (const width of [390, 1180]) {
  test(`returns to the input area from a long result at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 640 });
    await page.unroute("**/api/convert");
    const longResponse = {
      ...response,
      markdown: `# 长文章\n\n${Array.from({ length: 80 }, (_, index) => `第 ${index + 1} 段长内容，用于验证返回顶部入口。`).join("\n\n")}`,
    };
    await page.route("**/api/convert", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(longResponse) });
    });
    await page.evaluate(() => {
      const nativeScrollTo = window.scrollTo.bind(window);
      window.scrollTo = ((options: ScrollToOptions) => {
        (window as typeof window & { lastScrollBehavior?: ScrollBehavior }).lastScrollBehavior = options.behavior;
        nativeScrollTo(options);
      }) as typeof window.scrollTo;
    });

    const input = page.getByLabel("网页链接");
    await expect(page.getByRole("button", { name: "返回顶部" })).toHaveCount(0);
    await input.fill("https://example.com/long-article");
    await page.getByRole("button", { name: "转换", exact: true }).click();
    await expect(page.getByRole("heading", { name: "转换完成", level: 2 })).toBeVisible();
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);

    const backToTop = page.getByRole("button", { name: "返回顶部" });
    await expect(backToTop).toBeVisible();
    const box = await backToTop.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(640);

    await backToTop.click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(50);
    expect(await page.evaluate(() => (
      window as typeof window & { lastScrollBehavior?: ScrollBehavior }
    ).lastScrollBehavior)).toBe("smooth");
    await expect(input).toHaveValue("https://example.com/long-article");
    await expect(page.getByRole("heading", { name: "转换完成", level: 2 })).toBeAttached();
  });
}

test.describe("页头", () => {
  test("只保留带文字的设置入口", async ({ page }) => {
    await expect(page.getByText("本机处理 · 不保存内容")).toHaveCount(0);

    const entry = page.getByRole("link", { name: "设置" });
    await expect(entry).toBeVisible();
    await expect(entry).toHaveText("设置");
  });

  test("品牌只有文字，且用仓库内自托管的 Michroma", async ({ page }) => {
    const brand = page.locator('[aria-label="MD-Convertor"]');
    await expect(brand).toHaveText("MD-Convertor");
    await expect(brand.locator("span").filter({ hasText: /^MD$/ })).toHaveCount(0);

    await page.evaluate(() => document.fonts.ready);
    // next/font/local names the family after the binding in layout.tsx, hence the loose match.
    expect(await brand.evaluate((node) => getComputedStyle(node).fontFamily)).toMatch(/michroma/i);

    const served = await page.evaluate(async () => {
      const url = performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .find((name) => name.endsWith(".woff2"));
      const bytes = url ? new Uint8Array(await (await fetch(url)).arrayBuffer()) : new Uint8Array(0);
      const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      const loaded = Array.from(document.fonts)
        .filter((face) => face.status === "loaded")
        .map((face) => face.family);
      return { digest, loaded, url: url ?? "" };
    });

    // The face the page actually renders with is the file kept in the repository, not a fallback
    // and not something downloaded from Google at runtime or at build time.
    const vendored = createHash("sha256")
      .update(readFileSync(path.join(process.cwd(), "public", "fonts", "Michroma-Regular.woff2")))
      .digest("hex");
    expect(served.loaded.some((family) => /michroma/i.test(family))).toBe(true);
    expect(served.digest).toBe(vendored);
    expect(served.url).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  });
});

test.describe("富文本转换表单", () => {
  test("转换按钮与来源 URL 同一行，且与正文框右边缘对齐", async ({ page }) => {
    await page.getByRole("tab", { name: "富文本转换" }).click();

    const textarea = await page.getByLabel("粘贴的正文内容").boundingBox();
    const sourceInput = await page.getByLabel("来源 URL（可选）").boundingBox();
    const submit = await page.getByRole("button", { name: "转换", exact: true }).boundingBox();
    expect(textarea).not.toBeNull();
    expect(sourceInput).not.toBeNull();
    expect(submit).not.toBeNull();

    // Same row: the button sits to the right of the URL box and overlaps its vertical band.
    expect(submit!.x).toBeGreaterThan(sourceInput!.x);
    expect(Math.abs(submit!.y - sourceInput!.y)).toBeLessThan(sourceInput!.height);
    // The button's right edge lines up with the paste box above it.
    const buttonRight = submit!.x + submit!.width;
    const textareaRight = textarea!.x + textarea!.width;
    expect(Math.abs(buttonRight - textareaRight)).toBeLessThan(4);
  });

  test("清空按钮出现在转换按钮左侧的同一行", async ({ page }) => {
    await page.getByRole("tab", { name: "富文本转换" }).click();
    await page.getByLabel("粘贴的正文内容").fill("# 标题\n\n正文。");

    const clear = await page.getByRole("button", { name: "清空", exact: true }).boundingBox();
    const submit = await page.getByRole("button", { name: "转换", exact: true }).boundingBox();
    expect(clear).not.toBeNull();
    expect(submit).not.toBeNull();

    // Same row as 转换, and to its left (same relationship as 清空链接 in the link form).
    expect(Math.abs(clear!.y - submit!.y)).toBeLessThan(clear!.height);
    expect(clear!.x + clear!.width).toBeLessThanOrEqual(submit!.x);
  });
});

type StubSaveResult = { ok: true } | { ok: false; code: string };

/**
 * Installs a stand-in for the desktop preload bridge. The real bridge only exists
 * inside the packaged app, so the browser tests have to fake it — and the app must
 * behave exactly as before when there is none at all (`bridge: null`).
 *
 * `addInitScript` only applies to documents created after it, so callers must
 * navigate (again) afterwards.
 */
async function installOutputBridge(page: Page, result: StubSaveResult | null): Promise<void> {
  if (result === null) return;
  await page.addInitScript((saveResult) => {
    const target = window as typeof window & {
      mdConvertor?: Record<string, unknown>;
      outputCalls?: { dirPath: string; filename: string; content: string }[];
    };
    target.outputCalls = [];
    target.mdConvertor = {
      ...(target.mdConvertor ?? {}),
      output: {
        selectDirectory: async () => ({ ok: false, code: "CANCELLED" }),
        saveFile: async (dirPath: string, filename: string, content: string) => {
          target.outputCalls!.push({ dirPath, filename, content });
          return saveResult.ok ? { ok: true, path: `${dirPath}/${filename}` } : saveResult;
        },
      },
    };
  }, result);
}

/** Counts the browser-download path's only hard requirement: an object URL for the Blob. */
async function countObjectUrls(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const target = window as typeof window & { objectUrlCount?: number };
    target.objectUrlCount = 0;
    const createObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob: Blob) => {
      target.objectUrlCount = (target.objectUrlCount ?? 0) + 1;
      return createObjectURL(blob);
    };
  });
}

/**
 * Rewrites only the `output` field of the real settings response. The e2e server
 * shares one settings store across the whole run, so writing through PUT would leak
 * into the other engines (and other specs); patching the response cannot leak.
 */
async function routeSettingsOutput(
  page: Page,
  output: { defaultPath: string | null; useDefaultPath: boolean },
): Promise<void> {
  await page.route("**/api/settings", async (route) => {
    const fetched = await route.fetch();
    const body = (await fetched.json()) as Record<string, unknown>;
    await route.fulfill({ response: fetched, json: { ...body, output } });
  });
}

/** Navigates and waits for the settings fetch the download branch depends on. */
async function gotoWithSettings(page: Page): Promise<void> {
  const loaded = page.waitForResponse((response) => (
    response.url().includes("/api/settings") && response.request().method() === "GET"
  ));
  await page.goto("/");
  await loaded;
}

test.describe("下载分叉（默认保存目录）", () => {
  test("开启默认目录且有桥接时直接写入目录，不触发浏览器下载", async ({ page }) => {
    await installOutputBridge(page, { ok: true });
    await countObjectUrls(page);
    await routeSettingsOutput(page, { defaultPath: OUTPUT_DIRECTORY, useDefaultPath: true });
    let downloads = 0;
    page.on("download", () => { downloads += 1; });
    await gotoWithSettings(page);

    await page.getByLabel("网页链接").fill("https://example.com/article");
    await page.getByRole("button", { name: "转换", exact: true }).click();
    await expect(page.getByRole("heading", { name: "转换完成", level: 2 })).toBeVisible();

    await page.getByRole("button", { name: "下载", exact: true }).click();

    await expect(page.getByRole("status").filter({ hasText: "已保存到" }))
      .toContainText(`已保存到 ${OUTPUT_DIRECTORY}/跨浏览器测试文章.md`);
    // The browser download path never runs: no Blob URL, no download event.
    expect(await page.evaluate(() => (window as typeof window & { objectUrlCount?: number }).objectUrlCount)).toBe(0);
    expect(downloads).toBe(0);

    expect(await page.evaluate(() => (window as typeof window & { outputCalls?: unknown }).outputCalls)).toEqual([
      { dirPath: OUTPUT_DIRECTORY, filename: "跨浏览器测试文章.md", content: response.markdown },
    ]);
  });

  test("直接写入失败时说明原因并降级为浏览器下载", async ({ page }) => {
    await installOutputBridge(page, { ok: false, code: "EACCES" });
    await countObjectUrls(page);
    await routeSettingsOutput(page, { defaultPath: OUTPUT_DIRECTORY, useDefaultPath: true });
    await gotoWithSettings(page);

    await page.getByLabel("网页链接").fill("https://example.com/article");
    await page.getByRole("button", { name: "转换", exact: true }).click();
    await expect(page.getByRole("heading", { name: "转换完成", level: 2 })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载", exact: true }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("跨浏览器测试文章.md");
    const notice = page.getByRole("status").filter({ hasText: "已改为浏览器下载" });
    await expect(notice).toContainText("没有写入权限");
    expect(await page.evaluate(() => (window as typeof window & { objectUrlCount?: number }).objectUrlCount)).toBe(1);
  });

  test("没有桥接时忽略默认目录设置，仍走浏览器下载", async ({ page }) => {
    await countObjectUrls(page);
    await routeSettingsOutput(page, { defaultPath: OUTPUT_DIRECTORY, useDefaultPath: true });
    await gotoWithSettings(page);

    await page.getByLabel("网页链接").fill("https://example.com/article");
    await page.getByRole("button", { name: "转换", exact: true }).click();
    await expect(page.getByRole("heading", { name: "转换完成", level: 2 })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载", exact: true }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("跨浏览器测试文章.md");
    await expect(page.getByText("已保存到")).toHaveCount(0);
    expect(await page.evaluate(() => (window as typeof window & { objectUrlCount?: number }).objectUrlCount)).toBe(1);
  });

  test("保存反馈在下次转换开始时清除", async ({ page }) => {
    await installOutputBridge(page, { ok: true });
    await routeSettingsOutput(page, { defaultPath: OUTPUT_DIRECTORY, useDefaultPath: true });
    await gotoWithSettings(page);

    await page.getByLabel("网页链接").fill("https://example.com/article");
    await page.getByRole("button", { name: "转换", exact: true }).click();
    await expect(page.getByRole("heading", { name: "转换完成", level: 2 })).toBeVisible();
    await page.getByRole("button", { name: "下载", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "已保存到" })).toBeVisible();

    // A new conversion describes a new file, so the previous download's notice is stale.
    await page.getByLabel("网页链接").fill("https://example.com/second");
    await page.getByRole("button", { name: "转换", exact: true }).click();
    await expect(page.getByText("已保存到")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "转换完成", level: 2 })).toBeVisible();
    await expect(page.getByText("已保存到")).toHaveCount(0);
  });
});
