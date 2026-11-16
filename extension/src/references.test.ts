import { describe, expect, it } from "vitest";
import { rewriteImageReferences, type ImageOutcome } from "./references";

// T2.4: the pure rewrite that turns the placeholders the content script left behind into real
// paths, and drops the images that could not be downloaded back to their original URL.
const IMAGES = "示例文章标题.images";

describe("rewriteImageReferences", () => {
  it("points a downloaded image at the path the browser reported", () => {
    const markdown = `正文\n\n![插图](md-convertor-image-1)\n\n更多正文\n`;
    const plans: ImageOutcome[] = [{ placeholder: "md-convertor-image-1", path: `${IMAGES}/001-lazy.png` }];

    expect(rewriteImageReferences(markdown, plans)).toBe(
      `正文\n\n![插图](${IMAGES}/001-lazy.png)\n\n更多正文\n`,
    );
  });

  it("keeps the original URL and adds a comment line for an image that failed", () => {
    const markdown = `正文\n\n![](md-convertor-image-2)\n`;
    const plans: ImageOutcome[] = [{ placeholder: "md-convertor-image-2", url: "https://example.com/b.png" }];

    expect(rewriteImageReferences(markdown, plans)).toBe(
      `正文\n\n![](https://example.com/b.png)\n<!-- 图片未下载：https://example.com/b.png -->\n`,
    );
  });

  it("leaves the markdown byte-for-byte alone when the placeholder never appears", () => {
    const markdown = `正文\n\n![](md-convertor-image-9)\n`;
    const plans: ImageOutcome[] = [{ placeholder: "md-convertor-image-1", path: `${IMAGES}/001-lazy.png` }];

    expect(rewriteImageReferences(markdown, plans)).toBe(markdown);
  });

  it("does not let a short placeholder eat a longer one that starts the same way", () => {
    const markdown = `![](md-convertor-image-10)\n\n![](md-convertor-image-1)\n`;
    const plans: ImageOutcome[] = [
      { placeholder: "md-convertor-image-1", path: `${IMAGES}/001-a.png` },
      { placeholder: "md-convertor-image-10", path: `${IMAGES}/010-j.png` },
    ];

    expect(rewriteImageReferences(markdown, plans)).toBe(
      `![](${IMAGES}/010-j.png)\n\n![](${IMAGES}/001-a.png)\n`,
    );
  });

  it("replaces every occurrence and comments only once per line", () => {
    const markdown = `![](md-convertor-image-3) 与 ![](md-convertor-image-3)\n`;
    const plans: ImageOutcome[] = [{ placeholder: "md-convertor-image-3", url: "https://example.com/c.png" }];

    expect(rewriteImageReferences(markdown, plans)).toBe(
      `![](https://example.com/c.png) 与 ![](https://example.com/c.png)\n` +
        `<!-- 图片未下载：https://example.com/c.png -->\n`,
    );
  });

  // B1 follow-up: the title keeps spaces and parentheses, so a bare destination would be cut at
  // the first space (or at the first `)`) by any CommonMark parser. Only the characters that can
  // end a bare destination are escaped — percent-encoding CJK would make the file unreadable for
  // no gain, and the desktop reader already `decodeURIComponent`s what it finds.
  it("percent-encodes spaces so a title with spaces keeps a parseable destination", () => {
    const markdown = `![](md-convertor-image-1)\n`;
    const plans: ImageOutcome[] = [
      { placeholder: "md-convertor-image-1", path: "X 上的 姚金刚.images/001-a.png" },
    ];

    expect(rewriteImageReferences(markdown, plans)).toBe(`![](X%20上的%20姚金刚.images/001-a.png)\n`);
  });

  it("escapes parentheses so they cannot close the destination early", () => {
    const markdown = `![](md-convertor-image-1)\n`;
    const plans: ImageOutcome[] = [
      { placeholder: "md-convertor-image-1", path: "X (@someone).images/001-a.png" },
    ];

    expect(rewriteImageReferences(markdown, plans)).toBe(`![](X%20%28@someone%29.images/001-a.png)\n`);
  });

  it("escapes a literal percent, hash and question mark so the reader can round-trip the name", () => {
    const markdown = `![](md-convertor-image-1)\n`;
    const plans: ImageOutcome[] = [
      { placeholder: "md-convertor-image-1", path: "100% #tag ?query.images/001-a.png" },
    ];

    expect(rewriteImageReferences(markdown, plans)).toBe(
      `![](100%25%20%23tag%20%3Fquery.images/001-a.png)\n`,
    );
  });

  it("percent-encodes non-ASCII whitespace by UTF-8 byte so the reader decodes the same name", () => {
    const markdown = `![](md-convertor-image-1)\n`;
    const plans: ImageOutcome[] = [
      { placeholder: "md-convertor-image-1", path: "X\u00a0Y\u3000Z.images/001-a.png" },
    ];

    expect(rewriteImageReferences(markdown, plans)).toBe(
      `![](X%C2%A0Y%E3%80%80Z.images/001-a.png)\n`,
    );
  });

  it("escapes a DEL character, which CommonMark forbids in a bare destination", () => {
    const markdown = `![](md-convertor-image-1)\n`;
    const plans: ImageOutcome[] = [
      { placeholder: "md-convertor-image-1", path: "a\u007fb.images/001-a.png" },
    ];

    expect(rewriteImageReferences(markdown, plans)).toBe(`![](a%7Fb.images/001-a.png)\n`);
  });

  it("leaves a kept URL untouched — it is already a valid destination", () => {
    const markdown = `![](md-convertor-image-1)\n`;
    const plans: ImageOutcome[] = [
      { placeholder: "md-convertor-image-1", url: "https://example.com/a%20b.png?x=1&y=2#frag" },
    ];

    expect(rewriteImageReferences(markdown, plans)).toBe(
      `![](https://example.com/a%20b.png?x=1&y=2#frag)\n` +
        `<!-- 图片未下载：https://example.com/a%20b.png?x=1&y=2#frag -->\n`,
    );
  });
});
