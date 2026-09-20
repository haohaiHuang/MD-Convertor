import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Shared with the preload/IPC whitelist so no caller can pass a surprising name. */
export const PROVIDER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

const SYSTEM_PATH_ENTRIES = ["/usr/bin", "/bin", "/usr/sbin", "/sbin", "/usr/local/bin", "/opt/homebrew/bin"];
const HOME_PATH_ENTRIES = [".npm-global/bin", ".local/bin", "bin"];

export function mergePathEntries(entries) {
  const seen = new Set();
  const merged = [];
  for (const entry of entries) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    merged.push(trimmed);
  }
  return merged;
}

/**
 * GUI launch through Finder gets a minimal launchd PATH, so the user's login
 * shell PATH and the usual per-user install locations are merged back in.
 */
export function resolvePathEnv({ processPath = "", loginShellPath = "", homeDir = "" } = {}) {
  const entries = [
    ...String(processPath).split(path.delimiter),
    ...String(loginShellPath).split(path.delimiter),
    ...(homeDir ? HOME_PATH_ENTRIES.map((entry) => path.join(homeDir, entry)) : []),
    ...SYSTEM_PATH_ENTRIES,
  ];
  return mergePathEntries(entries).join(path.delimiter);
}

/** Reads the PATH a login shell would produce; any failure degrades to "no extra PATH". */
export function readLoginShellPath(runCommand = defaultRunCommand) {
  try {
    const output = runCommand("/bin/zsh", ["-lc", "echo -n $PATH"]);
    return typeof output === "string" ? output.trim() : "";
  } catch {
    return "";
  }
}

function defaultRunCommand(file, args) {
  return execFileSync(file, args, { encoding: "utf8", timeout: 3000, stdio: ["ignore", "pipe", "ignore"] });
}

function unquote(value) {
  if (value.length >= 2) {
    const first = value[0];
    if ((first === '"' || first === "'") && value.endsWith(first)) return value.slice(1, -1);
  }
  return value.replace(/\s+#.*$/, "").trim();
}

const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Minimal dotenv reader: comments, blanks, optional `export`, quotes, last duplicate wins. */
export function parseDotEnv(content) {
  const result = {};
  for (const rawLine of String(content).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const assignment = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const separator = assignment.indexOf("=");
    if (separator <= 0) continue;
    const key = assignment.slice(0, separator).trim();
    if (!KEY_PATTERN.test(key)) continue;
    result[key] = unquote(assignment.slice(separator + 1).trim());
  }
  return result;
}

export async function readDotEnvFile(filePath) {
  try {
    return parseDotEnv(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw error;
  }
}

/** Base64 JSON of { [providerId]: plaintextKey } for MD_CONVERTOR_SECRETS. */
export function encodeSecretsPayload(secrets) {
  return Buffer.from(JSON.stringify(secrets), "utf8").toString("base64");
}

/**
 * Environment for the local Next.js server child process. The launching environment
 * wins over userData/.env, and the MD_CONVERTOR_* keys are always authoritative.
 */
export function buildServerEnv({ baseEnv = {}, pathEnv = "", userDataDir = "", secrets = {}, dotEnv = {} } = {}) {
  return {
    ...dotEnv,
    ...baseEnv,
    PATH: pathEnv,
    MD_CONVERTOR_USER_DATA: userDataDir,
    MD_CONVERTOR_SECRETS: encodeSecretsPayload(secrets),
  };
}
