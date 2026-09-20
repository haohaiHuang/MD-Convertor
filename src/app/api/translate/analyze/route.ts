import { NextResponse } from "next/server";
import { handleLocalApi, readJsonBody } from "@/lib/local-api";
import { TRANSLATE_MAX_REQUEST_BYTES } from "@/lib/translate/limits";
import { readAnalyzeBody } from "@/lib/translate/request";
import { analyzeTranslation } from "@/lib/translate/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Labels every block of a document so the UI can decide whether to translate. */
export async function POST(request: Request): Promise<NextResponse> {
  return handleLocalApi(request, async () => {
    const { markdown, targetLanguage } = readAnalyzeBody(await readJsonBody(request, TRANSLATE_MAX_REQUEST_BYTES));
    return analyzeTranslation({ markdown, targetLanguage, signal: request.signal });
  });
}
