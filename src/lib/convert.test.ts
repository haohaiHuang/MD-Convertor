import { describe, expect, it } from "vitest";
import { AppError } from "./errors";
import { renderMarkdownWithinBudget } from "./convert";

const baseOptions = {
  title: "预算测试",
  sourceUrl: "https://example.com/article",
  convertedAt: "2026-07-18T00:00:00.000Z",
};

describe("final Markdown budget", () => {
  it("drops images from the end while preserving text", () => {
    const result = renderMarkdownWithinBudget({
      ...baseOptions,
      html: `<p>必须保留的正文</p><img src="data:image/png;base64,${"A".repeat(600)}" alt="超预算图片">`,
      embeddedImageCount: 1,
      omittedImageCount: 0,
      maxBytes: 300,
    });
    expect(result.markdown).toContain("必须保留的正文");
    expect(result.markdown).not.toContain("data:image/");
    expect(result.embeddedImageCount).toBe(0);
    expect(result.omittedImageCount).toBe(1);
    expect(result.imageBudgetExceeded).toBe(true);
    expect(result.outputBytes).toBeLessThanOrEqual(300);
  });

  it("fails only when text without images exceeds the limit", () => {
    expect(() => renderMarkdownWithinBudget({
      ...baseOptions,
      html: `<p>${"纯正文".repeat(200)}</p>`,
      embeddedImageCount: 0,
      omittedImageCount: 0,
      maxBytes: 100,
    })).toThrowError(AppError);
  });
});
