import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const zipPath = path.join(root, "public/md-convertor-extension.zip");
const pkgRoot = "md-convertor-extension";
const usageName = "使用说明.md";

// Built once for the whole file, same reasoning as `extension-build.test.mjs`: the assertions must
// read one artifact, and a clean tree has no ZIP (it is gitignored), so build it here.
function buildOnce() {
  execFileSync("npm", ["run", "build:extension"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
}

function zipEntries() {
  return execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

// `unzip -Z1` charset-converts names because `ditto` does not set the UTF-8 flag, so the non-ASCII
// entry prints garbled. `unzip -p` extraction still yields the correct bytes on disk — read there.
function extract() {
  const dir = mkdtempSync(path.join(tmpdir(), "md-convertor-zip-"));
  execFileSync("unzip", ["-q", "-o", zipPath, "-d", dir]);
  return dir;
}

describe("extension distributable", () => {
  const extracted = [];

  beforeAll(buildOnce);

  afterAll(() => {
    for (const dir of extracted) rmSync(dir, { recursive: true, force: true });
  });

  it("produces the ZIP next to the site so the download button resolves", () => {
    expect(existsSync(zipPath)).toBe(true);
    expect(readFileSync(zipPath).subarray(0, 2).toString()).toBe("PK");
  });

  it("contains the extension folder and only its four files (no AppleDouble junk)", () => {
    const entries = zipEntries();
    expect(entries).toHaveLength(5);
    expect(entries).toContain(`${pkgRoot}/`);
    expect(entries).toContain(`${pkgRoot}/manifest.json`);
    expect(entries).toContain(`${pkgRoot}/content.js`);
    expect(entries).toContain(`${pkgRoot}/worker.js`);
    expect(entries.filter((entry) => entry.endsWith(".md"))).toHaveLength(1);
    expect(entries.some((entry) => path.basename(entry).startsWith("._"))).toBe(false);
  });

  it("packages non-empty usage notes that document the three permissions", () => {
    const dir = extract();
    extracted.push(dir);
    const content = readFileSync(path.join(dir, pkgRoot, usageName), "utf8");
    expect(content.length).toBeGreaterThan(0);
    for (const permission of ["activeTab", "scripting", "downloads"]) {
      expect(content).toContain(permission);
    }
    expect(content).toContain("不读");
    expect(content).toContain("不上传");
  });

  it("ships non-empty bundles and a manifest that matches the source", () => {
    const dir = extract();
    extracted.push(dir);
    const packed = path.join(dir, pkgRoot);
    for (const name of ["content.js", "worker.js"]) {
      expect(readFileSync(path.join(packed, name), "utf8").length).toBeGreaterThan(0);
    }
    const manifest = JSON.parse(readFileSync(path.join(packed, "manifest.json"), "utf8"));
    const source = JSON.parse(readFileSync(path.join(root, "extension/manifest.json"), "utf8"));
    expect(manifest.version).toBe(source.version);
    expect(manifest.permissions).toEqual(["activeTab", "scripting", "downloads"]);
  });
});
