import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({
  validate: vi.fn(),
  readBody: vi.fn(),
  convert: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
}));

vi.mock("@/lib/api-security", () => ({ validateConvertApiCaller: mocks.validate }));
vi.mock("@/lib/paste-request", () => ({
  MAX_PASTE_REQUEST_BYTES: 5 * 1024 * 1024,
  readPastedRequestBody: mocks.readBody,
  pasteRequestHasContent: (value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const candidate = value as { text?: unknown; html?: unknown; sourceUrl?: unknown };
    if (candidate.text !== undefined && typeof candidate.text !== "string") return false;
    if (candidate.html !== undefined && typeof candidate.html !== "string") return false;
    if (candidate.sourceUrl !== undefined && typeof candidate.sourceUrl !== "string") return false;
    return (typeof candidate.text === "string" && candidate.text.trim().length > 0)
      || (typeof candidate.html === "string" && candidate.html.trim().length > 0);
  },
}));
vi.mock("@/lib/convert-paste", () => ({ convertPastedContent: mocks.convert }));
vi.mock("@/lib/rate-limit", () => ({
  acquireConversionSlot: mocks.acquire,
  clientIpFromHeaders: () => "paste-route-test",
}));

import { POST } from "./route";

function request(options: { headers?: Record<string, string>; signal?: AbortSignal } = {}): Request {
  return new Request("http://127.0.0.1:3210/api/convert-paste", {
    method: "POST",
    headers: { "content-type": "application/json", ...options.headers },
    body: "{}",
    signal: options.signal,
  });
}

beforeEach(() => {
  mocks.validate.mockReset();
  mocks.readBody.mockReset();
  mocks.convert.mockReset();
  mocks.acquire.mockReset();
  mocks.release.mockReset();
  mocks.validate.mockImplementation(() => undefined);
  mocks.readBody.mockResolvedValue(JSON.stringify({ text: "粘贴正文" }));
  mocks.acquire.mockReturnValue(mocks.release);
  mocks.convert.mockResolvedValue({
    title: "粘贴正文",
    filename: "粘贴正文.md",
    markdown: "# 粘贴正文\n",
    warnings: [],
    meta: {
      sourceUrl: "",
      convertedAt: "2026-08-09T00:00:00.000Z",
      extractionMode: "paste",
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
});

describe("POST /api/convert-paste", () => {
  it("authenticates before reading the request body", async () => {
    mocks.validate.mockImplementation(() => {
      throw new AppError(403, "INVALID_SESSION_TOKEN", "未授权");
    });

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_SESSION_TOKEN" } });
    expect(mocks.readBody).not.toHaveBeenCalled();
    expect(mocks.acquire).not.toHaveBeenCalled();
  });

  it("rejects a declared request body over 5 MiB before reading it", async () => {
    const response = await POST(request({
      headers: { "content-length": String(5 * 1024 * 1024 + 1) },
    }));

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: { code: "REQUEST_TOO_LARGE" } });
    expect(mocks.readBody).not.toHaveBeenCalled();
    expect(mocks.acquire).not.toHaveBeenCalled();
  });

  it("rejects an extremely long decimal Content-Length before reading it", async () => {
    const response = await POST(request({
      headers: { "content-length": "9".repeat(400) },
    }));

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: { code: "REQUEST_TOO_LARGE" } });
    expect(mocks.readBody).not.toHaveBeenCalled();
    expect(mocks.acquire).not.toHaveBeenCalled();
  });

  it("maps an actual streaming body overflow to 413 even with a small declaration", async () => {
    mocks.readBody.mockRejectedValue(new AppError(413, "REQUEST_TOO_LARGE", "请求内容过大。"));

    const response = await POST(request({ headers: { "content-length": "1" } }));

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: { code: "REQUEST_TOO_LARGE" } });
    expect(mocks.acquire).not.toHaveBeenCalled();
  });

  it("maps an actual streaming body overflow without Content-Length to 413", async () => {
    mocks.readBody.mockRejectedValue(new AppError(413, "REQUEST_TOO_LARGE", "请求内容过大。"));

    const response = await POST(request());

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: { code: "REQUEST_TOO_LARGE" } });
    expect(mocks.acquire).not.toHaveBeenCalled();
  });

  it.each([
    ["not-json", "INVALID_REQUEST"],
    ["{}", "INVALID_REQUEST"],
    [JSON.stringify({ html: "", text: "   " }), "INVALID_REQUEST"],
    [JSON.stringify({ html: 42 }), "INVALID_REQUEST"],
    [JSON.stringify({ text: "正文", sourceUrl: 42 }), "INVALID_REQUEST"],
  ])("rejects malformed pasted payloads: %s", async (body, code) => {
    mocks.readBody.mockResolvedValue(body);

    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code } });
    expect(mocks.acquire).not.toHaveBeenCalled();
    expect(mocks.convert).not.toHaveBeenCalled();
  });

  it("converts a valid pasted text request and releases its slot", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ filename: "粘贴正文.md", meta: { extractionMode: "paste" } });
    expect(mocks.validate).toHaveBeenCalledOnce();
    expect(mocks.readBody).toHaveBeenCalledOnce();
    expect(mocks.convert).toHaveBeenCalledWith({ text: "粘贴正文" }, expect.any(AbortSignal));
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("preserves source URL validation errors from paste conversion", async () => {
    mocks.readBody.mockResolvedValue(JSON.stringify({ text: "正文", sourceUrl: "javascript:alert(1)" }));
    mocks.convert.mockRejectedValue(new AppError(400, "INVALID_SOURCE_URL", "来源 URL 无效。"));

    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_SOURCE_URL" } });
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it.each([
    "file:///tmp/paste",
    "https://user:password@example.com/article",
  ])("returns 400 for source URL rejected by paste conversion: %s", async (sourceUrl) => {
    mocks.readBody.mockResolvedValue(JSON.stringify({ text: "正文", sourceUrl }));
    mocks.convert.mockRejectedValue(new AppError(400, "INVALID_SOURCE_URL", "来源 URL 无效。"));

    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_SOURCE_URL" } });
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("does not log pasted html, text, or source URL on success", async () => {
    const sentinel = "SECRET_PASTE_SENTINEL";
    mocks.readBody.mockResolvedValue(JSON.stringify({
      html: `<p>${sentinel}</p>`,
      text: sentinel,
      sourceUrl: `https://example.com/${sentinel}`,
    }));
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(info.mock.calls.flat().join(" ")).not.toContain(sentinel);
  });

  it("does not log pasted html, text, or source URL on failure", async () => {
    const sentinel = "SECRET_FAILURE_SENTINEL";
    mocks.readBody.mockResolvedValue(JSON.stringify({
      html: `<p>${sentinel}</p>`,
      text: sentinel,
      sourceUrl: `https://example.com/${sentinel}`,
    }));
    mocks.convert.mockRejectedValue(new AppError(422, "NO_USABLE_CONTENT", "没有可转换内容。"));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await POST(request());

    expect(response.status).toBe(422);
    expect(warning.mock.calls.flat().join(" ")).not.toContain(sentinel);
  });

  it("returns 429 when the conversion slot is unavailable", async () => {
    mocks.acquire.mockImplementation(() => {
      throw new AppError(429, "RATE_LIMITED", "请求过于频繁。");
    });

    const response = await POST(request());

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ error: { code: "RATE_LIMITED" } });
    expect(mocks.convert).not.toHaveBeenCalled();
    expect(mocks.release).not.toHaveBeenCalled();
  });

  it("maps the server deadline to 504 and releases the slot", async () => {
    const timeoutError = new Error("deadline");
    timeoutError.name = "TimeoutError";
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(AbortSignal.abort(timeoutError));
    mocks.convert.mockImplementation(async (_body: unknown, signal: AbortSignal) => {
      throw signal.reason;
    });

    const response = await POST(request());

    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ error: { code: "CONVERSION_TIMEOUT" } });
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("maps a timeout that fires after conversion resolves to 504", async () => {
    const timeoutController = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutController.signal);
    mocks.convert.mockImplementation(async () => {
      timeoutController.abort();
      return {
        title: "粘贴正文",
        filename: "粘贴正文.md",
        markdown: "# 粘贴正文\n",
        warnings: [],
        meta: {
          sourceUrl: "",
          convertedAt: "2026-08-09T00:00:00.000Z",
          extractionMode: "paste",
          outputBytes: 16,
          textChars: 4,
          sourceImageCount: 0,
          embeddedImageCount: 0,
          omittedImageCount: 0,
        },
      };
    });

    const response = await POST(request());

    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ error: { code: "CONVERSION_TIMEOUT" } });
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("maps a client abort that races with conversion resolution to 499", async () => {
    const controller = new AbortController();
    mocks.convert.mockImplementation(async () => {
      controller.abort();
      return {
        title: "粘贴正文",
        filename: "粘贴正文.md",
        markdown: "# 粘贴正文\n",
        warnings: [],
        meta: {
          sourceUrl: "",
          convertedAt: "2026-08-09T00:00:00.000Z",
          extractionMode: "paste",
          outputBytes: 16,
          textChars: 4,
          sourceImageCount: 0,
          embeddedImageCount: 0,
          omittedImageCount: 0,
        },
      };
    });

    const response = await POST(request({ signal: controller.signal }));

    expect(response.status).toBe(499);
    expect(await response.json()).toMatchObject({ error: { code: "CLIENT_ABORTED" } });
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("maps client cancellation to 499 and releases the slot", async () => {
    const controller = new AbortController();
    controller.abort();
    mocks.convert.mockRejectedValue(new DOMException("stopped", "AbortError"));

    const response = await POST(request({ signal: controller.signal }));

    expect(response.status).toBe(499);
    expect(await response.json()).toMatchObject({ error: { code: "CLIENT_ABORTED" } });
    expect(mocks.release).toHaveBeenCalledOnce();
  });
});
