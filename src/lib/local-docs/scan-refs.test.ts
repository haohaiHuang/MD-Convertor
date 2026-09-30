import { describe, expect, it } from "vitest";
import { scanImageRefs } from "./scan-refs";

describe("scanImageRefs — inline syntax", () => {
  it("collects a plain inline image with its exact spans", () => {
    const markdown = "前文\n\n![示例](photo.png)\n\n后文\n";
    const refs = scanImageRefs(markdown);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ syntax: "inline", target: "photo.png", alt: "示例" });
    expect(markdown.slice(refs[0].start, refs[0].end)).toBe("![示例](photo.png)");
    expect(markdown.slice(refs[0].targetStart, refs[0].targetEnd)).toBe("photo.png");
  });

  it("keeps the title outside the target span", () => {
    const markdown = '![图](https://cdn.example.com/a.png "标题")';
    const refs = scanImageRefs(markdown);

    expect(refs[0].target).toBe("https://cdn.example.com/a.png");
    expect(markdown.slice(refs[0].targetStart, refs[0].targetEnd)).toBe("https://cdn.example.com/a.png");
  });

  it("unwraps a pointy-bracket target that contains spaces", () => {
    const markdown = "![图](<my photo.png>)";
    const refs = scanImageRefs(markdown);

    expect(refs[0].target).toBe("my photo.png");
    expect(markdown.slice(refs[0].targetStart, refs[0].targetEnd)).toBe("my photo.png");
  });

  it("does not collect the reference-style syntax", () => {
    expect(scanImageRefs("![alt][id]\n\n[id]: photo.png")).toEqual([]);
    expect(scanImageRefs("![alt][]")).toEqual([]);
  });
});

describe("scanImageRefs — html syntax", () => {
  it("collects a src attribute and its alt text", () => {
    const markdown = '<p><img src="local.png" alt="本地图" width="10"></p>';
    const refs = scanImageRefs(markdown);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ syntax: "html", target: "local.png", alt: "本地图" });
    expect(markdown.slice(refs[0].targetStart, refs[0].targetEnd)).toBe("local.png");
  });

  it("collects a single-quoted src and leaves the tag's other attributes alone", () => {
    const markdown = "<img alt='x' src='a.png'/>";
    const refs = scanImageRefs(markdown);

    expect(refs[0].target).toBe("a.png");
    expect(markdown.slice(refs[0].start, refs[0].end)).toBe("<img alt='x' src='a.png'/>");
  });

  it("does not treat a data-src as the src", () => {
    expect(scanImageRefs('<img data-src="lazy.png" alt="懒">')).toEqual([]);
  });
});

describe("scanImageRefs — code is out of scope", () => {
  it("skips images inside a fenced code block", () => {
    const markdown = [
      "正常",
      "",
      "```md",
      "![代码里的图](code.png)",
      "```",
      "",
      "![正文图](body.png)",
    ].join("\n");
    const refs = scanImageRefs(markdown);

    expect(refs).toHaveLength(1);
    expect(refs[0].target).toBe("body.png");
  });

  it("skips images inside a tilde fence and after an unclosed fence", () => {
    expect(scanImageRefs("~~~\n![a](code.png)\n~~~\n![b](body.png)")).toHaveLength(1);
    expect(scanImageRefs("```\n![a](code.png)\n![b](still-code.png)")).toEqual([]);
  });

  it("skips images inside inline code on the same line", () => {
    const markdown = "写 `![a](code.png)` 与 ![b](body.png) 的区别";
    const refs = scanImageRefs(markdown);

    expect(refs).toHaveLength(1);
    expect(refs[0].target).toBe("body.png");
  });

  it("skips images inside double-backtick inline code", () => {
    expect(scanImageRefs("``![a](code.png)`` 与 ![b](body.png)")).toHaveLength(1);
  });
});

describe("scanImageRefs — positions", () => {
  it("returns every match sorted by position", () => {
    const markdown = "![一](1.png)\n\n<img src=\"2.png\">\n\n![三](3.png)\n";
    const refs = scanImageRefs(markdown);

    expect(refs.map((ref) => ref.target)).toEqual(["1.png", "2.png", "3.png"]);
    expect(refs.map((ref) => ref.syntax)).toEqual(["inline", "html", "inline"]);
    expect(refs[0].start).toBeLessThan(refs[1].start);
    expect(refs[1].start).toBeLessThan(refs[2].start);
  });

  it("leaves every byte outside the target span untouched when a span is spliced", () => {
    const markdown = [
      "# 标题",
      "",
      "正文先来一段。",
      "",
      "![示例](photo.png)",
      "",
      "> 引用 ![引用图](q.png \"题\") 结束",
      "",
      '<img src="h.png" alt="h">',
      "",
      "尾段。",
    ].join("\n");

    const refs = scanImageRefs(markdown);
    const kept = new Set(["photo.png", "q.png", "h.png"]);
    expect(refs.map((ref) => ref.target)).toEqual([...kept]);

    const spliced = [...refs]
      .sort((a, b) => b.targetStart - a.targetStart)
      .reduce((text, ref) => `${text.slice(0, ref.targetStart)}⟨${ref.target}⟩${text.slice(ref.targetEnd)}`, markdown);

    // The invariant that matters: every span cut out of the document is exactly its target,
    // so dropping the markers has to give the original back byte for byte.
    expect(spliced.match(/⟨/g)).toHaveLength(3);
    expect(spliced.replaceAll("⟨", "").replaceAll("⟩", "")).toBe(markdown);
  });
});

describe("scanImageRefs — destinations with spaces and parentheses", () => {
  it("collects the extension's export shape, where the folder keeps the page title", () => {
    // The browser extension writes `<title>.images/…` verbatim: spaces and half-width
    // parentheses stay in the destination, so a scanner that stops at whitespace misses it.
    const markdown = "[![](X 上的 姚金刚 (@yaojingang).images/001-a.jpg)](https://x.com/a)";
    const refs = scanImageRefs(markdown);

    expect(refs).toHaveLength(1);
    expect(refs[0].target).toBe("X 上的 姚金刚 (@yaojingang).images/001-a.jpg");
    expect(markdown.slice(refs[0].targetStart, refs[0].targetEnd)).toBe("X 上的 姚金刚 (@yaojingang).images/001-a.jpg");
  });

  it("allows a plain space and a balanced pair of parentheses", () => {
    const refs = scanImageRefs("![图](图 集 (草稿)/pic (1).png)");

    expect(refs[0]?.target).toBe("图 集 (草稿)/pic (1).png");
  });

  it("still collects an opening parenthesis that is never closed", () => {
    expect(scanImageRefs("![a](foo(bar.png)")[0]?.target).toBe("foo(bar.png");
  });

  it("never lets a destination run past the end of its line", () => {
    const refs = scanImageRefs("![a](a b.png\n\n![b](c.png)");

    expect(refs.map((ref) => ref.target)).toEqual(["c.png"]);
  });
});
