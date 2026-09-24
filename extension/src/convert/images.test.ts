import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { collectImages } from "./images";

const baseUrl = "https://example.com/post";

function rootOf(html: string): Element {
  return new JSDOM(`<body>${html}</body>`, { url: baseUrl }).window.document.body;
}

describe("collectImages", () => {
  it("prefers lazy sources and absolutizes relative URLs", () => {
    const { images, html } = collectImages(rootOf('<img data-src="/a.png" src="/placeholder.png">'), baseUrl);
    expect(images).toEqual([
      { index: 1, url: "https://example.com/a.png", placeholder: "md-convertor-image-1" },
    ]);
    expect(html).toContain('src="md-convertor-image-1"');
  });

  it("falls back to data-lazy-src", () => {
    const { images } = collectImages(rootOf('<img data-lazy-src="/lazy.png">'), baseUrl);
    expect(images[0]?.url).toBe("https://example.com/lazy.png");
  });

  it("leaves data: images untouched and out of the plan", () => {
    const { images, html } = collectImages(rootOf('<img src="data:image/png;base64,AAAA" alt="内嵌">'), baseUrl);
    expect(images).toEqual([]);
    expect(html).toContain('src="data:image/png;base64,AAAA"');
  });

  it("ignores non-http schemes and images without a source", () => {
    const { images } = collectImages(rootOf('<img src="javascript:bad()"><img alt="无源">'), baseUrl);
    expect(images).toEqual([]);
  });

  it("deduplicates the same absolute URL into a single placeholder", () => {
    const { images, html } = collectImages(
      rootOf('<img src="/a.png"><img src="https://example.com/a.png"><img src="/b.png">'),
      baseUrl,
    );
    expect(images.map((image) => image.url)).toEqual([
      "https://example.com/a.png",
      "https://example.com/b.png",
    ]);
    expect(html.match(/md-convertor-image-1/g)).toHaveLength(2);
    expect(html).toContain("md-convertor-image-2");
  });

  it("removes srcset, sizes and loading from collected images", () => {
    const { html } = collectImages(
      rootOf('<img src="/a.png" srcset="/a.png 2x" sizes="100vw" loading="lazy">'),
      baseUrl,
    );
    expect(html).not.toContain("srcset");
    expect(html).not.toContain("sizes");
    expect(html).not.toContain("loading");
  });
});
