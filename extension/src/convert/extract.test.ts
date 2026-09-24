import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { extractArticle } from "./extract";
import { createSanitizer } from "./sanitize";

const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../tests/fixtures");

function setup(file: string, url: string) {
  const html = readFileSync(path.join(fixtures, file), "utf8");
  const dom = new JSDOM(html, { url });
  return {
    document: dom.window.document,
    deps: { sanitize: createSanitizer(createDOMPurify(dom.window)) },
  };
}

describe("extractArticle", () => {
  it("keeps the article body and drops navigation, sidebar, footer and comments", () => {
    const url = "https://example.com/post";
    const { document, deps } = setup("article.html", url);
    const article = extractArticle(document, url, deps);

    expect(article).not.toBeNull();
    expect(article?.title).toContain("示例文章标题");
    expect(article?.html).toContain("第一段正文");
    expect(article?.html).toContain("结尾段落");
    expect(article?.html).not.toContain("侧栏广告");
    expect(article?.html).not.toContain("版权所有");
    expect(article?.html).not.toContain("评论区");
    expect(article?.html).not.toContain("关于本站");
    expect(article?.textLength).toBeGreaterThan(50);
  });

  it("returns null when no article can be found", () => {
    const url = "https://example.com/empty";
    const { document, deps } = setup("no-article.html", url);
    expect(extractArticle(document, url, deps)).toBeNull();
  });

  it("uses the WeChat container and promotes lazy image sources", () => {
    const url = "https://mp.weixin.qq.com/s/abc";
    const { document, deps } = setup("wechat.html", url);
    const article = extractArticle(document, url, deps);

    expect(article).not.toBeNull();
    expect(article?.title).toBe("微信文章标题");
    expect(article?.html).toContain("微信正文内容");
    expect(article?.html).toContain("https://mmbiz.qpic.cn/example.png");
    expect(article?.html).not.toContain("data:image/gif");
  });

  it("returns null for a WeChat page without enough text", () => {
    const url = "https://mp.weixin.qq.com/s/short";
    const dom = new JSDOM('<body><div id="js_content"><p>太短</p></div></body>', { url });
    const deps = { sanitize: createSanitizer(createDOMPurify(dom.window)) };
    expect(extractArticle(dom.window.document, url, deps)).toBeNull();
  });

  it("falls back to 未命名网页 when the page carries no title", () => {
    const url = "https://example.com/untitled";
    const body = `<article><p>${'正文'.repeat(40)}</p></article>`;
    const dom = new JSDOM(`<body>${body}</body>`, { url });
    const deps = { sanitize: createSanitizer(createDOMPurify(dom.window)) };
    const article = extractArticle(dom.window.document, url, deps);
    expect(article?.title).toBe("未命名网页");
  });

  it("still extracts when the source URL cannot be parsed", () => {
    const url = "https://example.com/post";
    const { document, deps } = setup("article.html", url);
    expect(extractArticle(document, "not a url", deps)).not.toBeNull();
  });
});
