import { describe, expect, it } from "vitest";
import { extractBodyFallback, extractReadable } from "./extract";

const articleHtml = `
  <!doctype html><html><head><title>测试文章</title></head><body>
    <nav>导航</nav><article><h1>测试文章</h1>
    <p>${"这是用于验证正文提取的句子。".repeat(40)}</p>
    <script>alert('xss')</script></article><footer>页脚</footer>
  </body></html>`;

describe("content extraction", () => {
  it("extracts article content and removes scripts", () => {
    const result = extractReadable(articleHtml, "https://example.com/post");
    expect(result?.title).toBe("测试文章");
    expect(result?.textLength).toBeGreaterThan(300);
    expect(result?.html).not.toContain("<script");
  });

  it("body fallback removes common chrome", () => {
    const result = extractBodyFallback(articleHtml, "https://example.com/post");
    expect(result.html).not.toContain("导航");
    expect(result.html).not.toContain("页脚");
    expect(result.html).toContain("正文提取");
  });

  it("prefers the WeChat article container and preserves lazy image sources", () => {
    const wechatBody = "这是微信公众号的实际正文内容。".repeat(200);
    const html = `<!doctype html><html><head><title>微信文章</title></head><body>
      <article><p>${"封面摘要。".repeat(80)}</p><img src="https://mmbiz.qpic.cn/cover.jpg" alt="封面"></article>
      <div id="js_content" style="visibility: hidden"><p>${wechatBody}</p>
        <img data-src="https://mmbiz.qpic.cn/body.jpg" alt="正文图片">
      </div>
    </body></html>`;

    const result = extractReadable(html, "https://mp.weixin.qq.com/s/example");

    expect(result?.html).toContain(wechatBody);
    expect(result?.html).toContain('src="https://mmbiz.qpic.cn/body.jpg"');
    expect(result?.html).not.toContain("data-src=");
  });
});
