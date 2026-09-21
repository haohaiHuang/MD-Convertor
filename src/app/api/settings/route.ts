import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { validateConvertApiCaller } from "@/lib/api-security";
import { AppError } from "@/lib/errors";
import { SettingsStoreError, readSettings, writeSettings } from "@/lib/settings/store";
import { SettingsValidationError, validateSettings, type Settings } from "@/types/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64 * 1024;

/** Explicit allowlist: only fields the settings UI needs leave this endpoint. */
function sanitizeSettings(settings: Settings): Settings {
  return {
    version: settings.version,
    mode: settings.mode,
    cloud: {
      providers: settings.cloud.providers.map((provider) => ({
        id: provider.id,
        name: provider.name,
        baseUrl: provider.baseUrl,
        keyStored: provider.keyStored,
        models: provider.models,
        selectedModel: provider.selectedModel,
      })),
      activeProviderId: settings.cloud.activeProviderId,
    },
    local: {
      clis: settings.local.clis.map((cli) => ({
        id: cli.id,
        name: cli.name,
        enabled: cli.enabled,
        detectedPath: cli.detectedPath,
        models: cli.models,
        selectedModel: cli.selectedModel,
      })),
      activeCliId: settings.local.activeCliId,
    },
    languages: {
      target: settings.languages.target,
      custom: settings.languages.custom,
    },
    translation: {
      defaultEnabled: settings.translation.defaultEnabled,
    },
    output: {
      defaultPath: settings.output.defaultPath,
      useDefaultPath: settings.output.useDefaultPath,
    },
  };
}

function toSettingsError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof SettingsValidationError) {
    return new AppError(400, "INVALID_SETTINGS", "设置数据无效，请检查后重试。");
  }
  if (error instanceof SettingsStoreError) {
    return new AppError(409, error.code, "设置文件由更高版本的应用写入，当前版本无法读取。");
  }
  return new AppError(500, "SETTINGS_UNAVAILABLE", "设置暂时无法读取或保存。");
}

async function respond(request: Request, run: () => Promise<Settings>): Promise<NextResponse> {
  const requestId = randomUUID();
  const startedAt = Date.now();
  try {
    validateConvertApiCaller(request);
    const settings = await run();
    return NextResponse.json(sanitizeSettings(settings), { status: 200 });
  } catch (error) {
    const appError = toSettingsError(error);
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

export async function GET(request: Request): Promise<NextResponse> {
  return respond(request, readSettings);
}

export async function PUT(request: Request): Promise<NextResponse> {
  return respond(request, async () => {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BODY_BYTES) {
      throw new AppError(413, "REQUEST_TOO_LARGE", "设置内容过大。");
    }
    const body: unknown = await request.json().catch(() => null);
    if (body === null) {
      throw new AppError(400, "INVALID_SETTINGS", "设置数据无效，请检查后重试。");
    }
    const settings = validateSettings(body);
    await writeSettings(settings);
    return settings;
  });
}
