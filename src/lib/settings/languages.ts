import { SettingsValidationError, isBcp47 } from "@/types/settings";

export type TargetLanguage = {
  tag: string;
  label: string;
};

/** The eleven preset target languages offered by the settings page. */
export const PRESET_TARGET_LANGUAGES: TargetLanguage[] = [
  { tag: "zh-Hans", label: "简体中文" },
  { tag: "en", label: "英语" },
  { tag: "ja", label: "日语" },
  { tag: "ko", label: "韩语" },
  { tag: "fr", label: "法语" },
  { tag: "de", label: "德语" },
  { tag: "es", label: "西班牙语" },
  { tag: "pt", label: "葡萄牙语" },
  { tag: "it", label: "意大利语" },
  { tag: "ru", label: "俄语" },
  { tag: "ar", label: "阿拉伯语" },
];

export function languageLabel(tag: string): string {
  return PRESET_TARGET_LANGUAGES.find((language) => language.tag === tag)?.label ?? tag;
}

/**
 * Appends a manually entered BCP-47 tag, ignoring presets and duplicates.
 * The validation error names the field path only, never the rejected value.
 */
export function addCustomLanguage(custom: string[], tag: string): string[] {
  const value = tag.trim();
  if (!isBcp47(value)) {
    throw new SettingsValidationError("languages.custom must be a BCP-47 language tag");
  }

  const needle = value.toLowerCase();
  const isPreset = PRESET_TARGET_LANGUAGES.some((language) => language.tag.toLowerCase() === needle);
  const isDuplicate = custom.some((existing) => existing.toLowerCase() === needle);
  return isPreset || isDuplicate ? custom : [...custom, value];
}
