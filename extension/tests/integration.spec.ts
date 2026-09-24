import { expect, test, type BrowserContext, type Worker } from "@playwright/test";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import {
  copyExtensionWithHostPermission,
  launchExtension,
  prepareProfile,
  serviceWorker,
  tempDir,
  useRealDownloadNaming,
  waitForDownloadComplete,
} from "./harness";
import { MISSING_IMAGE, PROTECTED_IMAGE, startFixtureServer, type FixtureServer } from "./fixtures/server";

// S3 layer 4: the real built extension, in a real Chromium, writing real files. Everything here
// asserts the on-disk result rather than what the worker said it did, because "the worker thinks
// it saved a file" is exactly the claim S2 could only make with fakes.
//
// Harness notes (both measured in the S2 T2.0 probe, both required):
//   * `prepareProfile` + `useRealDownloadNaming` keep Chrome's own naming — without them Playwright
//     names every download `<guid>` and drops the requested subdirectory, so filenames and
//     `conflictAction: "overwrite"` would be untestable.
//   * The temp manifest copy carries a host permission: Playwright cannot click the toolbar, so
//     `activeTab` is never granted and an ungestured `executeScript` would be rejected.

const projectRoot = path.resolve(__dirname, "../..");
const builtExtension = path.join(projectRoot, "extension/dist");

const ARTICLE = { route: "/article", title: "示例文章标题" };
const COOKIE_ARTICLE = { route: "/article-cookie", title: "会话图片文章" };
const MISSING_ARTICLE = { route: "/article-missing", title: "缺图文章" };
const SPECIAL_ARTICLE = { route: "/article-special", rawTitle: "发布说明/第 1 期: 中文标题", title: "发布说明-第 1 期- 中文标题" };

let server: FixtureServer;
let context: BrowserContext;
let worker: Worker;
let downloadDir: string;
let extensionDir: string;
let profileDir: string;

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

test.beforeAll(async () => {
  server = await startFixtureServer();
  downloadDir = tempDir("md-integration-downloads-");
  extensionDir = tempDir("md-integration-ext-");
  profileDir = tempDir("md-integration-profile-");
  prepareProfile(profileDir, downloadDir);
  copyExtensionWithHostPermission(builtExtension, extensionDir, `${server.origin}/*`);
  context = await launchExtension(profileDir, extensionDir);
  await useRealDownloadNaming(context);
  worker = await serviceWorker(context);
});

test.afterAll(async () => {
  await context?.close();
  await server?.close();
  for (const dir of [downloadDir, extensionDir, profileDir]) {
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

// The worker's own entry point, called directly — the toolbar click (and the `activeTab` grant it
// carries) can only be exercised by a human, which is what T3.4 is for.
async function convert(route: string): Promise<{ mdName: string; saved: number; failed: number }> {
  const page = await context.newPage();
  await page.goto(`${server.origin}${route}`, { waitUntil: "domcontentloaded" });
  try {
    return (await worker.evaluate(async (origin) => {
      const tabs = await chrome.tabs.query({});
      const tab = tabs.find((candidate) => candidate.url?.startsWith(origin));
      if (!tab?.id) throw new Error("fixture tab not found");
      return (
        globalThis as unknown as { __mdConvertorRun: (tabId: number) => Promise<unknown> }
      ).__mdConvertorRun(tab.id);
    }, server.origin)) as { mdName: string; saved: number; failed: number };
  } finally {
    await page.close();
  }
}

function readMarkdown(mdName: string): Promise<string> {
  return waitForDownloadComplete(worker, mdName).then(() =>
    readFileSync(path.join(downloadDir, mdName), "utf8"),
  );
}

// Every non-http reference in the markdown, i.e. the relative paths that have to point at real
// files. The `> 来源：` line is an absolute URL and is deliberately not part of this set.
function relativeRefs(markdown: string): string[] {
  return [...markdown.matchAll(/\]\(([^)]+)\)/g)]
    .map((match) => match[1].replace(/^<|>$/g, ""))
    .filter((target) => !target.startsWith("http"));
}

test("T3.1 — the markdown and its images really land, and every reference resolves", async () => {
  const result = await convert(ARTICLE.route);
  expect(result).toMatchObject({ mdName: `${ARTICLE.title}.md`, saved: 2, failed: 0 });

  const markdown = await readMarkdown(result.mdName);
  const refs = relativeRefs(markdown);
  // Three image references, two files: the fixture repeats the first image on purpose.
  expect(refs).toHaveLength(3);
  for (const ref of refs) {
    expect(existsSync(path.join(downloadDir, ref)), `${ref} must exist on disk`).toBe(true);
  }

  const imagesDir = `${ARTICLE.title}.images`;
  expect(readdirSync(path.join(downloadDir, imagesDir)).sort()).toEqual([
    "001-photo-one.png",
    "002-photo-two.png",
  ]);
  expect(new Set(refs).size).toBe(2);
  expect(refs[0]).toBe(refs[2]);
});

test("T3.2 — an image behind the session cookie still downloads", async () => {
  const result = await convert(COOKIE_ARTICLE.route);
  expect(result).toMatchObject({ mdName: `${COOKIE_ARTICLE.title}.md`, saved: 1, failed: 0 });

  const markdown = await readMarkdown(result.mdName);
  const refs = relativeRefs(markdown);
  expect(refs).toHaveLength(1);
  const downloaded = path.join(downloadDir, refs[0]);
  expect(existsSync(downloaded)).toBe(true);
  // A real image, not an empty file left behind by a refused request.
  expect(readFileSync(downloaded).byteLength).toBeGreaterThan(0);
  expect(path.basename(downloaded)).toBe("001-secret.png");
  // The session cookie is what made it work; without it the same path is a 403.
  expect((await fetch(`${server.origin}${PROTECTED_IMAGE}`)).status).toBe(403);
});

test("T3.2 — a 404 image keeps its original URL and gets a visible marker", async () => {
  const result = await convert(MISSING_ARTICLE.route);
  expect(result).toMatchObject({ mdName: `${MISSING_ARTICLE.title}.md`, saved: 0, failed: 1 });

  const markdown = await readMarkdown(result.mdName);
  const missing = `${server.origin}${MISSING_IMAGE}`;
  const lines = markdown.split("\n");
  const line = lines.findIndex((candidate) => candidate.includes(`](${missing})`));
  expect(line, `markdown was:\n${markdown}`).toBeGreaterThan(-1);
  expect(lines[line + 1]).toBe(`<!-- 图片未下载：${missing} -->`);
  const imageDir = path.join(downloadDir, `${MISSING_ARTICLE.title}.images`);
  // Measured: Chrome creates the target directory before the request, and an interrupted
  // download removes the partial file but leaves the directory behind — empty. The downloads API
  // cannot delete a directory, so "absent or empty" is the strongest honest claim.
  expect(existsSync(imageDir) ? readdirSync(imageDir) : []).toEqual([]);
});

test("T3.3 — exporting the same article twice overwrites instead of splitting the pair", async () => {
  const first = await convert(ARTICLE.route);
  const firstMarkdown = await readMarkdown(first.mdName);
  const imagesBefore = readdirSync(path.join(downloadDir, `${ARTICLE.title}.images`)).sort();

  const second = await convert(ARTICLE.route);
  expect(second.mdName).toBe(first.mdName);

  // Scoped to this title: the other cases have written their own files into the same directory.
  const siblings = readdirSync(downloadDir).filter(
    (entry) => entry.startsWith(ARTICLE.title) && entry.endsWith(".md"),
  );
  expect(siblings).toEqual([`${ARTICLE.title}.md`]);
  expect(readdirSync(path.join(downloadDir, `${ARTICLE.title}.images`)).sort()).toEqual(imagesBefore);

  // The `> 转换时间：` line is the one thing that may differ between two runs.
  const strip = (markdown: string) => markdown.replace(/^> 转换时间：.*$/m, "");
  expect(strip(await readMarkdown(second.mdName))).toBe(strip(firstMarkdown));
});

test("T3.3 — a Chinese title with a slash and a colon yields a clean, readable file name", async () => {
  const result = await convert(SPECIAL_ARTICLE.route);
  expect(result.mdName).toBe(`${SPECIAL_ARTICLE.title}.md`);

  const markdown = await readMarkdown(result.mdName);
  // The file name is sanitised; the heading keeps the real title.
  expect(markdown).toContain(`# ${SPECIAL_ARTICLE.rawTitle}`);
  expect(markdown).toContain("这是第一段正文");

  for (const entry of readdirSync(downloadDir)) {
    expect(entry, `${entry} must not contain a character a file system rejects`).not.toMatch(
      /[<>:"/\\|?*]/,
    );
  }
});
