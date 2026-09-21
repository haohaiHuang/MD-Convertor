import { expect, test, type Page } from "@playwright/test";

const NAVY = {
  paper: "rgb(249, 250, 251)",
  accent: "rgb(42, 57, 92)",
  accentDark: "rgb(35, 47, 78)",
  accentSoft: "rgb(238, 241, 246)",
};

/** Fixed settings so the badge text and the provider card do not depend on other specs' writes. */
async function mockSettings(page: Page) {
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
        // The real API fills output server-side; the mock matches that contract.
        output: { defaultPath: null, useDefaultPath: false },
      }),
    }),
  );
}

test("the converter page paints the navy palette", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("html")).toHaveCSS("background-color", NAVY.paper);

  // The tinted radial behind the page must sit on the accent hue, not on the retired moss green.
  const pageBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundImage);
  expect(pageBackground).toMatch(/rgba?\(42[, ]+57[, ]+92/);

  const submit = page.getByRole("button", { name: "转换", exact: true });
  await page.getByLabel("网页链接").fill("https://example.com/article");
  await expect(submit).toBeEnabled();

  await expect(submit).toHaveCSS("background-color", NAVY.accent);
  await submit.hover();
  await expect(submit).toHaveCSS("background-color", NAVY.accentDark);
});

test("the settings card paints the navy palette", async ({ page }) => {
  await mockSettings(page);
  await page.goto("/settings");

  const card = page.locator("article[aria-label='云端 Provider']");
  await expect(card.getByText("未配置", { exact: true })).toHaveCSS("background-color", NAVY.accentSoft);
  await expect(card).toHaveCSS("background-color", NAVY.paper);
});

/** The two weights S2 collected ten hand-tuned values down to. */
// Two separate tokens that currently resolve to the same Regular weight; body text is no longer thin.
const BODY_WEIGHT = "400";
const UI_WEIGHT = "400";

const CONVERSION = {
  title: "字重测试文章",
  filename: "字重测试文章.md",
  markdown: "# 字重测试文章\n\n> 来源：[https://example.com](https://example.com)\n\n这是一段测试正文。\n\n## 小节\n\n又一段正文。",
  warnings: [],
  meta: {
    sourceUrl: "https://example.com",
    convertedAt: "2026-07-18T00:00:00.000Z",
    extractionMode: "direct",
    outputBytes: 128,
    textChars: 40,
    sourceImageCount: 0,
    embeddedImageCount: 0,
    omittedImageCount: 0,
  },
};

async function convert(page: Page) {
  await page.route("**/api/convert", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(CONVERSION) }),
  );
  await page.goto("/");
  await page.getByLabel("网页链接").fill("https://example.com/article");
  await page.getByRole("button", { name: "转换", exact: true }).click();
  await expect(page.getByText("转换完成")).toBeVisible();
}

test("the interface text uses the single collected UI weight", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "转换", exact: true })).toHaveCSS("font-weight", UI_WEIGHT);
  await expect(page.getByRole("tab", { name: "富文本转换" })).toHaveCSS("font-weight", UI_WEIGHT);

  await page.getByRole("tab", { name: "富文本转换" }).click();
  await expect(page.locator('label[for="paste-source"]')).toHaveCSS("font-weight", UI_WEIGHT);
});

test("the brand keeps its only available weight and font", async ({ page }) => {
  await page.goto("/");

  // Regression lock: Michroma ships 400 only, so the brand must not be pushed below it.
  const brand = page.locator('[aria-label="MD-Convertor"]');
  await expect(brand).toHaveCSS("font-weight", UI_WEIGHT);
  await page.evaluate(() => document.fonts.ready);
  expect(await brand.evaluate((node) => getComputedStyle(node).fontFamily)).toMatch(/michroma/i);
});

test("body text keeps the regular weight and the reading pane stays regular with bold headings", async ({ page }) => {
  await convert(page);

  // Nothing sets a weight on these, so they inherit the body weight.
  await expect(page.getByLabel("转换结果统计").locator("dt").first()).toHaveCSS("font-weight", BODY_WEIGHT);

  // The reading pane pins the UI weight so it can never drift thinner than the rest of the app.
  await expect(page.getByLabel("Markdown 预览")).toHaveCSS("font-weight", UI_WEIGHT);
  await expect(page.getByLabel("Markdown 预览").locator("p").first()).toHaveCSS("font-weight", UI_WEIGHT);
  // Regression lock: preview headings keep the browser default bold.
  await expect(page.getByLabel("Markdown 预览").locator("h2")).toHaveCSS("font-weight", "700");
});

test("antialiasing is switched on for one consistent stroke rendering", async ({ page, browserName }) => {
  // Firefox and WebKit do not expose -webkit-font-smoothing at all.
  test.skip(browserName !== "chromium", "webkitFontSmoothing is Chromium-only");

  await page.goto("/");

  // TS's CSSStyleDeclaration omits this WebKit property, but Chromium exposes it at runtime.
  const smoothing = await page.evaluate(
    () => (getComputedStyle(document.body) as unknown as { webkitFontSmoothing: string }).webkitFontSmoothing,
  );
  expect(smoothing).toBe("antialiased");
});
