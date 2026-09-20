import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

async function writeFixture(root, relativePath, contents = "fixture") {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
}

describe("desktop preparation command", () => {
  it("installs the declared Electron runtime before preparing the package", async () => {
    const packageJson = JSON.parse(await readFile(
      new URL("../package.json", import.meta.url),
      "utf8",
    ));

    expect(packageJson.scripts["desktop:prepare"]).toBe(
      "install-electron && node scripts/prepare-desktop.mjs",
    );
  });

  it("omits the traced Electron runtime while retaining required desktop dependencies", async () => {
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "md-convertor-desktop-"));
    const electronCache = path.join(fixtureRoot, "electron-cache");
    const playwrightCache = path.join(fixtureRoot, "playwright-cache");

    try {
      await writeFixture(
        fixtureRoot,
        "node_modules/electron/package.json",
        JSON.stringify({ version: "43.3.0" }),
      );
      await writeFixture(
        fixtureRoot,
        "node_modules/playwright-core/browsers.json",
        JSON.stringify({
          browsers: [{ name: "chromium-headless-shell", revision: "fixture-revision" }],
        }),
      );
      await writeFixture(fixtureRoot, "node_modules/playwright/runtime-marker");
      await writeFixture(fixtureRoot, "node_modules/playwright-core/runtime-marker");
      await writeFixture(fixtureRoot, "node_modules/@img/sharp-darwin-arm64/native-marker");
      await writeFixture(fixtureRoot, "node_modules/@img/sharp-libvips-darwin-arm64/native-marker");

      await writeFixture(fixtureRoot, ".next/standalone/server.js");
      await writeFixture(
        fixtureRoot,
        ".next/standalone/node_modules/electron/dist/Electron.app/duplicate-runtime",
      );
      await writeFixture(fixtureRoot, ".next/standalone/node_modules/next/runtime-marker");
      await writeFixture(fixtureRoot, ".next/static/static-marker");
      await writeFixture(fixtureRoot, "public/public-marker");

      await writeFixture(electronCache, "electron-v43.3.0-darwin-arm64.zip");
      await writeFixture(
        playwrightCache,
        "chromium_headless_shell-fixture-revision/chrome-headless-shell-mac-arm64/chrome-headless-shell",
      );

      await execFileAsync(
        process.execPath,
        [new URL("./prepare-desktop.mjs", import.meta.url).pathname],
        {
          cwd: fixtureRoot,
          env: {
            ...process.env,
            ELECTRON_CACHE: electronCache,
            PLAYWRIGHT_BROWSERS_PATH: playwrightCache,
          },
        },
      );

      const serverPath = (...segments) => path.join(fixtureRoot, ".desktop", "server", ...segments);

      await expect(access(serverPath("node_modules", "electron"))).rejects.toMatchObject({
        code: "ENOENT",
      });
      // The pruning must hit the staged copy alone: the source bundle and the project-level package both
      // stay, or Forge loses the outer runtime and the next run has nothing left to copy from.
      await expect(access(path.join(
        fixtureRoot,
        ".next/standalone/node_modules/electron/dist/Electron.app/duplicate-runtime",
      ))).resolves.toBeUndefined();
      await expect(access(path.join(fixtureRoot, "node_modules/electron/package.json")))
        .resolves.toBeUndefined();
      await expect(access(serverPath("node_modules", "playwright", "runtime-marker"))).resolves
        .toBeUndefined();
      await expect(access(serverPath("node_modules", "playwright-core", "runtime-marker"))).resolves
        .toBeUndefined();
      await expect(
        access(serverPath("node_modules", "@img", "sharp-darwin-arm64", "native-marker")),
      ).resolves.toBeUndefined();
      await expect(
        access(serverPath("node_modules", "@img", "sharp-libvips-darwin-arm64", "native-marker")),
      ).resolves.toBeUndefined();
      await expect(access(serverPath("browser", "chrome-headless-shell"))).resolves.toBeUndefined();
      await expect(access(serverPath("node_modules", "next", "runtime-marker"))).resolves
        .toBeUndefined();
    } finally {
      await rm(fixtureRoot, { force: true, recursive: true });
    }
  });
});
