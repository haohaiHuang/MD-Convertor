import { NextResponse } from "next/server";
import { readField, readJsonBody, handleLocalApi } from "@/lib/local-api";
import { scanLocalDocs } from "@/lib/local-docs/scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only: lists the `.md` files of a directory (one level) with each one's dedup state. */
export async function POST(request: Request): Promise<NextResponse> {
  return handleLocalApi(request, async () => {
    const body = await readJsonBody(request);
    return scanLocalDocs({
      dirPath: readField(body, "dirPath"),
      outputDir: readField(body, "outputDir"),
    });
  });
}
