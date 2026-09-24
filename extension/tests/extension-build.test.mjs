import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const corePath = path.join(root, "extension/dist-test/core.js");

describe("extension browser bundle", () => {
  it("builds and contains no Node-only module residue", () => {
    execFileSync("npm", ["run", "build:extension"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });

    const source = readFileSync(corePath, "utf8");
    expect(source.length).toBeGreaterThan(0);
    for (const forbidden of ['require("node:', "jsdom", "domino"]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
