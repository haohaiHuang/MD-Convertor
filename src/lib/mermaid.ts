import { JSDOM } from "jsdom";

const MERMAID_SOURCE_MARKER = "md-convertor-mermaid-source";
export const GENERATED_MERMAID_IMAGE_ATTRIBUTE = "data-md-convertor-generated";

export function normalizeMermaidSources(document: Document): number {
  let normalizedCount = 0;
  document.querySelectorAll<HTMLElement>("pre > code.language-mermaid").forEach((code) => {
    code.parentElement?.setAttribute("title", MERMAID_SOURCE_MARKER);
    normalizedCount += 1;
  });
  document.querySelectorAll<HTMLElement>(".mermaid").forEach((container) => {
    if (container.querySelector("svg, canvas")) return;
    const source = container.textContent?.trim() ?? "";
    if (!source) return;

    const pre = document.createElement("pre");
    pre.setAttribute("title", MERMAID_SOURCE_MARKER);
    const code = document.createElement("code");
    code.className = "language-mermaid";
    code.textContent = source;
    pre.appendChild(code);
    container.replaceWith(pre);
    normalizedCount += 1;
  });
  return normalizedCount;
}

export function restoreMermaidSourceMarkers(html: string): string {
  const dom = new JSDOM(`<body>${html}</body>`);
  try {
    dom.window.document.querySelectorAll<HTMLPreElement>(`pre[title="${MERMAID_SOURCE_MARKER}"]`)
      .forEach((pre) => {
        const code = pre.querySelector("code");
        if (code) code.className = "language-mermaid";
        pre.removeAttribute("title");
      });
    return dom.window.document.body.innerHTML;
  } finally {
    dom.window.close();
  }
}

export function replaceUnusablePastedMermaid(document: Document): number {
  let replacedCount = 0;
  const replaceWithPlaceholder = (element: Element) => {
    const placeholder = document.createElement("blockquote");
    placeholder.textContent = "Mermaid 图表未能安全转换";
    element.replaceWith(placeholder);
    replacedCount += 1;
  };
  document.querySelectorAll<HTMLElement>(".mermaid").forEach((container) => {
    replaceWithPlaceholder(container);
  });
  document.querySelectorAll<SVGElement>('svg[id^="mermaid-"], svg[aria-roledescription]').forEach((svg) => {
    if (svg.isConnected) replaceWithPlaceholder(svg);
  });
  return replacedCount;
}

export function requiresMermaidRendering(html: string): boolean {
  if (!html.trim()) return false;
  const dom = new JSDOM(html, { runScripts: "outside-only" });
  try {
    if (dom.window.document.querySelector('svg[id^="mermaid-"], svg[aria-roledescription]')) return true;
    return Array.from(dom.window.document.querySelectorAll<HTMLElement>(".mermaid"))
      .some((container) => {
        if (container.querySelector("svg, canvas")) return true;
        return !(container.textContent?.trim() ?? "");
      });
  } finally {
    dom.window.close();
  }
}
