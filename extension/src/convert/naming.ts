const RESERVED_FILENAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif", "svg", "bmp"]);
const MAX_STEM_LENGTH = 80;
const MAX_SLUG_LENGTH = 40;

// Byte-for-byte the rule from `src/lib/markdown.ts` so an extension export and a desktop
// export of the same article land on the same name.
export function cleanFilenameStem(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/[. ]+$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, MAX_STEM_LENGTH)
    .trim();
}

function shortHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(6, "0").slice(0, 6);
}

export function fallbackName(seed: string): string {
  return `page-${shortHash(seed)}`;
}

// `.md` and `.images/` always share this stem, so overwriting can never split the pair.
function articleStem(title: string): string {
  const cleaned = cleanFilenameStem(title);
  return !cleaned || RESERVED_FILENAME.test(cleaned) ? fallbackName(title) : cleaned;
}

export function mdFileName(title: string): string {
  return `${articleStem(title)}.md`;
}

export function imageDirName(title: string): string {
  return `${articleStem(title)}.images`;
}

function urlBasenameParts(url: string): { slug: string; extension: string } {
  let pathname = "";
  try {
    pathname = new URL(url).pathname;
  } catch {
    // A URL that cannot be parsed has no usable basename.
  }
  const last = pathname.split("/").pop() ?? "";
  const dot = last.lastIndexOf(".");
  const rawSlug = dot > 0 ? last.slice(0, dot) : last;
  const extension = dot > 0 ? last.slice(dot + 1).toLowerCase() : "";
  return {
    slug: cleanFilenameStem(rawSlug),
    extension: IMAGE_EXTENSIONS.has(extension) ? extension : "",
  };
}

export function imageFileName(index: number, url: string): string {
  const { slug, extension } = urlBasenameParts(url);
  const usable = /[\p{L}\p{N}]/u.test(slug) ? slug.slice(0, MAX_SLUG_LENGTH).replace(/[. ]+$/g, "") : "image";
  return `${String(index).padStart(3, "0")}-${usable}${extension ? `.${extension}` : ""}`;
}
