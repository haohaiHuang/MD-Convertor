import { describe, expect, it } from "vitest";
import { translatedFilename } from "./filename";

describe("translatedFilename", () => {
  it("adds the lower-case hyphenated language tag before the extension", () => {
    expect(translatedFilename("article.md", "zh-Hans")).toBe("article-zh-hans.md");
    expect(translatedFilename("article.md", "en")).toBe("article-en.md");
    expect(translatedFilename("article.md", "zh-Hans-CN")).toBe("article-zh-hans-cn.md");
  });

  it("keeps non-ASCII names intact", () => {
    expect(translatedFilename("粘贴测试文章.md", "ja")).toBe("粘贴测试文章-ja.md");
  });

  it("normalizes separators, spaces and repeated runs in the tag", () => {
    expect(translatedFilename("article.md", "pt_BR")).toBe("article-pt-br.md");
    expect(translatedFilename("article.md", "  zh  Hans ")).toBe("article-zh-hans.md");
    expect(translatedFilename("article.md", "--en--")).toBe("article-en.md");
  });

  it("strips an existing .md extension case-insensitively and always ends in .md", () => {
    expect(translatedFilename("article.MD", "en")).toBe("article-en.md");
    expect(translatedFilename("notes", "en")).toBe("notes-en.md");
  });

  it("falls back to the original name when the tag carries nothing usable", () => {
    expect(translatedFilename("article.md", "")).toBe("article.md");
    expect(translatedFilename("article.md", "   ")).toBe("article.md");
    expect(translatedFilename("article.md", "!!!")).toBe("article.md");
  });
});
