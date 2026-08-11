import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchHtml: vi.fn(),
  renderDynamicPage: vi.fn(),
  embedImages: vi.fn(),
  detectPageAccessIssue: vi.fn(),
}));

vi.mock("@/lib/fetcher", () => ({ fetchHtml: mocks.fetchHtml }));
vi.mock("@/lib/browser", () => ({ renderDynamicPage: mocks.renderDynamicPage }));
vi.mock("@/lib/images", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/images")>();
  return { ...actual, embedImages: mocks.embedImages };
});
vi.mock("@/lib/page-access", () => ({ detectPageAccessIssue: mocks.detectPageAccessIssue }));

import { convertUrlToMarkdown } from "./convert";

const sourceUrl = "https://example.com/mermaid-article";

describe("Mermaid URL conversion", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.detectPageAccessIssue.mockReturnValue(null);
    mocks.embedImages.mockImplementation(async (html: string) => ({
      html,
      warnings: [],
      stats: { sourceImageCount: 0, embeddedImageCount: 0, omittedImageCount: 0 },
    }));
  });

  it("preserves available Mermaid source without launching Chromium", async () => {
    const body = "这是足够长的文章正文。".repeat(60);
    mocks.fetchHtml.mockResolvedValue({
      html: `<!doctype html><html><head><title>Diagram article</title></head><body><article>
        <h1>Diagram article</h1><p>${body}</p>
        <div class="mermaid">flowchart TD\n  Input --&gt; Output</div>
      </article></body></html>`,
      finalUrl: new URL(sourceUrl),
    });

    const result = await convertUrlToMarkdown(sourceUrl, new AbortController().signal);

    expect(result.markdown).toContain("```mermaid\nflowchart TD\n  Input --> Output\n```");
    expect(mocks.renderDynamicPage).not.toHaveBeenCalled();
  });

  it("keeps an existing language-mermaid code block through Readability", async () => {
    const body = "这是另一段足够长的网页正文。".repeat(60);
    mocks.fetchHtml.mockResolvedValue({
      html: `<!doctype html><html><head><title>Existing fence</title></head><body><article>
        <h1>Existing fence</h1><p>${body}</p>
        <pre><code class="language-mermaid">sequenceDiagram\n  A-&gt;&gt;B: hello</code></pre>
      </article></body></html>`,
      finalUrl: new URL(sourceUrl),
    });

    const result = await convertUrlToMarkdown(sourceUrl, new AbortController().signal);

    expect(result.markdown).toContain("```mermaid\nsequenceDiagram\n  A->>B: hello\n```");
    expect(mocks.renderDynamicPage).not.toHaveBeenCalled();
  });

  it("launches Chromium for an empty Mermaid placeholder even when direct text is sufficient", async () => {
    const body = "这是包含动态图表的足够长正文。".repeat(60);
    mocks.fetchHtml.mockResolvedValue({
      html: `<!doctype html><html><head><title>Dynamic diagram</title></head><body><article>
        <h1>Dynamic diagram</h1><p>${body}</p><div class="mermaid"></div>
      </article></body></html>`,
      finalUrl: new URL(sourceUrl),
    });
    mocks.renderDynamicPage.mockResolvedValue({
      html: `<!doctype html><html><head><title>Dynamic diagram</title></head><body><article>
        <h1>Dynamic diagram</h1><p>${body}渲染完成。</p><div class="mermaid"><svg id="mermaid-1"></svg></div>
      </article></body></html>`,
      generatedImages: [],
      warnings: [],
    });

    await convertUrlToMarkdown(sourceUrl, new AbortController().signal);

    expect(mocks.renderDynamicPage).toHaveBeenCalledOnce();
  });

  it("uses a near-complete browser extraction when it contains a generated Mermaid raster", async () => {
    const paragraph = "这是包含动态图表的正文段落。";
    const directBody = paragraph.repeat(60);
    const renderedBody = paragraph.repeat(59);
    mocks.fetchHtml.mockResolvedValue({
      html: `<!doctype html><html><head><title>Rendered diagram</title></head><body><article>
        <h1>Rendered diagram</h1><p>${directBody}</p><div class="mermaid"></div>
      </article></body></html>`,
      finalUrl: new URL(sourceUrl),
    });
    mocks.renderDynamicPage.mockResolvedValue({
      html: `<!doctype html><html><head><title>Rendered diagram</title></head><body><article>
        <h1>Rendered diagram</h1><p>${renderedBody}</p>
        <img src="/.md-convertor/mermaid/diagram.png" alt="Mermaid 图表">
      </article></body></html>`,
      generatedImages: [{
        placeholderUrl: "/.md-convertor/mermaid/diagram.png",
        dataUri: "data:image/png;base64,cG5n",
      }],
      warnings: [],
    });

    const result = await convertUrlToMarkdown(sourceUrl, new AbortController().signal);

    expect(result.meta.extractionMode).toBe("browser");
    expect(mocks.embedImages).toHaveBeenCalledWith(
      expect.stringContaining("/.md-convertor/mermaid/diagram.png"),
      sourceUrl,
      expect.any(AbortSignal),
      expect.any(Number),
      expect.objectContaining({
        trustedDataUris: expect.any(Map),
      }),
    );
  });

  it("returns a clear Mermaid warning when the required browser render fails", async () => {
    const body = "这是包含失败动态图表的足够长正文。".repeat(60);
    mocks.fetchHtml.mockResolvedValue({
      html: `<!doctype html><html><head><title>Failed diagram</title></head><body><article>
        <h1>Failed diagram</h1><p>${body}</p><div class="mermaid"></div>
      </article></body></html>`,
      finalUrl: new URL(sourceUrl),
    });
    mocks.renderDynamicPage.mockRejectedValue(new Error("browser unavailable"));

    const result = await convertUrlToMarkdown(sourceUrl, new AbortController().signal);

    expect(result.warnings).toContainEqual({
      code: "MERMAID_RENDER_FAILED",
      message: "网页中的 Mermaid 图表未能安全栅格化，结果中可能缺少该图表。",
    });
    expect(result.warnings.map((warning) => warning.code)).toContain("BROWSER_FALLBACK_FAILED");
  });
});
