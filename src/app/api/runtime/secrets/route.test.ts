import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRuntimeSecrets, resolveProviderKey } from "@/lib/provider/credentials";
import { POST } from "./route";

const SECRET = "sk-live-0123456789";

function secretsRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://127.0.0.1:3210/api/runtime/secrets", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function storedKey(): string | null {
  return resolveProviderKey({ id: "openai" })?.key ?? null;
}

let logged: string[] = [];

beforeEach(() => {
  logged = [];
  delete process.env.MD_CONVERTOR_SECRETS;
  resetRuntimeSecrets();
  vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => { logged.push(args.map(String).join(" ")); });
  vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => { logged.push(args.map(String).join(" ")); });
});

afterEach(() => {
  resetRuntimeSecrets();
  delete process.env.MD_CONVERTOR_SECRETS;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /api/runtime/secrets caller validation", () => {
  it("rejects a cross-origin request", async () => {
    const response = await POST(secretsRequest({ providerId: "openai", value: SECRET }, { origin: "https://attacker.example" }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_API_ORIGIN" } });
    expect(storedKey()).toBeNull();
  });

  it("requires the application token when one is configured", async () => {
    vi.stubEnv("MD_CONVERTOR_SESSION_TOKEN", "route-session-token");
    const response = await POST(secretsRequest({ providerId: "openai", value: SECRET }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_SESSION_TOKEN" } });
    expect(storedKey()).toBeNull();
  });

  it("rejects a non-JSON content type", async () => {
    const response = await POST(new Request("http://127.0.0.1:3210/api/runtime/secrets", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ providerId: "openai", value: SECRET }),
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_CONTENT_TYPE" } });
    expect(storedKey()).toBeNull();
  });
});

describe("POST /api/runtime/secrets", () => {
  it("applies a saved key to the running server without a restart", async () => {
    const response = await POST(secretsRequest({ providerId: "openai", value: SECRET }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(storedKey()).toBe(SECRET);
  });

  it("clears a key that is no longer stored", async () => {
    await POST(secretsRequest({ providerId: "openai", value: SECRET }));
    const response = await POST(secretsRequest({ providerId: "openai", value: null }));
    expect(response.status).toBe(200);
    expect(storedKey()).toBeNull();
  });

  it("never writes the key into a response or a log line", async () => {
    const accepted = await POST(secretsRequest({ providerId: "openai", value: SECRET }));
    expect(await accepted.text()).not.toContain(SECRET);

    const rejected = await POST(secretsRequest({ providerId: "openai", value: 42, leak: SECRET }));
    expect(rejected.status).toBe(400);
    expect(await rejected.text()).not.toContain(SECRET);

    expect(logged).toHaveLength(1);
    expect(logged[0]).not.toContain(SECRET);
    expect(Object.keys(JSON.parse(logged[0])).sort()).toEqual(["code", "durationMs", "requestId", "status"]);
  });

  it.each([
    ["a missing provider id", { value: SECRET }],
    ["a malformed provider id", { providerId: "!!", value: SECRET }],
    ["a non-string provider id", { providerId: 7, value: SECRET }],
  ])("rejects %s", async (_label, body) => {
    const response = await POST(secretsRequest(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_PROVIDER_ID" } });
    expect(storedKey()).toBeNull();
  });

  it("accepts a well-formed id even before settings mention it", async () => {
    const response = await POST(secretsRequest({ providerId: "other", value: SECRET }));
    expect(response.status).toBe(200);
    expect(resolveProviderKey({ id: "other" })?.key).toBe(SECRET);
  });

  it.each([
    ["an empty value", { providerId: "openai", value: "" }],
    ["a whitespace-only value", { providerId: "openai", value: "   " }],
    ["a non-string value", { providerId: "openai", value: 42 }],
    ["an oversized value", { providerId: "openai", value: "x".repeat(9000) }],
  ])("rejects %s", async (_label, body) => {
    const response = await POST(secretsRequest(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_SECRET_VALUE" } });
    expect(storedKey()).toBeNull();
  });

  it("rejects a malformed body without logging it", async () => {
    const response = await POST(secretsRequest(`{"${SECRET}`));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_REQUEST_BODY" } });
    expect(logged.join("\n")).not.toContain(SECRET);
    expect(Object.keys(JSON.parse(logged[0])).sort()).toEqual(["code", "durationMs", "requestId", "status"]);
  });

  it("rejects an oversized body", async () => {
    const response = await POST(secretsRequest({ providerId: "openai", value: SECRET, pad: "x".repeat(70_000) }));
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: { code: "REQUEST_TOO_LARGE" } });
    expect(storedKey()).toBeNull();
  });
});
