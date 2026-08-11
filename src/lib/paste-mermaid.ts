import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import sharp from "sharp";
import { GENERATED_MERMAID_IMAGE_ATTRIBUTE } from "@/lib/mermaid";
import type { ConversionWarning } from "@/types/conversion";

const MAX_MERMAID_IMAGES = 30;
const MAX_SVG_BYTES = 1024 * 1024;
const MAX_RASTER_EDGE = 2048;
const MAX_RASTER_BYTES = 8 * 1024 * 1024;
const FORBIDDEN_SVG_TAGS = [
  "script",
  "iframe",
  "object",
  "embed",
  "image",
  "video",
  "audio",
  "canvas",
  "link",
  "meta",
  "base",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "animate",
  "animatemotion",
  "animatetransform",
  "set",
];

function hasUnsafeResource(value: string): boolean {
  const withoutLocalReferences = value.replace(/url\(\s*(['"]?)#[A-Za-z0-9_.:-]+\1\s*\)/gi, "");
  return /url\s*\(|@import|expression\s*\(|javascript:|data:|https?:|\/\//i.test(withoutLocalReferences);
}

function replaceForeignObjectLabels(svg: SVGElement): void {
  svg.querySelectorAll<SVGForeignObjectElement>("foreignObject").forEach((foreignObject) => {
    const label = (foreignObject.textContent ?? "").replace(/\s+/g, " ").trim();
    const x = Number(foreignObject.getAttribute("x") ?? 0);
    const y = Number(foreignObject.getAttribute("y") ?? 0);
    const width = Number(foreignObject.getAttribute("width"));
    const height = Number(foreignObject.getAttribute("height"));
    if (!label || !Number.isFinite(x) || !Number.isFinite(y) ||
      !Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      foreignObject.remove();
      return;
    }

    const text = foreignObject.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "text");
    text.textContent = label;
    text.setAttribute("x", String(x + width / 2));
    text.setAttribute("y", String(y + height / 2));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("font-family", "sans-serif");
    text.setAttribute("font-size", "14");
    foreignObject.replaceWith(text);
  });
}

function setPresentation(
  element: Element,
  attributes: Record<string, string>,
): void {
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
}

function applyCanonicalMermaidTheme(svg: SVGElement): void {
  svg.querySelectorAll("style").forEach((style) => style.remove());
  svg.querySelectorAll("[style]").forEach((element) => element.removeAttribute("style"));

  svg.querySelectorAll("path,line,polyline").forEach((element) => setPresentation(element, {
    fill: "none",
    stroke: "#6b7280",
    "stroke-width": "1.5",
  }));
  svg.querySelectorAll("rect,circle,ellipse,polygon").forEach((element) => setPresentation(element, {
    fill: "#f5f5f0",
    stroke: "#9ca3af",
    "stroke-width": "1.5",
  }));
  svg.querySelectorAll("marker path,marker circle,marker polygon,.marker").forEach((element) =>
    setPresentation(element, { fill: "#6b7280", stroke: "#6b7280" }));
  svg.querySelectorAll("text").forEach((element) => setPresentation(element, { fill: "#111827" }));
}

function replaceWithMermaidPlaceholder(svg: SVGElement): void {
  const placeholder = svg.ownerDocument.createElement("blockquote");
  placeholder.textContent = "Mermaid 图表未能安全转换";
  const container = svg.closest(".mermaid");
  (container ?? svg).replaceWith(placeholder);
}

function safeSvgMarkup(svg: SVGElement, window: JSDOM["window"]): string | null {
  if (Buffer.byteLength(svg.outerHTML) > MAX_SVG_BYTES) return null;
  svg.querySelectorAll(FORBIDDEN_SVG_TAGS.join(",")).forEach((element) => element.remove());
  replaceForeignObjectLabels(svg);
  applyCanonicalMermaidTheme(svg);
  svg.querySelectorAll("*").forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on") || name === "src" || name === "srcset" || name === "srcdoc") {
        element.removeAttribute(attribute.name);
        continue;
      }
      if (name === "href" || name === "xlink:href") {
        if (!/^#[A-Za-z0-9_.:-]+$/.test(attribute.value)) element.removeAttribute(attribute.name);
        continue;
      }
      if (hasUnsafeResource(attribute.value)) element.removeAttribute(attribute.name);
    }
  });
  svg.querySelectorAll("style").forEach((style) => {
    if (hasUnsafeResource(style.textContent ?? "")) style.remove();
  });

  const purify = createDOMPurify(window);
  const sanitized = purify.sanitize(svg.outerHTML, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: FORBIDDEN_SVG_TAGS,
    ALLOW_DATA_ATTR: false,
  });
  if (!sanitized.trim()) return null;

  const cleanDom = new JSDOM(sanitized, { contentType: "image/svg+xml" });
  try {
    const cleanSvg = cleanDom.window.document.documentElement;
    if (cleanSvg.localName.toLowerCase() !== "svg") return null;
    if (!cleanSvg.querySelector("path,rect,circle,ellipse,line,polyline,polygon,text,use")) return null;
    const viewBox = cleanSvg.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number) ?? [];
    let width = Number(cleanSvg.getAttribute("width"));
    let height = Number(cleanSvg.getAttribute("height"));
    if ((!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) &&
      viewBox.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0) {
      width = viewBox[2];
      height = viewBox[3];
    }
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return null;
    const scale = Math.min(1, MAX_RASTER_EDGE / width, MAX_RASTER_EDGE / height);
    cleanSvg.setAttribute("width", String(Math.max(1, Math.round(width * scale))));
    cleanSvg.setAttribute("height", String(Math.max(1, Math.round(height * scale))));
    return cleanSvg.outerHTML;
  } finally {
    cleanDom.window.close();
  }
}

async function svgToPngDataUri(svg: SVGElement, window: JSDOM["window"], signal: AbortSignal): Promise<string | null> {
  signal.throwIfAborted();
  const markup = safeSvgMarkup(svg, window);
  if (!markup) return null;
  try {
    const png = await sharp(Buffer.from(markup), {
      density: 72,
      limitInputPixels: MAX_RASTER_EDGE * MAX_RASTER_EDGE,
    }).flatten({ background: "#ffffff" }).png().toBuffer();
    signal.throwIfAborted();
    if (!png.byteLength || png.byteLength > MAX_RASTER_BYTES) return null;
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    signal.throwIfAborted();
    return null;
  }
}

export async function rasterizePastedMermaid(
  html: string | undefined,
  signal: AbortSignal,
): Promise<{
  html: string | undefined;
  warnings: ConversionWarning[];
  omittedImageCount: number;
}> {
  if (!html?.trim()) return { html, warnings: [], omittedImageCount: 0 };
  const dom = new JSDOM(html, { runScripts: "outside-only" });
  try {
    const { document } = dom.window;
    const warnings: ConversionWarning[] = [];
    let omittedImageCount = 0;
    const candidates = Array.from(document.querySelectorAll<SVGElement>(
      '.mermaid svg, svg[id^="mermaid-"]:not(.mermaid svg), svg[aria-roledescription]:not(.mermaid svg)',
    ));
    for (const svg of candidates.slice(0, MAX_MERMAID_IMAGES)) {
      const dataUri = await svgToPngDataUri(svg, dom.window, signal);
      if (!dataUri) {
        replaceWithMermaidPlaceholder(svg);
        omittedImageCount += 1;
        warnings.push({
          code: "MERMAID_RENDER_UNAVAILABLE",
          message: "有一张 Mermaid 图表只有渲染结果，无法从粘贴内容中安全转换，已保留占位文本。",
        });
        continue;
      }
      const image = document.createElement("img");
      image.src = dataUri;
      image.setAttribute(GENERATED_MERMAID_IMAGE_ATTRIBUTE, "mermaid");
      image.alt = "Mermaid 图表";
      const container = svg.closest(".mermaid");
      (container ?? svg).replaceWith(image);
    }
    for (const svg of candidates.slice(MAX_MERMAID_IMAGES)) {
      replaceWithMermaidPlaceholder(svg);
      omittedImageCount += 1;
    }
    if (candidates.length > MAX_MERMAID_IMAGES) {
      warnings.push({
        code: "MERMAID_COUNT_LIMIT",
        message: "粘贴内容包含超过 30 张 Mermaid 图表，额外图表已保留占位文本。",
      });
    }
    signal.throwIfAborted();
    return { html: dom.serialize(), warnings, omittedImageCount };
  } finally {
    dom.window.close();
  }
}
