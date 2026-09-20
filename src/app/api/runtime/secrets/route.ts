import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { handleLocalApi, readField, readJsonBody } from "@/lib/local-api";
import { setRuntimeSecret } from "@/lib/provider/credentials";
import { isProviderId } from "@/types/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Kept in step with the desktop bridge (`electron/preload-contract.cjs`). */
const MAX_SECRET_LENGTH = 8192;

/**
 * Applies a key that was just saved or cleared in the desktop keychain.
 *
 * The value arrives in memory only: it is never written to disk and never
 * logged, and the request body stays out of every log line.
 */
export async function POST(request: Request): Promise<NextResponse> {
  return handleLocalApi(request, async () => {
    const body = await readJsonBody(request);
    const providerId = readField(body, "providerId");
    if (typeof providerId !== "string" || !isProviderId(providerId)) {
      throw new AppError(400, "INVALID_PROVIDER_ID", "Provider 标识无效。");
    }

    const value = readField(body, "value");
    if (value !== null && typeof value !== "string") {
      throw new AppError(400, "INVALID_SECRET_VALUE", "密钥内容无效。");
    }
    if (typeof value === "string" && (value.trim().length === 0 || value.length > MAX_SECRET_LENGTH)) {
      throw new AppError(400, "INVALID_SECRET_VALUE", "密钥内容无效。");
    }

    setRuntimeSecret(providerId, value);
    return { ok: true };
  });
}
