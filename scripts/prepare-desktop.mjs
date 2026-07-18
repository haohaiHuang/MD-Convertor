import { cp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, ".next", "standalone");
const targetRoot = path.join(projectRoot, ".desktop", "server");
const electronZipRoot = path.join(projectRoot, ".desktop", "electron");

const electronPackage = JSON.parse(await readFile(
  path.join(projectRoot, "node_modules", "electron", "package.json"),
  "utf8",
));
const electronZipName = `electron-v${electronPackage.version}-darwin-arm64.zip`;
const electronCache = process.env.ELECTRON_CACHE || path.join(os.homedir(), "Library", "Caches", "electron");
const cacheEntries = await readdir(electronCache, { recursive: true });
const cachedZip = cacheEntries.find((entry) => path.basename(entry) === electronZipName);
if (!cachedZip) {
  throw new Error(`Electron cache is missing ${electronZipName}. Run npm install with network access first.`);
}

const playwrightPackage = JSON.parse(await readFile(
  path.join(projectRoot, "node_modules", "playwright-core", "browsers.json"),
  "utf8",
));
const headlessShell = playwrightPackage.browsers.find((browser) => browser.name === "chromium-headless-shell");
if (!headlessShell) throw new Error("Playwright does not declare a Chromium headless shell.");
const playwrightCache = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), "Library", "Caches", "ms-playwright");
const headlessShellRoot = path.join(
  playwrightCache,
  `chromium_headless_shell-${headlessShell.revision}`,
  "chrome-headless-shell-mac-arm64",
);

await rm(targetRoot, { force: true, recursive: true });
await mkdir(targetRoot, { recursive: true });
await cp(sourceRoot, targetRoot, { recursive: true, verbatimSymlinks: true });
for (const nativePackage of ["sharp-darwin-arm64", "sharp-libvips-darwin-arm64"]) {
  const targetPackage = path.join(targetRoot, "node_modules", "@img", nativePackage);
  await rm(targetPackage, { force: true, recursive: true });
  await cp(
    path.join(projectRoot, "node_modules", "@img", nativePackage),
    targetPackage,
    { recursive: true },
  );
}
await cp(
  path.join(projectRoot, "node_modules", "playwright"),
  path.join(targetRoot, "node_modules", "playwright"),
  { recursive: true },
);
await cp(
  path.join(projectRoot, "node_modules", "playwright-core"),
  path.join(targetRoot, "node_modules", "playwright-core"),
  { recursive: true },
);
await cp(
  path.join(projectRoot, ".next", "static"),
  path.join(targetRoot, ".next", "static"),
  { recursive: true },
);
await cp(path.join(projectRoot, "public"), path.join(targetRoot, "public"), { recursive: true });
await cp(headlessShellRoot, path.join(targetRoot, "browser"), { recursive: true });
await rm(electronZipRoot, { force: true, recursive: true });
await mkdir(electronZipRoot, { recursive: true });
await cp(path.join(electronCache, cachedZip), path.join(electronZipRoot, electronZipName));

console.log(`Prepared desktop server at ${targetRoot}`);
