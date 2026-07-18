export function assertFreshArtifact({ currentMtimeMs, previousMtimeMs, startedAtMs }) {
  if (currentMtimeMs < startedAtMs - 1_000) {
    throw new Error("Release ZIP predates this release run.");
  }
  if (previousMtimeMs !== null && currentMtimeMs <= previousMtimeMs) {
    throw new Error("Release ZIP was not refreshed by this release run.");
  }
}
