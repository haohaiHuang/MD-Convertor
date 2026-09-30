import { describe, expect, it } from "vitest";
import { isMarkdownFileName, isSafeDirectoryPath } from "./paths";

describe("isSafeDirectoryPath", () => {
  it("accepts an absolute directory path", () => {
    expect(isSafeDirectoryPath("/Users/someone/Downloads")).toBe(true);
    expect(isSafeDirectoryPath("/tmp md/notes")).toBe(true);
  });

  it("accepts an iCloud path whose tilde is not home shorthand", () => {
    const iCloud = "/Users/someone/Library/Mobile Documents/com~apple~CloudDocs/文档";
    expect(isSafeDirectoryPath(iCloud)).toBe(true);
  });

  it("rejects a path with a traversal segment", () => {
    expect(isSafeDirectoryPath("/Users/someone/../other")).toBe(false);
    expect(isSafeDirectoryPath("/..")).toBe(false);
  });

  it("rejects a home-shorthand segment wherever it starts a segment", () => {
    expect(isSafeDirectoryPath("~/Downloads")).toBe(false);
    expect(isSafeDirectoryPath("/Users/someone/~/Downloads")).toBe(false);
  });

  it("rejects a relative path, an empty value, and a non-string", () => {
    expect(isSafeDirectoryPath("Downloads")).toBe(false);
    expect(isSafeDirectoryPath("")).toBe(false);
    expect(isSafeDirectoryPath(undefined)).toBe(false);
    expect(isSafeDirectoryPath(null)).toBe(false);
    expect(isSafeDirectoryPath(42)).toBe(false);
  });
});

describe("isMarkdownFileName", () => {
  it("accepts .md in any case", () => {
    expect(isMarkdownFileName("notes.md")).toBe(true);
    expect(isMarkdownFileName("Notes.MD")).toBe(true);
    expect(isMarkdownFileName("文档.md")).toBe(true);
  });

  it("rejects every other extension", () => {
    expect(isMarkdownFileName("notes.markdown")).toBe(false);
    expect(isMarkdownFileName("notes.txt")).toBe(false);
    expect(isMarkdownFileName("md")).toBe(false);
  });

  it("rejects separators, traversal, an empty name, and an over-long name", () => {
    expect(isMarkdownFileName("sub/notes.md")).toBe(false);
    expect(isMarkdownFileName("sub\\notes.md")).toBe(false);
    expect(isMarkdownFileName("../notes.md")).toBe(false);
    expect(isMarkdownFileName("")).toBe(false);
    expect(isMarkdownFileName(`${"a".repeat(254)}.md`)).toBe(false);
    expect(isMarkdownFileName(undefined)).toBe(false);
  });
});
