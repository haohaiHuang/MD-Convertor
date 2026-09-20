import type { AnalyzeResponse, RunResponse, TranslationAnalysis, TranslationScope } from "@/types/translation";

/** Mirrors the engine's cancellation code so callers can tell it apart from a real failure. */
export const TRANSLATE_CANCELLED = "TRANSLATE_CANCELLED";

const GENERIC_MESSAGE = "翻译失败，请稍后重试。";

/**
 * Fallbacks used when the response carries a code but no usable message. The
 * server messages are preferred when present; neither ever contains the
 * document, a key or a CLI output (S3 contract).
 */
const FALLBACK_MESSAGES: Record<string, string> = {
  TRANSLATE_NOT_CONFIGURED: "尚未配置可用的翻译模型，请先到设置页配置。",
  TRANSLATE_ANALYSIS_STALE: "文档已变化，请重新转换后再翻译。",
  TRANSLATE_PROVIDER_ERROR: "模型调用失败，请重试。",
  TRANSLATE_INVALID_RESPONSE: "模型返回的内容无法解析，请重试。",
  TRANSLATE_TIMEOUT: "翻译超时，请重试。",
  TRANSLATE_BUSY: "已有翻译任务正在进行，请稍候。",
  TRANSLATE_EMPTY_INPUT: "这篇文档没有可翻译的正文。",
  TRANSLATE_INPUT_TOO_LARGE: "正文过长，请先删减或分段转换后再翻译。",
  [TRANSLATE_CANCELLED]: "已取消翻译。",
};

export class TranslationError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "TranslationError";
    this.status = status;
    this.code = code;
  }
}

export function isCancelled(error: unknown): boolean {
  return error instanceof TranslationError && error.code === TRANSLATE_CANCELLED;
}

type ErrorBody = { error?: { code?: unknown; message?: unknown } };

/** Cancellation first: an aborted fetch rejects, so it never reaches the error-body path. */
function toError(status: number, body: ErrorBody | null, signal: AbortSignal | undefined, thrown: unknown): TranslationError {
  if (signal?.aborted || (thrown instanceof DOMException && thrown.name === "AbortError")) {
    return new TranslationError(499, TRANSLATE_CANCELLED, FALLBACK_MESSAGES[TRANSLATE_CANCELLED]);
  }
  if (status === 0) {
    return new TranslationError(0, "TRANSLATE_NETWORK_ERROR", "无法连接本地翻译服务，请重试。");
  }
  const code = typeof body?.error?.code === "string" ? body.error.code : "TRANSLATE_UNKNOWN_ERROR";
  const message = typeof body?.error?.message === "string" && body.error.message
    ? body.error.message
    : FALLBACK_MESSAGES[code] ?? GENERIC_MESSAGE;
  return new TranslationError(status, code, message);
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      // The session header is injected by the app shell; nothing else is sent.
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    throw toError(0, null, signal, error);
  }

  const payload = (await response.json().catch(() => null)) as (T & ErrorBody) | null;
  if (!response.ok) throw toError(response.status, payload, signal, null);
  return payload as T;
}

export function analyzeDocument(
  markdown: string,
  targetLanguage: string,
  signal?: AbortSignal,
): Promise<AnalyzeResponse> {
  return post<AnalyzeResponse>("/api/translate/analyze", { markdown, targetLanguage }, signal);
}

export function translateDocument(
  markdown: string,
  targetLanguage: string,
  analysis: TranslationAnalysis,
  scope: TranslationScope,
  signal?: AbortSignal,
): Promise<RunResponse> {
  return post<RunResponse>("/api/translate/run", { markdown, targetLanguage, analysis, scope }, signal);
}
