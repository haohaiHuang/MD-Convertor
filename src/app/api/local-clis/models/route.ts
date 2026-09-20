import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { handleLocalApi, readField, readJsonBody } from "@/lib/local-api";
import { listLocalCliModels } from "@/lib/local-cli/models";
import { findCliDefinition } from "@/lib/local-cli/registry";
import { findCliExecutable } from "@/lib/local-cli/scan";
import { readSettings } from "@/lib/settings/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lists the models of one local agent CLI, using the path from the last scan. */
export async function POST(request: Request): Promise<NextResponse> {
  return handleLocalApi(request, async () => {
    const cliId = readField(await readJsonBody(request), "cliId");
    if (typeof cliId !== "string" || !findCliDefinition(cliId)) {
      throw new AppError(400, "INVALID_CLI_ID", "未知的本地 CLI。");
    }

    const settings = await readSettings();
    const detectedPath = settings.local.clis.find((entry) => entry.id === cliId)?.detectedPath?.trim();
    const executablePath = detectedPath || (await findCliExecutable(cliId));
    if (!executablePath) {
      throw new AppError(409, "TRANSLATE_NOT_CONFIGURED", `尚未检测到 ${cliId}。`);
    }

    return { models: await listLocalCliModels({ cliId, executablePath }) };
  });
}
