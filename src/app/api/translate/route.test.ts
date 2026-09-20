import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "@/types/settings";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  analyze: vi.fn(),
  run: vi.fn(),
}));

vi.mock("@/lib/settings/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/settings/store")>();
  return { ...actual, readSettings: mocks.read };
});

vi.mock("@/lib/translate/run", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/translate/run")>();
  return { ...actual, analyzeTranslation: mocks.analyze, runTranslation: mocks.run };
});

import { POST as analyzeRoute } from "./analyze/route";
import { POST as runRoute } from "./run/route";

type Route = (request: Request) => Promise<Response>;
type RequestBuilder = (body?: unknown, headers?: Record<string, string>) => Request;

const ROUTES: readonly (readonly [string, Route])[] = [
  ["analyze", analyzeRoute],
  ["run", runRoute],
];
const ROUTES_WITH_BUILDER: readonly (readonly [string, Route, RequestBuilder])[] = [
  ["analyze", analyzeRoute, analyzeRequest],
  ["run", runRoute, runRequest],
];

const MARKDOWN = "# Title\n\nEnglish paragraph.\n";
const ANALYSIS = {
  targetLanguage: "zh-Hans",
  totalChars: 18,
  targetChars: 0,
  ratio: 0,
  blocks: [
    { index: 0, language: "other", chars: 5 },
    { index: 1, language: "skipped", chars: 0 },
    { index: 2, language: "other", chars: 18 },
  ],
};

function settingsWithProvider(): Settings {
  const settings = structuredClone(DEFAULT_SETTINGS);
  settings.cloud.providers.push({
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.example.com/v1",
    keyStored: false,
    models: ["model-a"],
    selectedModel: "model-a",
  });
  settings.cloud.activeProviderId = "openai";
  return settings;
}

function post(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`http://127.0.0.1:3210${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function analyzeRequest(body: unknown = { markdown: MARKDOWN, targetLanguage: "zh-Hans" }, headers = {}): Request {
  return post("/api/translate/analyze", body, headers);
}

function runRequest(
  body: unknown = { markdown: MARKDOWN, targetLanguage: "zh-Hans", analysis: ANALYSIS, scope: "all" },
  headers = {},
): Request {
  return post("/api/translate/run", body, headers);
}

beforeEach(() => {
  mocks.read.mockReset();
  mocks.read.mockResolvedValue(settingsWithProvider());
  mocks.analyze.mockReset();
  mocks.analyze.mockResolvedValue({
    analysis: ANALYSIS,
    warnings: [],
    meta: { targetLanguage: "zh-Hans", model: "model-a", durationMs: 12 },
  });
  mocks.run.mockReset();
  mocks.run.mockResolvedValue({
    markdown: "# 标题\n",
    warnings: [],
    meta: { targetLanguage: "zh-Hans", model: "model-a", scope: "all", batches: 1, translatedBlocks: 2, durationMs: 30 },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("translation endpoints caller validation", () => {
  it.each(ROUTES_WITH_BUILDER)("rejects a cross-origin %s request", async (_name, route, build) => {
    const response = await route(build(undefined, { origin: "https://attacker.example" }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_API_ORIGIN" } });
  });

  it.each(ROUTES_WITH_BUILDER)("requires the session token for %s", async (_name, route, build) => {
    vi.stubEnv("MD_CONVERTOR_SESSION_TOKEN", "route-session-token");
    const response = await route(build());
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_SESSION_TOKEN" } });
    expect(mocks.analyze).not.toHaveBeenCalled();
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it.each(ROUTES)("rejects a non-JSON content type for %s", async (_name, route) => {
    const response = await route(
      new Request("http://127.0.0.1:3210/api/translate/x", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "{}",
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_CONTENT_TYPE" } });
  });

  it.each(ROUTES)("refuses a body above the translate ceiling for %s", async (_name, route) => {
    // The translate ceiling is 40 MiB (markdown plus base64 images); a declared
    // length above it is rejected before the body is read.
    const response = await route(
      new Request("http://127.0.0.1:3210/api/translate/x", {
        method: "POST",
        headers: { "content-type": "application/json", "content-length": String(41 * 1024 * 1024) },
        body: "{}",
      }),
    );
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: { code: "REQUEST_TOO_LARGE" } });
  });
});

describe("POST /api/translate/analyze", () => {
  it("returns the analysis, warnings and meta", async () => {
    const response = await analyzeRoute(analyzeRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      analysis: ANALYSIS,
      warnings: [],
      meta: { targetLanguage: "zh-Hans", model: "model-a", durationMs: 12 },
    });
    expect(mocks.analyze).toHaveBeenCalledWith(
      expect.objectContaining({ markdown: MARKDOWN, targetLanguage: "zh-Hans" }),
    );
  });

  it("passes the request signal so a cancelled client stops the work", async () => {
    await analyzeRoute(analyzeRequest());
    const call = mocks.analyze.mock.calls[0]?.[0] as { signal?: AbortSignal };
    expect(call.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ["missing markdown", { targetLanguage: "zh-Hans" }, "INVALID_REQUEST_BODY"],
    ["markdown is not text", { markdown: 42, targetLanguage: "zh-Hans" }, "INVALID_REQUEST_BODY"],
    ["missing target language", { markdown: MARKDOWN }, "INVALID_TARGET_LANGUAGE"],
    ["target language is not BCP-47", { markdown: MARKDOWN, targetLanguage: "not a tag" }, "INVALID_TARGET_LANGUAGE"],
  ])("rejects a request with %s", async (_name, body, code) => {
    const response = await analyzeRoute(analyzeRequest(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code } });
    expect(mocks.analyze).not.toHaveBeenCalled();
  });
});

describe("POST /api/translate/run", () => {
  it("returns the translated markdown with meta", async () => {
    const response = await runRoute(runRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ markdown: "# 标题\n", warnings: [] });
    expect(mocks.run).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "all", analysis: ANALYSIS, targetLanguage: "zh-Hans" }),
    );
  });

  it.each([
    ["missing scope", { markdown: MARKDOWN, targetLanguage: "zh-Hans", analysis: ANALYSIS }, "INVALID_SCOPE"],
    ["unknown scope", { markdown: MARKDOWN, targetLanguage: "zh-Hans", analysis: ANALYSIS, scope: "some" }, "INVALID_SCOPE"],
    ["missing analysis", { markdown: MARKDOWN, targetLanguage: "zh-Hans", scope: "all" }, "INVALID_ANALYSIS"],
    [
      "analysis without blocks",
      { markdown: MARKDOWN, targetLanguage: "zh-Hans", scope: "all", analysis: { targetLanguage: "zh-Hans" } },
      "INVALID_ANALYSIS",
    ],
    [
      "analysis block with an unknown language",
      {
        markdown: MARKDOWN,
        targetLanguage: "zh-Hans",
        scope: "all",
        analysis: { ...ANALYSIS, blocks: [{ index: 0, language: "klingon", chars: 1 }] },
      },
      "INVALID_ANALYSIS",
    ],
    [
      "analysis without totals",
      {
        markdown: MARKDOWN,
        targetLanguage: "zh-Hans",
        scope: "all",
        analysis: { targetLanguage: "zh-Hans", blocks: [{ index: 0, language: "other", chars: 1 }] },
      },
      "INVALID_ANALYSIS",
    ],
    [
      "analysis block with a non-numeric index",
      {
        markdown: MARKDOWN,
        targetLanguage: "zh-Hans",
        scope: "all",
        analysis: { ...ANALYSIS, blocks: [{ index: "0", language: "other", chars: 1 }] },
      },
      "INVALID_ANALYSIS",
    ],
  ])("rejects a request with %s", async (_name, body, code) => {
    const response = await runRoute(runRequest(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code } });
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("propagates a stale analysis", async () => {
    const { AppError } = await import("@/lib/errors");
    mocks.run.mockRejectedValue(new AppError(409, "TRANSLATE_ANALYSIS_STALE", "文档已变化，请重新判定。"));
    const response = await runRoute(runRequest());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "TRANSLATE_ANALYSIS_STALE" } });
  });

  it.each([
    [400, "TRANSLATE_EMPTY_INPUT"],
    [413, "TRANSLATE_INPUT_TOO_LARGE"],
    [429, "TRANSLATE_BUSY"],
    [502, "TRANSLATE_PROVIDER_ERROR"],
    [504, "TRANSLATE_TIMEOUT"],
  ])("maps engine error %i %s without leaking the body", async (status, code) => {
    const { AppError } = await import("@/lib/errors");
    mocks.run.mockRejectedValue(new AppError(status, code, "无法完成翻译。"));
    const response = await runRoute(runRequest());
    expect(response.status).toBe(status);
    const payload = (await response.json()) as { error: { code: string; message: string } };
    expect(payload.error.code).toBe(code);
    expect(JSON.stringify(payload)).not.toContain(MARKDOWN);
  });

  it("answers with a generic error for an unexpected failure", async () => {
    mocks.run.mockRejectedValue(new Error("boom"));
    const response = await runRoute(runRequest());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: { code: "INTERNAL_ERROR" } });
  });
});
