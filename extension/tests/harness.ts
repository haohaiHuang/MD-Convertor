import { chromium, type BrowserContext, type Worker } from "@playwright/test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
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

export async function waitForFile(dir: string, name: string, timeoutMs = 30_000): Promise<string> {
  const target = path.join(dir, name);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(target)) return target;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const seen = existsSync(dir) ? readdirSync(dir).join(", ") : "(directory missing)";
  throw new Error(`${name} never appeared in ${dir}; saw: ${seen}`);
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
