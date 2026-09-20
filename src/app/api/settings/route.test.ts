import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "@/types/settings";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  write: vi.fn(),
}));

vi.mock("@/lib/settings/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/settings/store")>();
  return { ...actual, readSettings: mocks.read, writeSettings: mocks.write };
});

import { SettingsStoreError } from "@/lib/settings/store";
import { GET, PUT } from "./route";

const SECRET = "sk-live-0123456789";

type Method = "GET" | "PUT";
const handlers: Record<Method, (request: Request) => Promise<Response>> = { GET, PUT };

function populated(): Settings {
  const settings = structuredClone(DEFAULT_SETTINGS);
  settings.cloud.providers.push({
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    keyStored: true,
    models: ["gpt-4o-mini"],
    selectedModel: "gpt-4o-mini",
  });
  settings.cloud.activeProviderId = "openai";
  return settings;
}

function settingsRequest(
  method: Method,
  options: { headers?: Record<string, string>; body?: unknown } = {},
): Request {
  const hasBody = options.body !== undefined && method !== "GET";
  return new Request("http://127.0.0.1:3210/api/settings", {
    method,
    headers: {
      "content-type": "application/json",
      ...options.headers,
    },
    ...(hasBody ? { body: typeof options.body === "string" ? options.body : JSON.stringify(options.body) } : {}),
  });
}

beforeEach(() => {
  mocks.read.mockReset();
  mocks.write.mockReset();
  mocks.read.mockResolvedValue(populated());
  mocks.write.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe.each<Method>(["GET", "PUT"])("%s /api/settings caller validation", (method) => {
  it("rejects a cross-origin request", async () => {
    const response = await handlers[method](settingsRequest(method, {
      headers: { origin: "https://attacker.example" },
      body: {},
    }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_API_ORIGIN" } });
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, "INVALID_SESSION_TOKEN"],
    ["wrong-token", "INVALID_SESSION_TOKEN"],
  ])("rejects a missing or incorrect application token", async (token, code) => {
    vi.stubEnv("MD_CONVERTOR_SESSION_TOKEN", "route-session-token");
    const headers: Record<string, string> = {};
    if (token) headers["x-md-convertor-token"] = token;
    const response = await handlers[method](settingsRequest(method, { headers, body: {} }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code } });
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it("rejects a non-JSON content type", async () => {
    const response = await handlers[method](settingsRequest(method, {
      headers: { "content-type": "text/plain" },
      body: {},
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_CONTENT_TYPE" } });
  });

  it("accepts a same-origin JSON request", async () => {
    const response = await handlers[method](settingsRequest(method, { body: populated() }));
    expect(response.status).toBe(200);
  });
});

describe("GET /api/settings", () => {
  it("returns the stored settings", async () => {
    const response = await GET(settingsRequest("GET"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(populated());
  });

  it("never returns secret-shaped fields from the store", async () => {
    const poisoned = {
      ...populated(),
      cloud: { ...populated().cloud, secret: SECRET, providers: [{ ...populated().cloud.providers[0], apiKey: SECRET }] },
    };
    mocks.read.mockResolvedValue(poisoned);

    const response = await GET(settingsRequest("GET"));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("apiKey\"");
    expect(text).not.toContain("secret");
    const payload = JSON.parse(text) as Settings;
    expect(payload.cloud.providers[0].keyStored).toBe(true);
    expect(payload.cloud.providers[0]).not.toHaveProperty("apiKeyEnv");
  });

  it("reports an unreadable newer settings file as 409", async () => {
    mocks.read.mockRejectedValue(new SettingsStoreError("SETTINGS_VERSION_UNSUPPORTED", "newer"));
    const response = await GET(settingsRequest("GET"));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "SETTINGS_VERSION_UNSUPPORTED" } });
  });
});

describe("PUT /api/settings", () => {
  it.each([
    ["a non-object body", "null"],
    ["malformed JSON", "{"],
    ["an unknown field", JSON.stringify({ ...populated(), extra: true })],
    ["a missing field", JSON.stringify((() => { const settings = populated(); delete (settings.translation as Partial<Settings["translation"]>).defaultEnabled; return settings; })())],
    ["an invalid URL", JSON.stringify((() => { const settings = populated(); settings.cloud.providers[0].baseUrl = "not-a-url"; return settings; })())],
    ["an invalid language tag", JSON.stringify((() => { const settings = populated(); settings.languages.target = "zh_Hans"; return settings; })())],
  ])("rejects %s with 400", async (_label, body) => {
    const response = await PUT(settingsRequest("PUT", { body }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_SETTINGS" } });
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it("does not echo a key that was placed in the wrong field", async () => {
    const body = populated() as Settings & { cloud: { providers: Record<string, unknown>[] } };
    body.cloud.providers[0].apiKey = SECRET;
    const response = await PUT(settingsRequest("PUT", { body }));
    const text = await response.text();
    expect(response.status).toBe(400);
    expect(text).not.toContain(SECRET);
  });

  it("validates and persists the body, then returns the stored settings", async () => {
    const response = await PUT(settingsRequest("PUT", { body: populated() }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(populated());
    expect(mocks.write).toHaveBeenCalledWith(populated());
  });

  it("does not persist extra fields that reached the body", async () => {
    const poisoned = {
      ...populated(),
      cloud: { ...populated().cloud, providers: [{ ...populated().cloud.providers[0], apiKey: SECRET }] },
    };
    const response = await PUT(settingsRequest("PUT", { body: poisoned }));
    expect(response.status).toBe(400);
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it("rejects an oversized body before parsing it", async () => {
    const response = await PUT(settingsRequest("PUT", {
      headers: { "content-length": "70001" },
      body: JSON.stringify({ pad: "x".repeat(70_000) }),
    }));
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: { code: "REQUEST_TOO_LARGE" } });
    expect(mocks.write).not.toHaveBeenCalled();
  });
});
