import { describe, expect, it } from "vitest";
import type { Segment } from "./segment";
import { buildAnalysis, countTranslatableChars, isTargetLanguage, primarySubtag } from "./analysis";

function text(index: number, body: string, prefix = ""): Segment {
  return { index, kind: "text", prefix, text: body, suffix: "" };
}

function skip(index: number, body: string): Segment {
  return { index, kind: "skip", prefix: "```\n", text: body, suffix: "\n```" };
}

const SEGMENTS: Segment[] = [
  text(0, "English paragraph."),
  skip(1, "code();"),
  text(2, "中文段落。"),
  text(3, "   "),
  text(4, "No answer here."),
];

const LANGUAGES = new Map([
  [0, "en"],
  [2, "zh-Hans"],
  [4, ""],
]);

describe("buildAnalysis", () => {
  it("counts only translatable prose and reports skipped blocks with zero characters", () => {
    const analysis = buildAnalysis(SEGMENTS, LANGUAGES, "zh-Hans");
    expect(analysis.blocks).toEqual([
      { index: 0, language: "other", chars: 18 },
      { index: 1, language: "skipped", chars: 0 },
      { index: 2, language: "target", chars: 5 },
      { index: 3, language: "skipped", chars: 0 },
      { index: 4, language: "unknown", chars: 15 },
    ]);
    expect(analysis.totalChars).toBe(38);
    expect(analysis.targetChars).toBe(5);
    expect(analysis.ratio).toBeCloseTo(5 / 38, 6);
    expect(analysis.targetLanguage).toBe("zh-Hans");
  });

  it("returns a zero ratio for a document with no prose at all", () => {
    const analysis = buildAnalysis([skip(0, "code();")], new Map(), "en");
    expect(analysis).toMatchObject({ totalChars: 0, targetChars: 0, ratio: 0 });
    expect(analysis.blocks).toEqual([{ index: 0, language: "skipped", chars: 0 }]);
  });

  it("reports a fully translated document as 100%", () => {
    const analysis = buildAnalysis([text(0, "全部中文。")], new Map([[0, "zh"]]), "zh-Hans");
    expect(analysis).toMatchObject({ totalChars: 5, targetChars: 5, ratio: 1 });
  });

  it("keeps unknown labels inside the ratio denominator", () => {
    const analysis = buildAnalysis([text(0, "abcdef")], new Map(), "en");
    expect(analysis).toMatchObject({ totalChars: 6, targetChars: 0, ratio: 0 });
    expect(analysis.blocks[0]?.language).toBe("unknown");
  });
});

describe("language comparison", () => {
  it("compares primary subtags case-insensitively", () => {
    expect(primarySubtag("ZH-hans")).toBe("zh");
    expect(isTargetLanguage("zh", "zh-Hans")).toBe(true);
    expect(isTargetLanguage("zh-Hant", "zh-Hans")).toBe(true);
    expect(isTargetLanguage("zh-Hans", "en")).toBe(false);
    expect(isTargetLanguage("", "en")).toBe(false);
  });

  it("counts characters of the given blocks", () => {
    expect(countTranslatableChars([text(0, "abcde"), text(1, "x")])).toBe(6);
  });
});
