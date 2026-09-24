import { expect, test, type BrowserContext, type Worker } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  copyExtensionWithHostPermission,
  launchExtension,
  prepareProfile,
  serveFixtures,
  serviceWorker,
  tempDir,
  useRealDownloadNaming,
  waitForFile,
  type FixtureServer,
} from "./harness";

// T2.1 skeleton: one click → one `<标题>.md` on disk. Images, reference rewriting and the badge
// land in later S2 tasks, so this spec deliberately asserts only the markdown.
const projectRoot = path.resolve(__dirname, "../..");
const builtExtension = path.join(projectRoot, "extension/dist");
const fixtures = path.join(projectRoot, "extension/tests/fixtures");

let server: FixtureServer;
let context: BrowserContext;
let worker: Worker;
let downloadDir: string;
let extensionDir: string;

test.beforeAll(async () => {
  server = await serveFixtures(fixtures);
  downloadDir = tempDir("md-skeleton-downloads-");
  extensionDir = tempDir("md-skeleton-ext-");

  const profileDir = tempDir("md-skeleton-profile-");
  prepareProfile(profileDir, downloadDir);
  copyExtensionWithHostPermission(builtExtension, extensionDir, `${server.origin}/*`);
  context = await launchExtension(profileDir, extensionDir);
  await useRealDownloadNaming(context);
  worker = await serviceWorker(context);
});

test.afterAll(async () => {
  await context?.close();
  await server?.close();
});

test("the worker writes <title>.md for the injected page", async () => {
  const page = await context.newPage();
  await page.goto(`${server.origin}/article.html`, { waitUntil: "domcontentloaded" });

  const result = await worker.evaluate(async (origin) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((candidate) => candidate.url?.startsWith(origin));
    if (!tab?.id) throw new Error("fixture tab not found");
    return (globalThis as unknown as { __mdConvertorRun: (tabId: number) => Promise<unknown> }).__mdConvertorRun(
      tab.id,
    );
  }, server.origin);

  // The image in the fixture is a 404 on purpose: a failed image must not stop the markdown.
  expect(result).toMatchObject({ ok: true, mdName: "示例文章标题.md", saved: 0, failed: 1 });

  const markdown = readFileSync(await waitForFile(downloadDir, "示例文章标题.md"), "utf8");
  expect(markdown).toContain("示例文章标题");
  expect(markdown).toContain("这是第一段正文");
  expect(markdown).toContain("> 来源：");
  await page.close();
});
