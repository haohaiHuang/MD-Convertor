import { describe, expect, it } from "vitest";
import { htmlToMarkdown, makeFilename, makePasteFilename, pastedContentToMarkdown } from "./markdown";

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

  it("preserves every line when a pre contains multiple code nodes", () => {
    const markdown = htmlToMarkdown(
      [
        "<pre>",
        '<code><span leaf>first line</span></code>',
        '<code><span leaf>second &amp; line</span></code>',
        '<code><span leaf></span></code>',
        '<code><span leaf>  <span class="token">indented</span> &lt; line</span></code>',
        "</pre>",
      ].join(""),
      "微信式代码块",
      "https://example.com/wechat-code",
      "2026-08-21T00:00:00.000Z",
    );

    expect(markdown).toContain([
      "```",
      "first line",
      "second & line",
      "",
      "  indented < line",
      "```",
    ].join("\n"));
  });

  it("does not merge a normal single-code block or lose its language", () => {
    const markdown = htmlToMarkdown(
      '<pre><code class="language-typescript"><span>const answer = 42;</span>\n<span>console.log(answer);</span></code></pre>',
      "普通代码块",
      "https://example.com/code",
      "2026-08-21T00:00:00.000Z",
    );

    expect(markdown).toContain([
      "```typescript",
      "const answer = 42;",
      "console.log(answer);",
      "```",
    ].join("\n"));
  });

  it("turns br elements inside a multi-code block into line breaks", () => {
    const markdown = htmlToMarkdown(
      "<pre><code><span leaf>before<br>after</span></code><code><span leaf>last</span></code></pre>",
      "带换行的代码块",
      "https://example.com/code-break",
      "2026-08-21T00:00:00.000Z",
    );

    expect(markdown).toContain("```\nbefore\nafter\nlast\n```");
  });

  it("uses the same complete multi-code normalization for pasted HTML", () => {
    const markdown = pastedContentToMarkdown({
      mode: "html",
      html: "<pre><code><span leaf>paste first</span></code><code><span leaf>paste second</span></code></pre>",
      title: "Pasted code",
      convertedAt: "2026-08-21T00:00:00.000Z",
    });

    expect(markdown).toContain("```\npaste first\npaste second\n```");
  });

  it("renders plain pasted text with a source-free header and preserved newlines", () => {
    const markdown = pastedContentToMarkdown({
      mode: "text",
      text: "First line\nSecond line",
      title: "Pasted article",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).toBe([
      "# Pasted article",
      "",
      "> 转换时间：2026-08-09T00:00:00.000Z",
      "",
      "First line",
      "Second line",
      "",
    ].join("\n"));
    expect(markdown).not.toContain("来源：");
  });

  it("escapes Markdown control characters in pasted plain text", () => {
    const markdown = pastedContentToMarkdown({
      mode: "text",
      text: "literal *stars* [brackets] # hash\n- dash and 1. item\n`code` _under_ + plus ! bang | pipe",
      title: "Controls",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).toContain("literal \\*stars\\* \\[brackets\\] \\# hash");
    expect(markdown).toContain("\\- dash and 1\\. item");
    expect(markdown).toContain("\\`code\\` \\_under\\_ \\+ plus \\! bang \\| pipe");
    expect(pastedContentToMarkdown({
      mode: "text",
      text: "~~literal strike~~",
      title: "Controls",
      convertedAt: "2026-08-09T00:00:00.000Z",
    })).toContain("\\~\\~literal strike\\~\\~");
  });

  it("escapes only line-level Setext and parenthesized-list markers in plain text", () => {
    const markdown = pastedContentToMarkdown({
      mode: "text",
      text: "Heading\n=====\n1) first\nvalue = 2\nkeep this ) parenthesis",
      title: "Line markers",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).toContain("Heading\n\\=\\=\\=\\=\\=\n1\\) first\nvalue = 2\nkeep this ) parenthesis");
  });

  it("includes the optional source line when a source URL is provided", () => {
    const markdown = pastedContentToMarkdown({
      mode: "text",
      text: "Body",
      title: "With source",
      sourceUrl: "https://example.com/article",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).toContain(
      "> 来源：[https://example\\.com/article](<https://example.com/article>)\n> 转换时间：2026-08-09T00:00:00.000Z",
    );
  });

  it("escapes source display text and wraps the destination while keeping metadata contiguous", () => {
    const sourceUrl = "https://example.com/a_[draft].md?x=1&y=2";
    const markdown = pastedContentToMarkdown({
      mode: "text",
      text: "Body",
      title: "Special source",
      sourceUrl,
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).toContain(
      "> 来源：[https://example\\.com/a\\_\\[draft\\]\\.md?x=1&y=2](<https://example.com/a_[draft].md?x=1&y=2>)\n> 转换时间：2026-08-09T00:00:00.000Z",
    );
  });

  it("omits a source line for a whitespace-only source URL", () => {
    const markdown = pastedContentToMarkdown({
      mode: "text",
      text: "Body",
      title: "No source",
      sourceUrl: "   ",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).not.toContain("来源：");
  });

  it("renders structured pasted HTML with the shared GFM style", () => {
    const markdown = pastedContentToMarkdown({
      mode: "html",
      html: "<h2>Subheading</h2><p>Body text</p>",
      title: "Pasted article",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).toContain("## Subheading\n\nBody text");
  });

  it("removes the first pasted h1 when it repeats the output title", () => {
    const markdown = pastedContentToMarkdown({
      mode: "html",
      html: "<h1>  Article   Title </h1><p>Body</p>",
      title: "Article Title",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown.match(/^# /gm)).toHaveLength(1);
    expect(markdown).toContain("Body");
  });

  it("keeps absolute links without a source and degrades relative or anchor links to text", () => {
    const markdown = pastedContentToMarkdown({
      mode: "html",
      html: `<p><a href="https://example.com/doc">absolute</a>
        <a href="/relative">relative</a> <a href="#section">anchor</a></p>`,
      title: "Links",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).toContain("[absolute](https://example.com/doc)");
    expect(markdown).not.toContain("[relative](");
    expect(markdown).not.toContain("[anchor](");
    expect(markdown).toContain("relative");
    expect(markdown).toContain("anchor");
  });

  it("validates no-source absolute links before preserving them", () => {
    const markdown = pastedContentToMarkdown({
      mode: "html",
      html: '<p><a href="https://">malformed</a> <a href="https://example.com/ok">valid</a></p>',
      title: "Link validation",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).not.toContain("[malformed](");
    expect(markdown).toContain("[valid](https://example.com/ok)");
  });

  it("resolves relative HTTP links against the optional source URL", () => {
    const markdown = pastedContentToMarkdown({
      mode: "html",
      html: '<p><a href="../asset">relative asset</a></p>',
      title: "Relative link",
      sourceUrl: "https://example.com/articles/page",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).toContain("[relative asset](https://example.com/asset)");
  });

  it("renders headings and paragraphs in document order", () => {
    const markdown = pastedContentToMarkdown({
      mode: "html",
      html: "<h1>One</h1><p>First</p><h3>Three</h3><p>Second</p>",
      title: "Document",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).toContain("# One\n\nFirst\n\n### Three\n\nSecond");
  });

  it("renders unordered and nested ordered lists with stable indentation", () => {
    const markdown = pastedContentToMarkdown({
      mode: "html",
      html: "<ul><li>alpha</li><li>beta<ol><li>one</li></ol></li></ul>",
      title: "Lists",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).toContain("- alpha\n- beta\n  1. one");
  });

  it("renders a MiaoYan outer ordered list with a nested unordered list", () => {
    const markdown = pastedContentToMarkdown({
      mode: "html",
      html: "<ol><li>first<ul><li>sub one</li><li>sub two</li></ul></li><li>second</li></ol>",
      title: "Nested ordered list",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).toContain("1. first\n   - sub one\n   - sub two\n2. second");
  });

  it("renders blockquotes with Markdown quote markers", () => {
    const markdown = pastedContentToMarkdown({
      mode: "html",
      html: "<blockquote><p>quoted words</p></blockquote>",
      title: "Quote",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).toContain("> quoted words");
  });

  it("renders fenced code with a language class", () => {
    const markdown = pastedContentToMarkdown({
      mode: "html",
      html: '<pre><code class="language-swift">let a = 1\nlet b = 2</code></pre>',
      title: "Code",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).toContain("```swift\nlet a = 1\nlet b = 2\n```");
  });

  it("extends a code fence when code contains backticks and preserves blank lines", () => {
    const markdown = pastedContentToMarkdown({
      mode: "html",
      html: "<pre><code>before\n\n\nafter\n```inside</code></pre>",
      title: "Code fence",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).toContain("````\nbefore\n\n\nafter\n```inside\n````");
  });

  it("renders a GFM table with headers and escaped cell pipes", () => {
    const markdown = pastedContentToMarkdown({
      mode: "html",
      html: "<table><thead><tr><th>Name</th><th>Expr</th></tr></thead><tbody><tr><td>Ann</td><td>a | b</td></tr></tbody></table>",
      title: "Table",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).toContain("| Name | Expr |\n| --- | --- |\n| Ann | a \\| b |");
  });

  it("uses the first row as a GFM header when a table has no th cells", () => {
    const markdown = pastedContentToMarkdown({
      mode: "html",
      html: "<table><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></table>",
      title: "Table without header",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).toContain("| A | B |\n| --- | --- |\n| C | D |");
  });

  it("promotes missing cells in a mixed first table row to complete the header", () => {
    const markdown = pastedContentToMarkdown({
      mode: "html",
      html: "<table><tr><th>A</th><td>B</td></tr><tr><td>C</td><td>D</td></tr></table>",
      title: "Mixed table header",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).toContain("| A | B |\n| --- | --- |\n| C | D |");
  });

  it("renders horizontal rules between surrounding paragraphs", () => {
    const markdown = pastedContentToMarkdown({
      mode: "html",
      html: "<p>above</p><hr><p>below</p>",
      title: "Rule",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).toContain("above\n\n---\n\nbelow");
  });

  it("renders mixed inline formatting using the configured GFM delimiters", () => {
    const markdown = pastedContentToMarkdown({
      mode: "html",
      html: "<p>mix <strong>bold</strong> and <em>italic</em> and <code>code</code> and <del>gone</del></p>",
      title: "Inline",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).toContain("mix **bold** and *italic* and `code` and ~~gone~~");
  });

  it("keeps data URI images for the later paste image pipeline", () => {
    const markdown = pastedContentToMarkdown({
      mode: "html",
      html: '<p>before <img src="data:image/png;base64,AAAA" alt="pic"> after</p>',
      title: "Data image",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).toContain("![pic](data:image/png;base64,AAAA)");
  });

  it("drops script and style content from pasted HTML", () => {
    const markdown = pastedContentToMarkdown({
      mode: "html",
      html: "<style>p { color: red }</style><script>alert(1)</script><p>kept</p>",
      title: "Safe HTML",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).toContain("kept");
    expect(markdown).not.toContain("alert");
    expect(markdown).not.toContain("color");
  });

  it("collapses incidental whitespace inside pasted paragraphs", () => {
    const markdown = pastedContentToMarkdown({
      mode: "html",
      html: "<p>a\n   lot    of\n whitespace</p>",
      title: "Whitespace",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).toContain("a lot of whitespace");
  });

  it("decodes HTML entities while preserving CJK text", () => {
    const markdown = pastedContentToMarkdown({
      mode: "html",
      html: "<h2>中文标题</h2><p>正文内容 &amp; &lt; 例子</p>",
      title: "实体",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).toContain("## 中文标题\n\n正文内容 & < 例子");
  });

  it("keeps nested list text space-separated inside table cells", () => {
    const markdown = pastedContentToMarkdown({
      mode: "html",
      html: "<table><tr><th>Opts</th></tr><tr><td><ul><li>alpha</li><li>beta</li></ul></td></tr></table>",
      title: "Table list",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).toContain("| alpha beta |");
  });

  it("keeps text around a list-item code block in document order", () => {
    const markdown = pastedContentToMarkdown({
      mode: "html",
      html: "<ul><li>before<pre><code>code</code></pre>after</li></ul>",
      title: "List code",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).toContain("- before\n  ```\n  code\n  ```\n  after");
  });

  it("preserves a real blank line immediately after an embedded code fence", () => {
    const markdown = pastedContentToMarkdown({
      mode: "html",
      html: "<ul><li><pre><code>```\n\nfoo</code></pre></li></ul>",
      title: "List code blank",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).toContain("- ````\n  ```\n  \n  foo\n  ````");
  });

  it("pads inline code when its content starts with a backtick", () => {
    const markdown = pastedContentToMarkdown({
      mode: "html",
      html: "<p>tick <code>`x</code> here</p>",
      title: "Inline code",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).toContain("tick `` `x `` here");
  });

  it("keeps a br inside a heading on one Markdown heading line", () => {
    const markdown = pastedContentToMarkdown({
      mode: "html",
      html: "<h1>part1<br>part2</h1>",
      title: "Heading break",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).toContain("# part1 part2");
  });

  it("ignores head metadata when rendering a full pasted document", () => {
    const markdown = pastedContentToMarkdown({
      mode: "html",
      html: "<html><head><title>ignored</title></head><body><h2>Hello</h2><p>World</p></body></html>",
      title: "Full document",
      convertedAt: "2026-08-09T00:00:00.000Z",
    });

    expect(markdown).toContain("## Hello\n\nWorld");
    expect(markdown).not.toContain("ignored");
  });

  it("uses the existing cross-platform cleaning rules for a valid paste title", () => {
    expect(makePasteFilename('A <title>: with / unsafe * chars', new Date("2026-07-18T00:00:00Z"))).toBe(
      "A -title-- with - unsafe - chars.md",
    );
  });

  it("uses the paste-specific timestamp fallback for an empty or default title", () => {
    const date = new Date("2026-07-18T00:00:00Z");
    expect(makePasteFilename("", date)).toBe("粘贴内容-20260718T000000.md");
    expect(makePasteFilename("   ", date)).toBe("粘贴内容-20260718T000000.md");
    expect(makePasteFilename("粘贴内容", date)).toBe("粘贴内容-20260718T000000.md");
    expect(makePasteFilename("CON", date)).toBe("粘贴内容-20260718T000000.md");
  });
});
