import { afterEach, describe, expect, it, vi } from "vitest";
import type { TranslationAnalysis } from "@/types/translation";
import { TranslationError, analyzeDocument, isCancelled, translateDocument } from "./client";

const analysis: TranslationAnalysis = {
  targetLanguage: "en",
  totalChars: 4,
  targetChars: 0,
  ratio: 0,
  blocks: [{ index: 0, language: "other", chars: 4 }],
};

type Call = { url: string; init: RequestInit };

function mockFetch(handler: (call: Call) => Response | Promise<Response>): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const call = { url, init };
    calls.push(call);
    return handler(call);
  });
  return calls;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("analyzeDocument", () => {
  it("posts the markdown and target language and returns the payload", async () => {
    const payload = { analysis, warnings: [], meta: { targetLanguage: "en", model: "m", durationMs: 1 } };
    const calls = mockFetch(() => jsonResponse(200, payload));

    await expect(analyzeDocument("# 标题", "en")).resolves.toEqual(payload);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/translate/analyze");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.body).toBe(JSON.stringify({ markdown: "# 标题", targetLanguage: "en" }));
  });
});

describe("translateDocument", () => {
  it("posts the markdown, target language, analysis and scope", async () => {
    const payload = { markdown: "translated", warnings: [], meta: {} };
    const calls = mockFetch(() => jsonResponse(200, payload));

    await expect(translateDocument("# 标题", "en", analysis, "all")).resolves.toEqual(payload);
    expect(calls[0].url).toBe("/api/translate/run");
    expect(calls[0].init.body).toBe(
      JSON.stringify({ markdown: "# 标题", targetLanguage: "en", analysis, scope: "all" }),
    );
  });
});

describe("request headers", () => {
  it("sends only a JSON content type and never an authorization header", async () => {
    const calls = mockFetch(() => jsonResponse(200, { markdown: "", warnings: [], meta: {} }));

    await translateDocument("x", "en", analysis, "all");
    expect(calls[0].init.headers).toEqual({ "content-type": "application/json" });
  });

  it("keeps request details out of a failed result", async () => {
    mockFetch(() => jsonResponse(502, { error: { code: "TRANSLATE_PROVIDER_ERROR" } }));

    const error = await translateDocument("x", "en", analysis, "all").catch((reason: unknown) => reason);
    expect(String(error)).not.toContain("content-type");
    expect(JSON.stringify(error)).not.toContain("content-type");
  });
});

describe("error handling", () => {
  it("turns a server error body into a displayable code and message", async () => {
    mockFetch(() => jsonResponse(409, { error: { code: "TRANSLATE_NOT_CONFIGURED", message: "尚未选择云端 Provider。" } }));

    const error = await analyzeDocument("x", "en").catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(TranslationError);
    expect(error).toMatchObject({ status: 409, code: "TRANSLATE_NOT_CONFIGURED", message: "尚未选择云端 Provider。" });
  });

  it("uses the built-in message when the body carries only a known code", async () => {
    mockFetch(() => jsonResponse(429, { error: { code: "TRANSLATE_BUSY" } }));

    const error = await analyzeDocument("x", "en").catch((reason: unknown) => reason);
    expect(error).toMatchObject({ status: 429, code: "TRANSLATE_BUSY", message: "已有翻译任务正在进行，请稍候。" });
  });

  it("falls back to a generic message when the body is not JSON", async () => {
    mockFetch(() => new Response("<html>nope</html>", { status: 500 }));

    const error = await analyzeDocument("x", "en").catch((reason: unknown) => reason);
    expect(error).toMatchObject({ status: 500, code: "TRANSLATE_UNKNOWN_ERROR", message: "翻译失败，请稍后重试。" });
  });

  it("reports an unreachable local service as a network error", async () => {
    mockFetch(() => {
      throw new TypeError("Failed to fetch");
    });

    const error = await analyzeDocument("x", "en").catch((reason: unknown) => reason);
    expect(error).toMatchObject({ status: 0, code: "TRANSLATE_NETWORK_ERROR", message: "无法连接本地翻译服务，请重试。" });
  });

  it("reports a server-side cancellation as cancelled", async () => {
    mockFetch(() => jsonResponse(499, { error: { code: "TRANSLATE_CANCELLED" } }));

    const error = await analyzeDocument("x", "en").catch((reason: unknown) => reason);
    expect(isCancelled(error)).toBe(true);
  });
});

describe("abort", () => {
  it("maps an aborted request to a cancelled translation error", async () => {
    mockFetch((call) => new Promise<Response>((_resolve, reject) => {
      call.init.signal?.addEventListener("abort", () => {
        reject(new DOMException("The operation was aborted.", "AbortError"));
      });
    }));
    const controller = new AbortController();

    const pending = analyzeDocument("x", "en", controller.signal);
    controller.abort();

    const error = await pending.catch((reason: unknown) => reason);
    expect(isCancelled(error)).toBe(true);
    expect(error).toMatchObject({ status: 499, code: "TRANSLATE_CANCELLED", message: "已取消翻译。" });
  });

  it("reports a browser-side abort without an aborted signal as cancelled", async () => {
    mockFetch(() => Promise.reject(new DOMException("The operation was aborted.", "AbortError")));

    const error = await analyzeDocument("x", "en").catch((reason: unknown) => reason);
    expect(isCancelled(error)).toBe(true);
  });

  it("treats a non-cancellation error as not cancelled", async () => {
    mockFetch(() => jsonResponse(502, { error: { code: "TRANSLATE_PROVIDER_ERROR" } }));

    const error = await analyzeDocument("x", "en").catch((reason: unknown) => reason);
    expect(isCancelled(error)).toBe(false);
    expect(isCancelled(new Error("boom"))).toBe(false);
  });
});
