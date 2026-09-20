import { describe, expect, it } from "vitest";
import { isBcp47 } from "@/types/settings";
import { PRESET_TARGET_LANGUAGES, addCustomLanguage, languageLabel } from "./languages";

describe("PRESET_TARGET_LANGUAGES", () => {
  it("ships eleven target languages", () => {
    expect(PRESET_TARGET_LANGUAGES).toHaveLength(11);
  });

  it("uses unique, valid BCP-47 tags", () => {
    const tags = PRESET_TARGET_LANGUAGES.map((language) => language.tag);
    expect(new Set(tags).size).toBe(tags.length);
    expect(tags.every((tag) => isBcp47(tag))).toBe(true);
  });

  it("offers every language with a label", () => {
    expect(PRESET_TARGET_LANGUAGES.every((language) => language.label.trim().length > 0)).toBe(true);
    expect(PRESET_TARGET_LANGUAGES.map((language) => language.label)).toContain("简体中文");
  });
});

describe("languageLabel", () => {
  it("returns the preset label", () => {
    expect(languageLabel("ja")).toBe("日语");
  });

  it("returns the raw tag for a tag the app has no label for", () => {
    expect(languageLabel("sv")).toBe("sv");
  });
});

describe("addCustomLanguage", () => {
  it("appends a valid tag", () => {
    expect(addCustomLanguage([], "sv")).toEqual(["sv"]);
    expect(addCustomLanguage(["sv"], "nb-NO")).toEqual(["sv", "nb-NO"]);
  });

  it("trims input", () => {
    expect(addCustomLanguage([], "  da  ")).toEqual(["da"]);
  });

  it("ignores duplicates, including case differences", () => {
    expect(addCustomLanguage(["sv"], "sv")).toEqual(["sv"]);
    expect(addCustomLanguage(["sv"], "SV")).toEqual(["sv"]);
  });

  it("ignores a tag that is already a preset", () => {
    expect(addCustomLanguage([], "ja")).toEqual([]);
  });

  it("rejects an invalid BCP-47 tag without naming the value", () => {
    for (const invalid of ["", "  ", "nope!", "japanese", "-ja", "a"]) {
      expect(() => addCustomLanguage([], invalid)).toThrow(/languages\.custom/);
    }
  });
});
