import { NextResponse } from "next/server";
import { handleLocalApi, readJsonBody } from "@/lib/local-api";
import { TRANSLATE_MAX_REQUEST_BYTES } from "@/lib/translate/limits";
import { readRunBody } from "@/lib/translate/request";
import { runTranslation } from "@/lib/translate/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Translates the blocks selected by `scope` and returns the rebuilt document. */
export async function POST(request: Request): Promise<NextResponse> {
  return handleLocalApi(request, async () => {
    const { markdown, targetLanguage, analysis, scope } = readRunBody(
      await readJsonBody(request, TRANSLATE_MAX_REQUEST_BYTES),
    );
    return runTranslation({ markdown, targetLanguage, analysis, scope, signal: request.signal });
  });
}
