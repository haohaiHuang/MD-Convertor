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
  return { name, api, bridge: api.secrets, output: api.output, invoke };
}

describe("preload bridge", () => {
  it("exposes mdConvertor.secrets and mdConvertor.output", () => {
    const loaded = loadPreload();

    expect(loaded.name).toBe("mdConvertor");
    expect(Object.keys(loaded.api)).toEqual(["secrets", "output"]);
    expect(Object.keys(loaded.bridge).sort()).toEqual(["clear", "set", "status"]);
    expect(Object.keys(loaded.output).sort()).toEqual(["saveFile", "selectDirectory"]);
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

describe("preload output bridge", () => {
  it("passes selectDirectory with no payload over the contract channel", async () => {
    const loaded = loadPreload();

    await loaded.output.selectDirectory();

    expect(loaded.invoke).toHaveBeenCalledTimes(1);
    expect(loaded.invoke.mock.calls[0][0]).toBe(contract.CHANNELS.selectDirectory);
    expect(loaded.invoke.mock.calls[0][1]).toBeUndefined();
  });

  it("passes saveFile payloads over the contract channel", async () => {
    const loaded = loadPreload();

    await loaded.output.saveFile("/Users/someone/Documents", "notes.md", "# Hello");

    expect(loaded.invoke).toHaveBeenCalledTimes(1);
    expect(loaded.invoke.mock.calls[0]).toEqual([
      contract.CHANNELS.saveFile,
      { dirPath: "/Users/someone/Documents", filename: "notes.md", content: "# Hello" },
    ]);
  });

  it("turns a save-file channel failure into a result object instead of throwing", async () => {
    const loaded = loadPreload(() => {
      throw new Error(`disk full while writing /Users/someone/Documents/notes.md`);
    });

    const result = await loaded.output.saveFile("/Users/someone/Documents", "notes.md", "# Hello");

    expect(result).toEqual({ ok: false, code: "IPC_FAILED" });
    expect(JSON.stringify(result)).not.toContain("/Users/someone/Documents");
  });

  it.each([
    ["a parent traversal", "../x.md"],
    ["a nested path", "a/b.md"],
    ["a windows path", "a\\b.md"],
    ["a home reference", "~/.md"],
    ["an empty name", ""],
    ["a non-string name", 42],
    ["a missing name", undefined],
    ["an over-long name", "a".repeat(256)],
  ])("rejects %s before reaching the main process", async (_label, filename) => {
    const loaded = loadPreload();

    await expect(loaded.output.saveFile("/Users/someone/Documents", filename, "# Hello"))
      .rejects.toThrow(TypeError);
    expect(loaded.invoke).not.toHaveBeenCalled();
  });

  it.each([
    ["a home path", "~/Documents"],
    ["a relative path", "Documents/notes"],
    ["a parent traversal", "/Users/someone/../someone_else"],
    ["an empty path", ""],
    ["a non-string path", 42],
    ["a missing path", undefined],
  ])("rejects %s as dirPath before reaching the main process", async (_label, dirPath) => {
    const loaded = loadPreload();

    await expect(loaded.output.saveFile(dirPath, "notes.md", "# Hello"))
      .rejects.toThrow(TypeError);
    expect(loaded.invoke).not.toHaveBeenCalled();
  });

  it("rejects a non-string content before reaching the main process", async () => {
    const loaded = loadPreload();

    await expect(loaded.output.saveFile("/Users/someone/Documents", "notes.md", 42))
      .rejects.toThrow(TypeError);
    expect(loaded.invoke).not.toHaveBeenCalled();
  });

  it("keeps the preload filename/dirPath rules in sync with the contract", async () => {
    const filenameCases = ["notes.md", "", "a/b.md", "a\\b.md", "../x.md", "~/.md", "a".repeat(255), "a".repeat(256), 42];
    for (const filename of filenameCases) {
      const loaded = loadPreload();
      const accepted = await loaded.output
        .saveFile("/Users/someone/Documents", filename, "# Hello")
        .then(() => true, () => false);
      expect(accepted, JSON.stringify(filename)).toBe(contract.isValidOutputFilename(filename));
    }

    const dirCases = ["/tmp/notes", "~/Documents", "Documents", "/a/../b", "", 42];
    for (const dirPath of dirCases) {
      const loaded = loadPreload();
      const accepted = await loaded.output
        .saveFile(dirPath, "notes.md", "# Hello")
        .then(() => true, () => false);
      expect(accepted, JSON.stringify(dirPath)).toBe(contract.isAbsoluteDirPath(dirPath));
    }
  });
});
