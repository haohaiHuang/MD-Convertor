import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { validateConvertApiCaller } from "@/lib/api-security";
import { convertPastedContent } from "@/lib/convert-paste";
import { AppError, toAppError } from "@/lib/errors";
import { pasteRequestHasContent, readPastedRequestBody, MAX_PASTE_REQUEST_BYTES } from "@/lib/paste-request";
import { acquireConversionSlot, clientIpFromHeaders } from "@/lib/rate-limit";
import type { PastedConvertRequest } from "@/types/conversion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parseDeclaredLength(request: Request): void {
  const rawLength = request.headers.get("content-length");
  if (!rawLength) return;
  const normalized = rawLength.trim();
  if (!/^\d+$/.test(normalized)) return;
  const digits = normalized.replace(/^0+/, "") || "0";
  const limit = String(MAX_PASTE_REQUEST_BYTES);
  if (digits.length > limit.length || (digits.length === limit.length && digits > limit)) {
    throw new AppError(413, "REQUEST_TOO_LARGE", "请求内容过大。");
  }
}

function parsePastedRequest(raw: string): PastedConvertRequest {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new AppError(400, "INVALID_REQUEST", "请求必须是有效的 JSON。");
  }
  if (!pasteRequestHasContent(value)) {
    throw new AppError(400, "INVALID_REQUEST", "请提供 HTML 或纯文本内容。");
  }
  return value;
}

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = randomUUID();
  const startedAt = Date.now();
  let release: (() => void) | undefined;
  let timeoutSignal: AbortSignal | undefined;

  try {
    validateConvertApiCaller(request);
    parseDeclaredLength(request);
    timeoutSignal = AbortSignal.timeout(45_000);
    const signal = AbortSignal.any([request.signal, timeoutSignal]);
    const rawBody = await readPastedRequestBody(request.body, MAX_PASTE_REQUEST_BYTES, signal);
    const body = parsePastedRequest(rawBody);

    release = acquireConversionSlot(clientIpFromHeaders(request.headers));
    const result = await convertPastedContent(body, signal);
    signal.throwIfAborted();

    console.info(JSON.stringify({
      requestId,
      status: 200,
      durationMs: Date.now() - startedAt,
      outputBytes: result.meta.outputBytes,
      warningCodes: result.warnings.map((warning) => warning.code),
    }));
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const appError = request.signal.aborted
      ? new AppError(499, "CLIENT_ABORTED", "转换已由用户停止。")
      : timeoutSignal?.aborted
        ? new AppError(504, "CONVERSION_TIMEOUT", "转换超时，请稍后重试。")
        : toAppError(error);
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
  } finally {
    release?.();
  }
}
