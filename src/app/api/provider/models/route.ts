import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { handleLocalApi, readField, readJsonBody } from "@/lib/local-api";
import { resolveProviderKey } from "@/lib/provider/credentials";
import { listProviderModels } from "@/lib/provider/models";
import { readSettings } from "@/lib/settings/store";
import { isProviderId, type CloudProviderSettings } from "@/types/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lists the models of a cloud Provider.
 *
 * A saved provider is addressed by id alone. A draft provider — the settings
 * page pulls models before its form has all four fields — sends the address
 * and/or key from its input boxes instead; a missing half falls back to the
 * saved provider, so the request never needs the keychain read into the page.
 */
export async function POST(request: Request): Promise<NextResponse> {
  return handleLocalApi(request, async () => {
    const body = await readJsonBody(request);
    const providerId = readField(body, "providerId");
    const draftBaseUrl = readField(body, "baseUrl");
    const draftKey = readField(body, "apiKey");
    const usesDraft = draftBaseUrl !== undefined || draftKey !== undefined;

    if (!usesDraft) {
      const saved = await requireProvider(providerId);
      const resolved = resolveProviderKey({ id: saved.id });
      if (!resolved) {
        throw new AppError(409, "TRANSLATE_NOT_CONFIGURED", "尚未配置该 Provider 的密钥。");
      }
      return { models: await listProviderModels({ baseUrl: saved.baseUrl, apiKey: resolved.key }) };
    }

    const saved = typeof providerId === "string" && isProviderId(providerId)
      ? (await readSettings()).cloud.providers.find((entry) => entry.id === providerId) ?? null
      : null;
    const baseUrl = typeof draftBaseUrl === "string" ? draftBaseUrl : saved?.baseUrl ?? "";
    const typedKey = typeof draftKey === "string" ? draftKey.trim() : "";
    const apiKey = typedKey || (resolveProviderKey({ id: saved?.id ?? "" })?.key ?? "");
    if (!apiKey) {
      throw new AppError(409, "TRANSLATE_NOT_CONFIGURED", "请先填写 API 密钥。");
    }

    return { models: await listProviderModels({ baseUrl, apiKey }) };
  });
}

async function requireProvider(providerId: unknown): Promise<CloudProviderSettings> {
  if (typeof providerId !== "string" || !isProviderId(providerId)) {
    throw new AppError(400, "INVALID_PROVIDER_ID", "Provider 标识无效。");
  }

  const settings = await readSettings();
  const provider = settings.cloud.providers.find((entry) => entry.id === providerId);
  if (!provider) {
    throw new AppError(400, "INVALID_PROVIDER_ID", "该 Provider 不存在。");
  }
  return provider;
}
