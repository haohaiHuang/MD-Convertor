import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, SettingsValidationError, type Settings } from "@/types/settings";
import { secretsFilePath, settingsDir, settingsFilePath } from "./paths";
import { SettingsStoreError, readSettings, writeSettings } from "./store";

let userDataDir: string;

function populated(): Settings {
  const settings = structuredClone(DEFAULT_SETTINGS);
  settings.cloud.providers.push({
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    keyStored: true,
    models: ["gpt-4o-mini"],
    selectedModel: "gpt-4o-mini",
  });
  settings.cloud.activeProviderId = "openai";
  return settings;
}

async function entries(): Promise<string[]> {
  return (await readdir(userDataDir)).sort();
}

beforeEach(async () => {
  userDataDir = await mkdtemp(path.join(os.tmpdir(), "md-convertor-settings-"));
  process.env.MD_CONVERTOR_USER_DATA = userDataDir;
});

afterEach(async () => {
  delete process.env.MD_CONVERTOR_USER_DATA;
  await rm(userDataDir, { force: true, recursive: true });
});

describe("settings paths", () => {
  it("resolves files inside MD_CONVERTOR_USER_DATA", () => {
    expect(settingsDir()).toBe(userDataDir);
    expect(settingsFilePath()).toBe(path.join(userDataDir, "settings.json"));
    expect(secretsFilePath()).toBe(path.join(userDataDir, "secrets.json"));
  });

  it("falls back to ~/.md-convertor without the environment override", () => {
    delete process.env.MD_CONVERTOR_USER_DATA;
    expect(settingsDir()).toBe(path.join(os.homedir(), ".md-convertor"));
  });
});

describe("readSettings", () => {
  it("falls back to defaults when the file does not exist", async () => {
    await expect(readSettings()).resolves.toEqual(DEFAULT_SETTINGS);
    expect(await entries()).toEqual([]);
  });

  it("returns a copy that cannot mutate the module defaults", async () => {
    const settings = await readSettings();
    settings.cloud.providers.push({
      id: "leak",
      name: "leak",
      baseUrl: "https://example.com/v1",
      keyStored: false,
      models: [],
      selectedModel: null,
    });
    expect(DEFAULT_SETTINGS.cloud.providers).toHaveLength(0);
  });

  it("reads back what writeSettings stored", async () => {
    const settings = populated();
    await writeSettings(settings);
    await expect(readSettings()).resolves.toEqual(settings);
  });

  it("backs up a corrupt file and falls back to defaults", async () => {
    const corrupt = '{"version": 1, "mode": "cloud"';
    await writeFile(settingsFilePath(), corrupt, "utf8");

    await expect(readSettings()).resolves.toEqual(DEFAULT_SETTINGS);

    const files = await entries();
    expect(files).toHaveLength(1);
    const backup = files.find((name) => name.startsWith("settings.corrupt-") && name.endsWith(".json"));
    expect(backup).toBeDefined();
    expect(await readFile(path.join(userDataDir, backup as string), "utf8")).toBe(corrupt);
    expect(files).not.toContain("settings.json");
  });

  it("backs up a schema-invalid file and falls back to defaults", async () => {
    const invalid = JSON.stringify({ ...populated(), unexpected: true });
    await writeFile(settingsFilePath(), invalid, "utf8");

    await expect(readSettings()).resolves.toEqual(DEFAULT_SETTINGS);

    const files = await entries();
    expect(files.filter((name) => name.startsWith("settings.corrupt-"))).toHaveLength(1);
  });

  it("rejects an unknown higher version without touching the file", async () => {
    const future = JSON.stringify({ ...populated(), version: 2 });
    await writeFile(settingsFilePath(), future, "utf8");

    await expect(readSettings()).rejects.toBeInstanceOf(SettingsStoreError);
    await expect(readSettings()).rejects.toMatchObject({ code: "SETTINGS_VERSION_UNSUPPORTED" });
    expect(await entries()).toEqual(["settings.json"]);
    expect(await readFile(settingsFilePath(), "utf8")).toBe(future);
  });

  it("surfaces a missing version as a corrupt file", async () => {
    const withoutVersion: Record<string, unknown> = { ...populated() };
    delete withoutVersion.version;
    await writeFile(settingsFilePath(), JSON.stringify(withoutVersion), "utf8");

    await expect(readSettings()).resolves.toEqual(DEFAULT_SETTINGS);
    const files = await entries();
    expect(files.filter((name) => name.startsWith("settings.corrupt-"))).toHaveLength(1);
  });
});

describe("writeSettings", () => {
  it("creates the settings directory when missing", async () => {
    const nested = path.join(userDataDir, "nested", "deeper");
    process.env.MD_CONVERTOR_USER_DATA = nested;

    await writeSettings(populated());

    await expect(readSettings()).resolves.toEqual(populated());
  });

  it("writes the file with mode 0600", async () => {
    await writeSettings(populated());
    expect(((await stat(settingsFilePath())).mode & 0o777).toString(8)).toBe("600");
  });

  it("tightens the mode of an existing world-readable file", async () => {
    await writeFile(settingsFilePath(), "{}", { mode: 0o644 });
    await writeSettings(populated());
    expect(((await stat(settingsFilePath())).mode & 0o777).toString(8)).toBe("600");
  });

  it("replaces the file through a rename instead of truncating it", async () => {
    await writeSettings(populated());
    const before = await stat(settingsFilePath());

    await writeSettings(DEFAULT_SETTINGS);
    const after = await stat(settingsFilePath());

    expect(after.ino).not.toBe(before.ino);
    expect(await entries()).toEqual(["settings.json"]);
    expect(await readFile(settingsFilePath(), "utf8")).toContain('"providers": []');
  });

  it("rejects invalid settings without writing anything", async () => {
    const invalid = { ...populated(), version: 99 } as unknown as Settings;
    await expect(writeSettings(invalid)).rejects.toBeInstanceOf(SettingsValidationError);
    expect(await entries()).toEqual([]);
  });
});
