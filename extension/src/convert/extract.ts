import { Readability } from "@mozilla/readability";
import type { Sanitizer } from "./sanitize";

export type ExtractedArticle = {
  title: string;
  html: string;
  textLength: number;
};

export type ExtractDeps = {
  sanitize: Sanitizer;
};

const WECHAT_HOST = "mp.weixin.qq.com";
const MIN_TEXT_LENGTH = 50;

function pageTitle(document: Document): string {
  return (
    document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content.trim() ||
    document.title.trim() ||
    "未命名网页"
  );
}

// A detached element is enough to count rendered text; the desktop app builds a whole second
// JSDOM only because it already has jsdom in hand, which a browser does not.
function textLengthOf(document: Document, html: string): number {
  const container = document.createElement("div");
  container.innerHTML = html;
  return container.textContent?.trim().length ?? 0;
}

// Lazy-loading images store the real URL in `data-src`/`data-lazy-src` and a placeholder (often a
// 1px gif) in `src`. Readability drops every `data-*` attribute, so promote first or the body
// would hand us the placeholder. The desktop app only does this for WeChat; the extension does
// it for every page, because a locally saved placeholder image is useless.
function promoteLazyImages(root: ParentNode): void {
  root.querySelectorAll("img").forEach((image) => {
    const lazySource =
      image.getAttribute("data-src")?.trim() || image.getAttribute("data-lazy-src")?.trim();
    if (lazySource) image.setAttribute("src", lazySource);
  });
}

function extractWeChat(document: Document, sourceUrl: string, deps: ExtractDeps): ExtractedArticle | null {
  let hostname = "";
  try {
    hostname = new URL(sourceUrl).hostname;
  } catch {
    return null;
  }
  if (hostname !== WECHAT_HOST) return null;

  const source = document.querySelector("#js_content");
  if (!source) return null;

  const content = source.cloneNode(true) as Element;
  promoteLazyImages(content);

  const html = deps.sanitize(content.innerHTML);
  const textLength = textLengthOf(document, html);
  if (textLength < MIN_TEXT_LENGTH) return null;
  return { title: pageTitle(document), html, textLength };
}

// No whole-page fallback on purpose: the extension has not paid any fetch cost, and a fallback
// would only smuggle navigation and footers into the output. No article -> report failure.
export function extractArticle(document: Document, sourceUrl: string, deps: ExtractDeps): ExtractedArticle | null {
  const weChat = extractWeChat(document, sourceUrl, deps);
  if (weChat) return weChat;

  const documentClone = document.cloneNode(true) as Document;
  promoteLazyImages(documentClone);
  const article = new Readability(documentClone, { charThreshold: MIN_TEXT_LENGTH }).parse();
  if (!article?.content) return null;

  const html = deps.sanitize(article.content);
  const textLength = textLengthOf(document, html);
  // Readability happily returns chrome (a nav bar counts as "content"). A real article body
  // clears the same threshold the WeChat branch uses; below it there is no article.
  if (textLength < MIN_TEXT_LENGTH) return null;
  return {
    title: article.title?.trim() || pageTitle(document),
    html,
    textLength,
  };
}
