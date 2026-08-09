import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

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
});
