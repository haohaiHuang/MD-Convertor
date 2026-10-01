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

export type SystemBridge = {
  /** Opens a directory in Finder; the main process validates the path again. */
  openPath(dirPath: string): Promise<OutputResult>;
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

/** Present only inside the desktop app; browsers and e2e have no preload. */
export function systemBridge(): SystemBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = (window as unknown as { mdConvertor?: { system?: SystemBridge } }).mdConvertor?.system;
  return bridge ?? null;
}

/** The local API guard requires a JSON content type on every route. */
export async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
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

/**
 * The settings response also carries server-resolved defaults (L6): the input directory the
 * scan falls back to when `input.defaultPath` is null. Optional, because a PUT echo or a test
 * stub may omit it — and it is stripped again before PUT, since the API validates root keys.
 */
export type SettingsPayload = Settings & { defaults?: { inputDir: string } };

/**
 * What an unset input directory should read as.
 *
 * The settings card and the scan panel both show this, so the two screens can never drift apart:
 * with no explicit directory the server's resolved `defaults.inputDir` is the honest answer, and
 * only a missing `defaults` (older payloads, partial stubs) falls back to the wording.
 */
export function inputDirLabel(settings: SettingsPayload | null): string {
  return settings?.input.defaultPath ?? settings?.defaults?.inputDir ?? "系统下载目录";
}

/**
 * The settings screen's back capsule, labelled after the screen it returns to. The visible
 * text (including the 「← 」 prefix) is the accessible name — there is deliberately no
 * aria-label — so the e2e specs locate the button by these exact strings. `?from=` is
 * untrusted input: anything outside the known screens falls back to the plain label.
 */
export function backLabel(from: string | null | undefined): string {
  switch (from) {
    case "home":
      return "← 返回首页";
    case "local-docs":
      return "← 返回文档处理";
    case "convert":
      return "← 返回转换";
    default:
      return "← 返回";
  }
}

export function fetchSettings(): Promise<SettingsPayload> {
  return requestJson<SettingsPayload>("/api/settings");
}

export function putSettings(next: SettingsPayload): Promise<SettingsPayload> {
  const body = { ...next } as Record<string, unknown>;
  delete body.defaults;
  return requestJson<SettingsPayload>("/api/settings", { method: "PUT", body: JSON.stringify(body) });
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
