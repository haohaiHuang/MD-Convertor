import type { Settings } from "@/types/settings";

export type SecretsResult = { ok: boolean; code?: string; keyStored?: boolean; encryptionAvailable?: boolean };

export type SecretsBridge = {
  set(providerId: string, value: string): Promise<SecretsResult>;
  clear(providerId: string): Promise<SecretsResult>;
  status(): Promise<SecretsResult>;
};

export type OutputResult = { ok: boolean; code?: string; path?: string };

export type OutputBridge = {
  selectDirectory(): Promise<OutputResult>;
  saveFile(dirPath: string, filename: string, content: string): Promise<OutputResult>;
};

export type ProviderModelQuery = { providerId?: string; baseUrl?: string; apiKey?: string };

export type ScannedCli = {
  id: string;
  name: string;
  path: string | null;
  installed: boolean;
};

const SECRET_CODE_MESSAGES: Record<string, string> = {
  SECRETS_UNAVAILABLE: "系统密钥库不可用，无法安全保存密钥。",
  SECRETS_FILE_INVALID: "secrets.json 无法解析，请先处理该文件。",
  INVALID_PROVIDER_ID: "Provider 标识不合法。",
  INVALID_SECRET_VALUE: "密钥内容不合法。",
  IPC_FAILED: "与主进程通信失败。",
  SECRETS_FAILED: "密钥保存失败。",
};

const OUTPUT_CODE_MESSAGES: Record<string, string> = {
  INVALID_DIR_PATH: "保存目录不合法。",
  INVALID_FILENAME: "文件名不合法。",
  INVALID_CONTENT: "文件内容不合法。",
  CANCELLED: "已取消选择。",
  OUTPUT_SAVE_FAILED: "文件写入失败。",
  // The main process reports the raw `error.code` from Node's fs layer, so the real
  // filesystem failures arrive as their own codes rather than the generic one above.
  EACCES: "没有写入权限。",
  EPERM: "没有写入权限。",
  ENOENT: "目录不存在。",
  ENOTDIR: "保存目录不合法。",
  ENOSPC: "磁盘空间不足。",
  EROFS: "目标磁盘为只读，无法写入。",
  IPC_FAILED: "与主进程通信失败。",
};

/** CANCELLED is a user choice, not an error: callers handle it before reaching here. */
export function outputCodeMessage(code: string | undefined, fallback: string): string {
  return (code && OUTPUT_CODE_MESSAGES[code]) || fallback;
}

export function codeMessage(code: string | undefined, fallback: string): string {
  return (code && SECRET_CODE_MESSAGES[code]) || fallback;
}

/** Present only inside the desktop app; browsers and e2e have no preload. */
export function secretsBridge(): SecretsBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = (window as unknown as { mdConvertor?: { secrets?: SecretsBridge } }).mdConvertor?.secrets;
  return bridge ?? null;
}

/** Present only inside the desktop app; browsers and e2e have no preload. */
export function outputBridge(): OutputBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = (window as unknown as { mdConvertor?: { output?: OutputBridge } }).mdConvertor?.output;
  return bridge ?? null;
}

/** The local API guard requires a JSON content type on every route. */
async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message || "操作失败，请稍后重试。");
  }
  return payload as T;
}

export function fetchSettings(): Promise<Settings> {
  return requestJson<Settings>("/api/settings");
}

export function putSettings(next: Settings): Promise<Settings> {
  return requestJson<Settings>("/api/settings", { method: "PUT", body: JSON.stringify(next) });
}

/**
 * Asks the local service for a Provider's model list. A saved provider is
 * addressed by id; a draft (form not saved yet) sends its address and key
 * from the input boxes, and either half may fall back to the saved provider.
 */
export async function fetchProviderModels(query: ProviderModelQuery): Promise<string[]> {
  const payload = await requestJson<{ models: string[] }>("/api/provider/models", {
    method: "POST",
    body: JSON.stringify(query),
  });
  return payload.models;
}

export async function scanLocalClis(): Promise<ScannedCli[]> {
  const payload = await requestJson<{ clis: ScannedCli[] }>("/api/local-clis/scan", { method: "POST" });
  return payload.clis;
}

export async function fetchCliModels(cliId: string): Promise<string[]> {
  const payload = await requestJson<{ models: string[] }>("/api/local-clis/models", {
    method: "POST",
    body: JSON.stringify({ cliId }),
  });
  return payload.models;
}
