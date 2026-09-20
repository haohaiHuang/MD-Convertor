import { describe, expect, it } from "vitest";
import type { TranslationAnalysis } from "@/types/translation";
import { CONFIRM_RATIO, SKIP_RATIO, decideTranslation } from "./decision";

function analysis(ratio: number, totalChars = 1000): TranslationAnalysis {
  const targetChars = Math.round(ratio * totalChars);
  return {
    targetLanguage: "en",
    totalChars,
    targetChars,
    ratio: totalChars === 0 ? 0 : targetChars / totalChars,
    blocks: [],
  };
}

function emptyProse(): TranslationAnalysis {
  return { targetLanguage: "en", totalChars: 0, targetChars: 0, ratio: 0, blocks: [] };
}

describe("decideTranslation", () => {
  it("exposes the two documented thresholds", () => {
    expect(CONFIRM_RATIO).toBe(0.7);
    expect(SKIP_RATIO).toBe(0.97);
  });

  it("treats an empty prose body as skip, not as a 0% body", () => {
    expect(decideTranslation(emptyProse())).toEqual({ action: "skip", reason: "empty", percent: 0 });
  });

  it("translates everything below the confirmation threshold", () => {
    expect(decideTranslation(analysis(0))).toEqual({ action: "translate-all" });
    expect(decideTranslation(analysis(0.699))).toEqual({ action: "translate-all" });
  });

  it("asks for confirmation at exactly 0.70", () => {
    expect(decideTranslation(analysis(0.7))).toEqual({ action: "confirm", percent: 70 });
  });

  it("keeps confirming up to but not including 0.97", () => {
    expect(decideTranslation(analysis(0.969))).toEqual({ action: "confirm", percent: 97 });
  });

  it("skips at exactly 0.97 and above", () => {
    expect(decideTranslation(analysis(0.97))).toEqual({ action: "skip", reason: "target-language", percent: 97 });
    expect(decideTranslation(analysis(1))).toEqual({ action: "skip", reason: "target-language", percent: 100 });
  });

  it("compares the raw ratio but reports a rounded percentage", () => {
    const below = { ...emptyProse(), totalChars: 10000, targetChars: 9699, ratio: 0.9699 };
    expect(decideTranslation(below)).toEqual({ action: "confirm", percent: 97 });
    const above = { ...emptyProse(), totalChars: 10000, targetChars: 9700, ratio: 0.97 };
    expect(decideTranslation(above)).toEqual({ action: "skip", reason: "target-language", percent: 97 });
    const rounded = { ...emptyProse(), totalChars: 10000, targetChars: 8734, ratio: 0.8734 };
    expect(decideTranslation(rounded)).toEqual({ action: "confirm", percent: 87 });
  });
});
