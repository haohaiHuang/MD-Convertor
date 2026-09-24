import createDOMPurify from "dompurify";
import { buildArticle } from "./convert/index";
import { createSanitizer } from "./convert/sanitize";
import { ARTICLE_MESSAGE, FAILURE_MESSAGE, type ContentMessage } from "./messages";

// Injected on click by the service worker. This is the only context with a live DOM — the MV3
// worker has no `DOMParser`, which is why extraction happens here and orchestration happens there.
function convert(): ContentMessage {
  if (location.protocol !== "http:" && location.protocol !== "https:") {
    return { type: FAILURE_MESSAGE, code: "UNSUPPORTED_PAGE", message: `不支持 ${location.protocol} 页面` };
  }

  const convertedAt = new Date().toISOString();
  const article = buildArticle(document, location.href, {
    sanitize: createSanitizer(createDOMPurify(window)),
    now: () => convertedAt,
  });
  if (!article) {
    return { type: FAILURE_MESSAGE, code: "NO_ARTICLE", message: "没有识别出正文" };
  }

  return {
    type: ARTICLE_MESSAGE,
    title: article.title,
    markdown: article.markdown,
    images: article.images.map(({ placeholder, url }) => ({ placeholder, url })),
    sourceUrl: article.sourceUrl,
    convertedAt,
  };
}

// `void` without `.catch()` swallows a throw and looks like "the click did nothing".
void chrome.runtime.sendMessage(convert()).catch((error: unknown) => {
  console.warn("[md-convertor] 无法把转换结果发给扩展后台", error);
});
