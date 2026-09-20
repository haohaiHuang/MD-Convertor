import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "@/types/settings";

const mocks = vi.hoisted(() => ({ read: vi.fn() }));

vi.mock("@/lib/settings/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/settings/store")>();
  return { ...actual, readSettings: mocks.read };
});

import type { ProviderFetch } from "@/lib/provider/endpoint";
import { resetRuntimeSecrets, setRuntimeSecret } from "@/lib/provider/credentials";
import { POST } from "./route";

const SECRET = "sk-live-0123456789";

function settingsWithProvider(overrides: Partial<Settings["cloud"]["providers"][number]> = {}): Settings {
  const settings = structuredClone(DEFAULT_SETTINGS);
  settings.cloud.providers.push({
    id: "openai",
    name: "OpenAI",
    baseUrl: "http://127.0.0.1:11434/v1",
    keyStored: false,
    models: [],
    selectedModel: null,
    ...overrides,
  });
  settings.cloud.activeProviderId = "openai";
  return settings;
}

function modelsRequest(
  body: unknown = { providerId: "openai" },
  headers: Record<string, string> = {},
): Request {
  return new Request("http://127.0.0.1:3210/api/provider/models", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.read.mockReset();
  mocks.read.mockResolvedValue(settingsWithProvider());
  resetRuntimeSecrets();
  setRuntimeSecret("openai", SECRET);
});

afterEach(() => {
  resetRuntimeSecrets();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /api/provider/models caller validation", () => {
  it("rejects a cross-origin request", async () => {
    const response = await POST(modelsRequest(undefined, { origin: "https://attacker.example" }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_API_ORIGIN" } });
  });

  it("requires the application token when one is configured", async () => {
    vi.stubEnv("MD_CONVERTOR_SESSION_TOKEN", "route-session-token");
    const response = await POST(modelsRequest());
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_SESSION_TOKEN" } });
  });

  it("rejects a non-JSON content type", async () => {
    const response = await POST(new Request("http://127.0.0.1:3210/api/provider/models", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_CONTENT_TYPE" } });
  });
});

describe("POST /api/provider/models", () => {
  it("returns the models of the configured provider", async () => {
    const fetchImpl = vi.fn<ProviderFetch>(async () =>
      new Response(JSON.stringify({ data: [{ id: "qwen3:8b" }, { id: "llama3.2" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchImpl);

    const response = await POST(modelsRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ models: ["qwen3:8b", "llama3.2"] });
    expect(fetchImpl.mock.calls[0][1].headers).toMatchObject({ authorization: `Bearer ${SECRET}` });
  });

  it("never echoes the key or the provider response body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`denied ${SECRET}`, { status: 403 })));

    const response = await POST(modelsRequest());
    const text = await response.text();
    expect(response.status).toBe(502);
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("denied");
    expect(JSON.parse(text)).toMatchObject({ error: { code: "TRANSLATE_PROVIDER_ERROR" } });
  });

  it("reports a missing key as 409 without calling the provider", async () => {
    setRuntimeSecret("openai", null);
    mocks.read.mockResolvedValue(settingsWithProvider());
    const fetchImpl = vi.fn();
    vi.stubGlobal("fetch", fetchImpl);

    const response = await POST(modelsRequest());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "TRANSLATE_NOT_CONFIGURED" } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses a key stored through the desktop bridge", async () => {
    resetRuntimeSecrets();
    setRuntimeSecret("openai", SECRET);
    try {
      const fetchImpl = vi.fn<ProviderFetch>(async () => new Response(JSON.stringify({ data: [{ id: "gpt-4o" }] }), { status: 200 }));
      vi.stubGlobal("fetch", fetchImpl);

      const response = await POST(modelsRequest());
      expect(response.status).toBe(200);
      expect(fetchImpl.mock.calls[0][1].headers).toMatchObject({ authorization: `Bearer ${SECRET}` });
    } finally {
      resetRuntimeSecrets();
    }
  });

  it.each([
    ["a missing provider id", {}],
    ["an unknown provider id", { providerId: "nope" }],
    ["a malformed provider id", { providerId: "!!" }],
    ["a non-string provider id", { providerId: 7 }],
  ])("rejects %s", async (_label, body) => {
    const response = await POST(modelsRequest(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_PROVIDER_ID" } });
  });

  it("rejects a malformed body", async () => {
    const response = await POST(modelsRequest("{"));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_REQUEST_BODY" } });
  });

  it("rejects an oversized body", async () => {
    const response = await POST(modelsRequest({ providerId: "openai", pad: "x".repeat(70_000) }));
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: { code: "REQUEST_TOO_LARGE" } });
  });

  it("fails safely when settings cannot be read", async () => {
    mocks.read.mockRejectedValue(new Error("boom"));
    const response = await POST(modelsRequest());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: { code: "INTERNAL_ERROR" } });
  });
});

describe("POST /api/provider/models draft mode", () => {
  it("lists the models of an unsaved provider from the typed address and key", async () => {
    const fetchImpl = vi.fn<ProviderFetch>(async () =>
      new Response(JSON.stringify({ data: [{ id: "mimo-v2.5-pro" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchImpl);

    const response = await POST(modelsRequest({
      baseUrl: "http://127.0.0.1:9999/v1",
      apiKey: "sk-typed-draft",
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ models: ["mimo-v2.5-pro"] });
    expect(String(fetchImpl.mock.calls[0][0])).toBe("http://127.0.0.1:9999/v1/models");
    expect(fetchImpl.mock.calls[0][1].headers).toMatchObject({ authorization: "Bearer sk-typed-draft" });
  });

  it("falls back to the stored key when only a new address is sent", async () => {
    const fetchImpl = vi.fn<ProviderFetch>(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchImpl);

    const response = await POST(modelsRequest({ providerId: "openai", baseUrl: "http://127.0.0.1:8123/v1" }));

    expect(response.status).toBe(200);
    expect(String(fetchImpl.mock.calls[0][0])).toBe("http://127.0.0.1:8123/v1/models");
    expect(fetchImpl.mock.calls[0][1].headers).toMatchObject({ authorization: `Bearer ${SECRET}` });
  });

  it("falls back to the saved address when only a key is sent", async () => {
    const fetchImpl = vi.fn<ProviderFetch>(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchImpl);

    const response = await POST(modelsRequest({ providerId: "openai", apiKey: "sk-typed-draft" }));

    expect(response.status).toBe(200);
    expect(String(fetchImpl.mock.calls[0][0])).toBe("http://127.0.0.1:11434/v1/models");
    expect(fetchImpl.mock.calls[0][1].headers).toMatchObject({ authorization: "Bearer sk-typed-draft" });
  });

  it("rejects a draft that has no key to use", async () => {
    const fetchImpl = vi.fn();
    vi.stubGlobal("fetch", fetchImpl);

    const response = await POST(modelsRequest({ baseUrl: "http://127.0.0.1:9999/v1" }));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "TRANSLATE_NOT_CONFIGURED" } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a draft address that is not http(s)", async () => {
    const response = await POST(modelsRequest({ baseUrl: "ftp://127.0.0.1/v1", apiKey: "sk-typed-draft" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_PROVIDER_URL" } });
  });

  it("never echoes a typed key", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("denied sk-typed-draft", { status: 403 })));

    const response = await POST(modelsRequest({ baseUrl: "http://127.0.0.1:9999/v1", apiKey: "sk-typed-draft" }));
    const text = await response.text();

    expect(response.status).toBe(502);
    expect(text).not.toContain("sk-typed-draft");
    expect(text).not.toContain("denied");
  });
});
