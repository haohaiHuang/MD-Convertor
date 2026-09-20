import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "@/types/settings";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  listModels: vi.fn(),
  findExecutable: vi.fn(),
}));

vi.mock("@/lib/settings/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/settings/store")>();
  return { ...actual, readSettings: mocks.read };
});

vi.mock("@/lib/local-cli/models", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/local-cli/models")>();
  return { ...actual, listLocalCliModels: mocks.listModels };
});

vi.mock("@/lib/local-cli/scan", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/local-cli/scan")>();
  return { ...actual, findCliExecutable: mocks.findExecutable };
});

import { POST } from "./route";

function settingsWithCli(detectedPath: string | null): Settings {
  const settings = structuredClone(DEFAULT_SETTINGS);
  settings.mode = "local";
  settings.local.clis[0].detectedPath = detectedPath;
  settings.local.activeCliId = "pi";
  return settings;
}

function cliModelsRequest(body: unknown = { cliId: "pi" }, headers: Record<string, string> = {}): Request {
  return new Request("http://127.0.0.1:3210/api/local-clis/models", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.read.mockReset();
  mocks.listModels.mockReset();
  mocks.findExecutable.mockReset();
  mocks.read.mockResolvedValue(settingsWithCli("/usr/local/bin/pi"));
  mocks.listModels.mockResolvedValue(["agnes-2.5-flash"]);
  mocks.findExecutable.mockResolvedValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /api/local-clis/models caller validation", () => {
  it("rejects a cross-origin request", async () => {
    const response = await POST(cliModelsRequest(undefined, { origin: "https://attacker.example" }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_API_ORIGIN" } });
    expect(mocks.listModels).not.toHaveBeenCalled();
  });

  it("requires the application token when one is configured", async () => {
    vi.stubEnv("MD_CONVERTOR_SESSION_TOKEN", "route-session-token");
    const response = await POST(cliModelsRequest());
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_SESSION_TOKEN" } });
  });

  it("rejects a non-JSON content type", async () => {
    const response = await POST(new Request("http://127.0.0.1:3210/api/local-clis/models", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_CONTENT_TYPE" } });
  });
});

describe("POST /api/local-clis/models", () => {
  it("uses the path recorded by the last scan", async () => {
    const response = await POST(cliModelsRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ models: ["agnes-2.5-flash"] });
    expect(mocks.listModels).toHaveBeenCalledWith({ cliId: "pi", executablePath: "/usr/local/bin/pi" });
    expect(mocks.findExecutable).not.toHaveBeenCalled();
  });

  it("scans PATH when settings hold no path yet", async () => {
    mocks.read.mockResolvedValue(settingsWithCli(null));
    mocks.findExecutable.mockResolvedValue("/opt/homebrew/bin/pi");

    const response = await POST(cliModelsRequest());
    expect(response.status).toBe(200);
    expect(mocks.findExecutable).toHaveBeenCalledWith("pi");
    expect(mocks.listModels).toHaveBeenCalledWith({ cliId: "pi", executablePath: "/opt/homebrew/bin/pi" });
  });

  it("reports a missing CLI as 409 when settings hold no path and PATH has none", async () => {
    mocks.read.mockResolvedValue(settingsWithCli(null));
    const response = await POST(cliModelsRequest());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "TRANSLATE_NOT_CONFIGURED" } });
    expect(mocks.listModels).not.toHaveBeenCalled();
  });

  it.each([
    ["a missing cli id", {}],
    ["an unknown cli id", { cliId: "nope" }],
    ["a non-string cli id", { cliId: 7 }],
  ])("rejects %s", async (_label, body) => {
    const response = await POST(cliModelsRequest(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_CLI_ID" } });
  });

  it("rejects a malformed body", async () => {
    const response = await POST(cliModelsRequest("{"));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_REQUEST_BODY" } });
  });

  it("passes a CLI failure through without echoing CLI output", async () => {
    const { AppError } = await import("@/lib/errors");
    mocks.listModels.mockRejectedValue(new AppError(502, "TRANSLATE_PROVIDER_ERROR", "pi 无法列出模型（退出码 2）。"));

    const response = await POST(cliModelsRequest());
    const text = await response.text();
    expect(response.status).toBe(502);
    expect(JSON.parse(text)).toMatchObject({ error: { code: "TRANSLATE_PROVIDER_ERROR" } });
    expect(text).not.toContain("--list-models");
  });
});
