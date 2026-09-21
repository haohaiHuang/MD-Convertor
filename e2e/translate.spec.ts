import { expect, test, type Page } from "@playwright/test";

/**
 * Translation front end (S4). The conversion is stubbed so the browser never
 * fetches a real page; `/api/translate/analyze` and `/api/translate/run` are the
 * real endpoints backed by the built-in test model
 * (`MD_CONVERTOR_TEST_PROVIDER=1` in scripts/start-e2e-server.mjs).
 */
const convertedAt = "2026-08-09T00:00:00.000Z";
const bodyMarkdown = "这是一段粘贴正文。";
const originalMarkdown = `# 粘贴测试文章\n\n> 转换时间：${convertedAt}\n\n${bodyMarkdown}`;
const translatedMarkdown = `# [en] 粘贴测试文章\n\n> 转换时间：${convertedAt}\n\n[en] ${bodyMarkdown}`;

const pasteResponse = {
  title: "粘贴测试文章",
  filename: "粘贴测试文章.md",
  markdown: originalMarkdown,
  warnings: [],
  meta: {
    sourceUrl: "",
    convertedAt,
    extractionMode: "paste",
    outputBytes: 128,
    textChars: bodyMarkdown.length,
    sourceImageCount: 0,
    embeddedImageCount: 0,
    omittedImageCount: 0,
  },
};

type StoredSettings = {
  version: number;
  mode: string;
  cloud: { providers: unknown[]; activeProviderId: string | null };
  local: { clis: unknown[]; activeCliId: string | null };
  languages: { target: string; custom: string[] };
  translation: { defaultEnabled: boolean };
  // The real API always returns output (lenient read fills it server-side).
  output: { defaultPath: string | null; useDefaultPath: boolean };
};

function settingsWith(defaultEnabled: boolean, target: string): StoredSettings {
  return {
    version: 1,
    mode: "cloud",
    cloud: { providers: [], activeProviderId: null },
    local: { clis: [], activeCliId: null },
    languages: { target, custom: [] },
    translation: { defaultEnabled },
    output: { defaultPath: null, useDefaultPath: false },
  };
}

async function mockSettings(page: Page, defaultEnabled: boolean, target = "en"): Promise<void> {
  await page.route("**/api/settings", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(settingsWith(defaultEnabled, target)),
    });
  });
}

async function mockConversion(page: Page): Promise<void> {
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
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pasteResponse) });
  });
}

async function pasteAndConvert(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "富文本转换" }).click();
  const textarea = page.getByLabel("粘贴的正文内容");
  await textarea.evaluate((element, payload) => {
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: {
        getData: (type: string) => type === "text/plain" ? payload : "",
      },
    });
    element.dispatchEvent(event);
  }, bodyMarkdown);
  await page.getByRole("button", { name: "转换", exact: true }).click();
  await expect(page.getByRole("heading", { name: "转换完成", level: 2 })).toBeVisible();
}

async function waitForTranslation(page: Page): Promise<void> {
  await expect(page.getByRole("tabpanel", { name: "译文" })).toContainText("[en]");
}

function copiedMarkdown(page: Page): Promise<string | undefined> {
  return page.evaluate(() => (window as typeof window & { copiedMarkdown?: string }).copiedMarkdown);
}

const translateToggle = (page: Page) => page.getByRole("checkbox", { name: "翻译为英语" });

// ---------------------------------------------------------------------------
// S5 · language ratio decision
// ---------------------------------------------------------------------------

/** Ten equally sized paragraphs, so marking N of them as target-language is an exact ratio. */
const ratioParagraphs = Array.from({ length: 10 }, (_, index) => `Paragraph number ${index} of the ratio document.`);
const ratioMarkdown = `${ratioParagraphs.join("\n\n")}\n`;

async function mockRatioConversion(page: Page): Promise<void> {
  await page.route("**/api/convert-paste", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...pasteResponse, title: "Ratio document", filename: "ratio.md", markdown: ratioMarkdown }),
    }),
  );
}

type AnalysisBody = {
  analysis: {
    totalChars: number;
    targetChars: number;
    ratio: number;
    blocks: { language: string; chars: number }[];
  };
};

/**
 * Rewrites the real analyze answer into a chosen distribution. The run request
 * keeps using the real endpoint, so `scope: "non-target"` fidelity is exercised
 * end to end (`/api/translate/run` validates block alignment but not languages).
 */
async function mockAnalysisTargets(page: Page, targetCount: number): Promise<void> {
  await page.route("**/api/translate/analyze", async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as AnalysisBody;
    const prose = body.analysis.blocks.filter((block) => block.language !== "skipped");
    prose.forEach((block, position) => {
      block.language = position < targetCount ? "target" : "other";
    });
    const totalChars = prose.reduce((total, block) => total + block.chars, 0);
    const targetChars = prose.slice(0, targetCount).reduce((total, block) => total + block.chars, 0);
    body.analysis.totalChars = totalChars;
    body.analysis.targetChars = targetChars;
    body.analysis.ratio = totalChars === 0 ? 0 : targetChars / totalChars;
    await route.fulfill({ response, json: body });
  });
}

/** Defensive branch: an answer that reports no translatable prose at all. */
async function mockEmptyProseAnalysis(page: Page): Promise<void> {
  await page.route("**/api/translate/analyze", async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as AnalysisBody;
    for (const block of body.analysis.blocks) {
      block.language = "skipped";
      block.chars = 0;
    }
    body.analysis.totalChars = 0;
    body.analysis.targetChars = 0;
    body.analysis.ratio = 0;
    await route.fulfill({ response, json: body });
  });
}

function trackTranslationRequests(page: Page): { scopes: string[]; runs: number; analyses: number } {
  const record = { scopes: [] as string[], runs: 0, analyses: 0 };
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/api/translate/analyze")) record.analyses += 1;
    if (url.includes("/api/translate/run")) {
      record.runs += 1;
      record.scopes.push((JSON.parse(request.postData() ?? "{}") as { scope?: string }).scope ?? "");
    }
  });
  return record;
}

test.beforeEach(async ({ page }) => {
  await mockConversion(page);
});

test("勾选框按设置里的默认开关取值，取消勾选不跨启动保留，两个面板状态同步", async ({ page }) => {
  await mockSettings(page, true);
  await page.goto("/");

  await expect(translateToggle(page)).toBeChecked();
  await translateToggle(page).uncheck();

  await page.getByRole("tab", { name: "富文本转换" }).click();
  await expect(translateToggle(page)).not.toBeChecked();

  await page.reload();
  await expect(translateToggle(page)).toBeChecked();
});

test("未打开默认开关时勾选框保持未选中", async ({ page }) => {
  await mockSettings(page, false);
  await page.goto("/");

  await expect(translateToggle(page)).not.toBeChecked();
});

test("勾选后转换成功会自动翻译，出现两个 Tab 并默认停在译文", async ({ page }) => {
  await mockSettings(page, true);
  await page.goto("/");
  await expect(translateToggle(page)).toBeChecked();

  await pasteAndConvert(page);

  await expect(page.getByRole("tab", { name: "原文" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "译文" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "译文" })).toContainText(`[en] ${bodyMarkdown}`);

  await page.getByRole("tab", { name: "原文" }).click();
  await expect(page.getByRole("tabpanel", { name: "原文" })).toContainText(bodyMarkdown);
  await expect(page.getByRole("tabpanel", { name: "原文" })).not.toContainText("[en]");
});

test("未勾选时不出现译文 Tab，结果区与现状一致", async ({ page }) => {
  await mockSettings(page, true);
  await page.goto("/");
  await translateToggle(page).uncheck();

  await pasteAndConvert(page);

  await expect(page.getByRole("tablist", { name: "转换结果" })).toHaveCount(0);
  await expect(page.getByLabel("Markdown 预览")).toContainText(bodyMarkdown);
});

test("复制与下载跟随当前 Tab，译文下载名带语言后缀", async ({ page }) => {
  await mockSettings(page, true);
  await page.goto("/");
  await pasteAndConvert(page);
  await waitForTranslation(page);

  // 默认停在译文 Tab。
  await page.getByRole("button", { name: "复制" }).click();
  await expect(page.getByRole("button", { name: "已复制" })).toBeVisible();
  expect(await copiedMarkdown(page)).toBe(translatedMarkdown);

  const translatedDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载" }).click();
  expect((await translatedDownload).suggestedFilename()).toBe("粘贴测试文章-en.md");

  await page.getByRole("tab", { name: "原文" }).click();
  await page.getByRole("button", { name: "复制" }).click();
  await expect(page.getByRole("button", { name: "已复制" })).toBeVisible();
  expect(await copiedMarkdown(page)).toBe(originalMarkdown);

  const originalDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载" }).click();
  expect((await originalDownload).suggestedFilename()).toBe("粘贴测试文章.md");
});

test("翻译中可以取消，取消后原文仍可读且译文显示已取消", async ({ page }) => {
  await mockSettings(page, true);
  await page.route("**/api/translate/run", async (route) => {
    // 挂起 run，让取消成为唯一出路；页面关闭后 fulfill 会失败，忽略即可。
    await new Promise((resolve) => setTimeout(resolve, 8000));
    await route.fulfill({ status: 502, body: "{}" }).catch(() => undefined);
  });
  await page.goto("/");
  await pasteAndConvert(page);

  await expect(page.getByRole("tabpanel", { name: "译文" })).toContainText("正在翻译正文");
  await page.getByRole("button", { name: "取消" }).click();

  await expect(page.getByRole("tabpanel", { name: "译文" })).toContainText("已取消");
  await page.getByRole("tab", { name: "原文" }).click();
  await expect(page.getByRole("tabpanel", { name: "原文" })).toContainText(bodyMarkdown);
});

test("模型失败时显示错误，重试沿用同一 analysis 并成功", async ({ page }) => {
  await mockSettings(page, true);
  let runCalls = 0;
  let analyzeCalls = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/translate/analyze")) analyzeCalls += 1;
  });
  await page.route("**/api/translate/run", async (route) => {
    runCalls += 1;
    if (runCalls > 1) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "TRANSLATE_PROVIDER_ERROR", message: "模型调用失败，请重试。" } }),
    });
  });
  await page.goto("/");
  await pasteAndConvert(page);

  await expect(page.getByRole("tabpanel", { name: "译文" })).toContainText("模型调用失败，请重试。");
  await page.getByRole("button", { name: "重试" }).click();

  await waitForTranslation(page);
  expect(runCalls).toBe(2);
  expect(analyzeCalls).toBe(1);
});

test("未配置翻译模型时不出现 Tab，只提示去设置", async ({ page }) => {
  await mockSettings(page, true);
  await page.route("**/api/translate/analyze", (route) =>
    route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "TRANSLATE_NOT_CONFIGURED", message: "尚未配置翻译模型。" } }),
    }),
  );
  await page.goto("/");
  await pasteAndConvert(page);

  await expect(page.getByRole("tablist", { name: "转换结果" })).toHaveCount(0);
  await expect(page.getByLabel("Markdown 预览")).toContainText(bodyMarkdown);
  const notice = page.getByRole("status");
  await expect(notice).toContainText("尚未配置可用的翻译模型");
  await expect(notice.getByRole("link", { name: "设置" })).toBeVisible();
});

test("占比 70%–97% 时弹确认框，选「只翻译非目标语言部分」只翻其余部分", async ({ page }) => {
  await mockSettings(page, true);
  await mockRatioConversion(page);
  await mockAnalysisTargets(page, 8);
  const requests = trackTranslationRequests(page);
  await page.goto("/");
  await pasteAndConvert(page);

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("检测到正文约 80% 已是英语，是否只翻译其余部分？");
  await dialog.getByRole("button", { name: "只翻译非目标语言部分" }).click();

  await waitForTranslation(page);
  expect(requests.scopes).toEqual(["non-target"]);
  const translatedPanel = page.getByRole("tabpanel", { name: "译文" });
  // 前 8 段判定为英语，逐字节保持原文；后 2 段被翻译。
  await expect(translatedPanel).toContainText(ratioParagraphs[0] ?? "");
  await expect(translatedPanel).not.toContainText(`[en] ${ratioParagraphs[0]}`);
  await expect(translatedPanel).toContainText(`[en] ${ratioParagraphs[9]}`);
});

test("确认框选「不翻译」后保留原文、不显示译文 Tab、不重复弹窗", async ({ page }) => {
  await mockSettings(page, true);
  await mockRatioConversion(page);
  await mockAnalysisTargets(page, 8);
  const requests = trackTranslationRequests(page);
  await page.goto("/");
  await pasteAndConvert(page);

  await expect(page.getByRole("dialog")).toContainText("是否只翻译其余部分？");
  await page.getByRole("button", { name: "不翻译" }).click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("tablist", { name: "转换结果" })).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("已选择不翻译");
  await expect(page.getByLabel("Markdown 预览")).toContainText(ratioParagraphs[0] ?? "");
  await expect(translateToggle(page)).toBeChecked();
  expect(requests.runs).toBe(0);
  expect(requests.analyses).toBe(1);
});

test("占比 ≥97% 时只提示，不发起翻译", async ({ page }) => {
  await mockSettings(page, true);
  await mockRatioConversion(page);
  await mockAnalysisTargets(page, 10);
  const requests = trackTranslationRequests(page);
  await page.goto("/");
  await pasteAndConvert(page);

  await expect(page.getByRole("status")).toContainText("正文已是英语，无需翻译");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("tablist", { name: "转换结果" })).toHaveCount(0);
  await expect(page.getByLabel("Markdown 预览")).toContainText(ratioParagraphs[0] ?? "");
  expect(requests.runs).toBe(0);
});

test("没有可翻译的正文时只提示，不发起翻译", async ({ page }) => {
  await mockSettings(page, true);
  await mockRatioConversion(page);
  await mockEmptyProseAnalysis(page);
  const requests = trackTranslationRequests(page);
  await page.goto("/");
  await pasteAndConvert(page);

  await expect(page.getByRole("status")).toContainText("正文没有可翻译的段落");
  await expect(page.getByRole("tablist", { name: "转换结果" })).toHaveCount(0);
  expect(requests.runs).toBe(0);
});

test("占比低于 70% 时不打扰，直接全文翻译", async ({ page }) => {
  await mockSettings(page, true);
  await mockRatioConversion(page);
  await mockAnalysisTargets(page, 6);
  const requests = trackTranslationRequests(page);
  await page.goto("/");
  await pasteAndConvert(page);

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await waitForTranslation(page);
  expect(requests.scopes).toEqual(["all"]);
  await expect(page.getByRole("tabpanel", { name: "译文" })).toContainText(`[en] ${ratioParagraphs[0]}`);
});
