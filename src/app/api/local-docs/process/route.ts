import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { readField, readJsonBody, handleLocalApi } from "@/lib/local-api";
import { processLocalDoc } from "@/lib/local-docs/process";
import { readSettings } from "@/lib/settings/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only: returns the processed Markdown; the renderer writes it through the output bridge. */
export async function POST(request: Request): Promise<NextResponse> {
  return handleLocalApi(request, async () => {
    const body = await readJsonBody(request);
    const settings = await readSettings();
    const outputDir = readField(body, "outputPath") ?? settings.output.defaultPath ?? undefined;
    if (outputDir === undefined) {
      throw new AppError(400, "INVALID_DIR_PATH", "尚未设置输出目录，请先选择要写入的目录。");
    }

    return processLocalDoc({
      sourcePath: readField(body, "path"),
      outputDir,
      force: readField(body, "force") === true,
      translate: readField(body, "translate") === true,
      targetLanguage: readField(body, "targetLanguage") ?? settings.languages.target,
      signal: request.signal,
    });
  });
}
