import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { convertUrlToMarkdown } from "@/lib/convert";
import { validateConvertApiCaller } from "@/lib/api-security";
import { AppError, toAppError } from "@/lib/errors";
import { acquireConversionSlot, clientIpFromHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = randomUUID();
  const startedAt = Date.now();
  let release: (() => void) | undefined;
  let timeoutSignal: AbortSignal | undefined;

  try {
    validateConvertApiCaller(request);
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 4096) {
      throw new AppError(413, "REQUEST_TOO_LARGE", "请求内容过大。");
    }

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || typeof (body as { url?: unknown }).url !== "string") {
      throw new AppError(400, "INVALID_REQUEST", "请提供一个网页链接。");
    }

    release = acquireConversionSlot(clientIpFromHeaders(request.headers));
    timeoutSignal = AbortSignal.timeout(45_000);
    const signal = AbortSignal.any([request.signal, timeoutSignal]);
    const result = await convertUrlToMarkdown((body as { url: string }).url, signal);

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
