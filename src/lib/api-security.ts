import { timingSafeEqual } from "node:crypto";
import { AppError } from "@/lib/errors";

export const SESSION_TOKEN_HEADER = "x-md-convertor-token";

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return normalized === "127.0.0.1" || normalized === "::1" || normalized === "localhost";
}

function isSameLoopbackEndpoint(value: string, requestUrl: URL): boolean {
  try {
    const endpoint = value.includes("://")
      ? new URL(value)
      : new URL(`${requestUrl.protocol}//${value}`);
    return endpoint.protocol === requestUrl.protocol
      && isLoopbackHost(endpoint.hostname)
      && endpoint.port === requestUrl.port;
  } catch {
    return false;
  }
}

function tokenMatches(actual: string | null, expected: string): boolean {
  if (!actual) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function validateConvertApiCaller(request: Request): void {
  const requestUrl = new URL(request.url);
  if (!isLoopbackHost(requestUrl.hostname)) {
    throw new AppError(403, "INVALID_API_HOST", "本地转换接口只接受应用内请求。");
  }

  const host = request.headers.get("host");
  if (host && !isSameLoopbackEndpoint(host, requestUrl)) {
    throw new AppError(403, "INVALID_API_HOST", "请求的本地服务地址无效。");
  }

  const origin = request.headers.get("origin");
  if (origin && !isSameLoopbackEndpoint(origin, requestUrl)) {
    throw new AppError(403, "INVALID_API_ORIGIN", "本地转换接口不接受外部网页调用。");
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw new AppError(403, "INVALID_API_ORIGIN", "本地转换接口不接受跨站调用。");
  }

  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new AppError(400, "INVALID_CONTENT_TYPE", "请求必须使用 JSON 格式。");
  }

  const expectedToken = process.env.MD_CONVERTOR_SESSION_TOKEN;
  if (!expectedToken) {
    if (process.env.NODE_ENV === "production") {
      throw new AppError(403, "API_SESSION_UNAVAILABLE", "本地应用会话尚未建立。");
    }
    return;
  }

  if (!tokenMatches(request.headers.get(SESSION_TOKEN_HEADER), expectedToken)) {
    throw new AppError(403, "INVALID_SESSION_TOKEN", "本地应用会话验证失败。");
  }
}
