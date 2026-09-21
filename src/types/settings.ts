export const SETTINGS_VERSION = 1;

const BCP47_PATTERN = /^[a-z]{2,3}(-[a-z]{4})?(-([a-z]{2}|\d{3}))?(-([a-z0-9]{5,8}|\d[a-z0-9]{3}))*$/i;
const PROVIDER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export const LOCAL_CLI_IDS = ["pi", "claude"] as const;

export type SettingsMode = "cloud" | "local";
export type LocalCliId = (typeof LOCAL_CLI_IDS)[number];

export type CloudProviderSettings = {
  id: string;
  name: string;
  /** OpenAI-compatible API root, for example https://api.openai.com/v1 */
  baseUrl: string;
  /** Whether an encrypted entry exists in secrets.json. Plaintext keys never reach this file. */
  keyStored: boolean;
  models: string[];
  selectedModel: string | null;
};

export type LocalCliSettings = {
  id: LocalCliId;
  name: string;
  enabled: boolean;
  detectedPath: string | null;
  models: string[];
  /** null means "use the CLI default model". */
  selectedModel: string | null;
};

export type Settings = {
  version: typeof SETTINGS_VERSION;
  mode: SettingsMode;
  cloud: {
    providers: CloudProviderSettings[];
    activeProviderId: string | null;
  };
  local: {
    clis: LocalCliSettings[];
    activeCliId: LocalCliId | null;
  };
  languages: {
    /** BCP-47 tag of the single active target language. */
    target: string;
    /** Extra BCP-47 tags the user entered manually. */
    custom: string[];
  };
  translation: {
    defaultEnabled: boolean;
  };
  output: OutputSettings;
};

export type OutputSettings = {
  /** Absolute directory path; null = not configured. */
  defaultPath: string | null;
  /** true = downloads write straight into defaultPath without a save dialog. */
  useDefaultPath: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  mode: "cloud",
  cloud: {
    providers: [],
    activeProviderId: null,
  },
  local: {
    clis: [
      { id: "pi", name: "pi", enabled: true, detectedPath: null, models: [], selectedModel: null },
      { id: "claude", name: "claude", enabled: true, detectedPath: null, models: [], selectedModel: null },
    ],
    activeCliId: null,
  },
  languages: {
    target: "zh-Hans",
    custom: [],
  },
  translation: {
    defaultEnabled: false,
  },
  output: {
    defaultPath: null,
    useDefaultPath: false,
  },
};

/** Validation failures always name the field path, never the received value. */
export class SettingsValidationError extends Error {
  constructor(detail: string) {
    super(`Invalid settings: ${detail}`);
    this.name = "SettingsValidationError";
  }
}

export function isBcp47(value: string): boolean {
  return BCP47_PATTERN.test(value);
}

/** Provider identifiers are also secrets-store keys, so they stay strictly shaped. */
export function isProviderId(value: string): boolean {
  return PROVIDER_ID_PATTERN.test(value);
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:")
      && url.username === ""
      && url.password === "";
  } catch {
    return false;
  }
}

type JsonObject = Record<string, unknown>;

const CLOUD_KEYS = ["providers", "activeProviderId"] as const;
const PROVIDER_KEYS = ["id", "name", "baseUrl", "keyStored", "models", "selectedModel"] as const;
/** Fields earlier versions wrote; accepted on read and dropped on write. */
const RETIRED_PROVIDER_KEYS = ["apiKeyEnv"] as const;
const LOCAL_KEYS = ["clis", "activeCliId"] as const;
const CLI_KEYS = ["id", "name", "enabled", "detectedPath", "models", "selectedModel"] as const;
const LANGUAGE_KEYS = ["target", "custom"] as const;
const TRANSLATION_KEYS = ["defaultEnabled"] as const;
const OUTPUT_KEYS = ["defaultPath", "useDefaultPath"] as const;
const ROOT_KEYS = ["version", "mode", "cloud", "local", "languages", "translation", "output"] as const;

function fail(path: string, reason: string): never {
  throw new SettingsValidationError(`${path} ${reason}`);
}

function readObject(value: unknown, path: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(path, "must be an object");
  return value as JsonObject;
}

function readFields(value: JsonObject, path: string, allowed: readonly string[], retired: readonly string[] = []): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key) && !retired.includes(key)) fail(`${path}.${key}`, "is not a known field");
  }
  for (const key of allowed) {
    if (!(key in value)) fail(`${path}.${key}`, "is missing");
  }
}

function readString(
  value: JsonObject,
  path: string,
  key: string,
  check?: { test: (candidate: string) => boolean; reason: string },
): string {
  const raw = value[key];
  if (typeof raw !== "string") fail(`${path}.${key}`, "must be a string");
  const text = raw as string;
  if (check && !check.test(text)) fail(`${path}.${key}`, check.reason);
  return text;
}

function readNullableString(
  value: JsonObject,
  path: string,
  key: string,
  check?: { test: (candidate: string) => boolean; reason: string },
): string | null {
  const raw = value[key];
  if (raw === null) return null;
  if (typeof raw !== "string") fail(`${path}.${key}`, "must be a string or null");
  const text = raw as string;
  if (check && !check.test(text)) fail(`${path}.${key}`, check.reason);
  return text;
}

function readBoolean(value: JsonObject, path: string, key: string): boolean {
  const raw = value[key];
  if (typeof raw !== "boolean") fail(`${path}.${key}`, "must be a boolean");
  return raw as boolean;
}

function readStringArray(
  value: JsonObject,
  path: string,
  key: string,
  check?: { test: (candidate: string) => boolean; reason: string },
): string[] {
  const raw = value[key];
  if (!Array.isArray(raw)) fail(`${path}.${key}`, "must be an array");
  return (raw as unknown[]).map((entry, index) => {
    const entryPath = `${path}.${key}[${index}]`;
    if (typeof entry !== "string") fail(entryPath, "must be a string");
    const text = entry as string;
    if (check && !check.test(text)) fail(entryPath, check.reason);
    return text;
  });
}

const NON_EMPTY = { test: (value: string) => value.length > 0, reason: "must not be empty" };
const HTTP_URL = { test: isHttpUrl, reason: "must be an absolute http(s) URL without credentials" };
const BCP47 = { test: isBcp47, reason: "must be a BCP-47 language tag" };
const PROVIDER_ID = { test: (value: string) => PROVIDER_ID_PATTERN.test(value), reason: "must be a 1-64 character id" };
const CLI_ID = { test: (value: string) => (LOCAL_CLI_IDS as readonly string[]).includes(value), reason: "must be a known CLI id" };

function readProvider(value: unknown, path: string): CloudProviderSettings {
  const object = readObject(value, path);
  readFields(object, path, PROVIDER_KEYS, RETIRED_PROVIDER_KEYS);
  return {
    id: readString(object, path, "id", PROVIDER_ID),
    name: readString(object, path, "name", NON_EMPTY),
    baseUrl: readString(object, path, "baseUrl", HTTP_URL),
    keyStored: readBoolean(object, path, "keyStored"),
    models: readStringArray(object, path, "models", NON_EMPTY),
    selectedModel: readNullableString(object, path, "selectedModel", NON_EMPTY),
  };
}

function readCli(value: unknown, path: string): LocalCliSettings {
  const object = readObject(value, path);
  readFields(object, path, CLI_KEYS);
  return {
    id: readString(object, path, "id", CLI_ID) as LocalCliId,
    name: readString(object, path, "name", NON_EMPTY),
    enabled: readBoolean(object, path, "enabled"),
    detectedPath: readNullableString(object, path, "detectedPath", NON_EMPTY),
    models: readStringArray(object, path, "models", NON_EMPTY),
    selectedModel: readNullableString(object, path, "selectedModel", NON_EMPTY),
  };
}

function readArray(value: JsonObject, path: string, key: string): unknown[] {
  const raw = value[key];
  if (!Array.isArray(raw)) fail(`${path}.${key}`, "must be an array");
  return raw as unknown[];
}

function assertUniqueIds(entries: { id: string }[], path: string, key: string): void {
  const seen = new Set<string>();
  entries.forEach((entry, index) => {
    if (seen.has(entry.id)) fail(`${path}.${key}[${index}].id`, "is duplicated");
    seen.add(entry.id);
  });
}

/** Strict, non-mutating validation of a settings value read from disk or from a request body. */
export function validateSettings(value: unknown): Settings {
  const root = readObject(value, "settings");
  // `output` is the only field allowed to be absent on read: pre-0.3.6 settings.json
  // files legitimately lack it, and rejecting the file would reset every user config.
  // Everything else stays strict, and written files always contain `output`.
  for (const key of Object.keys(root)) {
    if (!ROOT_KEYS.includes(key as (typeof ROOT_KEYS)[number])) fail(`settings.${key}`, "is not a known field");
  }
  for (const key of ROOT_KEYS) {
    if (key === "output") continue;
    if (!(key in root)) fail(`settings.${key}`, "is missing");
  }

  const version = root.version;
  if (typeof version !== "number") fail("settings.version", "must be a number");
  if (version !== SETTINGS_VERSION) fail("settings.version", `must be ${SETTINGS_VERSION}`);

  const mode = readString(root, "settings", "mode");
  if (mode !== "cloud" && mode !== "local") fail("settings.mode", 'must be "cloud" or "local"');

  const cloud = readObject(root.cloud, "cloud");
  readFields(cloud, "cloud", CLOUD_KEYS);
  const providers = readArray(cloud, "cloud", "providers")
    .map((entry, index) => readProvider(entry, `cloud.providers[${index}]`));
  assertUniqueIds(providers, "cloud", "providers");
  const activeProviderId = readNullableString(cloud, "cloud", "activeProviderId", PROVIDER_ID);
  if (activeProviderId !== null && !providers.some((provider) => provider.id === activeProviderId)) {
    fail("cloud.activeProviderId", "must reference a configured provider");
  }

  const local = readObject(root.local, "local");
  readFields(local, "local", LOCAL_KEYS);
  const clis = readArray(local, "local", "clis").map((entry, index) => readCli(entry, `local.clis[${index}]`));
  assertUniqueIds(clis, "local", "clis");
  const activeCliId = readNullableString(local, "local", "activeCliId", CLI_ID) as LocalCliId | null;
  if (activeCliId !== null && !clis.some((cli) => cli.id === activeCliId)) {
    fail("local.activeCliId", "must reference a known CLI");
  }

  const languages = readObject(root.languages, "languages");
  readFields(languages, "languages", LANGUAGE_KEYS);

  const translation = readObject(root.translation, "translation");
  readFields(translation, "translation", TRANSLATION_KEYS);

  // Lenient read: a missing output object falls back to the defaults (see comment above).
  const output = "output" in root && root.output !== undefined
    ? readOutput(root.output)
    : { defaultPath: null, useDefaultPath: false };
  // Binding rule: an enabled switch without a directory is normalized away so the
  // stored file can never describe "direct-write mode with nowhere to write".
  if (output.useDefaultPath && output.defaultPath === null) {
    output.defaultPath = null;
    output.useDefaultPath = false;
  }

  return {
    version: SETTINGS_VERSION,
    mode,
    cloud: { providers, activeProviderId },
    local: { clis, activeCliId },
    languages: {
      target: readString(languages, "languages", "target", BCP47),
      custom: readStringArray(languages, "languages", "custom", BCP47),
    },
    translation: {
      defaultEnabled: readBoolean(translation, "translation", "defaultEnabled"),
    },
    output,
  };
}

function readOutput(value: unknown): OutputSettings {
  const object = readObject(value, "settings.output");
  readFields(object, "settings.output", OUTPUT_KEYS);
  return {
    defaultPath: readNullableString(object, "settings.output", "defaultPath", NON_EMPTY),
    useDefaultPath: readBoolean(object, "settings.output", "useDefaultPath"),
  };
}
