import { describe, expect, it } from "vitest";
import { assertFreshArtifact } from "./release-guards.mjs";

describe("release artifact freshness guard", () => {
  it("accepts a ZIP generated after release start", () => {
    expect(() => assertFreshArtifact({
      currentMtimeMs: 2_100,
      previousMtimeMs: 900,
      startedAtMs: 2_000,
    })).not.toThrow();
  });

  it("rejects an unchanged ZIP left by an earlier run", () => {
    expect(() => assertFreshArtifact({
      currentMtimeMs: 900,
      previousMtimeMs: 900,
      startedAtMs: 2_000,
    })).toThrow("predates this release run");
  });

  it("rejects a ZIP whose timestamp did not advance", () => {
    expect(() => assertFreshArtifact({
      currentMtimeMs: 2_000,
      previousMtimeMs: 2_000,
      startedAtMs: 2_000,
    })).toThrow("was not refreshed");
  });
});
