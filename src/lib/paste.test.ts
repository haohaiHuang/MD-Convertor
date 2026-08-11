import { describe, expect, it } from "vitest";
import { detectStructuredHtml, preparePastedContent } from "./paste";

describe("detectStructuredHtml", () => {
  it.each([
    ["heading h1", "<h1>Heading</h1>"],
    ["heading h2", "<h2>Heading</h2>"],
    ["heading h3", "<h3>Heading</h3>"],
    ["heading h4", "<h4>Heading</h4>"],
    ["heading h5", "<h5>Heading</h5>"],
    ["heading h6", "<h6>Heading</h6>"],
    ["table", "<table><tr><td>Cell</td></tr></table>"],
    ["unordered list", "<ul><li>Item</li></ul>"],
    ["ordered list", "<ol><li>Item</li></ol>"],
    ["blockquote", "<blockquote>Quote</blockquote>"],
    ["preformatted code", "<pre>code</pre>"],
    ["image", '<img src="https://example.com/image.png" alt="Image">'],
  ])("accepts %s as strong structure", (_name, html) => {
    expect(detectStructuredHtml(html)).toBe(true);
  });

  it("accepts two ordinary paragraphs", () => {
    expect(detectStructuredHtml("<p>First paragraph.</p><p>Second paragraph.</p>")).toBe(true);
  });

  it("rejects paragraphs that contain no body text", () => {
    expect(detectStructuredHtml("<p>  </p><p><br></p>")).toBe(false);
  });

  it("rejects one plain paragraph", () => {
    expect(detectStructuredHtml("<p>an ultimate ulterior plan</p>")).toBe(false);
  });

  it("rejects div/span/font-only wrappers", () => {
    expect(detectStructuredHtml("<div><span><font>Wrapped text</font></span></div>")).toBe(false);
  });

  it("accepts rich text signals and only non-empty safe links", () => {
    for (const tag of ["strong", "b", "em", "i", "del", "s", "code"]) {
      expect(detectStructuredHtml(`<${tag}>formatted</${tag}>`)).toBe(true);
    }
    expect(detectStructuredHtml('<a href="https://example.com">link</a>')).toBe(true);
    expect(detectStructuredHtml('<a href="  ">empty</a>')).toBe(false);
    expect(detectStructuredHtml('<a href="javascript:alert(1)">unsafe</a>')).toBe(false);
  });

  it("only treats HTTP or relative links as valid structure", () => {
    for (const href of ["https://example.com", "http://example.com", "//example.com/path", "/path", "article", "#section"]) {
      expect(detectStructuredHtml(`<a href="${href}">safe</a>`)).toBe(true);
    }
    for (const href of ["file:///tmp/page", "blob:https://example.com/id", "mailto:user@example.com", "data:text/plain,x", "https://"]) {
      expect(detectStructuredHtml(`<a href="${href}">unsupported</a>`)).toBe(false);
    }
  });
});

describe("preparePastedContent", () => {
  it("uses trimmed authoritative plain text and its first line as title", () => {
    const result = preparePastedContent({ text: "  First   line  \n second line  " });

    expect(result).toEqual({
      mode: "text",
      html: "",
      text: "First   line  \n second line",
      title: "First line",
      textLength: "First   line  \n second line".length,
    });
  });

  it("prefers the document title before other HTML title candidates", () => {
    const result = preparePastedContent({
      html: `<!doctype html><html><head>
        <title>  Page   Title </title>
        <meta property="og:title" content="Open Graph Title">
      </head><body><div>Body wrapper</div></body></html>`,
      text: "Plain text title",
    });

    expect(result.title).toBe("Page Title");
  });

  it("uses og:title when the document title is absent", () => {
    const result = preparePastedContent({
      html: `<html><head><meta property="og:title" content="  Open   Graph  "></head>
        <body><h1>Heading fallback</h1></body></html>`,
      text: "Plain fallback",
    });

    expect(result.title).toBe("Open Graph");
  });

  it("uses the first h1 when head title candidates are absent", () => {
    const result = preparePastedContent({
      html: "<body><h1>  Article   Heading </h1><h1>Second Heading</h1></body>",
      text: "Plain fallback",
    });

    expect(result.title).toBe("Article Heading");
  });

  it("does not use an SVG title as the document title", () => {
    const result = preparePastedContent({
      html: "<body><svg><title>Icon title</title></svg><h1>Article heading</h1></body>",
      text: "Plain fallback",
    });

    expect(result.title).toBe("Article heading");
  });

  it("falls back to the authoritative text first line for an HTML document", () => {
    const result = preparePastedContent({
      html: "<html><head></head><body><div>Unsemantic wrapper</div></body></html>",
      text: "  First   text line  \nsecond line",
    });

    expect(result.title).toBe("First text line");
  });

  it("uses 粘贴内容 when no title or text is available", () => {
    expect(preparePastedContent({ html: "", text: "   " })).toEqual({
      mode: "text",
      html: "",
      text: "",
      title: "粘贴内容",
      textLength: 0,
    });
  });

  it("selects sanitized HTML and derives text from a structured body", () => {
    const result = preparePastedContent({
      html: "<html><head><title>Document</title></head><body><h1>Heading</h1><p>Body</p></body></html>",
      text: "Clipboard text should not win",
    });

    expect(result.mode).toBe("html");
    expect(result.html).toBe("<h1>Heading</h1><p>Body</p>");
    expect(result.text).toBe("HeadingBody");
    expect(result.textLength).toBe("HeadingBody".length);
  });

  it("removes executable, chrome, and dangerous attributes from the body", () => {
    const result = preparePastedContent({
      html: `<body><h2>Heading</h2>
        <script>alert(1)</script><style>.x{color:red}</style><noscript>no</noscript>
        <template>template</template><iframe>frame</iframe><object>object</object><embed>
        <form>form</form><svg>svg</svg><math>math</math><button>button</button><nav>nav</nav>
        <p style="color:red" onclick="alert(1)" srcdoc="evil">Visible</p></body>`,
    });

    expect(result.mode).toBe("html");
    expect(result.html).toContain("<h2>Heading</h2>");
    for (const tag of ["script", "style", "noscript", "template", "iframe", "object", "embed", "form", "svg", "math", "button", "nav"]) {
      expect(result.html).not.toContain(`<${tag}`);
    }
    expect(result.html).not.toMatch(/(?:style|onclick|srcdoc)=/i);
    expect(result.text).toContain("Visible");
    expect(result.text).not.toMatch(/object|form|button|nav/i);
  });

  it("preserves only image lazy-source data attributes", () => {
    const result = preparePastedContent({
      html: `<body><img src="placeholder.gif" data-src="https://example.com/real.png"
        data-lazy-src="https://example.com/lazy.png" data-other="drop" alt="A picture">
        <h2 data-src="drop" data-lazy-src="drop" data-other="drop">Heading</h2></body>`,
    });

    expect(result.mode).toBe("html");
    expect(result.html).toContain('data-src="https://example.com/real.png"');
    expect(result.html).toContain('data-lazy-src="https://example.com/lazy.png"');
    expect(result.html).toContain('alt="A picture"');
    expect(result.html).not.toContain('data-other="drop"');
    expect(result.html).not.toContain('<h2 data-src=');
  });

  it("uses request text as the authoritative fallback for unstructured HTML", () => {
    const result = preparePastedContent({
      html: "<body><div>DOM wrapper text</div></body>",
      text: "  Clipboard first line  \nsecond line  ",
    });

    expect(result).toEqual({
      mode: "text",
      html: "",
      text: "Clipboard first line  \nsecond line",
      title: "Clipboard first line",
      textLength: "Clipboard first line  \nsecond line".length,
    });
  });

  it("does not treat a sanitized javascript link as rich-text structure", () => {
    const result = preparePastedContent({
      html: '<body><a href="javascript:alert(1)">Unsafe link</a></body>',
      text: "Plain clipboard text",
    });

    expect(result.mode).toBe("text");
    expect(result.html).toBe("");
    expect(result.text).toBe("Plain clipboard text");
  });

  it("handles malformed HTML through the tolerant parser", () => {
    const result = preparePastedContent({
      html: "<body><h1>Heading<p>Body",
      text: "Fallback text",
    });

    expect(result.mode).toBe("html");
    expect(result.html).toContain("<h1>Heading");
    expect(result.html).toContain("<p>Body</p>");
  });

  it("captures the title before cleaning a forbidden container", () => {
    const result = preparePastedContent({
      html: "<body><nav><h1>Copied Page Title</h1></nav><h2>Body heading</h2></body>",
    });

    expect(result.title).toBe("Copied Page Title");
    expect(result.html).not.toContain("Copied Page Title");
    expect(result.html).toContain("Body heading");
  });

  it("normalizes pasted Mermaid source into a fenced-code HTML shape", () => {
    const result = preparePastedContent({
      html: '<article><h1>Diagram</h1><div class="mermaid">flowchart LR\n  A --&gt; B</div></article>',
      text: "Diagram\nflowchart LR\nA --> B",
    });

    expect(result.mode).toBe("html");
    expect(result.html).toContain('<pre><code class="language-mermaid">flowchart LR\n  A --&gt; B</code></pre>');
    expect(result.html).not.toContain('class="mermaid"');
  });
});
