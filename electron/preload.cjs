/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Sandboxed preload script: exposes `window.mdConvertor.secrets` and
 * `window.mdConvertor.output` to the renderer.
 *
 * This file must stay self-contained. Electron sandboxed preloads can only resolve
 * built-in modules, so `require("./preload-contract.cjs")` fails at runtime; the
 * channel names and limits below are asserted against that contract in
 * `electron/preload.test.cjs`.
 */
const { contextBridge, ipcRenderer } = require("electron");

const CHANNELS = Object.freeze({
  set: "md-convertor:secrets:set",
  clear: "md-convertor:secrets:clear",
  status: "md-convertor:secrets:status",
  selectDirectory: "md-convertor:output:select-directory",
  saveFile: "md-convertor:output:save-file",
});

const PROVIDER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const MAX_SECRET_LENGTH = 8192;
const MAX_FILENAME_LENGTH = 255;

function assertProviderId(value) {
  if (typeof value !== "string" || !PROVIDER_ID_PATTERN.test(value)) {
    throw new TypeError("providerId must be 1-64 characters of [A-Za-z0-9_-].");
  }
}

function assertSecretValue(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_SECRET_LENGTH) {
    throw new TypeError(`value must be a non-empty string of at most ${MAX_SECRET_LENGTH} characters.`);
  }
}

function isValidOutputFilename(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= MAX_FILENAME_LENGTH
    && !value.includes("/")
    && !value.includes("\\")
    && !value.includes("..");
}

function isAbsoluteDirPath(value) {
  // A tilde is home shorthand only when it *starts* a segment; iCloud Drive lives
  // under `com~apple~CloudDocs`. Kept in sync with `preload-contract.cjs`.
  if (typeof value !== "string" || !value.startsWith("/")) {
    return false;
  }
  return !value.split("/").some((segment) => segment === ".." || segment.startsWith("~"));
}

function assertFilename(value) {
  if (!isValidOutputFilename(value)) {
    throw new TypeError("filename must be a plain file name without /, \\, or .. sequences.");
  }
}

function assertDirPath(value) {
  if (!isAbsoluteDirPath(value)) {
    throw new TypeError("dirPath must be an absolute path without traversal segments.");
  }
}

function assertContent(value) {
  if (typeof value !== "string") {
    throw new TypeError("content must be a string.");
  }
}

async function invoke(channel, payload) {
  try {
    return payload === undefined ? await ipcRenderer.invoke(channel) : await ipcRenderer.invoke(channel, payload);
  } catch {
    // The renderer only ever learns a code; main-process messages may carry key material.
    return { ok: false, code: "IPC_FAILED" };
  }
}

contextBridge.exposeInMainWorld("mdConvertor", {
  secrets: {
    async set(providerId, value) {
      assertProviderId(providerId);
      assertSecretValue(value);
      return invoke(CHANNELS.set, { providerId, value });
    },
    async clear(providerId) {
      assertProviderId(providerId);
      return invoke(CHANNELS.clear, { providerId });
    },
    async status() {
      return invoke(CHANNELS.status);
    },
  },
  output: {
    async selectDirectory() {
      return invoke(CHANNELS.selectDirectory);
    },
    async saveFile(dirPath, filename, content) {
      assertDirPath(dirPath);
      assertFilename(filename);
      assertContent(content);
      return invoke(CHANNELS.saveFile, { dirPath, filename, content });
    },
  },
});
