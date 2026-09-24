// The one place both sides of the extension agree on message shapes. The content script is the
// one that speaks first (it reports the converted article), so there is no request message.
export const ARTICLE_MESSAGE = "md-convertor:article";
export const FAILURE_MESSAGE = "md-convertor:failed";

export type ArticleImage = {
  placeholder: string;
  url: string;
};

export type ConvertPayload = {
  type: typeof ARTICLE_MESSAGE;
  title: string;
  markdown: string;
  images: ArticleImage[];
  sourceUrl: string;
  convertedAt: string;
};

export type ConvertFailure = {
  type: typeof FAILURE_MESSAGE;
  code: string;
  message: string;
};

export type ContentMessage = ConvertPayload | ConvertFailure;

// Messages arrive from any page the extension is injected into, so they are validated rather
// than trusted. Only the fields the worker actually reads are checked.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isImageList(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        isRecord(entry) && typeof entry.placeholder === "string" && typeof entry.url === "string",
    )
  );
}

export function isConvertPayload(value: unknown): value is ConvertPayload {
  if (!isRecord(value) || value.type !== ARTICLE_MESSAGE) return false;
  return (
    typeof value.title === "string" &&
    typeof value.markdown === "string" &&
    typeof value.sourceUrl === "string" &&
    typeof value.convertedAt === "string" &&
    isImageList(value.images)
  );
}

export function isConvertFailure(value: unknown): value is ConvertFailure {
  return (
    isRecord(value) &&
    value.type === FAILURE_MESSAGE &&
    typeof value.code === "string" &&
    typeof value.message === "string"
  );
}
