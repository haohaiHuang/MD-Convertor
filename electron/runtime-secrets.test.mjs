import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pushRuntimeSecret } from "./runtime-secrets.mjs";

const SECRET = "sk-live-0123456789";
const RENDERER_URL = "http://127.0.0.1:43711";
const SESSION_TOKEN = "session-token-value";

let logged = [];
let warn;

beforeEach(() => {
  logged = [];
  warn = vi.spyOn(console, "warn").mockImplementation((...args) => { logged.push(args.map(String).join(" ")); });
});

afterEach(() => {
  warn.mockRestore();
  vi.restoreAllMocks();
});

function okFetch() {
  return vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
}

describe("pushRuntimeSecret", () => {
  it("posts the key to the running server with the session token", async () => {
    const fetchImpl = okFetch();

    const applied = await pushRuntimeSecret({
      rendererUrl: RENDERER_URL,
      sessionToken: SESSION_TOKEN,
      providerId: "openai",
      value: SECRET,
      fetchImpl,
    });

    expect(applied).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${RENDERER_URL}/api/runtime/secrets`);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "content-type": "application/json",
      "x-md-convertor-token": SESSION_TOKEN,
    });
    expect(JSON.parse(init.body)).toEqual({ providerId: "openai", value: SECRET });
  });

  it("sends an explicit null when a key is removed", async () => {
    const fetchImpl = okFetch();

    await pushRuntimeSecret({
      rendererUrl: RENDERER_URL,
      sessionToken: SESSION_TOKEN,
      providerId: "openai",
      value: null,
      fetchImpl,
    });

    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ providerId: "openai", value: null });
  });

  it("omits the token header when the server has none", async () => {
    const fetchImpl = okFetch();

    await pushRuntimeSecret({
      rendererUrl: RENDERER_URL,
      providerId: "openai",
      value: SECRET,
      fetchImpl,
    });

    expect(fetchImpl.mock.calls[0][1].headers).not.toHaveProperty("x-md-convertor-token");
  });

  it("reports a rejected push by status code without echoing the key or the body", async () => {
    const fetchImpl = vi.fn(async () => new Response(`rejected ${SECRET}`, { status: 403 }));

    const applied = await pushRuntimeSecret({
      rendererUrl: RENDERER_URL,
      sessionToken: SESSION_TOKEN,
      providerId: "openai",
      value: SECRET,
      fetchImpl,
    });

    expect(applied).toBe(false);
    expect(logged).toEqual(["Pushing a provider key to the local server was rejected: 403"]);
  });

  it("reports an unreachable server without throwing", async () => {
    // Mirrors the undici failure shape: the transport code lives on `cause`.
    const fetchImpl = vi.fn(async () => {
      const error = new TypeError("fetch failed");
      error.cause = { code: "ECONNREFUSED" };
      throw error;
    });

    const applied = await pushRuntimeSecret({
      rendererUrl: RENDERER_URL,
      sessionToken: SESSION_TOKEN,
      providerId: "openai",
      value: SECRET,
      fetchImpl,
    });

    expect(applied).toBe(false);
    expect(logged).toEqual(["Pushing a provider key to the local server failed: ECONNREFUSED"]);
  });

  it("never logs the key on the happy path", async () => {
    await pushRuntimeSecret({
      rendererUrl: RENDERER_URL,
      sessionToken: SESSION_TOKEN,
      providerId: "openai",
      value: SECRET,
      fetchImpl: okFetch(),
    });

    expect(logged).toEqual([]);
  });
});
