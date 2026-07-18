import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  convert: vi.fn(),
  release: vi.fn(),
  acquire: vi.fn(),
}));

vi.mock("@/lib/convert", () => ({ convertUrlToMarkdown: mocks.convert }));
vi.mock("@/lib/rate-limit", () => ({
  acquireConversionSlot: mocks.acquire,
  clientIpFromHeaders: () => "route-test",
}));

import { POST } from "./route";

function convertRequest(options: { headers?: Record<string, string>; signal?: AbortSignal } = {}): Request {
  return new Request("http://127.0.0.1:3210/api/convert", {
    method: "POST",
    headers: { "content-type": "application/json", ...options.headers },
    body: JSON.stringify({ url: "https://example.com/article" }),
    signal: options.signal,
  });
}

beforeEach(() => {
  mocks.convert.mockReset();
  mocks.release.mockReset();
  mocks.acquire.mockReset();
  mocks.acquire.mockReturnValue(mocks.release);
  mocks.convert.mockResolvedValue({
    title: "测试文章",
    filename: "测试文章.md",
    markdown: "# 测试文章\n",
    warnings: [],
    meta: {
      sourceUrl: "https://example.com/article",
      convertedAt: "2026-07-18T00:00:00.000Z",
      extractionMode: "direct",
      outputBytes: 16,
      textChars: 4,
      sourceImageCount: 0,
      embeddedImageCount: 0,
      omittedImageCount: 0,
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /api/convert", () => {
  it("rejects a cross-origin request before starting conversion", async () => {
    const response = await POST(convertRequest({ headers: { origin: "https://attacker.example" } }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_API_ORIGIN" } });
    expect(mocks.convert).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, "INVALID_SESSION_TOKEN"],
    ["wrong-token", "INVALID_SESSION_TOKEN"],
  ])("rejects a missing or incorrect application token", async (token, code) => {
    vi.stubEnv("MD_CONVERTOR_SESSION_TOKEN", "route-session-token");
    const headers: Record<string, string> = {};
    if (token) headers["x-md-convertor-token"] = token;
    const response = await POST(convertRequest({ headers }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code } });
    expect(mocks.convert).not.toHaveBeenCalled();
  });

  it("accepts the correct application token and releases the slot", async () => {
    vi.stubEnv("MD_CONVERTOR_SESSION_TOKEN", "route-session-token");
    const response = await POST(convertRequest({
      headers: { "x-md-convertor-token": "route-session-token" },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ filename: "测试文章.md" });
    expect(mocks.convert).toHaveBeenCalledOnce();
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("reports the server deadline as a 504 timeout", async () => {
    const timeoutError = new Error("deadline");
    timeoutError.name = "TimeoutError";
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(AbortSignal.abort(timeoutError));
    mocks.convert.mockImplementation(async (_url: string, signal: AbortSignal) => {
      throw signal.reason;
    });

    const response = await POST(convertRequest());

    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ error: { code: "CONVERSION_TIMEOUT" } });
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("distinguishes an explicit client cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    mocks.convert.mockRejectedValue(new DOMException("stopped", "AbortError"));

    const response = await POST(convertRequest({ signal: controller.signal }));

    expect(response.status).toBe(499);
    expect(await response.json()).toMatchObject({ error: { code: "CLIENT_ABORTED" } });
    expect(mocks.release).toHaveBeenCalledOnce();
  });
});
