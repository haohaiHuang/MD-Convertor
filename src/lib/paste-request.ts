import { AppError } from "@/lib/errors";
import { MAX_PASTE_REQUEST_BYTES as MAX_PASTE_REQUEST_LIMIT } from "@/lib/paste-contract";
import type { PastedConvertRequest } from "@/types/conversion";

export const MAX_PASTE_REQUEST_BYTES = MAX_PASTE_REQUEST_LIMIT;

export function pasteRequestHasContent(value: unknown): value is PastedConvertRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.html !== undefined && typeof candidate.html !== "string") return false;
  if (candidate.text !== undefined && typeof candidate.text !== "string") return false;
  if (candidate.sourceUrl !== undefined && typeof candidate.sourceUrl !== "string") return false;
  const html = typeof candidate.html === "string" ? candidate.html : "";
  const text = typeof candidate.text === "string" ? candidate.text : "";
  return Boolean(html.trim() || text.trim());
}

export async function readPastedRequestBody(
  body: ReadableStream<Uint8Array> | null,
  limit = MAX_PASTE_REQUEST_BYTES,
  signal?: AbortSignal,
): Promise<string> {
  signal?.throwIfAborted();
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  const abort = (): void => {
    void reader.cancel(signal?.reason).catch(() => undefined);
  };
  signal?.addEventListener("abort", abort, { once: true });

  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > limit) {
        void reader.cancel().catch(() => undefined);
        throw new AppError(413, "REQUEST_TOO_LARGE", "请求内容过大。");
      }
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    signal?.throwIfAborted();
    throw new AppError(400, "INVALID_REQUEST", "请求必须是有效的 JSON。");
  } finally {
    signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }

  return Buffer.concat(chunks, total).toString("utf8");
}
