import { describe, expect, it } from "vitest";
import {
  TRANSLATE_CALL_TIMEOUT_MS,
  TRANSLATE_TASK_BASE_TIMEOUT_MS,
  TRANSLATE_TASK_TIMEOUT_MS,
  translateTaskTimeoutMs,
} from "./limits";

describe("translateTaskTimeoutMs", () => {
  it("never drops below the base budget for a short document", () => {
    expect(translateTaskTimeoutMs(0)).toBe(TRANSLATE_TASK_TIMEOUT_MS);
    // One batch is already worth a full call ceiling plus overhead.
    expect(translateTaskTimeoutMs(1)).toBe(TRANSLATE_CALL_TIMEOUT_MS + TRANSLATE_TASK_BASE_TIMEOUT_MS);
  });

  it("grows by one call ceiling per batch once the base is passed", () => {
    expect(translateTaskTimeoutMs(2)).toBe(2 * TRANSLATE_CALL_TIMEOUT_MS + TRANSLATE_TASK_BASE_TIMEOUT_MS);
    expect(translateTaskTimeoutMs(8)).toBe(8 * TRANSLATE_CALL_TIMEOUT_MS + TRANSLATE_TASK_BASE_TIMEOUT_MS);
  });

  it("covers a long article of many short paragraphs", () => {
    // A 9,000-character article of 150 short paragraphs is 8 batches at 20 blocks each.
    expect(translateTaskTimeoutMs(8)).toBeGreaterThan(TRANSLATE_TASK_TIMEOUT_MS * 4);
  });

  it("leaves room for the thinking tokens of a reasoning model", () => {
    // A cloud reasoning provider only answered one batch after 38-60s of
    // reasoning tokens, so the old 60s ceiling cut the call off mid-body.
    expect(TRANSLATE_CALL_TIMEOUT_MS).toBe(180_000);
    expect(translateTaskTimeoutMs(3)).toBe(3 * TRANSLATE_CALL_TIMEOUT_MS + TRANSLATE_TASK_BASE_TIMEOUT_MS);
  });
});
