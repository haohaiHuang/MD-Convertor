import { expect, test, type BrowserContext, type Worker } from "@playwright/test";
import { writeFileSync } from "node:fs";
import path from "node:path";
import {
  copyExtensionWithHostPermission,
  launchExtension,
  prepareProfile,
  serveFixtures,
  serviceWorker,
  tempDir,
  type FixtureServer,
} from "./harness";

// T2.2: what the injected content script reports. Three shapes matter — a real article, a page
// with no article, and a page the extension is not allowed to touch. The message contract is the
// only interface between the two halves of the extension, so it is asserted field by field here.
const projectRoot = path.resolve(__dirname, "../..");
const builtExtension = path.join(projectRoot, "extension/dist");
const fixtures = path.join(projectRoot, "extension/tests/fixtures");

let server: FixtureServer;
let context: BrowserContext;
let worker: Worker;

test.beforeAll(async () => {
  server = await serveFixtures(fixtures);
  const extensionDir = tempDir("md-content-ext-");
  const profileDir = tempDir("md-content-profile-");
  prepareProfile(profileDir, tempDir("md-content-downloads-"));
  copyExtensionWithHostPermission(builtExtension, extensionDir, `${server.origin}/*`);
  context = await launchExtension(profileDir, extensionDir);
  worker = await serviceWorker(context);
});

test.afterAll(async () => {
  await context?.close();
  await server?.close();
});

// Injects the built content script the way the worker does and hands back whatever it sends.
async function injectAndCapture(url: string): Promise<unknown> {
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const message = await worker.evaluate(async (target) => {
    const received = new Promise((resolve) => chrome.runtime.onMessage.addListener((value) => resolve(value)));
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((candidate) => candidate.url === target);
    if (!tab?.id) throw new Error("target tab not found");
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    return received;
  }, url);
  await page.close();
  return message;
}

test("the content script reports a complete payload for a real article", async () => {
  const message = (await injectAndCapture(`${server.origin}/article.html`)) as Record<string, unknown>;

  expect(message.type).toBe("md-convertor:article");
  expect(message.title).toBe("示例文章标题");
  expect(message.sourceUrl).toBe(`${server.origin}/article.html`);
  expect(message.convertedAt).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
  expect(message.markdown).toContain("这是第一段正文");
  expect(message.markdown).toContain("md-convertor-image-1");
  // The lazy image is rewritten to a placeholder and planned for download; the inline `data:` image
  // stays in the markdown (it is already self-contained) and must not appear in the plan.
  expect(message.images).toEqual([
    { placeholder: "md-convertor-image-1", url: `${server.origin}/images/lazy.png` },
  ]);
});

test("the content script reports NO_ARTICLE when the page has no article", async () => {
  const message = await injectAndCapture(`${server.origin}/no-article.html`);

  expect(message).toMatchObject({ type: "md-convertor:failed", code: "NO_ARTICLE" });
  expect((message as { message: string }).message).toContain("正文");
});

test("a page the extension may not touch fails readably instead of silently", async () => {
  const file = path.join(tempDir("md-content-file-"), "page.html");
  writeFileSync(file, "<html><body><h1>本地页</h1><p>扩展没有 file:// 权限。</p></body></html>");
  const page = await context.newPage();
  await page.goto(`file://${file}`, { waitUntil: "domcontentloaded" });

  // The URL of a tab we have no host permission for is not readable from the worker (measured: it
  // comes back `undefined`), so this picks the tab this test just opened — the newest one.
  const result = await worker.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.at(-1);
    if (!tab?.id) throw new Error("no tab to inject into");
    return (globalThis as unknown as { __mdConvertorRun: (tabId: number) => Promise<unknown> }).__mdConvertorRun(
      tab.id,
    );
  });

  expect(result).toMatchObject({ ok: false, code: "INJECT_FAILED" });
  expect((result as { message: string }).message.length).toBeGreaterThan(0);
  await page.close();
});
