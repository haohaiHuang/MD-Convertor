import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { PROVIDER_ID_PATTERN } from "./env.mjs";

const SECRETS_VERSION = 1;
const MAX_SECRET_LENGTH = 8192;

export class SecretsUnavailableError extends Error {
  constructor(message = "系统密钥库不可用，无法安全保存密钥。") {
    super(message);
    this.name = "SecretsUnavailableError";
    this.code = "SECRETS_UNAVAILABLE";
  }
}

export class SecretsStoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SecretsStoreError";
    this.code = code;
  }
}

function invalid(code, message) {
  return new SecretsStoreError(code, message);
}

function assertProviderId(providerId) {
  if (typeof providerId !== "string" || !PROVIDER_ID_PATTERN.test(providerId)) {
    throw invalid("INVALID_PROVIDER_ID", "Provider id must be 1-64 characters of [A-Za-z0-9_-].");
  }
}

function assertSecretValue(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_SECRET_LENGTH) {
    throw invalid("INVALID_SECRET_VALUE", `Secret must be a non-empty string of at most ${MAX_SECRET_LENGTH} characters.`);
  }
}

/** Reads { version, entries } or throws; never silently discards other providers' entries. */
async function readEntries(filePath) {
  let text;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw error;
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw invalid("SECRETS_FILE_INVALID", "secrets.json is not valid JSON; refusing to overwrite it.");
  }
  if (parsed?.version !== SECRETS_VERSION || typeof parsed.entries !== "object" || parsed.entries === null || Array.isArray(parsed.entries)) {
    throw invalid("SECRETS_FILE_INVALID", "secrets.json does not match the expected schema; refusing to overwrite it.");
  }
  for (const [id, entry] of Object.entries(parsed.entries)) {
    if (typeof entry !== "string") {
      throw invalid("SECRETS_FILE_INVALID", `secrets.json entry ${id} is not a string; refusing to overwrite it.`);
    }
  }
  return parsed.entries;
}

// Deliberate duplicate of src/lib/settings/store.ts: this runs in Electron's main process and
// cannot import the TypeScript store. Both writers keep the 0600 temp-file + rename contract.
async function writeEntries(filePath, entries) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  const payload = JSON.stringify({ version: SECRETS_VERSION, entries }, null, 2);
  await writeFile(tempPath, `${payload}\n`, { mode: 0o600 });
  await rename(tempPath, filePath);
}

/**
 * safeStorage-backed key store: safeStorage is injected so this module stays testable
 * outside Electron. Plaintext keys exist only in memory and in the child-process environment.
 */
export function createSecretsStore({ filePath, safeStorage }) {
  return {
    async set(providerId, value) {
      assertProviderId(providerId);
      assertSecretValue(value);
      if (!safeStorage.isEncryptionAvailable()) throw new SecretsUnavailableError();

      const entries = await readEntries(filePath);
      const encrypted = safeStorage.encryptString(value);
      entries[providerId] = Buffer.from(encrypted).toString("base64");
      await writeEntries(filePath, entries);
    },

    async clear(providerId) {
      assertProviderId(providerId);
      const entries = await readEntries(filePath);
      if (!(providerId in entries)) return;
      delete entries[providerId];
      await writeEntries(filePath, entries);
    },

    async keyStored(providerId) {
      assertProviderId(providerId);
      const entries = await readEntries(filePath);
      return Object.hasOwn(entries, providerId);
    },

    /** Plaintext map for MD_CONVERTOR_SECRETS. Unreadable entries are skipped, not fatal. */
    async exportPlaintext() {
      const entries = await readEntries(filePath);
      if (!safeStorage.isEncryptionAvailable()) return {};
      const plaintext = {};
      for (const [id, entry] of Object.entries(entries)) {
        try {
          plaintext[id] = safeStorage.decryptString(Buffer.from(entry, "base64"));
        } catch {
          // Keychain entry removed or created on another machine: treat as not stored.
        }
      }
      return plaintext;
    },
  };
}
