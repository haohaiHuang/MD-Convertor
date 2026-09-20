import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_SETTINGS,
  SETTINGS_VERSION,
  SettingsValidationError,
  validateSettings,
  type Settings,
} from "@/types/settings";
import { settingsFilePath } from "./paths";

export const CORRUPT_BACKUP_PREFIX = "settings.corrupt-";

export class SettingsStoreError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SettingsStoreError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function backupName(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${CORRUPT_BACKUP_PREFIX}${stamp}.json`;
}

/**
 * Reads userData/settings.json.
 * Missing file or invalid content falls back to DEFAULT_SETTINGS; invalid content is preserved
 * as settings.corrupt-<timestamp>.json so nothing the user typed is silently destroyed.
 * There is no migration path yet: version 1 is the first schema (see S1 handoff).
 */
export async function readSettings(): Promise<Settings> {
  const filePath = settingsFilePath();
  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return validateSettings(DEFAULT_SETTINGS);
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  if (isRecord(parsed) && typeof parsed.version === "number" && parsed.version > SETTINGS_VERSION) {
    throw new SettingsStoreError(
      "SETTINGS_VERSION_UNSUPPORTED",
      `settings.json version ${parsed.version} is newer than supported version ${SETTINGS_VERSION}.`,
    );
  }

  try {
    return validateSettings(parsed);
  } catch (error) {
    if (!(error instanceof SettingsValidationError)) throw error;
  }

  await rename(filePath, path.join(path.dirname(filePath), backupName()));
  return validateSettings(DEFAULT_SETTINGS);
}

/** Validates, then writes through a temporary file and rename so readers never see a partial file. */
export async function writeSettings(settings: Settings): Promise<void> {
  const validated = validateSettings(settings);
  const filePath = settingsFilePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(validated, null, 2)}\n`, { mode: 0o600 });
  await rename(tempPath, filePath);
}
