import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchHtml: vi.fn(),
  fetchPublicResource: vi.fn(),
  renderDynamicPage: vi.fn(),
  detectPageAccessIssue: vi.fn(),
}));

vi.mock("@/lib/fetcher", () => ({
  fetchHtml: mocks.fetchHtml,
  fetchPublicResource: mocks.fetchPublicResource,
}));
vi.mock("@/lib/browser", () => ({ renderDynamicPage: mocks.renderDynamicPage }));
vi.mock("@/lib/page-access", () => ({ detectPageAccessIssue: mocks.detectPageAccessIssue }));

import { convertUrlToMarkdown } from "./convert";

const sourceUrl = "https://example.com/dynamic-mermaid";
const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nKAAAAAASUVORK5CYII=",
  "base64",
);

describe("trusted Mermaid browser images", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.detectPageAccessIssue.mockReturnValue(null);
    mocks.fetchPublicResource.mockRejectedValue(new Error("unexpected network image fetch"));
  });

  it("embeds the browser-generated raster without fetching its internal placeholder", async () => {
    const body = "这是包含客户端动态图表的完整文章正文。".repeat(50);
    const placeholderUrl = "/.md-convertor/mermaid/diagram.png";
    mocks.fetchHtml.mockResolvedValue({
      html: `<html><head><title>Dynamic Mermaid</title></head><body><article>
        <h1>Dynamic Mermaid</h1><p>${body}</p><div class="mermaid"></div>
      </article></body></html>`,
      finalUrl: new URL(sourceUrl),
    });
    mocks.renderDynamicPage.mockResolvedValue({
      html: `<html><head><title>Dynamic Mermaid</title></head><body><article>
        <h1>Dynamic Mermaid</h1><p>${body}</p><img src="${placeholderUrl}" alt="Mermaid 图表">
        <img src="https://" alt="畸形普通图片">
      </article></body></html>`,
      generatedImages: [{
        placeholderUrl,
        dataUri: `data:image/png;base64,${onePixelPng.toString("base64")}`,
      }],
      warnings: [],
    });

    const result = await convertUrlToMarkdown(sourceUrl, new AbortController().signal);

    expect(result.markdown).toContain("![Mermaid 图表](data:image/png;base64,");
    expect(result.meta).toMatchObject({
      extractionMode: "browser",
      sourceImageCount: 2,
      embeddedImageCount: 1,
      omittedImageCount: 1,
    });
    expect(mocks.fetchPublicResource).not.toHaveBeenCalled();
    expect(result.warnings.map((warning) => warning.code)).toContain("IMAGE_FETCH_FAILED");
  });
});
