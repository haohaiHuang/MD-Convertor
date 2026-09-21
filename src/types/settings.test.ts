import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  SETTINGS_VERSION,
  SettingsValidationError,
  isBcp47,
  validateSettings,
  type LocalCliId,
  type Settings,
} from "./settings";

function defaults(): Settings {
  return structuredClone(DEFAULT_SETTINGS);
}

function populated(): Settings {
  const settings = defaults();
  settings.cloud.providers.push({
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    keyStored: true,
    models: ["gpt-4o-mini"],
    selectedModel: "gpt-4o-mini",
  });
  settings.cloud.activeProviderId = "openai";
  settings.local.clis[0].detectedPath = "/opt/homebrew/bin/pi";
  settings.local.clis[0].models = ["sonnet"];
  settings.local.clis[0].selectedModel = "sonnet";
  settings.local.activeCliId = "pi";
  settings.languages = { target: "ja", custom: ["zh-Hant", "pt-BR"] };
  settings.translation.defaultEnabled = true;
  return settings;
}

function rejectionFor(mutate: (settings: Settings) => void): SettingsValidationError {
  const settings = populated();
  mutate(settings);
  let captured: unknown;
  try {
    validateSettings(settings);
  } catch (error) {
    captured = error;
  }
  expect(captured).toBeInstanceOf(SettingsValidationError);
  return captured as SettingsValidationError;
}

describe("settings types", () => {
  it("exposes stable defaults", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      version: 1,
      mode: "cloud",
      cloud: { providers: [], activeProviderId: null },
      local: {
        clis: [
          {
            id: "pi",
            name: "pi",
            enabled: true,
            detectedPath: null,
            models: [],
            selectedModel: null,
          },
          {
            id: "claude",
            name: "claude",
            enabled: true,
            detectedPath: null,
            models: [],
            selectedModel: null,
          },
        ],
        activeCliId: null,
      },
      languages: { target: "zh-Hans", custom: [] },
      translation: { defaultEnabled: false },
      output: { defaultPath: null, useDefaultPath: false },
    });
  });

  it("accepts the defaults and returns a detached copy", () => {
    const validated = validateSettings(DEFAULT_SETTINGS);
    expect(validated).toEqual(DEFAULT_SETTINGS);
    expect(validated).not.toBe(DEFAULT_SETTINGS);

    validated.cloud.providers.push({
      id: "leak",
      name: "leak",
      baseUrl: "https://example.com/v1",
      keyStored: false,
      models: [],
      selectedModel: null,
    });
    validated.local.clis[0].detectedPath = "/usr/bin/pi";
    expect(DEFAULT_SETTINGS.cloud.providers).toHaveLength(0);
    expect(DEFAULT_SETTINGS.local.clis[0].detectedPath).toBeNull();
  });

  it("accepts a fully populated settings object and keeps its values", () => {
    const settings = populated();
    expect(validateSettings(settings)).toEqual(settings);
  });

  it.each([null, [], "settings", 7])("rejects a non-object settings value", (value) => {
    let captured: unknown;
    try {
      validateSettings(value);
    } catch (error) {
      captured = error;
    }
    expect(captured).toBeInstanceOf(SettingsValidationError);
  });

  it("rejects an unsupported version", () => {
    expect(rejectionFor((settings) => {
      (settings as { version: number }).version = 2;
    }).message).toContain("settings.version");
  });

  it.each([
    ["mode", (settings: Settings) => { (settings as { mode: string }).mode = "auto"; }],
    ["translation.defaultEnabled", (settings: Settings) => {
      (settings.translation as unknown as { defaultEnabled: string }).defaultEnabled = "yes";
    }],
    ["cloud.providers[0].keyStored", (settings: Settings) => {
      (settings.cloud.providers[0] as unknown as { keyStored: string }).keyStored = "yes";
    }],
    ["cloud.providers[0].models[1]", (settings: Settings) => {
      (settings.cloud.providers[0] as { models: unknown[] }).models = ["ok", 7];
    }],
    ["languages.custom[0]", (settings: Settings) => {
      (settings.languages as { custom: unknown[] }).custom = [null];
    }],
    ["local.clis[0].id", (settings: Settings) => {
      (settings.local.clis[0] as { id: string }).id = "cursor";
    }],
  ])("rejects a wrong type at %s", (field, mutate) => {
    expect(rejectionFor(mutate).message).toContain(field);
  });

  it("rejects missing fields at every level", () => {
    expect(rejectionFor((settings) => {
      delete (settings.translation as Partial<Settings["translation"]>).defaultEnabled;
    }).message).toContain("translation.defaultEnabled");
    expect(rejectionFor((settings) => {
      delete (settings.cloud as Partial<Settings["cloud"]>).activeProviderId;
    }).message).toContain("cloud.activeProviderId");
    expect(rejectionFor((settings) => {
      delete (settings.cloud.providers[0] as Partial<Settings["cloud"]["providers"][number]>).baseUrl;
    }).message).toContain("cloud.providers[0].baseUrl");
    expect(rejectionFor((settings) => {
      delete (settings as Partial<Settings>).mode;
    }).message).toContain("settings.mode");
  });

  it("rejects unknown fields at every level", () => {
    expect(rejectionFor((settings) => {
      (settings as Settings & { hash: string }).hash = "x";
    }).message).toContain("settings.hash");
    expect(rejectionFor((settings) => {
      (settings.cloud as Settings["cloud"] & { cache: string }).cache = "x";
    }).message).toContain("cloud.cache");
    expect(rejectionFor((settings) => {
      (settings.cloud.providers[0] as Settings["cloud"]["providers"][number] & { apiKey: string }).apiKey = "x";
    }).message).toContain("cloud.providers[0].apiKey");
    expect(rejectionFor((settings) => {
      (settings.languages as Settings["languages"] & { auto: boolean }).auto = true;
    }).message).toContain("languages.auto");
    expect(rejectionFor((settings) => {
      (settings.local.clis[0] as Settings["local"]["clis"][number] & { version: string }).version = "1";
    }).message).toContain("local.clis[0].version");
  });

  it.each([
    "api.openai.com/v1",
    "ftp://api.openai.com/v1",
    "https://user:secret@api.openai.com/v1",
    "",
    "https://",
  ])("rejects the invalid provider base URL %s", (baseUrl) => {
    const error = rejectionFor((settings) => {
      settings.cloud.providers[0].baseUrl = baseUrl;
    });
    expect(error.message).toContain("cloud.providers[0].baseUrl");
    expect(error.message).not.toContain(baseUrl || "https://");
  });

  it.each(["zh_Hans", "chinese", "", "zh-Hans-CN-extra-9", "Z H"])(
    "rejects the invalid BCP-47 target language %s",
    (target) => {
      expect(rejectionFor((settings) => {
        settings.languages.target = target;
      }).message).toContain("languages.target");
    },
  );

  it("rejects an invalid custom language entry", () => {
    expect(rejectionFor((settings) => {
      settings.languages.custom = ["fr", "not a tag"];
    }).message).toContain("languages.custom[1]");
  });

  it("drops the retired apiKeyEnv field instead of rejecting the file", () => {
    const raw = {
      ...populated(),
      cloud: {
        activeProviderId: "openai",
        providers: [{
          id: "openai",
          name: "OpenAI",
          baseUrl: "https://api.openai.com/v1",
          apiKeyEnv: "OPENAI_API_KEY",
          keyStored: true,
          models: [],
          selectedModel: null,
        }],
      },
    };

    const validated = validateSettings(raw);

    expect(validated.cloud.providers[0]).not.toHaveProperty("apiKeyEnv");
    expect(validated.cloud.providers[0].name).toBe("OpenAI");
  });

  it("rejects duplicate provider ids", () => {
    expect(rejectionFor((settings) => {
      settings.cloud.providers.push({ ...settings.cloud.providers[0], name: "Copy" });
    }).message).toContain("cloud.providers[1].id");
  });

  it("rejects an active provider that does not exist", () => {
    expect(rejectionFor((settings) => {
      settings.cloud.activeProviderId = "missing";
    }).message).toContain("cloud.activeProviderId");
  });

  it("rejects an active CLI that does not exist", () => {
    expect(rejectionFor((settings) => {
      settings.local.activeCliId = "nope" as LocalCliId;
    }).message).toContain("local.activeCliId");
  });
});

describe("isBcp47", () => {
  it.each(["zh-Hans", "en", "pt-BR", "es-419", "ja", "ar", "zh-hant-hk", "de-CH-1901"])(
    "accepts %s",
    (tag) => {
      expect(isBcp47(tag)).toBe(true);
    },
  );

  it.each(["", "zh_Hans", "chinese", "zh-Hans-CN-extra-9", "en-", "-en"])("rejects %s", (tag) => {
    expect(isBcp47(tag)).toBe(false);
  });
});

describe("output settings", () => {
  it("includes output defaults in DEFAULT_SETTINGS", () => {
    expect(DEFAULT_SETTINGS.output).toEqual({ defaultPath: null, useDefaultPath: false });
  });

  it("accepts a fully populated settings object with output values", () => {
    const settings = populated();
    settings.output = { defaultPath: "/Users/someone/Documents/notes", useDefaultPath: true };
    expect(validateSettings(settings)).toEqual(settings);
  });

  it("keeps the settings version at 1 while adding output", () => {
    // The lenient read of a missing `output` must never be coupled to a version bump:
    // bumping would make every pre-feat-041 settings.json fail validation and wipe user config.
    expect(SETTINGS_VERSION).toBe(1);
  });

  it("fills a missing output object with defaults and keeps every existing field (legacy settings.json)", () => {
    const raw = populated() as Omit<Settings, "output">;
    const validated = validateSettings(raw);

    expect(validated.output).toEqual({ defaultPath: null, useDefaultPath: false });
    expect(validated.version).toBe(1);
    expect(validated.mode).toBe("cloud");
    expect(validated.cloud).toEqual(raw.cloud);
    expect(validated.local).toEqual(raw.local);
    expect(validated.languages).toEqual(raw.languages);
    expect(validated.translation).toEqual(raw.translation);
  });

  it("normalizes useDefaultPath=true with a null defaultPath to the all-default output", () => {
    const settings = populated();
    settings.output = { defaultPath: null, useDefaultPath: true };
    expect(validateSettings(settings).output).toEqual({ defaultPath: null, useDefaultPath: false });
  });

  it("normalizes the impossible combination before writing it back", () => {
    // The normalization is not read-only: the sanitized copy is what callers persist.
    const settings = populated();
    settings.output = { defaultPath: null, useDefaultPath: true };
    const validated = validateSettings(settings);
    expect(() => validateSettings(validated)).not.toThrow();
    expect(validated.output.useDefaultPath).toBe(false);
  });

  it("still rejects an unknown field inside output (leniency is missing-only, not shape-free)", () => {
    const raw = {
      ...populated(),
      output: { defaultPath: "/tmp/notes", useDefaultPath: true, extra: "x" },
    };
    let captured: unknown;
    try {
      validateSettings(raw);
    } catch (error) {
      captured = error;
    }
    expect(captured).toBeInstanceOf(SettingsValidationError);
    expect((captured as SettingsValidationError).message).toContain("output.extra");
  });

  it("rejects a non-boolean useDefaultPath", () => {
    const raw = {
      ...populated(),
      output: { defaultPath: "/tmp/notes", useDefaultPath: "yes" },
    };
    let captured: unknown;
    try {
      validateSettings(raw);
    } catch (error) {
      captured = error;
    }
    expect(captured).toBeInstanceOf(SettingsValidationError);
    expect((captured as SettingsValidationError).message).toContain("output.useDefaultPath");
  });

  it("rejects a non-string non-null defaultPath", () => {
    const raw = {
      ...populated(),
      output: { defaultPath: 7, useDefaultPath: false },
    };
    let captured: unknown;
    try {
      validateSettings(raw);
    } catch (error) {
      captured = error;
    }
    expect(captured).toBeInstanceOf(SettingsValidationError);
    expect((captured as SettingsValidationError).message).toContain("output.defaultPath");
  });

  it("rejects an empty-string defaultPath", () => {
    const raw = {
      ...populated(),
      output: { defaultPath: "", useDefaultPath: false },
    };
    let captured: unknown;
    try {
      validateSettings(raw);
    } catch (error) {
      captured = error;
    }
    expect(captured).toBeInstanceOf(SettingsValidationError);
    expect((captured as SettingsValidationError).message).toContain("output.defaultPath");
  });
});
