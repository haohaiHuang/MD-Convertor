import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const fontDir = path.join(process.cwd(), "public", "fonts");

describe("brand font assets", () => {
  it("keeps the Michroma face in the repository instead of fetching it during the build", () => {
    const font = readFileSync(path.join(fontDir, "Michroma-Regular.woff2"));

    expect(font.byteLength).toBeGreaterThan(5_000);
    expect(font.subarray(0, 4).toString("latin1")).toBe("wOF2");
  });

  it("ships the licence that the font is redistributed under", () => {
    const licence = readFileSync(path.join(fontDir, "OFL.txt"), "utf8");

    expect(licence).toContain("Copyright 2011 The Michroma Project Authors");
    expect(licence).toContain("SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007");
  });
});
