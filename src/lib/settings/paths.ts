import os from "node:os";
import path from "node:path";

const FALLBACK_DIR_NAME = ".md-convertor";

/** Settings directory. Electron injects MD_CONVERTOR_USER_DATA; tests inject a temporary directory. */
export function settingsDir(): string {
  const override = process.env.MD_CONVERTOR_USER_DATA?.trim();
  return override ? override : path.join(os.homedir(), FALLBACK_DIR_NAME);
}

export function settingsFilePath(): string {
  return path.join(settingsDir(), "settings.json");
}

export function secretsFilePath(): string {
  return path.join(settingsDir(), "secrets.json");
}
