import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { buildArticle } from "./index";
import { createSanitizer } from "./sanitize";

const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../tests/fixtures");
const convertedAt = "2026-09-24T00:00:00.000Z";

function setup(file: string, url: string) {
  const html = readFileSync(path.join(fixtures, file), "utf8");
  const dom = new JSDOM(html, { url });
  return {
    document: dom.window.document,
    deps: { sanitize: createSanitizer(createDOMPurify(dom.window)), now: () => convertedAt },
  };
}

describe("buildArticle", () => {
  it("produces the article Markdown, image plan and placeholder positions", () => {
    const url = "https://example.com/post";
    const { document, deps } = setup("article.html", url);
    const article = buildArticle(document, url, deps);

    expect(article).not.toBeNull();
    expect(article?.title).toContain("示例文章标题");
    expect(article?.sourceUrl).toBe(url);

    expect(article?.images).toEqual([
      { index: 1, url: "https://example.com/images/lazy.png", placeholder: "md-convertor-image-1" },
    ]);

    const markdown = article?.markdown ?? "";
    // The header is locked verbatim (T1.5 asks for a fixed snapshot): order, blank lines and the
    // escaped title/source line are what a reader sees first. A whole-document snapshot would only
    // break on every fixture tweak, so the body is asserted by content below.
    expect(markdown.split("\n").slice(0, 5)).toEqual([
      "# 示例文章标题",
      "",
      "> 来源：[https://example\\.com/post](<https://example.com/post>)",
      `> 转换时间：${convertedAt}`,
      "",
    ]);
    expect(markdown).toContain("# 示例文章标题");
    expect(markdown).toContain(`> 转换时间：${convertedAt}`);
    expect(markdown).toMatch(/!\[[^\]]*\]\(md-convertor-image-1\)/);
    expect(markdown).toContain("| 列A |");
    expect(markdown).toContain("const answer = 42;");
    expect(markdown).toContain("第二段正文");
    expect(markdown).not.toContain("<script");
    expect(markdown).not.toContain("侧栏广告");
  });

  it("returns null when there is no article", () => {
    const url = "https://example.com/empty";
    const { document, deps } = setup("no-article.html", url);
    expect(buildArticle(document, url, deps)).toBeNull();
  });
});
