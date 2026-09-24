import { extractArticle } from "./extract";
import { collectImages, type ImagePlan } from "./images";
import { htmlToArticleMarkdown } from "./markdown";
import type { Sanitizer } from "./sanitize";

export type { ImagePlan } from "./images";
export type { Sanitizer } from "./sanitize";

export type BuildDeps = {
  sanitize: Sanitizer;
  now: () => string;
};

export type BuiltArticle = {
  title: string;
  markdown: string;
  images: ImagePlan[];
  sourceUrl: string;
};

// Everything here takes a live `Document`; the browser bundle must never parse an HTML string
// itself (turndown maps domino to an empty stub in browser builds).
export function buildArticle(document: Document, sourceUrl: string, deps: BuildDeps): BuiltArticle | null {
  const extracted = extractArticle(document, sourceUrl, { sanitize: deps.sanitize });
  if (!extracted) return null;

  const container = document.createElement("div");
  container.innerHTML = extracted.html;

  const { images } = collectImages(container, sourceUrl);
  const markdown = htmlToArticleMarkdown(container, {
    title: extracted.title,
    sourceUrl,
    convertedAt: deps.now(),
  });

  return { title: extracted.title, markdown, images, sourceUrl };
}
