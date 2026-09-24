import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { htmlToArticleMarkdown } from "./markdown";

const convertedAt = "2026-09-24T00:00:00.000Z";
const sourceUrl = "https://example.com/post";

function bodyOf(html: string, url = sourceUrl): HTMLElement {
  const dom = new JSDOM(`<body>${html}</body>`, { url });
  return dom.window.document.body;
}

function render(html: string, url = sourceUrl): string {
  return htmlToArticleMarkdown(bodyOf(html, url), {
    title: "示例标题",
    sourceUrl: url,
    convertedAt,
  });
}

describe("htmlToArticleMarkdown", () => {
  it("removes a duplicate title heading and writes the metadata header", () => {
    const markdown = render("<h1>示例标题</h1><p>正文内容</p>");
    expect(markdown.match(/^# /gm)).toHaveLength(1);
    expect(markdown).toContain("> 来源：[https://example\\.com/post](<https://example.com/post>)");
    expect(markdown).toContain(`> 转换时间：${convertedAt}`);
    expect(markdown).toContain("正文内容");
  });

  it("absolutizes relative links, drops scriptable schemes and keeps mail links", () => {
    const markdown = render(
      '<p><a href="/a">A</a> <a href="#x">X</a> <a href="mailto:a@b.c">M</a> <a href="javascript:bad()">J</a></p>',
    );
    expect(markdown).toContain("[A](https://example.com/a)");
    expect(markdown).toContain("[X](https://example.com/post#x)");
    expect(markdown).toContain("[M](mailto:a@b.c)");
    expect(markdown).not.toContain("javascript:");
  });

  it("keeps GFM tables and fenced code blocks", () => {
    const markdown = render(
      "<table><tr><th>A</th></tr><tr><td>B</td></tr></table><pre><code>const a = 1;</code></pre>",
    );
    expect(markdown).toContain("| A |");
    expect(markdown).toContain("| B |");
    expect(markdown).toContain("```");
    expect(markdown).toContain("const a = 1;");
  });

  it("never emits script or style nodes", () => {
    const markdown = render("<style>p{color:red}</style><script>bad()</script><p>ok</p>");
    expect(markdown).not.toContain("bad()");
    expect(markdown).not.toContain("color:red");
    expect(markdown).toContain("ok");
  });

  it("keeps image placeholders written by the image collector", () => {
    const markdown = render('<p><img src="md-convertor-image-1" alt="图示"></p>');
    expect(markdown).toContain("![图示](md-convertor-image-1)");
  });

  it("merges sibling code nodes inside one pre", () => {
    const markdown = render(
      '<pre><code><span>first line</span></code><code><span>second line</span></code></pre>',
    );
    expect(markdown).toContain("first line\nsecond line");
  });

  it("keeps code attributes and line breaks while merging", () => {
    const markdown = render(
      '<pre><code class="language-js"><span>a<br>b</span></code><code><span>c</span></code></pre>',
    );
    expect(markdown).toContain("```js");
    expect(markdown).toContain("a\nb\nc");
  });

  it("drops links whose href cannot be parsed", () => {
    const markdown = render('<p><a href="http://[invalid">X</a></p>');
    expect(markdown).toContain("X");
    expect(markdown).not.toContain("http://[invalid");
  });

  it("falls back to a placeholder title when the title is blank", () => {
    const dom = new JSDOM("<body><p>only body</p></body>", { url: sourceUrl });
    const markdown = htmlToArticleMarkdown(dom.window.document.body, {
      title: "   ",
      sourceUrl,
      convertedAt,
    });
    expect(markdown).toContain("# 未命名网页");
  });
});
