import Module, { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const contract = require("./preload-contract.cjs");
const PRELOAD_PATH = require.resolve("./preload.cjs");

const KEY = "sk-live-plaintext-value";

/** Runs the shipped preload against a stubbed electron module, as the sandbox would. */
function loadPreload(invokeImpl = async () => ({ ok: true })) {
  const invoke = vi.fn(invokeImpl);
  const exposeInMainWorld = vi.fn();
  const fakeElectron = { contextBridge: { exposeInMainWorld }, ipcRenderer: { invoke } };
  const originalLoad = Module._load;
  Module._load = function (request, ...rest) {
    return request === "electron" ? fakeElectron : originalLoad.call(this, request, ...rest);
  };
  try {
    delete require.cache[PRELOAD_PATH];
    require(PRELOAD_PATH);
  } finally {
    Module._load = originalLoad;
  }
  expect(exposeInMainWorld).toHaveBeenCalledTimes(1);
  const [name, api] = exposeInMainWorld.mock.calls[0];
  return { name, api, bridge: api.secrets, invoke };
}

describe("preload bridge", () => {
  it("exposes only mdConvertor.secrets", () => {
    const loaded = loadPreload();

    expect(loaded.name).toBe("mdConvertor");
    expect(Object.keys(loaded.api)).toEqual(["secrets"]);
    expect(Object.keys(loaded.bridge).sort()).toEqual(["clear", "set", "status"]);
  });

  it("uses the channel names the main process handles", async () => {
    const loaded = loadPreload();

    await loaded.bridge.set("openai", KEY);
    await loaded.bridge.clear("openai");
    await loaded.bridge.status();

    expect(loaded.invoke.mock.calls.map(([channel]) => channel)).toEqual([
      contract.CHANNELS.set,
      contract.CHANNELS.clear,
      contract.CHANNELS.status,
    ]);
  });

  it("sends set, clear, and status payloads over their channels", async () => {
    const loaded = loadPreload();

    await loaded.bridge.set("openai", KEY);
    await loaded.bridge.clear("openai");
    await loaded.bridge.status();

    expect(loaded.invoke.mock.calls).toEqual([
      [contract.CHANNELS.set, { providerId: "openai", value: KEY }],
      [contract.CHANNELS.clear, { providerId: "openai" }],
      [contract.CHANNELS.status],
    ]);
  });

  it.each([
    ["a space", "open ai"],
    ["an empty id", ""],
    ["a leading underscore", "__proto__"],
    ["a path traversal", "../secrets"],
    ["an over-long id", "a".repeat(65)],
    ["a non-string id", 42],
    ["a missing id", undefined],
    ["an object id", {}],
  ])("rejects %s before reaching the main process", async (_label, providerId) => {
    const loaded = loadPreload();

    await expect(loaded.bridge.set(providerId, KEY)).rejects.toThrow(TypeError);
    await expect(loaded.bridge.clear(providerId)).rejects.toThrow(TypeError);
    await expect(loaded.bridge.status()).resolves.toEqual({ ok: true });
    expect(loaded.invoke).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["an empty value", ""],
    ["a non-string value", 42],
    ["a null value", null],
    ["an over-long value", "x".repeat(8193)],
  ])("rejects %s before reaching the main process", async (_label, value) => {
    const loaded = loadPreload();

    await expect(loaded.bridge.set("openai", value)).rejects.toThrow(TypeError);
    expect(loaded.invoke).not.toHaveBeenCalled();
  });

  it("keeps the provider id pattern and value limit in sync with the contract", async () => {
    const cases = ["openai", "a".repeat(64), "a".repeat(65), "__proto__", "", "open ai", "http://x"];
    for (const providerId of cases) {
      const loaded = loadPreload();
      const accepted = await loaded.bridge.set(providerId, KEY).then(() => true, () => false);
      expect(accepted, providerId).toBe(contract.isValidProviderId(providerId));
    }

    for (const length of [1, contract.MAX_SECRET_LENGTH, contract.MAX_SECRET_LENGTH + 1]) {
      const loaded = loadPreload();
      const accepted = await loaded.bridge.set("openai", "x".repeat(length)).then(() => true, () => false);
      expect(accepted, `length ${length}`).toBe(length <= contract.MAX_SECRET_LENGTH);
    }
  });

  it("turns a channel failure into a result object instead of throwing", async () => {
    const loaded = loadPreload(() => {
      throw new Error(`keychain blew up while storing ${KEY}`);
    });

    const result = await loaded.bridge.set("openai", KEY);

    expect(result).toEqual({ ok: false, code: "IPC_FAILED" });
    expect(JSON.stringify(result)).not.toContain(KEY);
  });
});
