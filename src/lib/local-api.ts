import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { validateConvertApiCaller } from "@/lib/api-security";
import { AppError } from "@/lib/errors";

export const MAX_LOCAL_API_BODY_BYTES = 64 * 1024;

/**
 * Reads a JSON body with an explicit size ceiling, so an oversized payload is
 * rejected before it is ever parsed or kept in memory.
 */
export async function readJsonBody(request: Request, maxBytes = MAX_LOCAL_API_BODY_BYTES): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new AppError(413, "REQUEST_TOO_LARGE", "请求内容过大。");
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > maxBytes) {
    throw new AppError(413, "REQUEST_TOO_LARGE", "请求内容过大。");
  }
  if (!raw.trim()) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new AppError(400, "INVALID_REQUEST_BODY", "请求内容无法解析。");
  }
}

export function readField(body: unknown, field: string): unknown {
  return body !== null && typeof body === "object" ? (body as Record<string, unknown>)[field] : undefined;
}

/**
 * Shared shell for the local settings endpoints: caller validation, error
 * mapping, and a log line that carries only request id, status, code and
 * duration — never a request body, a key or a provider response.
 */
export async function handleLocalApi(
  request: Request,
  run: () => Promise<unknown> | unknown,
): Promise<NextResponse> {
  const requestId = randomUUID();
  const startedAt = Date.now();

  try {
    validateConvertApiCaller(request);
    return NextResponse.json(await run(), { status: 200 });
  } catch (error) {
    const appError = error instanceof AppError
      ? error
      : new AppError(500, "INTERNAL_ERROR", "服务暂时不可用。");
    console.warn(JSON.stringify({
      requestId,
      status: appError.status,
      code: appError.code,
      durationMs: Date.now() - startedAt,
    }));
    return NextResponse.json(
      { error: { code: appError.code, message: appError.message }, requestId },
      { status: appError.status },
    );
  }
}
