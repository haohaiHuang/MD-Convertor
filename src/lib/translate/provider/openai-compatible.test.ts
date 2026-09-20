import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import type { ProviderFetch, ProviderLookup } from "@/lib/provider/endpoint";
import { callOpenAiCompatible } from "./openai-compatible";

const KEY = "sk-test-0123456789";

/** Tests never touch DNS: a public address keeps the endpoint policy happy. */
const LOOKUP: ProviderLookup = async () => [{ address: "93.184.216.34", family: 4 }];

const MESSAGES = [
  { role: "system" as const, content: "system prompt" },
  { role: "user" as const, content: "user prompt" },
];

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

function recordingFetch(response: Response | (() => Promise<Response>)): {
  fetch: ProviderFetch;
  calls: { url: URL; init: RequestInit }[];
} {
  const calls: { url: URL; init: RequestInit }[] = [];
  const fetchImpl: ProviderFetch = async (url, init) => {
    calls.push({ url, init });
    return typeof response === "function" ? response() : response;
  };
  return { fetch: fetchImpl, calls };
}

function expectAppError(run: () => Promise<unknown>): Promise<AppError> {
  return run().then(
    () => {
      throw new Error("expected an AppError");
    },
    (error: unknown) => {
      if (error instanceof AppError) return error;
      throw error;
    },
  );
}

describe("callOpenAiCompatible", () => {
  it("posts a non-streaming chat completion with the bearer key", async () => {
    const { fetch, calls } = recordingFetch(
      jsonResponse({ choices: [{ message: { role: "assistant", content: "译文" } }] }),
    );

    await expect(
      callOpenAiCompatible({
        baseUrl: "https://api.example.com/v1",
        apiKey: KEY,
        model: "model-a",
        messages: MESSAGES,
        deps: { fetch, lookup: LOOKUP },
      }),
    ).resolves.toBe("译文");

    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.url.href).toBe("https://api.example.com/v1/chat/completions");
    expect(call?.init.method).toBe("POST");
    expect(new Headers(call?.init.headers).get("authorization")).toBe(`Bearer ${KEY}`);
    expect(new Headers(call?.init.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(String(call?.init.body))).toEqual({
      model: "model-a",
      messages: MESSAGES,
      stream: false,
    });
  });

  it("keeps the key out of the request body and the error message", async () => {
    const { fetch, calls } = recordingFetch(jsonResponse({ error: "nope" }, 500));
    const error = await expectAppError(() =>
      callOpenAiCompatible({
        baseUrl: "http://127.0.0.1:11434/v1",
        apiKey: KEY,
        model: "model-a",
        messages: MESSAGES,
        deps: { fetch, lookup: LOOKUP },
      }),
    );
    expect(String(calls[0]?.init.body)).not.toContain(KEY);
    expect(error).toMatchObject({ status: 502, code: "TRANSLATE_PROVIDER_ERROR" });
    expect(error.message).toContain("500");
    expect(error.message).toContain("127.0.0.1");
    expect(error.message).not.toContain(KEY);
  });

  it("maps a network failure to a provider error with the host only", async () => {
    const fetch: ProviderFetch = async () => {
      throw new TypeError("fetch failed");
    };
    const error = await expectAppError(() =>
      callOpenAiCompatible({
        baseUrl: "https://api.example.com",
        apiKey: KEY,
        model: "model-a",
        messages: MESSAGES,
        deps: { fetch, lookup: LOOKUP },
      }),
    );
    expect(error).toMatchObject({ status: 502, code: "TRANSLATE_PROVIDER_ERROR" });
    expect(error.message).toContain("api.example.com");
    expect(error.message).not.toContain(KEY);
  });

  it("maps a timed out call to TRANSLATE_TIMEOUT", async () => {
    const fetch: ProviderFetch = async () => {
      throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    };
    const error = await expectAppError(() =>
      callOpenAiCompatible({
        baseUrl: "https://api.example.com",
        apiKey: KEY,
        model: "model-a",
        messages: MESSAGES,
        timeoutMs: 5,
        deps: { fetch, lookup: LOOKUP },
      }),
    );
    expect(error).toMatchObject({ status: 504, code: "TRANSLATE_TIMEOUT" });
  });

  it("maps a timeout that lands while the body is being read to TRANSLATE_TIMEOUT", async () => {
    let combined: AbortSignal | null = null;
    const response = {
      ok: true,
      status: 200,
      json: () =>
        new Promise((_resolve, reject) => {
          combined?.addEventListener("abort", () =>
            reject(Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" })),
          );
        }),
    } as unknown as Response;
    const fetch: ProviderFetch = async (_url, init) => {
      combined = init.signal ?? null;
      return response;
    };

    const error = await expectAppError(() =>
      callOpenAiCompatible({
        baseUrl: "https://api.example.com",
        apiKey: KEY,
        model: "model-a",
        messages: MESSAGES,
        timeoutMs: 5,
        deps: { fetch, lookup: LOOKUP },
      }),
    );
    expect(error).toMatchObject({ status: 504, code: "TRANSLATE_TIMEOUT" });
  });

  it("maps an aborted caller to a cancelled task", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetch: ProviderFetch = async () => {
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    };
    const error = await expectAppError(() =>
      callOpenAiCompatible({
        baseUrl: "https://api.example.com",
        apiKey: KEY,
        model: "model-a",
        messages: MESSAGES,
        signal: controller.signal,
        deps: { fetch, lookup: LOOKUP },
      }),
    );
    expect(error).toMatchObject({ status: 499, code: "TRANSLATE_CANCELLED" });
  });

  it.each([
    ["missing choices", jsonResponse({ choices: [] })],
    ["no content string", jsonResponse({ choices: [{ message: {} }] })],
    ["not json", new Response("<html>nope</html>", { status: 200 })],
  ])("rejects a payload with %s", async (_name, response) => {
    const { fetch } = recordingFetch(response);
    const error = await expectAppError(() =>
      callOpenAiCompatible({
        baseUrl: "https://api.example.com",
        apiKey: KEY,
        model: "model-a",
        messages: MESSAGES,
        deps: { fetch, lookup: LOOKUP },
      }),
    );
    expect(error).toMatchObject({ status: 502, code: "TRANSLATE_PROVIDER_ERROR" });
  });

  it("refuses to call without a key", async () => {
    const fetch = vi.fn<ProviderFetch>();
    const error = await expectAppError(() =>
      callOpenAiCompatible({
        baseUrl: "https://api.example.com",
        apiKey: "  ",
        model: "model-a",
        messages: MESSAGES,
        deps: { fetch, lookup: LOOKUP },
      }),
    );
    expect(error).toMatchObject({ status: 409, code: "TRANSLATE_NOT_CONFIGURED" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("stops at a blocked target before the request leaves the process", async () => {
    const { fetch, calls } = recordingFetch(jsonResponse({}));
    const error = await expectAppError(() =>
      callOpenAiCompatible({
        baseUrl: "http://169.254.169.254/v1",
        apiKey: KEY,
        model: "model-a",
        messages: MESSAGES,
        deps: { fetch, lookup: LOOKUP },
      }),
    );
    expect(error).toMatchObject({ status: 403, code: "PROVIDER_TARGET_BLOCKED" });
    expect(calls).toHaveLength(0);
  });
});
