import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import {
  GENERATED_MERMAID_IMAGE_ATTRIBUTE,
  normalizeMermaidSources,
  replaceUnusablePastedMermaid,
  restoreMermaidSourceMarkers,
} from "@/lib/mermaid";
import type { ConversionWarning } from "@/types/conversion";

const STRONG_STRUCTURE_SELECTOR = "h1,h2,h3,h4,h5,h6,table,ul,ol,blockquote,pre,img";
const RICH_TEXT_SELECTOR = "strong,b,em,i,del,s,code";
const PASTE_FORBID_TAGS = [
  "script",
  "style",
  "noscript",
  "template",
  "iframe",
  "object",
  "embed",
  "form",
  "svg",
  "math",
  "button",
  "nav",
];

export interface PreparedPastedContent {
  mode: "html" | "text";
  html: string;
  text: string;
  title: string;
  textLength: number;
  warnings?: ConversionWarning[];
}

export interface PastedContentInput {
  html?: string;
  text?: string;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function firstTextLine(value: string): string {
  for (const line of value.split(/\r?\n/)) {
    const normalized = normalizeWhitespace(line);
    if (normalized) return normalized;
  }
  return "";
}

function candidateTitle(value: string | null | undefined): string {
  return normalizeWhitespace(value ?? "");
}

function documentTitle(document: Document, plainText: string): string {
  const title = candidateTitle(document.head?.querySelector("title")?.textContent);
  if (title) return title;

  const ogTitle = Array.from(document.head?.querySelectorAll("meta") ?? []).find(
    (meta) => meta.getAttribute("property")?.trim().toLowerCase() === "og:title",
  );
  const ogTitleText = candidateTitle(ogTitle?.getAttribute("content"));
  if (ogTitleText) return ogTitleText;

  const heading = candidateTitle(document.querySelector("h1")?.textContent);
  if (heading) return heading;

  return firstTextLine(plainText) || "粘贴内容";
}

function sanitizePasteBody(window: JSDOM["window"], bodyHtml: string): string {
  const purify = createDOMPurify(window);
  return purify.sanitize(bodyHtml, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: PASTE_FORBID_TAGS,
    FORBID_ATTR: ["style", "srcdoc"],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ["data-src", "data-lazy-src", GENERATED_MERMAID_IMAGE_ATTRIBUTE],
  });
}

function hasValidLink(document: Document): boolean {
  return Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
    .some((anchor) => {
      const href = anchor.getAttribute("href")?.trim() ?? "";
      if (!href) return false;
      try {
        const url = new URL(href, "https://paste.invalid/");
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    });
}

export function detectStructuredHtml(html: string): boolean {
  if (typeof html !== "string" || html.trim().length === 0) return false;

  const dom = new JSDOM(html, { runScripts: "outside-only" });
  try {
    const { document } = dom.window;
    if (document.querySelector(STRONG_STRUCTURE_SELECTOR)) return true;
    if (hasValidLink(document)) return true;
    if (document.querySelector(RICH_TEXT_SELECTOR)) return true;
    const bodyParagraphs = Array.from(document.querySelectorAll("p"))
      .filter((paragraph) => normalizeWhitespace(paragraph.textContent ?? "").length > 0);
    return bodyParagraphs.length >= 2;
  } finally {
    dom.window.close();
  }
}

export function preparePastedContent({ html, text }: PastedContentInput): PreparedPastedContent {
  const plainText = (text ?? "").trim();
  const sourceDom = html?.trim() ? new JSDOM(html, { runScripts: "outside-only" }) : null;
  const title = sourceDom ? documentTitle(sourceDom.window.document, plainText) : firstTextLine(plainText) || "粘贴内容";
  try {
    if (sourceDom) {
      normalizeMermaidSources(sourceDom.window.document);
      const unavailableMermaidCount = replaceUnusablePastedMermaid(sourceDom.window.document);
      const warnings = unavailableMermaidCount > 0
        ? [{
            code: "MERMAID_RENDER_UNAVAILABLE",
            message: "有一张 Mermaid 图表只有渲染结果，无法从粘贴内容中安全转换，已保留占位文本。",
          }]
        : [];
      const sourceBody = sourceDom.window.document.body;
      sourceBody?.querySelectorAll(PASTE_FORBID_TAGS.join(",")).forEach((element) => element.remove());
      const cleanHtml = sanitizePasteBody(
        sourceDom.window,
        restoreMermaidSourceMarkers(sourceBody?.innerHTML ?? ""),
      );
      const cleanDom = new JSDOM(`<body>${cleanHtml}</body>`, { runScripts: "outside-only" });
      try {
        const cleanBody = cleanDom.window.document.body;
        cleanBody.querySelectorAll("*:not(img)").forEach((element) => {
          element.removeAttribute("data-src");
          element.removeAttribute("data-lazy-src");
        });
        if (detectStructuredHtml(cleanBody.innerHTML)) {
          const cleanText = cleanBody.textContent?.trim() ?? "";
          return {
            mode: "html",
            html: cleanBody.innerHTML,
            text: cleanText,
            title,
            textLength: cleanText.length,
            ...(warnings.length > 0 ? { warnings } : {}),
          };
        }
      } finally {
        cleanDom.window.close();
      }
    }

    return {
      mode: "text",
      html: "",
      text: plainText,
      title,
      textLength: plainText.length,
    };
  } finally {
    sourceDom?.window.close();
  }
}
