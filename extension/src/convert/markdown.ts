import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

export type MarkdownOptions = {
  title: string;
  sourceUrl: string;
  convertedAt: string;
};

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim() || "未命名网页";
}

function escapeMarkdownText(value: string): string {
  return value.replace(/([\\`*_{}\[\]<>#+.!|-])/g, "\\$1");
}

// Schemes that can execute when a Markdown reader renders the link. The sanitizer already
// strips them; this is the second, DOM-level guard so `htmlToArticleMarkdown` is safe on its own.
const UNSAFE_SCHEMES = new Set(["javascript:", "data:", "vbscript:"]);

function codeNodeText(node: Element): string {
  const clone = node.cloneNode(true) as Element;
  clone.querySelectorAll("br").forEach((lineBreak) => {
    lineBreak.replaceWith(clone.ownerDocument.createTextNode("\n"));
  });
  return clone.textContent ?? "";
}

// WeChat wraps every source line in its own <code>; the desktop app merges them so the
// fenced block keeps its line breaks. Same rule here.
function normalizeMultiCodeBlocks(body: Element): void {
  body.querySelectorAll("pre").forEach((pre) => {
    const codeNodes = Array.from(pre.children).filter((child) => child.tagName.toLowerCase() === "code");
    if (codeNodes.length < 2 || codeNodes.length !== pre.children.length) return;

    const hasSignificantTextNode = Array.from(pre.childNodes).some(
      (node) => node.nodeType === 3 && Boolean(node.textContent?.trim()),
    );
    if (hasSignificantTextNode) return;

    const mergedCode = pre.ownerDocument.createElement("code");
    Array.from(codeNodes[0].attributes).forEach((attribute) => {
      mergedCode.setAttribute(attribute.name, attribute.value);
    });
    mergedCode.textContent = codeNodes.map(codeNodeText).join("\n");
    pre.replaceChildren(mergedCode);
  });
}

function absolutizeLinks(root: Element, sourceUrl: string): void {
  root.querySelectorAll("a[href]").forEach((link) => {
    const href = link.getAttribute("href") ?? "";
    let resolved: URL;
    try {
      resolved = new URL(href, sourceUrl);
    } catch {
      // Desktop parity: a href we cannot even parse is dropped rather than emitted verbatim.
      link.removeAttribute("href");
      return;
    }
    if (resolved.protocol === "http:" || resolved.protocol === "https:") {
      link.setAttribute("href", resolved.toString());
      return;
    }
    if (UNSAFE_SCHEMES.has(resolved.protocol)) link.removeAttribute("href");
  });
}

export function htmlToArticleMarkdown(root: HTMLElement, options: MarkdownOptions): string {
  const normalizedTitle = normalizeTitle(options.title);

  const firstHeading = root.querySelector("h1");
  if (firstHeading?.textContent?.trim().toLocaleLowerCase() === normalizedTitle.toLocaleLowerCase()) {
    firstHeading.remove();
  }
  absolutizeLinks(root, options.sourceUrl);
  normalizeMultiCodeBlocks(root);

  const turndown = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    strongDelimiter: "**",
    linkStyle: "inlined",
  });
  turndown.use(gfm);
  turndown.remove(["script", "style", "iframe", "object", "embed", "form"]);
  const body = turndown.turndown(root).trim();

  return [
    `# ${escapeMarkdownText(normalizedTitle)}`,
    "",
    `> 来源：[${escapeMarkdownText(options.sourceUrl)}](<${options.sourceUrl}>)`,
    `> 转换时间：${options.convertedAt}`,
    "",
    body,
    "",
  ].join("\n");
}
