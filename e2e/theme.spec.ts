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
