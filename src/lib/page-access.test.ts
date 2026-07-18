import { describe, expect, it } from "vitest";
import { detectPageAccessIssue } from "@/lib/page-access";

describe("detectPageAccessIssue", () => {
  it("detects WeChat interactive verification pages", () => {
    const issue = detectPageAccessIssue(`
      <html><body>
        <h2>环境异常</h2>
        <p>当前环境异常，完成验证后即可继续访问。</p>
        <button>去验证</button>
      </body></html>
    `, "https://mp.weixin.qq.com/s/example");

    expect(issue).toMatchObject({
      status: 422,
      code: "INTERACTIVE_VERIFICATION_REQUIRED",
    });
  });

  it("detects deleted WeChat articles", () => {
    const issue = detectPageAccessIssue(
      "<html><body>该内容已被发布者删除 微信公众平台运营中心</body></html>",
      "https://mp.weixin.qq.com/s/example",
    );

    expect(issue).toMatchObject({ status: 422, code: "CONTENT_UNAVAILABLE" });
  });

  it("does not reject a normal article mentioning verification", () => {
    const issue = detectPageAccessIssue(
      "<html><body><article><h1>系统安全验证方法</h1><p>本文介绍如何设计用户验证流程。</p></article></body></html>",
      "https://example.com/article",
    );

    expect(issue).toBeNull();
  });
});
