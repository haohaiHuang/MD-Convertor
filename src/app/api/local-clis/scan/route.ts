import { NextResponse } from "next/server";
import { handleLocalApi } from "@/lib/local-api";
import { scanLocalClis } from "@/lib/local-cli/scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reports which local agent CLIs are installed and where. */
export async function POST(request: Request): Promise<NextResponse> {
  return handleLocalApi(request, async () => ({ clis: await scanLocalClis() }));
}
