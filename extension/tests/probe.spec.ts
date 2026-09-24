import { chromium, expect, test, type BrowserContext, type CDPSession, type Worker } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// T2.0 fact probe. Loads a throwaway MV3 extension (built here in the OS temp dir — nothing is
// committed, nothing lands in `extension/dist/`) and measures the platform facts S2's service
// worker orchestration depends on. The assertions below are the measured values, so if Chromium
// changes one of them this fails instead of the shipped extension misbehaving.
//
// Harness trap measured while writing this: Playwright always sets CDP `Browser.setDownloadBehavior`
// to `allowAndName` for a persistent context, which names every download `<guid>` (no extension) and
// drops the requested subdirectory — the requested `filename` becomes unobservable. The probe
// therefore resets the behaviour to `default` over CDP and points the profile's download directory
// at a temp dir (the profile Preferences below); that combination reproduces real Chrome naming.

const chromiumArgs = (process.env.MD_CONVERTOR_EXTENSION_CHROMIUM_ARGS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const PROBE = "md-convertor-probe";
const IMAGE_DIR = `${PROBE}-images`;
const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

let extensionDir: string;
let profileDir: string;
let downloadDir: string;
let context: BrowserContext;
let worker: Worker;
let server: Server;
let origin: string;

function writeProbeExtension(dir: string): void {
  writeFileSync(
    path.join(dir, "manifest.json"),
    JSON.stringify(
      {
        manifest_version: 3,
        name: "MD Convertor probe",
        version: "0.0.1",
        permissions: ["activeTab", "scripting", "downloads"],
        action: { default_title: "probe" },
        background: { service_worker: "worker.js" },
      },
      null,
      2,
    ),
  );
  writeFileSync(path.join(dir, "worker.js"), "chrome.runtime.onMessage.addListener(() => {});\n");
  writeFileSync(path.join(dir, "content.js"), "globalThis.__mdProbeInjected = true;\n");
}

async function waitForDownload(downloadId: number): Promise<{ filename: string; state: string }> {
  const deadline = Date.now() + 30_000;
  for (;;) {
    const item = await worker.evaluate(
      async (id) => (await chrome.downloads.search({ id }))[0] ?? null,
      downloadId,
    );
    if (item?.state === "complete" || item?.state === "interrupted") return item;
    if (Date.now() > deadline) throw new Error(`download ${downloadId} did not settle in 30s`);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

async function download(filename: string, url: string): Promise<{ filename: string; state: string }> {
  const id = await worker.evaluate(
    async ({ name, target }) =>
      chrome.downloads.download({ url: target, filename: name, conflictAction: "overwrite", saveAs: false }),
    { name: filename, target: url },
  );
  return waitForDownload(id);
}

const markdownUrl = (body: string) => `data:text/markdown;charset=utf-8,${encodeURIComponent(body)}`;
const imageUrl = () => `data:image/png;base64,${PNG_1X1}`;

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

test.beforeAll(async () => {
  extensionDir = mkdtempSync(path.join(tmpdir(), "md-probe-ext-"));
  profileDir = mkdtempSync(path.join(tmpdir(), "md-probe-profile-"));
  downloadDir = mkdtempSync(path.join(tmpdir(), "md-probe-downloads-"));
  writeProbeExtension(extensionDir);
  mkdirSync(path.join(profileDir, "Default"), { recursive: true });
  writeFileSync(
    path.join(profileDir, "Default", "Preferences"),
    JSON.stringify({ download: { default_directory: downloadDir, prompt_for_download: false } }),
  );

  server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("<!doctype html><html><body><article><p>probe page</p></article></body></html>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("probe server has no port");
  origin = `http://127.0.0.1:${address.port}/`;

  context = await chromium.launchPersistentContext(profileDir, {
    channel: "chromium",
    args: [
      ...chromiumArgs,
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
    ],
  });
  const cdp: CDPSession = await context.newCDPSession(await context.newPage());
  await cdp.send("Browser.setDownloadBehavior", { behavior: "default" });
  worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
});

test.afterAll(async () => {
  await context?.close();
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  rmSync(extensionDir, { recursive: true, force: true });
  rmSync(profileDir, { recursive: true, force: true });
  rmSync(downloadDir, { recursive: true, force: true });
});

test("probe 1 — a service worker cannot inject a content script without a user gesture", async () => {
  const page = await context.newPage();
  await page.goto(origin, { waitUntil: "domcontentloaded" });

  const outcomes = await worker.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    const results: { tabId: number; ok: boolean; detail: string }[] = [];
    for (const tab of tabs) {
      if (tab.id === undefined) continue;
      try {
        const injected = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"],
        });
        results.push({ tabId: tab.id, ok: injected.length > 0, detail: "injected" });
      } catch (error) {
        results.push({ tabId: tab.id, ok: false, detail: String((error as Error).message ?? error) });
      }
    }
    return results;
  });

  await page.close();
  expect(outcomes.length).toBeGreaterThan(0);
  expect(outcomes.filter((outcome) => outcome.ok)).toEqual([]);
  expect(outcomes.every((outcome) => outcome.detail.includes("must request permission"))).toBe(true);
});

test("probe 2 — a requested filename without an extension is written exactly as requested", async () => {
  const note = await download(`${IMAGE_DIR}/note`, markdownUrl("# note\n"));
  const photo = await download(`${IMAGE_DIR}/photo`, imageUrl());

  expect(note.state).toBe("complete");
  expect(photo.state).toBe("complete");
  // Chrome does not infer an extension from the MIME type; the plain name lands as-is.
  expect(path.basename(note.filename)).toBe("note");
  expect(path.basename(photo.filename)).toBe("photo");
});

test("probe 3 — search() reports the real absolute path, subdirectory included", async () => {
  const image = await download(`${IMAGE_DIR}/1-image.png`, imageUrl());

  expect(path.isAbsolute(image.filename)).toBe(true);
  expect(image.filename).toBe(path.join(downloadDir, IMAGE_DIR, "1-image.png"));
  expect(existsSync(image.filename)).toBe(true);
  expect(readdirSync(path.join(downloadDir, IMAGE_DIR)).sort()).toEqual([
    "1-image.png",
    "note",
    "photo",
  ]);
});

test("probe 4 — conflictAction overwrite replaces the file instead of adding a suffix", async () => {
  const first = await download(`${IMAGE_DIR}/dup.md`, markdownUrl("# first\n"));
  const second = await download(`${IMAGE_DIR}/dup.md`, markdownUrl("# second\n"));

  expect(second.state).toBe("complete");
  expect(second.filename).toBe(first.filename);
  expect(readFileSync(second.filename, "utf8")).toContain("second");
  const siblings = readdirSync(path.dirname(second.filename)).filter((entry) =>
    entry.startsWith("dup"),
  );
  expect(siblings).toEqual(["dup.md"]);
});

test("probe 5 — an absolute filename is rejected, which is why every write path stays relative", async () => {
  const outcome = await worker.evaluate(async () => {
    try {
      await chrome.downloads.download({
        url: "data:text/markdown;charset=utf-8,%23%20abs%0A",
        filename: "/tmp/md-convertor-probe-absolute.md",
        conflictAction: "overwrite",
        saveAs: false,
      });
      return "accepted";
    } catch (error) {
      return String((error as Error).message ?? error);
    }
  });

  expect(outcome).toContain("Invalid filename");
});
