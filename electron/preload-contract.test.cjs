import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const contract = require("./preload-contract.cjs");

describe("output channel names", () => {
  it("declares the two output channels the main process handles", () => {
    expect(contract.CHANNELS.selectDirectory).toBe("md-convertor:output:select-directory");
    expect(contract.CHANNELS.saveFile).toBe("md-convertor:output:save-file");
  });

  it("keeps the secrets channels untouched", () => {
    expect(contract.CHANNELS.set).toBe("md-convertor:secrets:set");
    expect(contract.CHANNELS.clear).toBe("md-convertor:secrets:clear");
    expect(contract.CHANNELS.status).toBe("md-convertor:secrets:status");
  });
});

describe("isValidOutputFilename", () => {
  it.each(["notes.md", "我的文档 2026.md", "a".repeat(255)])("accepts %s", (filename) => {
    expect(contract.isValidOutputFilename(filename)).toBe(true);
  });

  it.each([
    ["a parent traversal", "../x.md"],
    ["a nested path", "a/b.md"],
    ["a windows path", "a\\b.md"],
    ["a home reference", "~/.md"],
    ["a dot-dot name", ".."],
    ["an empty name", ""],
    ["a non-string", 42],
    ["a missing name", undefined],
    ["an over-long name", "a".repeat(256)],
  ])("rejects %s", (_label, filename) => {
    expect(contract.isValidOutputFilename(filename)).toBe(false);
  });
});

describe("isAbsoluteDirPath", () => {
  it.each(["/Users/someone/Documents", "/", "/tmp/md-convertor"])("accepts %s", (dirPath) => {
    expect(contract.isAbsoluteDirPath(dirPath)).toBe(true);
  });

  it.each([
    ["a home path", "~/Documents"],
    ["a relative path", "Documents/notes"],
    ["a current-relative path", "./Documents"],
    ["a parent traversal", "/Users/someone/../someone_else"],
    ["a dot-dot middle segment", "/a/../b"],
    ["an empty path", ""],
    ["a non-string", 42],
    ["a missing path", undefined],
  ])("rejects %s", (_label, dirPath) => {
    expect(contract.isAbsoluteDirPath(dirPath)).toBe(false);
  });

  it("accepts dots that are not a traversal segment", () => {
    expect(contract.isAbsoluteDirPath("/Users/some.one/notes.v2")).toBe(true);
  });
});
