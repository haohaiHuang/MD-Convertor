import { AppError } from "@/lib/errors";
import { fetchProviderEndpoint, parseProviderUrl, type ProviderEndpointDeps } from "@/lib/provider/endpoint";
import { TRANSLATE_CALL_TIMEOUT_MS } from "../limits";
import type { ModelMessage } from "./provider";

export type OpenAiCallOptions = {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: readonly ModelMessage[];
  deps?: ProviderEndpointDeps;
  timeoutMs?: number;
  signal?: AbortSignal;
};

function failedCall(error: unknown, host: string, signal: AbortSignal | undefined): AppError {
  if (error instanceof AppError) return error;
  if (signal?.aborted) {
    return new AppError(499, "TRANSLATE_CANCELLED", "已取消翻译。");
  }
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return new AppError(504, "TRANSLATE_TIMEOUT", "模型调用超时，请稍后重试。");
  }
  return new AppError(502, "TRANSLATE_PROVIDER_ERROR", `无法连接 Provider ${host}。`);
}

/**
 * Non-streaming OpenAI-compatible chat completion (FSD §6).
 *
 * Error messages carry only the status code and the endpoint host: never the
 * key, the prompt or the provider response body.
 */
export async function callOpenAiCompatible({
  baseUrl,
  apiKey,
  model,
  messages,
  deps,
  timeoutMs = TRANSLATE_CALL_TIMEOUT_MS,
  signal,
}: OpenAiCallOptions): Promise<string> {
  const key = apiKey?.trim();
  if (!key) {
    throw new AppError(409, "TRANSLATE_NOT_CONFIGURED", "尚未配置该 Provider 的密钥。");
  }

  const root = parseProviderUrl(baseUrl);
  const endpoint = new URL("chat/completions", root.href.endsWith("/") ? root.href : `${root.href}/`);
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetchProviderEndpoint(
      endpoint,
      {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ model, messages, stream: false }),
        signal: combined,
      },
      deps,
    );
  } catch (error) {
    throw failedCall(error, endpoint.host, signal);
  }

  if (!response.ok) {
    throw new AppError(502, "TRANSLATE_PROVIDER_ERROR", `Provider ${endpoint.host} 返回 HTTP ${response.status}。`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    // The body streams in while the call runs, so a deadline can land mid-read.
    // Without this the abort would be swallowed and reported as an unreadable
    // answer instead of a timeout (see the callers above for the same mapping).
    if (combined.aborted) throw failedCall(error, endpoint.host, signal);
    payload = null;
  }

  const content = (payload as { choices?: { message?: { content?: unknown } }[] } | null)?.choices?.[0]?.message
    ?.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new AppError(502, "TRANSLATE_PROVIDER_ERROR", `Provider ${endpoint.host} 返回了无法识别的回答。`);
  }

  return content;
}
