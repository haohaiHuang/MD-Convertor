export type Sanitizer = (html: string) => string;

// Structural subset of a DOMPurify instance. The core never imports `dompurify` itself:
// Node injects `createDOMPurify(jsdomWindow)`, the browser injects the `DOMPurify` singleton.
type PurifyLike = {
  sanitize(html: string, options: Record<string, unknown>): string;
};

// Mirrors `src/lib/extract.ts` so the extension and the desktop app agree on what survives.
export function createSanitizer(purify: PurifyLike): Sanitizer {
  return (html) =>
    purify.sanitize(html, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "svg", "math"],
      FORBID_ATTR: ["style", "srcdoc"],
      ALLOW_DATA_ATTR: false,
    });
}
