import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "./errors";

const imageMocks = vi.hoisted(() => ({
  embedImages: vi.fn(),
}));

vi.mock("@/lib/images", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/images")>();
  return { ...actual, embedImages: imageMocks.embedImages };
});

import { convertPastedContent, renderPastedMarkdownWithinBudget } from "./convert-paste";

describe("paste conversion orchestration", () => {
  beforeEach(() => {
    imageMocks.embedImages.mockReset();
  });

  it("converts plain pasted text with paste metadata", async () => {
    const result = await convertPastedContent(
      { text: "Hello pasted text", sourceUrl: "   " },
      new AbortController().signal,
    );

    expect(result.title).toBe("Hello pasted text");
    expect(result.filename).toBe("Hello pasted text.md");
    expect(result.markdown).toContain("# Hello pasted text");
    expect(result.markdown).toContain("Hello pasted text");
    expect(result.warnings).toEqual([]);
    expect(result.meta).toMatchObject({
      sourceUrl: "",
      extractionMode: "paste",
      textChars: "Hello pasted text".length,
      sourceImageCount: 0,
      embeddedImageCount: 0,
      omittedImageCount: 0,
    });
    expect(result.meta.outputBytes).toBe(Buffer.byteLength(result.markdown));
    expect(Number.isNaN(Date.parse(result.meta.convertedAt))).toBe(false);
    expect(imageMocks.embedImages).not.toHaveBeenCalled();
  });

  it("converts structured pasted HTML through the paste image strategy", async () => {
    const signal = new AbortController().signal;
    const imageWarnings = [{ code: "IMAGE_FETCH_FAILED", message: "图片失败" }];
    imageMocks.embedImages.mockResolvedValue({
      html: '<h1>HTML Article</h1><p>Body</p><img src="data:image/png;base64,AAAA" alt="图片">',
      warnings: imageWarnings,
      stats: { sourceImageCount: 1, embeddedImageCount: 1, omittedImageCount: 0 },
    });

    const result = await convertPastedContent(
      {
        html: "<h1>HTML Article</h1><p>Body</p><img data-src=\"/photo.png\" alt=\"图片\">",
        sourceUrl: " https://example.com/article ",
      },
      signal,
    );

    expect(imageMocks.embedImages).toHaveBeenCalledWith(
      expect.stringContaining('data-src="/photo.png"'),
      "https://example.com/article",
      signal,
      expect.any(Number),
      { mode: "paste", sourcePriority: "lazy-first", allowDataUri: true },
    );
    expect(result.title).toBe("HTML Article");
    expect(result.markdown).toContain("# HTML Article");
    expect(result.markdown).toContain("Body");
    expect(result.markdown).toContain("data:image/png;base64,AAAA");
    expect(result.warnings).toEqual(imageWarnings);
    expect(result.meta).toMatchObject({
      sourceUrl: "https://example.com/article",
      extractionMode: "paste",
      sourceImageCount: 1,
      embeddedImageCount: 1,
      omittedImageCount: 0,
    });
  });

  it("converts pasted Mermaid source into a fenced Mermaid block", async () => {
    imageMocks.embedImages.mockImplementation(async (html: string) => ({
      html,
      warnings: [],
      stats: { sourceImageCount: 0, embeddedImageCount: 0, omittedImageCount: 0 },
    }));

    const result = await convertPastedContent(
      {
        html: '<article><h1>Diagram</h1><div class="mermaid">flowchart LR\n  A --&gt; B</div></article>',
        text: "Diagram\nflowchart LR\nA --> B",
      },
      new AbortController().signal,
    );

    expect(result.markdown).toContain("```mermaid\nflowchart LR\n  A --> B\n```");
    expect(result.markdown).not.toContain("<svg");
  });

  it("warns and keeps a placeholder when pasted Mermaid only contains rendered SVG", async () => {
    imageMocks.embedImages.mockImplementation(async (html: string) => ({
      html,
      warnings: [],
      stats: { sourceImageCount: 0, embeddedImageCount: 0, omittedImageCount: 0 },
    }));

    const result = await convertPastedContent(
      {
        html: `<article><h1>Rendered diagram</h1><p>正文内容</p>
          <div class="mermaid"><svg aria-roledescription="flowchart-v2">
            <script>alert(1)</script><text>Node A</text>
          </svg></div></article>`,
        text: "Rendered diagram\n正文内容\nNode A",
      },
      new AbortController().signal,
    );

    expect(result.markdown).toContain("Mermaid 图表未能安全转换");
    expect(result.markdown).not.toMatch(/<svg|<script|alert\(1\)/i);
    expect(result.warnings).toContainEqual({
      code: "MERMAID_RENDER_UNAVAILABLE",
      message: "有一张 Mermaid 图表只有渲染结果，无法从粘贴内容中安全转换，已保留占位文本。",
    });
  });

  it("also degrades a standalone rendered Mermaid SVG without executing it", async () => {
    imageMocks.embedImages.mockImplementation(async (html: string) => ({
      html,
      warnings: [],
      stats: { sourceImageCount: 0, embeddedImageCount: 0, omittedImageCount: 0 },
    }));

    const result = await convertPastedContent(
      {
        html: `<article><h1>Standalone diagram</h1><p>正文内容</p>
          <svg id="mermaid-80" aria-roledescription="sequence"><foreignObject>
            <script>alert(1)</script><p>unsafe</p>
          </foreignObject></svg></article>`,
        text: "Standalone diagram\n正文内容",
      },
      new AbortController().signal,
    );

    expect(result.markdown).toContain("Mermaid 图表未能安全转换");
    expect(result.markdown).not.toMatch(/<svg|foreignObject|unsafe|alert/i);
    expect(result.warnings.map((warning) => warning.code)).toContain("MERMAID_RENDER_UNAVAILABLE");
  });

  it("canonicalizes valid source URLs before image resolution and metadata", async () => {
    const signal = new AbortController().signal;
    imageMocks.embedImages.mockResolvedValue({
      html: "<h1>文章</h1><p>正文</p>",
      warnings: [],
      stats: { sourceImageCount: 0, embeddedImageCount: 0, omittedImageCount: 0 },
    });

    const result = await convertPastedContent(
      { html: "<h1>文章</h1><p>正文</p>", sourceUrl: " https://example.com/a\n>b " },
      signal,
    );

    expect(imageMocks.embedImages).toHaveBeenCalledWith(
      expect.any(String),
      "https://example.com/a%3Eb",
      signal,
      expect.any(Number),
      expect.any(Object),
    );
    expect(result.meta.sourceUrl).toBe("https://example.com/a%3Eb");
    expect(result.markdown).toContain("> 来源：[https://example\\.com/a%3Eb](<https://example.com/a%3Eb>)");
    expect(result.markdown).not.toContain("\n>b");
  });

  it("deduplicates image warnings by code and message", async () => {
    const duplicateWarning = { code: "IMAGE_FETCH_FAILED", message: "图片失败" };
    imageMocks.embedImages.mockResolvedValue({
      html: "<p>Body</p>",
      warnings: [duplicateWarning, duplicateWarning, { code: "IMAGE_SOURCE_INVALID", message: "地址无效" }],
      stats: { sourceImageCount: 1, embeddedImageCount: 0, omittedImageCount: 1 },
    });

    const result = await convertPastedContent(
      { html: "<p>Body</p><img src=\"/photo.png\" alt=\"图片\">" },
      new AbortController().signal,
    );

    expect(result.warnings).toEqual([
      duplicateWarning,
      { code: "IMAGE_SOURCE_INVALID", message: "地址无效" },
    ]);
  });

  it("rejects empty pasted content with NO_USABLE_CONTENT", async () => {
    await expect(convertPastedContent({}, new AbortController().signal)).rejects.toMatchObject({
      status: 422,
      code: "NO_USABLE_CONTENT",
    });
  });

  it("rejects HTML that contains only failed image resources", async () => {
    imageMocks.embedImages.mockResolvedValue({
      html: '<img src="/image.png" alt="无法下载">',
      warnings: [{ code: "IMAGE_FETCH_FAILED", message: "图片失败" }],
      stats: { sourceImageCount: 1, embeddedImageCount: 0, omittedImageCount: 1 },
    });

    await expect(convertPastedContent(
      { html: '<img src="/image.png" alt="无法下载">' },
      new AbortController().signal,
    )).rejects.toMatchObject({ status: 422, code: "NO_USABLE_CONTENT" });
  });

  it("accepts a valid pure image paste when the image embeds successfully", async () => {
    imageMocks.embedImages.mockResolvedValue({
      html: '<img src="data:image/png;base64,AAAA" alt="纯图片">',
      warnings: [],
      stats: { sourceImageCount: 1, embeddedImageCount: 1, omittedImageCount: 0 },
    });

    const result = await convertPastedContent(
      { html: '<img data-src="/photo.png" alt="纯图片">' },
      new AbortController().signal,
    );

    expect(result.title).toBe("粘贴内容");
    const expectedTimestamp = result.meta.convertedAt.replace(/[-:]/g, "").slice(0, 15);
    expect(result.filename).toBe(`粘贴内容-${expectedTimestamp}.md`);
    expect(result.markdown).toContain("data:image/png;base64,AAAA");
    expect(result.meta).toMatchObject({ sourceImageCount: 1, embeddedImageCount: 1, omittedImageCount: 0 });
  });

  it("drops pasted data images from the end until the Markdown budget fits", () => {
    const result = renderPastedMarkdownWithinBudget({
      mode: "html",
      html: '<p>必须保留的正文</p><img src="data:image/png;base64,AAAA" alt="第一张"><img src="data:image/png;base64,BBBB" alt="第二]张" title="say &quot;hi&quot;">',
      title: "预算测试",
      sourceUrl: "",
      convertedAt: "2026-08-09T00:00:00.000Z",
      embeddedImageCount: 2,
      omittedImageCount: 0,
      maxBytes: 150,
    });

    expect(result.markdown).toContain("必须保留的正文");
    expect(result.markdown).toContain("data:image/png;base64,AAAA");
    expect(result.markdown).not.toContain("data:image/png;base64,BBBB");
    expect(result.markdown).toContain("[图片：第二\\]张]");
    expect(result.embeddedImageCount).toBe(1);
    expect(result.omittedImageCount).toBe(1);
    expect(result.imageBudgetExceeded).toBe(true);
    expect(result.outputBytes).toBeLessThanOrEqual(150);
  });

  it("keeps escaped alt text valid and removes markers when within budget", () => {
    const result = renderPastedMarkdownWithinBudget({
      mode: "html",
      html: '<p>正文</p><img src="data:image/png;base64,AAAA" alt="第二]张" title="say &quot;hi&quot;">',
      title: "预算测试",
      convertedAt: "2026-08-09T00:00:00.000Z",
      embeddedImageCount: 1,
      omittedImageCount: 0,
      maxBytes: 500,
    });

    expect(result.markdown).toContain("![第二\\]张](data:image/png;base64,AAAA");
    expect(result.markdown).not.toContain("PIMG");
    expect(result.embeddedImageCount).toBe(1);
    expect(result.omittedImageCount).toBe(0);
  });

  it("rejects pure text that still exceeds the output budget", () => {
    let thrown: unknown;
    try {
      renderPastedMarkdownWithinBudget({
        mode: "text",
        text: "超长正文".repeat(200),
        title: "预算测试",
        convertedAt: "2026-08-09T00:00:00.000Z",
        embeddedImageCount: 0,
        omittedImageCount: 0,
        maxBytes: 100,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AppError);
    expect(thrown).toMatchObject({ status: 413, code: "OUTPUT_TOO_LARGE" });
  });

  it("only omits real HTML images, not data-image syntax inside code", () => {
    const result = renderPastedMarkdownWithinBudget({
      mode: "html",
      html: '<img src="data:image/png;base64,AAAA" alt="真实图"><pre><code>![literal](data:image/png;base64,CCCC)</code></pre><p>正文</p>',
      title: "代码",
      convertedAt: "2026-01-01T00:00:00.000Z",
      embeddedImageCount: 1,
      omittedImageCount: 0,
      maxBytes: 140,
    });

    expect(result.markdown).not.toContain("data:image/png;base64,AAAA");
    expect(result.markdown).toContain("![literal](data:image/png;base64,CCCC)");
    expect(result.embeddedImageCount).toBe(0);
    expect(result.omittedImageCount).toBe(1);
  });

  it("does not let an unclosed code-image token swallow a real image", () => {
    const result = renderPastedMarkdownWithinBudget({
      mode: "html",
      html: '<pre><code>![broken</code></pre><img src="data:image/png;base64,AAAA" alt="真实图">',
      title: "代码",
      convertedAt: "2026-01-01T00:00:00.000Z",
      embeddedImageCount: 1,
      omittedImageCount: 0,
      maxBytes: 100,
    });

    expect(result.markdown).toContain("![broken");
    expect(result.markdown).not.toContain("data:image/png;base64,AAAA");
    expect(result.embeddedImageCount).toBe(0);
    expect(result.omittedImageCount).toBe(1);
  });

  it("honors an already-aborted signal before preparing content", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(convertPastedContent({ text: "不会处理" }, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(imageMocks.embedImages).not.toHaveBeenCalled();
  });

  it.each([
    "relative/path",
    "mailto:test@example.com",
    "javascript:alert(1)",
    "https://user:pass@example.com/article",
    "https://",
  ])("rejects an invalid source URL: %s", async (sourceUrl) => {
    await expect(convertPastedContent(
      { text: "正文", sourceUrl },
      new AbortController().signal,
    )).rejects.toMatchObject({ status: 400, code: "INVALID_SOURCE_URL" });
  });

  it("honors cancellation raised while embedding images", async () => {
    const controller = new AbortController();
    imageMocks.embedImages.mockImplementation(async (_html: string, _source: string | undefined, signal: AbortSignal) => {
      controller.abort();
      signal.throwIfAborted();
      return { html: "<p>正文</p>", warnings: [], stats: { sourceImageCount: 1, embeddedImageCount: 0, omittedImageCount: 1 } };
    });

    await expect(convertPastedContent({ html: "<p>正文</p><img src=\"/image.png\">" }, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("adds a deduplicated warning when the output budget omits images", async () => {
    imageMocks.embedImages.mockResolvedValue({
      html: '<p>正文</p><img src="data:image/png;base64,AAAA" alt="第一张"><img src="data:image/png;base64,BBBB" alt="第二张">',
      warnings: [],
      stats: { sourceImageCount: 2, embeddedImageCount: 2, omittedImageCount: 0 },
    });
    vi.resetModules();
    vi.doMock("@/lib/markdown", async () => {
      const actual = await vi.importActual<typeof import("@/lib/markdown")>("@/lib/markdown");
      return { ...actual, MAX_MARKDOWN_BYTES: 110 };
    });

    try {
      const { convertPastedContent: convertWithSmallBudget } = await import("./convert-paste");
      const result = await convertWithSmallBudget(
        { html: '<h1>标题</h1><p>正文</p><img src="/first.png"><img src="/second.png">' },
        new AbortController().signal,
      );

      expect(result.warnings).toEqual([
        { code: "IMAGE_BUDGET_EXCEEDED", message: "部分图片会使文件超过 20 MiB，已保留替代文本。" },
      ]);
      expect(result.meta.embeddedImageCount).toBe(0);
      expect(result.meta.omittedImageCount).toBe(2);
    } finally {
      vi.doUnmock("@/lib/markdown");
      vi.resetModules();
    }
  });
});
