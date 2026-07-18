import { JSDOM } from "jsdom";
import { AppError } from "@/lib/errors";

function isWeChatArticleUrl(sourceUrl: string): boolean {
  try {
    return new URL(sourceUrl).hostname.toLowerCase() === "mp.weixin.qq.com";
  } catch {
    return false;
  }
}

function normalizedBodyText(html: string): string {
  const dom = new JSDOM(html);
  try {
    return dom.window.document.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
  } finally {
    dom.window.close();
  }
}

export function detectPageAccessIssue(html: string, sourceUrl: string): AppError | null {
  if (!isWeChatArticleUrl(sourceUrl)) return null;
  const text = normalizedBodyText(html);

  if (
    text.includes("环境异常")
    && text.includes("完成验证后即可继续访问")
    && text.includes("去验证")
  ) {
    return new AppError(
      422,
      "INTERACTIVE_VERIFICATION_REQUIRED",
      "微信要求完成访问验证，当前无法自动转换这篇文章。",
    );
  }

  if (
    text.includes("该内容已被发布者删除")
    || text.includes("此内容因违规无法查看")
    || text.includes("该内容已被删除")
  ) {
    return new AppError(422, "CONTENT_UNAVAILABLE", "这篇微信文章已删除或无法公开访问。");
  }

  return null;
}
