import { AppError } from "@/lib/errors";
import { fetchProviderEndpoint, parseProviderUrl, type ProviderEndpointDeps } from "./endpoint";

const REQUEST_TIMEOUT_MS = 10_000;

export type ListProviderModelsOptions = {
  baseUrl: string;
  apiKey: string;
  deps?: ProviderEndpointDeps;
  timeoutMs?: number;
};

/**
 * Lists the models of an OpenAI-compatible endpoint (`GET {base}/models`).
 *
 * Failures never echo the key, the request or the provider response body: the
 * message carries only the HTTP status and the endpoint host.
 */
export async function listProviderModels({
  baseUrl,
  apiKey,
  deps,
  timeoutMs = REQUEST_TIMEOUT_MS,
}: ListProviderModelsOptions): Promise<string[]> {
  const key = apiKey?.trim();
  if (!key) {
    throw new AppError(409, "TRANSLATE_NOT_CONFIGURED", "尚未配置该 Provider 的密钥。");
  }

  const root = parseProviderUrl(baseUrl);
  const endpoint = new URL("models", root.href.endsWith("/") ? root.href : `${root.href}/`);

  let response: Response;
  try {
    response = await fetchProviderEndpoint(
      endpoint,
      {
        method: "GET",
        headers: { authorization: `Bearer ${key}`, accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      },
      deps,
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(502, "TRANSLATE_PROVIDER_ERROR", `无法连接 Provider ${endpoint.host}。`);
  }

  if (!response.ok) {
    throw new AppError(502, "TRANSLATE_PROVIDER_ERROR", `Provider ${endpoint.host} 返回 HTTP ${response.status}。`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const entries =
    payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)
      ? ((payload as { data: unknown[] }).data)
      : null;
  if (!entries) {
    throw new AppError(502, "TRANSLATE_PROVIDER_ERROR", `Provider ${endpoint.host} 返回了无法识别的模型列表。`);
  }

  const models: string[] = [];
  for (const entry of entries) {
    const id = entry && typeof entry === "object" ? (entry as { id?: unknown }).id : null;
    if (typeof id !== "string") {
      continue;
    }
    const trimmed = id.trim();
    if (trimmed && !models.includes(trimmed)) {
      models.push(trimmed);
    }
  }

  return models;
}
