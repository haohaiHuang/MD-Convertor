import { describe, expect, it } from "vitest";
import { htmlToMarkdown, makeFilename } from "./markdown";

describe("Markdown output", () => {
  it("creates cross-platform safe filenames", () => {
    expect(makeFilename('A <title>: with / unsafe * chars', new Date("2026-07-18T00:00:00Z"))).toBe(
      "A -title-- with - unsafe - chars.md",
    );
    expect(makeFilename("CON", new Date("2026-07-18T00:00:00Z"))).toBe(
      "webpage-20260718T000000.md",
    );
  });

  it("adds metadata, removes a duplicate title, and keeps GFM tables", () => {
    const markdown = htmlToMarkdown(
      "<h1>示例标题</h1><p>正文内容</p><table><tr><th>A</th></tr><tr><td>B</td></tr></table>",
      "示例标题",
      "https://example.com/post",
      "2026-07-18T00:00:00.000Z",
    );
    expect(markdown.match(/^# /gm)).toHaveLength(1);
    expect(markdown).toContain("来源：");
    expect(markdown).toContain("| A |");
    expect(markdown).toContain("正文内容");
  });

  it("preserves generated raster data URIs", () => {
    const markdown = htmlToMarkdown(
      '<p><img src="data:image/png;base64,AAAA" alt="图"></p>',
      "图片",
      "https://example.com",
      "2026-07-18T00:00:00.000Z",
    );
    expect(markdown).toContain("data:image/png;base64,AAAA");
  });
});
