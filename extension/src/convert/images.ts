export type ImagePlan = {
  index: number;
  url: string;
  placeholder: string;
};

export type CollectedImages = {
  images: ImagePlan[];
  html: string;
};

const PLACEHOLDER_PREFIX = "md-convertor-image-";

// Same lazy-image precedence the desktop paste path uses. `currentSrc` is only set once the
// browser has resolved a source, so the raw attributes come first for freshly parsed DOM.
function imageSource(image: Element, baseUrl: string): string | null {
  const raw =
    image.getAttribute("data-src")?.trim() ||
    image.getAttribute("data-lazy-src")?.trim() ||
    (image as HTMLImageElement).currentSrc ||
    image.getAttribute("src")?.trim() ||
    "";
  if (!raw) return null;
  try {
    const absolute = new URL(raw, baseUrl);
    return absolute.protocol === "http:" || absolute.protocol === "https:" ? absolute.toString() : null;
  } catch {
    return null;
  }
}

// Rewrites every http(s) image to a `md-convertor-image-<n>` placeholder and reports the
// download plan. `data:` images stay in the Markdown as-is (they are already self-contained),
// and duplicate URLs share one placeholder so the SW downloads each file once.
export function collectImages(root: Element, baseUrl: string): CollectedImages {
  const images: ImagePlan[] = [];
  const byUrl = new Map<string, ImagePlan>();

  root.querySelectorAll("img").forEach((image) => {
    const url = imageSource(image, baseUrl);
    if (!url) return;

    let plan = byUrl.get(url);
    if (!plan) {
      const index = images.length + 1;
      plan = { index, url, placeholder: `${PLACEHOLDER_PREFIX}${index}` };
      byUrl.set(url, plan);
      images.push(plan);
    }

    image.setAttribute("src", plan.placeholder);
    image.removeAttribute("srcset");
    image.removeAttribute("sizes");
    image.removeAttribute("loading");
  });

  return { images, html: root.innerHTML };
}
