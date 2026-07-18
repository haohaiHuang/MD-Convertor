import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchHtml: vi.fn(),
  renderDynamicPage: vi.fn(),
  extractReadable: vi.fn(),
  extractBodyFallback: vi.fn(),
  embedImages: vi.fn(),
  detectPageAccessIssue: vi.fn(),
}));

vi.mock("@/lib/fetcher", () => ({ fetchHtml: mocks.fetchHtml }));
vi.mock("@/lib/browser", () => ({ renderDynamicPage: mocks.renderDynamicPage }));
vi.mock("@/lib/extract", () => ({
  extractReadable: mocks.extractReadable,
  extractBodyFallback: mocks.extractBodyFallback,
}));
vi.mock("@/lib/images", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./images")>();
  return { ...actual, embedImages: mocks.embedImages };
});
vi.mock("@/lib/page-access", () => ({ detectPageAccessIssue: mocks.detectPageAccessIssue }));

import { convertUrlToMarkdown } from "./convert";

const sourceUrl = "https://example.com/article";
const signal = new AbortController().signal;

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.fetchHtml.mockResolvedValue({ html: "<article>direct</article>", finalUrl: new URL(sourceUrl) });
  mocks.detectPageAccessIssue.mockReturnValue(null);
  mocks.extractReadable.mockReturnValue({
    title: "测试文章",
    html: "<p>直接提取的正文</p>",
    textLength: 350,
  });
  mocks.extractBodyFallback.mockReturnValue({
    title: "后备文章",
    html: "<p>后备正文</p>",
    textLength: 60,
  });
  mocks.embedImages.mockImplementation(async (html: string) => ({
    html,
    warnings: [],
    stats: { sourceImageCount: 0, embeddedImageCount: 0, omittedImageCount: 0 },
  }));
});

describe("complete conversion orchestration", () => {
  it("keeps a sufficient direct extraction without launching Chromium", async () => {
    const result = await convertUrlToMarkdown(sourceUrl, signal);
    expect(result.meta).toMatchObject({ extractionMode: "direct", textChars: 350 });
    expect(result.markdown).toContain("直接提取的正文");
    expect(mocks.renderDynamicPage).not.toHaveBeenCalled();
  });

  it("replaces a short direct result with a stronger browser extraction", async () => {
    mocks.extractReadable
      .mockReturnValueOnce({ title: "短正文", html: "<p>短</p>", textLength: 100 })
      .mockReturnValueOnce({ title: "动态正文", html: "<p>动态页面完整正文</p>", textLength: 420 });
    mocks.renderDynamicPage.mockResolvedValue("<article>rendered</article>");

    const result = await convertUrlToMarkdown(sourceUrl, signal);

    expect(result.meta.extractionMode).toBe("browser");
    expect(result.title).toBe("动态正文");
    expect(mocks.renderDynamicPage).toHaveBeenCalledOnce();
  });

  it("continues with usable direct text and a warning when browser fallback fails", async () => {
    mocks.extractReadable.mockReturnValue({ title: "短正文", html: "<p>仍可使用的正文</p>", textLength: 100 });
    mocks.renderDynamicPage.mockRejectedValue(new Error("browser unavailable"));

    const result = await convertUrlToMarkdown(sourceUrl, signal);

    expect(result.meta.extractionMode).toBe("direct");
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "BROWSER_FALLBACK_FAILED" }));
  });

  it("uses the sanitized body fallback when neither extractor finds an article", async () => {
    mocks.extractReadable.mockReturnValue(null);
    mocks.renderDynamicPage.mockRejectedValue(new Error("browser unavailable"));

    const result = await convertUrlToMarkdown(sourceUrl, signal);

    expect(result.meta.extractionMode).toBe("body-fallback");
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "BROWSER_FALLBACK_FAILED" }),
      expect.objectContaining({ code: "LOW_CONFIDENCE_EXTRACTION" }),
    ]));
  });
});
