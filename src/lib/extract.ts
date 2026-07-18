import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import type { ExtractedContent } from "@/types/conversion";

const REMOVE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "template",
  "iframe",
  "object",
  "embed",
  "form",
  "nav",
  "footer",
  "aside",
  "[aria-hidden='true']",
].join(",");

function sanitizeHtml(window: JSDOM["window"], html: string): string {
  const purify = createDOMPurify(window);
  return purify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "svg", "math"],
    FORBID_ATTR: ["style", "srcdoc"],
    ALLOW_DATA_ATTR: false,
  });
}

function pageTitle(dom: JSDOM): string {
  return dom.window.document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content.trim()
    || dom.window.document.title.trim()
    || "未命名网页";
}

function extractWeChatArticle(dom: JSDOM, sourceUrl: string): ExtractedContent | null {
  if (new URL(sourceUrl).hostname !== "mp.weixin.qq.com") return null;
  const source = dom.window.document.querySelector("#js_content");
  if (!source) return null;

  const content = source.cloneNode(true) as Element;
  content.querySelectorAll("img").forEach((image) => {
    const lazySource = image.getAttribute("data-src")?.trim();
    if (lazySource) image.setAttribute("src", lazySource);
  });

  const cleanHtml = sanitizeHtml(dom.window, content.innerHTML);
  const cleanDom = new JSDOM(cleanHtml);
  try {
    const textLength = cleanDom.window.document.body.textContent?.trim().length ?? 0;
    if (textLength < 50) return null;
    return { title: pageTitle(dom), html: cleanHtml, textLength };
  } finally {
    cleanDom.window.close();
  }
}

export function extractReadable(html: string, sourceUrl: string): ExtractedContent | null {
  const dom = new JSDOM(html, { url: sourceUrl, runScripts: "outside-only" });
  try {
    const weChatArticle = extractWeChatArticle(dom, sourceUrl);
    if (weChatArticle) return weChatArticle;

    const documentClone = dom.window.document.cloneNode(true) as Document;
    const article = new Readability(documentClone, { charThreshold: 50 }).parse();
    if (!article?.content) return null;
    const cleanHtml = sanitizeHtml(dom.window, article.content);
    const cleanDom = new JSDOM(cleanHtml);
    const textLength = cleanDom.window.document.body.textContent?.trim().length ?? 0;
    cleanDom.window.close();
    return {
      title: article.title?.trim() || pageTitle(dom),
      html: cleanHtml,
      textLength,
    };
  } finally {
    dom.window.close();
  }
}

export function extractBodyFallback(html: string, sourceUrl: string): ExtractedContent {
  const dom = new JSDOM(html, { url: sourceUrl, runScripts: "outside-only" });
  try {
    dom.window.document.querySelectorAll(REMOVE_SELECTORS).forEach((node) => node.remove());
    const title = dom.window.document.title.trim() || "未命名网页";
    const cleanHtml = sanitizeHtml(dom.window, dom.window.document.body.innerHTML);
    const textLength = new JSDOM(cleanHtml).window.document.body.textContent?.trim().length ?? 0;
    return { title, html: cleanHtml, textLength };
  } finally {
    dom.window.close();
  }
}
