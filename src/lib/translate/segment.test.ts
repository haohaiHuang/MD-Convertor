import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import {
  assertBlockAlignment,
  reassemble,
  segmentMarkdown,
  translatableSegments,
  type Segment,
} from "./segment";

/** Every fixture must survive a round trip byte for byte (FSD §3). */
const FIXTURES: [string, string][] = [
  ["headings", "# H1\n\n## H2\n\n### H3 ###\n"],
  ["paragraphs and blank lines", "第一段。\n\n\n第二段 with trailing text\n"],
  ["nested lists", "- a\n  - b\n    1. c\n- d\n\n1. one\n2. two\n"],
  ["blockquotes", "> 引用第一行\n> 引用第二行\n\n> > 嵌套引用\n"],
  ["tables", "| 名称 | 值 |\n| --- | ---: |\n| a | 1 |\n| b | 2 |\n"],
  ["fenced code", "```js\nconst a = 1;\n\tif (a) {}\n```\n"],
  ["tilde fence and mermaid", "~~~\nstateDiagram-v2\n  A --> B\n~~~\n\n```mermaid\ngraph TD;\nA-->B;\n```\n"],
  ["inline code", "使用 `npm install` 安装依赖。\n"],
  [
    "links and images",
    "见 [文档](https://example.com/a_(b).md \"标题\") 与 ![图](https://cdn.example.com/x.png) 。\n",
  ],
  ["base64 image", "![shot](data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==)\n"],
  ["html block", "<div class=\"x\">\n  <span>文本</span>\n</div>\n\n内联 <br> 标签\n"],
  ["horizontal rules", "a\n\n---\n\n***\n\n___\n"],
  ["meta lines", "> 来源：[https://example.com/a](<https://example.com/a>)\n> 转换时间：2026-09-17T00:00:00.000Z\n"],
  ["crlf", "# 标题\r\n\r\n第一段。\r\n\r\n- 项目\r\n"],
  ["trailing spaces", "标题行  \n下一行\t\n"],
  ["emoji and full-width punctuation", "状态：✅ 完成（全角标点：，。！） 🎉\n"],
  ["indented code", "    const x = 1;\n    return x;\n"],
  ["link reference definition", "[ref]: https://example.com/page\n\n使用 [ref] 引用。\n"],
  ["autolink and bare url", "见 <https://example.com/a> 与 https://example.com/b 两处。\n"],
  [
    "mixed document",
    "# 标题 🎉\n\n> 转换时间：2026-09-17T00:00:00.000Z\n\n第一段 [链接](https://example.com) 与 `code`。\n\n" +
      "| 名称 | 值 |\n| --- | --- |\n| a | 1 |\n\n- 项目一\n- 项目二\n\n```js\nconst a = 1;\n```\n\n---\n",
  ],
];

function pieces(segments: Segment[]): string {
  return segments.map((segment) => segment.prefix + segment.text + segment.suffix).join("");
}

function kindOf(segments: Segment[], text: string): string | undefined {
  return segments.find((segment) => segment.text.includes(text))?.kind;
}

function expectAppError(run: () => unknown): AppError {
  try {
    run();
  } catch (error) {
    if (error instanceof AppError) {
      return error;
    }
    throw error;
  }
  throw new Error("expected an AppError");
}

describe("segmentMarkdown identity regression", () => {
  it.each(FIXTURES)("partitions %s without losing a byte", (_name, source) => {
    expect(pieces(segmentMarkdown(source))).toBe(source);
  });

  it.each(FIXTURES)("reassembles %s byte for byte when the model echoes its input", (_name, source) => {
    const segments = segmentMarkdown(source);
    const identity = new Map(segments.filter((segment) => segment.kind === "text").map((segment) => [segment.index, segment.text]));
    expect(reassemble(segments, identity)).toBe(source);
  });

  it.each(FIXTURES)("indexes %s segments in document order", (_name, source) => {
    const segments = segmentMarkdown(source);
    expect(segments.map((segment) => segment.index)).toEqual(segments.map((_segment, index) => index));
  });
});

describe("segmentMarkdown protected blocks", () => {
  it("skips a fenced code block, fence lines included", () => {
    const segments = segmentMarkdown("说明\n\n```js\nconst a = 1;\n\tif (a) {}\n```\n");
    expect(kindOf(segments, "const a = 1;")).toBe("skip");
    expect(kindOf(segments, "```js")).toBe("skip");
    expect(segments.filter((segment) => segment.kind === "text").map((segment) => segment.text)).toEqual(["说明"]);
  });

  it("skips mermaid fences", () => {
    const segments = segmentMarkdown("```mermaid\ngraph TD;\nA-->B;\n```\n");
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ kind: "skip" });
  });

  it("skips table separator rows but keeps cells translatable", () => {
    const segments = segmentMarkdown("| 名称 | 值 |\n| --- | ---: |\n| a | 1 |\n");
    expect(kindOf(segments, "--- | ---:")).toBe("skip");
    const texts = segments.filter((segment) => segment.kind === "text").map((segment) => segment.text);
    expect(texts).toEqual(["名称", "值", "a", "1"]);
    expect(texts.some((text) => text.includes("|"))).toBe(false);
  });

  it("skips horizontal rules, blank lines and the generated meta lines", () => {
    const segments = segmentMarkdown("a\n\n---\n\n> 转换时间：2026-09-17T00:00:00.000Z\n> 来源：[https://example.com/a](<https://example.com/a>)\n");
    expect(kindOf(segments, "---")).toBe("skip");
    expect(kindOf(segments, "转换时间")).toBe("skip");
    expect(kindOf(segments, "来源")).toBe("skip");
    expect(kindOf(segments, "\n")).toBe("skip");
    expect(segments.filter((segment) => segment.kind === "text").map((segment) => segment.text)).toEqual(["a"]);
  });

  it("skips html lines, indented code and link reference definitions", () => {
    const segments = segmentMarkdown("<div class=\"x\">\n    const x = 1;\n[ref]: https://example.com/page\n");
    expect(segments.every((segment) => segment.kind === "skip")).toBe(true);
  });

  it("never hands a url to the model", () => {
    const segments = segmentMarkdown(
      "见 [文档](https://example.com/a_(b).md) 与 ![图](data:image/png;base64,iVBORw0KGgo=) 与 <https://example.com/c> 与 https://example.com/d\n",
    );
    const texts = segments.filter((segment) => segment.kind === "text").map((segment) => segment.text);
    expect(texts.join("")).not.toMatch(/https?:\/\/|data:image/);
    expect(texts).toContain("文档");
    expect(texts).toContain("图");
  });

  it("keeps inline code out of the prompt while translating the prose around it", () => {
    const segments = segmentMarkdown("使用 `npm install` 安装依赖。\n");
    const texts = segments.filter((segment) => segment.kind === "text").map((segment) => segment.text);
    expect(texts).toEqual(["使用 ", " 安装依赖。"]);
    expect(kindOf(segments, "`npm install`")).toBe("skip");
  });

  it("keeps heading, list and quote markers in prefix or suffix", () => {
    const segments = segmentMarkdown("# 标题\n\n- 项目\n\n> 引用\n");
    expect(segments.filter((segment) => segment.kind === "text").map((segment) => segment.prefix)).toEqual([
      "# ",
      "- ",
      "> ",
    ]);
  });

  it("returns no segments for an empty document", () => {
    expect(segmentMarkdown("")).toEqual([]);
  });

  it("round trips the real converter fixture byte for byte", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(new URL("../fixtures/golden-article.md", import.meta.url), "utf8");
    const segments = segmentMarkdown(source);
    expect(pieces(segments)).toBe(source);
    const identity = new Map(segments.filter((segment) => segment.kind === "text").map((segment) => [segment.index, segment.text]));
    expect(reassemble(segments, identity)).toBe(source);
    const texts = translatableSegments(segments).map((segment) => segment.text);
    expect(texts).toContain("这是用于稳定验证网页转换结果的第一段正文，包含足够的文字内容。");
    expect(texts).toContain("列表项目一");
    expect(texts).toContain("使用指南");
    expect(texts.join("")).not.toMatch(/https?:\/\/|data:image|const answer/);
  });
});

describe("reassemble with a subset of translations", () => {
  it("replaces only the blocks that carry a translation", () => {
    const source = "# 标题\n\n第一段。\n";
    const segments = segmentMarkdown(source);
    const heading = segments.find((segment) => segment.text === "标题");
    const translation = new Map(heading ? [[heading.index, "TITLE"]] : []);
    expect(reassemble(segments, translation)).toBe("# TITLE\n\n第一段。\n");
  });

  it("leaves the document untouched when nothing is translated", () => {
    const source = "> 引用 `code` 完成\n";
    const segments = segmentMarkdown(source);
    expect(reassemble(segments, new Map())).toBe(source);
  });
});

describe("translatableSegments", () => {
  it("keeps only non-blank prose", () => {
    const segments = segmentMarkdown("`a` `b`\n\n正文\n");
    expect(translatableSegments(segments).map((segment) => segment.text)).toEqual(["正文"]);
  });
});

describe("assertBlockAlignment", () => {
  it("accepts an analysis that matches the segmented document", () => {
    const segments = segmentMarkdown("# A\n\nB\n");
    expect(() =>
      assertBlockAlignment(segments, segments.map((segment) => ({ index: segment.index }))),
    ).not.toThrow();
  });

  it("rejects an analysis whose block count no longer matches", () => {
    const segments = segmentMarkdown("# A\n\nB\n");
    const error = expectAppError(() => assertBlockAlignment(segments, [{ index: 0 }]));
    expect(error).toMatchObject({ status: 409, code: "TRANSLATE_ANALYSIS_STALE" });
  });

  it("rejects an analysis whose indexes are out of order", () => {
    const segments = segmentMarkdown("# A\n");
    const error = expectAppError(() =>
      assertBlockAlignment(segments, [{ index: 3 }]),
    );
    expect(error).toMatchObject({ status: 409, code: "TRANSLATE_ANALYSIS_STALE" });
  });
});
