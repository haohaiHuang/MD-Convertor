import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { gotoConverter, gotoHydrated } from "./entry";
import { rectsInOneFrame } from "./geometry";

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
  await gotoConverter(page);
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
  // This environment's Firefox drops synthesized clicks in a thin band near y=672, which is where the
  // button's vertical center lands in this layout, so aim a few pixels above it instead of at the center.
  await page.getByRole("button", { name: "改用富文本粘贴" }).click({ position: { x: 30, y: 6 } });

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

    const { textarea, source, submit } = await rectsInOneFrame(page, {
      textarea: page.getByLabel("粘贴的正文内容"),
      source: page.getByLabel("来源 URL（可选）"),
      submit: page.getByRole("button", { name: "转换", exact: true }),
    });

    // Same row: the button sits to the right of the URL box and overlaps its vertical band.
    expect(submit.x).toBeGreaterThan(source.x);
    expect(Math.abs(submit.y - source.y)).toBeLessThan(source.height);
    // The button's right edge lines up with the paste box above it.
    const buttonRight = submit.x + submit.width;
    const textareaRight = textarea.x + textarea.width;
    expect(Math.abs(buttonRight - textareaRight)).toBeLessThan(4);
  });

  test("清空按钮出现在转换按钮左侧的同一行", async ({ page }) => {
    await page.getByRole("tab", { name: "富文本转换" }).click();
    await page.getByLabel("粘贴的正文内容").fill("# 标题\n\n正文。");

    const { clear, submit } = await rectsInOneFrame(page, {
      clear: page.getByRole("button", { name: "清空", exact: true }),
      submit: page.getByRole("button", { name: "转换", exact: true }),
    });

    // Same row as 转换, and to its left (same relationship as 清空链接 in the link form).
    expect(Math.abs(clear.y - submit.y)).toBeLessThan(clear.height);
    expect(clear.x + clear.width).toBeLessThanOrEqual(submit.x);
  });
});

type StubSaveResult = { ok: true } | { ok: false; code: string } | { ok: false; rejects: true };

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
          // The real preload asserts its arguments and rejects the promise; a stand-in
          // that only ever resolves would leave that path untested.
          if (!saveResult.ok && "rejects" in saveResult) {
            throw new TypeError("dirPath must be an absolute path without traversal segments.");
          }
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

/** Enters the converter and waits for the settings fetch the download branch depends on. */
async function gotoWithSettings(page: Page): Promise<void> {
  await gotoConverter(page);
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
    // A refused write must never look like a success: the two tones are distinguishable.
    await expect(notice).toHaveAttribute("data-tone", "warning");
    expect(await page.evaluate(() => (window as typeof window & { objectUrlCount?: number }).objectUrlCount)).toBe(1);
  });

  test("直写成功时给出醒目确认：失败态之外的成功卡片 +「下载」按钮自证", async ({ page }) => {
    await installOutputBridge(page, { ok: true });
    await routeSettingsOutput(page, { defaultPath: OUTPUT_DIRECTORY, useDefaultPath: true });
    await gotoWithSettings(page);

    await page.getByLabel("网页链接").fill("https://example.com/article");
    await page.getByRole("button", { name: "转换", exact: true }).click();
    await expect(page.getByRole("heading", { name: "转换完成", level: 2 })).toBeVisible();

    await page.getByRole("button", { name: "下载", exact: true }).click();

    // The button confirms on the spot, the way 复制 turns into 已复制: with no save dialog
    // the user is looking at the button, and a bare grey caption reads as "nothing happened".
    await expect(page.getByRole("button", { name: "已保存", exact: true })).toBeVisible();

    const notice = page.getByRole("status").filter({ hasText: "已保存到" });
    await expect(notice).toHaveAttribute("data-tone", "success");
    const look = await notice.evaluate((node) => ({
      background: getComputedStyle(node).backgroundColor,
      mark: getComputedStyle(node, "::before").content,
    }));
    // A success card, not plain caption text: it carries a mark and a filled background.
    expect(look.mark).toContain("✓");
    expect(look.background).not.toMatch(/rgba?\([^)]*,\s*0\)$/);

    // The button confirmation is transient, like 已复制.
    await expect(page.getByRole("button", { name: "下载", exact: true })).toBeVisible({ timeout: 5000 });
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

  test("桥接层拒绝时给出反馈并降级为浏览器下载", async ({ page }) => {
    // The preload validates its arguments and *rejects*; it does not resolve `{ ok: false }`.
    // An unhandled rejection here used to produce no file, no download and no feedback at all.
    await installOutputBridge(page, { ok: false, rejects: true });
    await countObjectUrls(page);
    await routeSettingsOutput(page, { defaultPath: OUTPUT_DIRECTORY, useDefaultPath: true });
    let downloads = 0;
    page.on("download", () => { downloads += 1; });
    await gotoWithSettings(page);

    await page.getByLabel("网页链接").fill("https://example.com/article");
    await page.getByRole("button", { name: "转换", exact: true }).click();
    await expect(page.getByRole("heading", { name: "转换完成", level: 2 })).toBeVisible();

    await page.getByRole("button", { name: "下载", exact: true }).click();

    await expect(page.getByRole("status").filter({ hasText: "已改为浏览器下载" })).toBeVisible();
    expect(downloads).toBe(1);
    expect(await page.evaluate(() => (window as typeof window & { objectUrlCount?: number }).objectUrlCount)).toBe(1);
  });
});

test.describe("首页入口画面", () => {
  test("打开应用先看到两个入口，二级画面还没出现", async ({ page }) => {
    await gotoHydrated(page);

    await expect(page.getByRole("button", { name: "转换既有文档" })).toBeVisible();
    await expect(page.getByRole("button", { name: "粘贴URL/富文本转换" })).toBeVisible();
    await expect(page.getByRole("link", { name: "下载浏览器插件" })).toBeVisible();
    await expect(page.getByLabel("网页链接")).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "链接转换", exact: true })).toHaveCount(0);
  });

  test("三个画面里品牌横向位置一致（返回按钮不把品牌推右）", async ({ page }) => {
    await gotoHydrated(page);
    const brand = page.locator('[aria-label="MD-Convertor"]');
    const landing = (await brand.boundingBox())?.x ?? -1;

    await page.getByRole("button", { name: "转换既有文档" }).click();
    const localDocs = (await brand.boundingBox())?.x ?? -2;
    await page.getByRole("button", { name: "返回首页" }).click();
    await page.getByRole("button", { name: "粘贴URL/富文本转换" }).click();
    const convert = (await brand.boundingBox())?.x ?? -3;

    expect(landing).toBeGreaterThan(0);
    expect(localDocs).toBeCloseTo(landing, 1);
    expect(convert).toBeCloseTo(landing, 1);
  });

  test("点「转换既有文档」进本地文档画面，再点「返回首页」回到入口", async ({ page }) => {
    await gotoHydrated(page);
    await page.getByRole("button", { name: "转换既有文档" }).click();

    // No preload outside the desktop app, so the panel degrades to its explanation.
    await expect(page.getByText("本地文档处理只能在桌面应用中使用。")).toBeVisible();
    await page.getByRole("button", { name: "返回首页" }).click();

    await expect(page.getByRole("button", { name: "转换既有文档" })).toBeVisible();
    await expect(page.getByText("本地文档处理只能在桌面应用中使用。")).toHaveCount(0);
  });

  test("点「粘贴URL/富文本转换」进转换画面，原来的标题、输入与内层 tab 都在，可返回", async ({ page }) => {
    await gotoHydrated(page);
    await page.getByRole("button", { name: "粘贴URL/富文本转换" }).click();

    await expect(page.getByRole("heading", { name: "把网页，变成一份干净的文档", level: 1 })).toBeVisible();
    await expect(page.getByText("Web to Markdown", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "链接转换", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel("网页链接")).toBeVisible();
    await page.getByRole("button", { name: "返回首页" }).click();

    await expect(page.getByRole("button", { name: "粘贴URL/富文本转换" })).toBeVisible();
    await expect(page.getByLabel("网页链接")).toHaveCount(0);
  });

  test("下载浏览器插件只在入口画面，指向静态 ZIP 且带 download 属性", async ({ page }) => {
    await gotoHydrated(page);
    const link = page.getByRole("link", { name: "下载浏览器插件" });

    await expect(link).toHaveAttribute("href", "/md-convertor-extension.zip");
    await expect(link).toHaveAttribute("download", "");

    await page.getByRole("button", { name: "转换既有文档" }).click();
    await expect(page.getByRole("link", { name: "下载浏览器插件" })).toHaveCount(0);
  });
});

/**
 * feat-043 S1 (T1.1, assertion-first): the top bar becomes a three-column grid pinned to the
 * content column. These are the geometric contracts behind review items 点 1 (brand axis) and
 * 点 2 (the bar hugging the content column), written before the implementation so they can be
 * seen failing on the old layout.
 */
test.describe("顶栏与内容列几何对齐", () => {
  test("品牌中心落在顶栏中心 ±4px", async ({ page }) => {
    const { header, brand } = await rectsInOneFrame(page, {
      header: page.locator("header"),
      brand: page.locator('[aria-label="MD-Convertor"]'),
    });

    const headerCenter = header.x + header.width / 2;
    const brandCenter = brand.x + brand.width / 2;
    expect(Math.abs(brandCenter - headerCenter)).toBeLessThanOrEqual(4);
  });

  test("返回按钮左缘与设置按钮右缘贴合内容列 ±4px", async ({ page }) => {
    const { back, settings, column, header } = await rectsInOneFrame(page, {
      back: page.getByRole("button", { name: "返回首页" }),
      settings: page.getByRole("link", { name: "设置" }),
      column: page.getByRole("form", { name: "网页转换表单" }),
      header: page.locator("header"),
    });

    expect(Math.abs(back.x - column.x)).toBeLessThanOrEqual(4);
    expect(Math.abs(settings.x + settings.width - (column.x + column.width))).toBeLessThanOrEqual(4);
    // The bar is exactly as wide as the content column, so it can never drift with its own content.
    expect(Math.abs(header.width - column.width)).toBeLessThanOrEqual(4);
    // --col takes effect here: the shared column measures 880px at this viewport.
    expect(column.width).toBeCloseTo(880, 0);
  });

  test("返回与设置按钮同高同圆角 ±1px", async ({ page }) => {
    const { back, settings } = await rectsInOneFrame(page, {
      back: page.getByRole("button", { name: "返回首页" }),
      settings: page.getByRole("link", { name: "设置" }),
    });

    expect(Math.abs(back.height - settings.height)).toBeLessThanOrEqual(1);
    // --control-h and --radius-control take effect on both capsules.
    expect(back.height).toBeCloseTo(36, 0);
    expect(settings.height).toBeCloseTo(36, 0);
    const radius = await page.getByRole("button", { name: "返回首页" })
      .evaluate((node) => getComputedStyle(node).borderRadius);
    expect(radius).toBe("10px");
  });
});

/*
 * feat-043 S3 (T3.1/T3.2, assertion-first): the polish pass on the landing and converter
 * screens — the feature row rides on the translate toggle's row, right-aligned to the
 * content column (2026-10-01 real-machine feedback supersedes the old left-axis rule),
 * and the entry cards stop being stretched by `aspect-ratio: 1 / 1`.
 */
test.describe("入口画面与表单同轴（S3）", () => {
  test("产品特点与翻译勾选同行，特点组右对齐到内容列右缘", async ({ page }) => {
    // Pinned settings so the toggle's label is deterministic across runs and engines.
    await page.route("**/api/settings", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          version: 1,
          mode: "cloud",
          cloud: { providers: [], activeProviderId: null },
          local: { clis: [], activeCliId: null },
          languages: { target: "zh-Hans", custom: [] },
          translation: { defaultEnabled: false },
          output: { defaultPath: null, useDefaultPath: false },
          input: { defaultPath: null },
        }),
      }),
    );
    await gotoConverter(page);

    // The ✓ group shares the checkbox's row and ends flush with the content column.
    const boxes = await rectsInOneFrame(page, {
      hintFirst: page.getByText("无需登录"),
      hintLast: page.getByText("随用随走"),
      toggle: page.getByRole("checkbox", { name: "翻译为简体中文" }),
      form: page.getByRole("form", { name: "网页转换表单" }),
    });
    const toggleMidY = boxes.toggle.y + boxes.toggle.height / 2;
    const hintMidY = boxes.hintFirst.y + boxes.hintFirst.height / 2;
    // Same row (the two used to stack vertically).
    expect(Math.abs(hintMidY - toggleMidY)).toBeLessThanOrEqual(6);
    // The group starts after the checkbox row's label, not under it.
    expect(boxes.hintFirst.x).toBeGreaterThanOrEqual(boxes.toggle.x + boxes.toggle.width);
    // Right-aligned to the content column: the form is the column's right edge.
    expect(
      Math.abs(boxes.hintLast.x + boxes.hintLast.width - (boxes.form.x + boxes.form.width)),
    ).toBeLessThanOrEqual(4);
  });

  test("入口卡片不再被 aspect-ratio 拉高，760px 单列不破", async ({ page }) => {
    await gotoHydrated(page);

    const docsCard = page.getByRole("button", { name: "转换既有文档" });
    const convertCard = page.getByRole("button", { name: "粘贴URL/富文本转换" });
    const boxes = await rectsInOneFrame(page, { docs: docsCard, convert: convertCard });
    // feat-043 S3 (T3.2): `aspect-ratio: 1 / 1` made each card as tall as it was wide.
    expect(boxes.docs.height).toBeLessThanOrEqual(260);
    expect(boxes.convert.height).toBeLessThanOrEqual(260);
    // Above the breakpoint the pair still sits side by side.
    expect(boxes.convert.x).toBeGreaterThan(boxes.docs.x + boxes.docs.width - 4);

    await page.setViewportSize({ width: 760, height: 800 });
    const stacked = await rectsInOneFrame(page, { docs: docsCard, convert: convertCard });
    // The 760px single column survives the new sizing: one card per row.
    expect(stacked.convert.y).toBeGreaterThanOrEqual(stacked.docs.y + stacked.docs.height - 4);
    expect(stacked.docs.width).toBeLessThanOrEqual(760);
    expect(stacked.docs.height).toBeLessThanOrEqual(260);
  });
});
