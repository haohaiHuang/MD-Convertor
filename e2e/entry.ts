import { expect, type Page } from "@playwright/test";

/**
 * The app opens on the landing screen, and the choice between the two entries is client state:
 * a click before hydration is lost, because the server-rendered button has no listener yet and
 * nothing about it looks "unready" to Playwright. Waiting for the page's own settings fetch
 * proves React is attached. Firefox was the engine slow enough to lose the click.
 */
export async function gotoHydrated(page: Page): Promise<void> {
  const loaded = page.waitForResponse((response) => (
    response.url().includes("/api/settings") && response.request().method() === "GET"
  ));
  await page.goto("/");
  await loaded;
}

/** Landing screen → converter screen, which is where the URL / paste specs live. */
export async function gotoConverter(page: Page): Promise<void> {
  await gotoHydrated(page);
  await page.getByRole("button", { name: "粘贴URL/富文本转换" }).click();
  await expect(page.getByLabel("网页链接")).toBeVisible();
}

/** Landing screen → local-documents screen. */
export async function openLocalDocs(page: Page): Promise<void> {
  await gotoHydrated(page);
  await page.getByRole("button", { name: "转换既有文档" }).click();
}
