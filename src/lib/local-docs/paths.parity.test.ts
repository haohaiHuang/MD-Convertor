import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
// The sandboxed preload cannot require a relative module, so `electron/preload-contract.cjs`
// and `src/lib/local-docs/paths.ts` are two independent implementations of the same rule.
// This table is what keeps them from drifting: change one, run this.
// Required rather than imported: `.cjs` has no declaration and TypeScript cannot read it as a module.
const contract = createRequire(import.meta.url)("../../../electron/preload-contract.cjs") as {
  isAbsoluteDirPath(value: unknown): boolean;
};
import { isSafeDirectoryPath } from "./paths";

const SAMPLES: [value: unknown, expected: boolean, label: string][] = [
  ["/Users/someone/Downloads", true, "ordinary absolute directory"],
  ["/Users/someone/Library/Mobile Documents/com~apple~CloudDocs/Docs", true, "iCloud tilde is a normal character"],
  ["/Volumes/External/notes", true, "external volume"],
  ["/Users/someone/~/Downloads", false, "tilde starts a segment"],
  ["~/Downloads", false, "tilde-only home shorthand"],
  ["/Users/someone/../other", false, "traversal segment"],
  ["relative/notes", false, "relative path"],
  ["", false, "empty string"],
];

describe("server path guard / preload contract parity", () => {
  it.each(SAMPLES)("agrees on %j (%s)", (value, expected) => {
    expect(isSafeDirectoryPath(value)).toBe(expected);
    expect(contract.isAbsoluteDirPath(value)).toBe(expected);
  });

  it("agrees across the whole table without a single mismatch", () => {
    const mismatches = SAMPLES.filter(
      ([value, expected]) => isSafeDirectoryPath(value) !== contract.isAbsoluteDirPath(value)
        || isSafeDirectoryPath(value) !== expected,
    );
    expect(mismatches).toEqual([]);
  });
});
