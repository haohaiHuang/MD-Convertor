import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ scan: vi.fn() }));

vi.mock("@/lib/local-cli/scan", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/local-cli/scan")>();
  return { ...actual, scanLocalClis: mocks.scan };
});

import { POST } from "./route";

function scanRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://127.0.0.1:3210/api/local-clis/scan", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: "{}",
  });
}

beforeEach(() => {
  mocks.scan.mockReset();
  mocks.scan.mockResolvedValue([
    { id: "pi", name: "pi", path: "/usr/local/bin/pi", installed: true },
    { id: "claude", name: "claude", path: null, installed: false },
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /api/local-clis/scan caller validation", () => {
  it("rejects a cross-origin request", async () => {
    const response = await POST(scanRequest({ origin: "https://attacker.example" }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_API_ORIGIN" } });
    expect(mocks.scan).not.toHaveBeenCalled();
  });

  it("requires the application token when one is configured", async () => {
    vi.stubEnv("MD_CONVERTOR_SESSION_TOKEN", "route-session-token");
    const response = await POST(scanRequest());
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_SESSION_TOKEN" } });
  });

  it("rejects a non-JSON content type", async () => {
    const response = await POST(new Request("http://127.0.0.1:3210/api/local-clis/scan", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_CONTENT_TYPE" } });
  });
});

describe("POST /api/local-clis/scan", () => {
  it("returns the detected CLI paths", async () => {
    const response = await POST(scanRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      clis: [
        { id: "pi", name: "pi", path: "/usr/local/bin/pi", installed: true },
        { id: "claude", name: "claude", path: null, installed: false },
      ],
    });
  });

  it("does not need a body", async () => {
    const response = await POST(new Request("http://127.0.0.1:3210/api/local-clis/scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(200);
  });

  it("fails safely when scanning throws", async () => {
    mocks.scan.mockRejectedValue(new Error("boom"));
    const response = await POST(scanRequest());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: { code: "INTERNAL_ERROR" } });
  });
});
