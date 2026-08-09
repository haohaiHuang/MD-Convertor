import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

export const MAX_MARKDOWN_BYTES = 20 * 1024 * 1024;

export type PastedMarkdownInput =
  | {
      mode: "html";
      html: string;
      title: string;
      sourceUrl?: string;
      convertedAt: string;
    }
  | {
      mode: "text";
      text: string;
      title: string;
      sourceUrl?: string;
      convertedAt: string;
    };

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim() || "未命名网页";
}

function escapeMarkdownText(value: string): string {
  return value.replace(/([\\`*_{}\[\]<>#+.!|-])/g, "\\$1");
}

function escapePastedPlainText(value: string): string {
  return value.split("\n").map((line) => {
    let escaped = escapeMarkdownText(line).replace(/~/g, "\\~");
    if (/^\s*=+\s*$/.test(line)) escaped = escaped.replace(/=/g, "\\=");
    if (/^\s*\d+\)\s+/.test(line)) escaped = escaped.replace(/^(\s*\d+)\)/, "$1\\)");
    return escaped;
  }).join("\n");
}

function normalizePasteTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim() || "粘贴内容";
}

const RESERVED_FILENAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

function cleanFilenameStem(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/[. ]+$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 80)
    .trim();
}

function filenameTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").slice(0, 15);
}

function pastedHeader(title: string, sourceUrl: string | undefined, convertedAt: string): string[] {
  const lines = [`# ${escapeMarkdownText(normalizePasteTitle(title))}`, ""];
  const normalizedSourceUrl = sourceUrl?.trim();
  if (normalizedSourceUrl) lines.push(`> 来源：[${escapeMarkdownText(normalizedSourceUrl)}](<${normalizedSourceUrl}>)`);
  lines.push(`> 转换时间：${convertedAt}`);
  return lines;
}

function createPasteTurndown(): TurndownService {
  const turndown = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    strongDelimiter: "**",
    linkStyle: "inlined",
  });
  turndown.use(gfm);
  turndown.remove(["script", "style", "iframe", "object", "embed", "form", "button", "nav"]);
  turndown.addRule("compactPasteListItem", {
    filter: "li",
    replacement: (content, node) => {
      let prefix = "- ";
      const parent = node.parentNode as Element | null;
      if (parent?.nodeName === "OL") {
        const start = parent.getAttribute("start");
        const index = Array.prototype.indexOf.call(parent.children, node);
        prefix = `${start ? Number(start) + index : index + 1}. `;
      }
      const isParagraph = /\n$/.test(content);
      content = content.replace(/^\n+|\n+$/g, "") + (isParagraph ? "\n" : "");
      const lines = content.split("\n");
      let openingIndex = lines.findIndex((line) => /^`{3,}\S*$/.test(line));
      if (openingIndex > 0 && lines[openingIndex - 1] === "") {
        lines.splice(openingIndex - 1, 1);
        openingIndex -= 1;
      }
      const fence = openingIndex >= 0 ? lines[openingIndex].match(/^(`{3,})/)?.[1] : undefined;
      if (fence) {
        const closingIndex = lines.findIndex((line, index) => index > openingIndex && line === fence);
        if (closingIndex >= 0 && lines[closingIndex + 1] === "" && closingIndex + 1 < lines.length - 1) {
          lines.splice(closingIndex + 1, 1);
        }
      }
      content = lines.join("\n");
      content = content.replace(/\n/g, `\n${" ".repeat(prefix.length)}`);
      return prefix + content + (node.nextSibling ? "\n" : "");
    },
  });
  turndown.addRule("escapePasteTableCellPipes", {
    filter: ["th", "td"],
    replacement: (content, node) => {
      const index = Array.prototype.indexOf.call(node.parentNode?.childNodes ?? [], node);
      const prefix = index === 0 ? "| " : " ";
      return `${prefix}${content.replace(/\|/g, "\\|")} |`;
    },
  });
  turndown.addRule("pasteHorizontalRule", {
    filter: "hr",
    replacement: () => "\n\n---\n\n",
  });
  turndown.addRule("pasteStrikethrough", {
    filter: (node) => ["DEL", "S", "STRIKE"].includes(node.nodeName),
    replacement: (content) => `~~${content}~~`,
  });
  turndown.addRule("pasteHeadingBreak", {
    filter: (node) => /^H[1-6]$/.test(node.parentNode?.nodeName ?? "") && node.nodeName === "BR",
    replacement: () => " ",
  });
  return turndown;
}

function normalizePasteLinks(body: Element, sourceUrl: string | undefined): void {
  body.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
    const href = link.getAttribute("href")?.trim() ?? "";
    if (!href || href.startsWith("#")) {
      link.removeAttribute("href");
      return;
    }

    if (!sourceUrl) {
      try {
        const absolute = new URL(href);
        if (absolute.protocol === "http:" || absolute.protocol === "https:") {
          link.setAttribute("href", absolute.toString());
          return;
        }
      } catch {
        // Invalid absolute URLs stay as plain text.
      }
    }

    try {
      const resolved = new URL(href, sourceUrl);
      if (resolved.protocol === "http:" || resolved.protocol === "https:") {
        link.setAttribute("href", resolved.toString());
        return;
      }
    } catch {
      // Relative URLs require a source URL and invalid URLs stay as text.
    }
    link.removeAttribute("href");
  });
}

function promotePasteTableHeaders(body: Element): void {
  body.querySelectorAll("table").forEach((table) => {
    const firstRow = table.querySelector("tr");
    if (!firstRow) return;
    Array.from(firstRow.children)
      .filter((cell) => cell.tagName.toLowerCase() === "td")
      .forEach((cell) => {
        const header = firstRow.ownerDocument.createElement("th");
        Array.from(cell.attributes).forEach((attribute) => header.setAttribute(attribute.name, attribute.value));
        while (cell.firstChild) header.appendChild(cell.firstChild);
        cell.replaceWith(header);
      });
  });
}

function flattenPasteTableLists(body: Element): void {
  body.querySelectorAll("td, th").forEach((cell) => {
    Array.from(cell.querySelectorAll("ul, ol")).reverse().forEach((list) => {
      const items = Array.from(list.children)
        .filter((item) => item.tagName.toLowerCase() === "li")
        .map((item) => item.textContent?.replace(/\s+/g, " ").trim() ?? "")
        .filter(Boolean)
        .join(" ");
      list.replaceWith(list.ownerDocument.createTextNode(items));
    });
  });
}

function renderPastedHtml(html: string, title: string, sourceUrl: string | undefined): string {
  const dom = new JSDOM(html, { runScripts: "outside-only" });
  try {
    const body = dom.window.document.body;
    const normalizedTitle = normalizePasteTitle(title);
    const firstHeading = body.querySelector("h1");
    if (firstHeading && normalizePasteTitle(firstHeading.textContent ?? "").toLocaleLowerCase() === normalizedTitle.toLocaleLowerCase()) {
      firstHeading.remove();
    }
    promotePasteTableHeaders(body);
    flattenPasteTableLists(body);
    normalizePasteLinks(body, sourceUrl?.trim() || undefined);
    return createPasteTurndown().turndown(body).trim();
  } finally {
    dom.window.close();
  }
}

export function makeFilename(title: string, date = new Date()): string {
  const cleaned = cleanFilenameStem(normalizeTitle(title));
  const fallback = `webpage-${filenameTimestamp(date)}`;
  return `${!cleaned || RESERVED_FILENAME.test(cleaned) ? fallback : cleaned}.md`;
}

export function makePasteFilename(title: string, date = new Date()): string {
  const normalized = title.replace(/\s+/g, " ").trim();
  const cleaned = cleanFilenameStem(normalized);
  if (!normalized || normalized === "粘贴内容" || !cleaned || RESERVED_FILENAME.test(cleaned)) {
    return `粘贴内容-${filenameTimestamp(date)}.md`;
  }
  return `${cleaned}.md`;
}

export function htmlToMarkdown(
  html: string,
  title: string,
  sourceUrl: string,
  convertedAt: string,
): string {
  const normalizedTitle = normalizeTitle(title);
  const dom = new JSDOM(`<body>${html}</body>`);
  const firstHeading = dom.window.document.body.querySelector("h1");
  if (firstHeading?.textContent?.trim().toLocaleLowerCase() === normalizedTitle.toLocaleLowerCase()) {
    firstHeading.remove();
  }
  dom.window.document.body.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
    try {
      const absoluteUrl = new URL(link.getAttribute("href") ?? "", sourceUrl);
      if (absoluteUrl.protocol === "http:" || absoluteUrl.protocol === "https:") {
        link.href = absoluteUrl.toString();
      }
    } catch {
      link.removeAttribute("href");
    }
  });

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
  const body = turndown.turndown(dom.window.document.body).trim();
  dom.window.close();

  return [
    `# ${escapeMarkdownText(normalizedTitle)}`,
    "",
    `> 来源：[${escapeMarkdownText(sourceUrl)}](<${sourceUrl}>)`,
    `> 转换时间：${convertedAt}`,
    "",
    body,
    "",
  ].join("\n");
}

export function pastedContentToMarkdown(input: PastedMarkdownInput): string {
  const body = input.mode === "text"
    ? escapePastedPlainText(input.text.trim())
    : renderPastedHtml(input.html, input.title, input.sourceUrl);
  return [...pastedHeader(input.title, input.sourceUrl, input.convertedAt), "", body, ""].join("\n");
}
