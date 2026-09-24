import { describe, expect, it } from "vitest";
import { cleanFilenameStem, fallbackName, imageDirName, imageFileName, mdFileName } from "./naming";

describe("cleanFilenameStem", () => {
  it("mirrors the desktop replacement rules", () => {
    expect(cleanFilenameStem('A <title>: with / unsafe * chars')).toBe("A -title-- with - unsafe - chars");
    expect(cleanFilenameStem("a\u0001b\u001fc")).toBe("a-b-c");
  });

  it("drops trailing dots and whitespace and collapses inner whitespace", () => {
    expect(cleanFilenameStem("结尾的点. ")).toBe("结尾的点");
    expect(cleanFilenameStem("  a   b  ")).toBe("a b");
  });

  it("keeps CJK characters and caps the stem at 80 characters", () => {
    expect(cleanFilenameStem("中文标题")).toBe("中文标题");
    expect(cleanFilenameStem("x".repeat(120))).toHaveLength(80);
  });
});

describe("fallbackName", () => {
  it("produces a deterministic page-<short hash> name", () => {
    expect(fallbackName("seed")).toMatch(/^page-[0-9a-z]{6}$/);
    expect(fallbackName("seed")).toBe(fallbackName("seed"));
    expect(fallbackName("seed")).not.toBe(fallbackName("other"));
  });
});

describe("md and image names derive from the same stem", () => {
  it("uses the cleaned title", () => {
    expect(mdFileName("中文标题")).toBe("中文标题.md");
    expect(imageDirName("中文标题")).toBe("中文标题.images");
  });

  it("falls back for empty or reserved names and keeps the pair in sync", () => {
    for (const title of ["", "   ", "CON", "com1", "..."]) {
      const stem = mdFileName(title).replace(/\.md$/, "");
      expect(stem).toMatch(/^page-[0-9a-z]{6}$/);
      expect(imageDirName(title)).toBe(`${stem}.images`);
    }
  });
});

describe("imageFileName", () => {
  it("uses a three-digit index, the URL basename slug and a whitelisted extension", () => {
    expect(imageFileName(1, "https://example.com/a/b.png")).toBe("001-b.png");
    expect(imageFileName(12, "https://example.com/a/photo.JPEG")).toBe("012-photo.jpeg");
  });

  it("drops extensions outside the whitelist", () => {
    expect(imageFileName(3, "https://example.com/a/file.txt")).toBe("003-file");
    expect(imageFileName(4, "https://example.com/a/noext")).toBe("004-noext");
  });

  it("falls back to `image` when the URL has no usable basename", () => {
    expect(imageFileName(5, "https://example.com/")).toBe("005-image");
    expect(imageFileName(6, "https://example.com/a/???")).toBe("006-image");
  });

  it("caps the slug at 40 characters", () => {
    const name = imageFileName(7, `https://example.com/${"x".repeat(80)}.png`);
    expect(name).toBe(`007-${"x".repeat(40)}.png`);
  });
});
