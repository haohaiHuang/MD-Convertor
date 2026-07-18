import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

export const MAX_MARKDOWN_BYTES = 20 * 1024 * 1024;

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim() || "未命名网页";
}

function escapeMarkdownText(value: string): string {
  return value.replace(/([\\`*_{}\[\]<>#+.!|-])/g, "\\$1");
}

export function makeFilename(title: string, date = new Date()): string {
  const cleaned = normalizeTitle(title)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/[. ]+$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 80)
    .trim();
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  const fallback = `webpage-${date.toISOString().replace(/[-:]/g, "").slice(0, 15)}`;
  return `${!cleaned || reserved.test(cleaned) ? fallback : cleaned}.md`;
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
