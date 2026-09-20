import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  SecretsStoreError,
  SecretsUnavailableError,
  createSecretsStore,
} from "./secrets.mjs";

const KEY = "sk-live-plaintext-value";

function fakeSafeStorage({ available = true } = {}) {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (value) => Buffer.from(`enc:${value}`, "utf8"),
    decryptString: (buffer) => buffer.toString("utf8").replace(/^enc:/, ""),
  };
}

let directory;
let filePath;

async function entries() {
  return (await readdir(directory)).sort();
}

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "md-convertor-secrets-"));
  filePath = path.join(directory, "secrets.json");
});

afterEach(async () => {
  await rm(directory, { force: true, recursive: true });
});

describe("createSecretsStore", () => {
  it("round-trips a stored key without writing plaintext", async () => {
    const store = createSecretsStore({ filePath, safeStorage: fakeSafeStorage() });

    await store.set("openai", KEY);

    await expect(store.keyStored("openai")).resolves.toBe(true);
    await expect(store.exportPlaintext()).resolves.toEqual({ openai: KEY });

    const raw = await readFile(filePath, "utf8");
    expect(raw).not.toContain(KEY);
    expect(JSON.parse(raw)).toEqual({ version: 1, entries: { openai: Buffer.from(`enc:${KEY}`).toString("base64") } });
  });

  it("writes the file with mode 0600 through a rename", async () => {
    const store = createSecretsStore({ filePath, safeStorage: fakeSafeStorage() });

    await store.set("openai", KEY);
    const before = await stat(filePath);
    await store.set("local-cli", "sk-2");
    const after = await stat(filePath);

    expect((after.mode & 0o777).toString(8)).toBe("600");
    expect(after.ino).not.toBe(before.ino);
    expect(await entries()).toEqual(["secrets.json"]);
  });

  it("keeps other providers when one entry is replaced", async () => {
    const store = createSecretsStore({ filePath, safeStorage: fakeSafeStorage() });

    await store.set("openai", KEY);
    await store.set("claude-proxy", "sk-2");
    await store.set("openai", "sk-rotated");

    await expect(store.exportPlaintext()).resolves.toEqual({ openai: "sk-rotated", "claude-proxy": "sk-2" });
  });

  it("reports false and stays quiet for an unknown provider", async () => {
    const store = createSecretsStore({ filePath, safeStorage: fakeSafeStorage() });

    await expect(store.keyStored("missing")).resolves.toBe(false);
    await expect(store.exportPlaintext()).resolves.toEqual({});
    expect(await entries()).toEqual([]);
  });

  it("clears a stored key", async () => {
    const store = createSecretsStore({ filePath, safeStorage: fakeSafeStorage() });
    await store.set("openai", KEY);

    await store.clear("openai");

    await expect(store.keyStored("openai")).resolves.toBe(false);
    await expect(store.exportPlaintext()).resolves.toEqual({});
    expect(await readFile(filePath, "utf8")).not.toContain("openai");
  });

  it("still clears when encryption is unavailable", async () => {
    const store = createSecretsStore({ filePath, safeStorage: fakeSafeStorage({ available: false }) });

    await expect(store.clear("openai")).resolves.toBeUndefined();
    await expect(store.keyStored("openai")).resolves.toBe(false);
  });

  it("rejects invalid provider ids and values without writing", async () => {
    const store = createSecretsStore({ filePath, safeStorage: fakeSafeStorage() });

    await expect(store.set("has space", KEY)).rejects.toMatchObject({ code: "INVALID_PROVIDER_ID" });
    await expect(store.set("openai", "")).rejects.toMatchObject({ code: "INVALID_SECRET_VALUE" });
    await expect(store.set("openai", 42)).rejects.toMatchObject({ code: "INVALID_SECRET_VALUE" });

    expect(await entries()).toEqual([]);
  });

  it("refuses an unusable system keychain instead of storing plaintext", async () => {
    const store = createSecretsStore({ filePath, safeStorage: fakeSafeStorage({ available: false }) });

    let captured;
    try {
      await store.set("openai", KEY);
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(SecretsUnavailableError);
    expect(captured.code).toBe("SECRETS_UNAVAILABLE");
    expect(captured.message).not.toContain(KEY);
    expect(await entries()).toEqual([]);
  });

  it("does not overwrite an unreadable secrets file", async () => {
    const store = createSecretsStore({ filePath, safeStorage: fakeSafeStorage() });
    await writeFile(filePath, '{"version": 1, "entries":', "utf8");

    await expect(store.set("openai", KEY)).rejects.toBeInstanceOf(SecretsStoreError);
    await expect(store.exportPlaintext()).rejects.toBeInstanceOf(SecretsStoreError);
    expect(await readFile(filePath, "utf8")).toBe('{"version": 1, "entries":');
  });

  it("returns no plaintext when the system keychain is unavailable", async () => {
    const store = createSecretsStore({ filePath, safeStorage: fakeSafeStorage() });
    await store.set("openai", KEY);

    const withoutKeychain = createSecretsStore({ filePath, safeStorage: fakeSafeStorage({ available: false }) });
    await expect(withoutKeychain.exportPlaintext()).resolves.toEqual({});
  });

  it("skips an entry that cannot be decrypted on this machine", async () => {
    const store = createSecretsStore({ filePath, safeStorage: fakeSafeStorage() });
    await store.set("openai", KEY);
    await store.set("other", "sk-2");

    const failing = createSecretsStore({
      filePath,
      safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: (value) => Buffer.from(value, "utf8"),
        decryptString: (buffer) => {
          const text = buffer.toString("utf8");
          if (text === "enc:sk-2") throw new Error("keychain entry is gone");
          return text.replace(/^enc:/, "");
        },
      },
    });

    await expect(failing.exportPlaintext()).resolves.toEqual({ openai: KEY });
  });
});
