import { chromium, type BrowserContext, type Worker } from "@playwright/test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";

// Shared Playwright plumbing for the extension specs. Two platform quirks are encoded here, both
// measured in the S2 T2.0 probe — see `docs/features/browser-extension/S2-extension-shell-and-writes.md`.

// Chromium inside a sandbox needs `--no-sandbox,--disable-gpu`; a normal shell needs nothing.
export const chromiumArgs = (process.env.MD_CONVERTOR_EXTENSION_CHROMIUM_ARGS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export function tempDir(prefix: string): string {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

// `chrome.downloads.download()` resolves once the download has *started*, so a file can exist with
// its bytes still being written — and `waitForFile` only looks for the name. Skeleton and the S3
// integration spec both read the file back, so they must first let Chrome declare it complete.
// (Measured: reading straight after the worker resolves produced an empty or truncated markdown
// in roughly one run out of ten.)
export async function waitForDownloadComplete(worker: Worker, name: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const state = await worker.evaluate(async (target) => {
      const items = await chrome.downloads.search({});
      return items.find((item) => item.filename === target || item.filename.endsWith(`/${target}`))?.state;
    }, name);
    if (state === "complete") return;
    if (Date.now() > deadline) {
      throw new Error(`${name} never finished downloading (last state: ${state ?? "not found"})`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

// Quirk 1: Playwright always forces CDP `Browser.setDownloadBehavior: allowAndName` on a
// persistent context, which renames every download to a GUID and drops the requested
// subdirectory. Pointing the profile's own download directory at a temp dir and resetting the
// behaviour to `default` restores real Chrome naming, which is the only harness in which
// filenames and `conflictAction: "overwrite"` are observable at all.
export function prepareProfile(profileDir: string, downloadDir: string): void {
  mkdirSync(path.join(profileDir, "Default"), { recursive: true });
  writeFileSync(
    path.join(profileDir, "Default", "Preferences"),
    JSON.stringify({ download: { default_directory: downloadDir, prompt_for_download: false } }),
  );
}

// Quirk 2: Playwright cannot click the browser toolbar, so `activeTab` is never granted and the
// worker's ungestured `executeScript` is rejected unless the manifest carries a host permission.
// Only the temp copy is widened; `extension/dist/` keeps the shipped manifest.
export function copyExtensionWithHostPermission(sourceDir: string, targetDir: string, pattern: string): void {
  cpSync(sourceDir, targetDir, { recursive: true });
  const manifestPath = path.join(targetDir, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { host_permissions?: string[] };
  manifest.host_permissions = [pattern];
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

export function launchExtension(profileDir: string, extensionDir: string): Promise<BrowserContext> {
  return chromium.launchPersistentContext(profileDir, {
    channel: "chromium",
    args: [
      ...chromiumArgs,
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
    ],
  });
}

export async function useRealDownloadNaming(context: BrowserContext): Promise<void> {
  const cdp = await context.newCDPSession(await context.newPage());
  await cdp.send("Browser.setDownloadBehavior", { behavior: "default" });
}

export async function serviceWorker(context: BrowserContext): Promise<Worker> {
  return context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
}

export type FixtureServer = { origin: string; close: () => Promise<void> };

export async function serveFixtures(dir: string): Promise<FixtureServer> {
  const server: Server = createServer((request, response) => {
    const name = path.basename(new URL(request.url ?? "/", "http://localhost").pathname);
    const file = path.join(dir, name);
    if (!name || !existsSync(file)) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(readFileSync(file));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("fixture server has no port");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
