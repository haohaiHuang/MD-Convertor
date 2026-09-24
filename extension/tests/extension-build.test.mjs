import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_TITLE } from "../src/worker-run";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const corePath = path.join(root, "extension/dist-test/core.js");
const distDir = path.join(root, "extension/dist");

// Built once for the whole file: esbuild is fast, but the four assertions must all read the same
// artifact, otherwise one of them could be checking a stale bundle.
const forbidden = ['require("node:', "jsdom", "domino"];

function buildOnce() {
  execFileSync("npm", ["run", "build:extension"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
}

describe("extension browser bundle", () => {
  beforeAll(buildOnce);

  it("builds and contains no Node-only module residue", () => {
    const source = readFileSync(corePath, "utf8");
    expect(source.length).toBeGreaterThan(0);
    for (const needle of forbidden) {
      expect(source).not.toContain(needle);
    }
  });

  it("ships exactly the manifest and the two entry points it points at", () => {
    expect(readdirSync(distDir).sort()).toEqual(["content.js", "manifest.json", "worker.js"]);
    for (const name of ["content.js", "worker.js"]) {
      const source = readFileSync(path.join(distDir, name), "utf8");
      expect(source.length).toBeGreaterThan(0);
      for (const needle of forbidden) {
        expect(source).not.toContain(needle);
      }
    }
  });

  it("asks for no more than the three permissions the plan allows", () => {
    const manifest = JSON.parse(readFileSync(path.join(distDir, "manifest.json"), "utf8"));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(["activeTab", "scripting", "downloads"]);
    // No `host_permissions` and no static `content_scripts`: the click injects, nothing runs before.
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.content_scripts).toBeUndefined();
    expect(manifest.background.service_worker).toBe("worker.js");
  });

  it("keeps the toolbar tooltip in step with the worker's restore text", () => {
    const manifest = JSON.parse(readFileSync(path.join(distDir, "manifest.json"), "utf8"));
    expect(manifest.action.default_title).toBe(DEFAULT_TITLE);
  });
});
