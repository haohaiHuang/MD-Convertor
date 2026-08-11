import { expect, test } from "@playwright/test";

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

  await page.getByRole("button", { name: "转换为 MD" }).click();

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
  await page.getByRole("button", { name: "转换为 MD" }).click();
  await expect(input).toHaveAttribute("readonly", "");
  await expect(page.getByRole("button", { name: "清空链接" })).toBeDisabled();
  await page.getByRole("button", { name: "停止转换" }).click();

  await expect(page.getByText("已停止转换，可修改链接后重新开始。")).toBeVisible();
  await expect(input).toHaveValue("https://example.com/slow");
  await expect(input).not.toHaveAttribute("readonly", "");
});

test("rejects invalid pasted content without converting", async ({ page }) => {
  let requestCount = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/convert")) requestCount += 1;
  });

  await pasteIntoUrlInput(page, "这不是一个网页链接");
  await expect(page.getByText("请输入完整的 HTTP 或 HTTPS 网页链接。")).toBeVisible();
  await expect(page.getByRole("button", { name: "转换为 MD" })).toBeDisabled();
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
  await page.getByRole("button", { name: "转换为 MD" }).click();
  await expect(page.getByRole("heading", { name: "转换完成", level: 2 })).toBeVisible();
  await page.getByRole("button", { name: "清空链接" }).click();

  await expect(input).toHaveValue("");
  await expect(page.getByRole("heading", { name: "转换完成", level: 2 })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "转换为 MD" })).toBeDisabled();
});

test("shows user-facing statistics without repeating the article title", async ({ page }) => {
  await page.getByLabel("网页链接").fill("https://example.com/article");
  await page.getByRole("button", { name: "转换为 MD" }).click();

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
    await page.getByRole("button", { name: "转换为 MD" }).click();
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
