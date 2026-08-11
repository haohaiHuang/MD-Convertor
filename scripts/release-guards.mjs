import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, lstatSync, readdirSync } from "node:fs";
import { homedir as defaultHomedir } from "node:os";
import path from "node:path";

export const PROTECTED_BASELINE_COMMIT = "ce041c9c826eb7ebdb576482dfa8ef5a6ac3e286";
export const PROTECTED_BASELINE_ERROR = "Protected 0.1.3 source baseline is not intact.";
export const PROTECTED_ARCHIVE_SHA256 = "66909aa8759ec41fdde875204773958d32b33a2c903e7b4eb0858a50fb1bdf89";
export const PROTECTED_ARCHIVE_ERROR = "Protected 0.1.3 archive is not intact.";
export const HISTORICAL_ZIP_ERROR = "Protected 0.1.x artifacts changed.";
export const PROTECTED_HISTORICAL_ZIP_MANIFEST = Object.freeze({
  "MD-Convertor-darwin-arm64-0.1.0.zip": "674720e2348c8948746bedcea91b5ef22191575cb2213199d0d595d70dae0593",
  "MD-Convertor-darwin-arm64-0.1.1.zip": "d3fc7e83cf7c7ffb370f2413c614e41d3bf52a689195b6d80dcbba15175c53ef",
  "MD-Convertor-darwin-arm64-0.1.2.zip": "fbb645e1ad55b28373bc94f3974c85ca3a9aa3de58f73ce2530b9628ac84baf5",
  "MD-Convertor-darwin-arm64-0.1.3.zip": PROTECTED_ARCHIVE_SHA256,
});

function resolveGitRef(ref, root) {
  return execFileSync("git", ["rev-parse", "--verify", ref], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

export function assertProtectedBaseline({ root = process.cwd(), revParse = resolveGitRef } = {}) {
  try {
    const tagCommit = String(revParse("v0.1.3^{commit}", root)).trim();
    if (tagCommit !== PROTECTED_BASELINE_COMMIT) {
      throw new Error(PROTECTED_BASELINE_ERROR);
    }
  } catch {
    throw new Error(PROTECTED_BASELINE_ERROR);
  }
}

export function getProtectedArchivePath(homedir = defaultHomedir()) {
  return path.join(
    homedir,
    "Downloads",
    "MD-Convertor-0.1.3-release",
    "MD-Convertor-darwin-arm64-0.1.3.zip",
  );
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

export async function assertProtectedArchive({ homedir = defaultHomedir(), hashFile = sha256File } = {}) {
  try {
    const archivePath = getProtectedArchivePath(homedir);
    const stats = lstatSync(archivePath);
    if (!stats.isFile() || (stats.mode & 0o222) !== 0) throw new Error(PROTECTED_ARCHIVE_ERROR);
    if (await hashFile(archivePath) !== PROTECTED_ARCHIVE_SHA256) throw new Error(PROTECTED_ARCHIVE_ERROR);
  } catch {
    throw new Error(PROTECTED_ARCHIVE_ERROR);
  }
}

function historicalZipDirectory(root) {
  return path.join(root, "out", "make", "zip", "darwin", "arm64");
}

const HISTORICAL_ZIP_NAME = /^MD-Convertor-darwin-arm64-0\.1\.\d+\.zip$/;

export async function captureHistoricalZipSnapshot({ root = process.cwd(), hashFile = sha256File } = {}) {
  const directory = historicalZipDirectory(root);
  try {
    const entries = readdirSync(directory, { withFileTypes: true });
    const byName = new Map(entries.map((entry) => [entry.name, entry]));
    const snapshot = [];

    for (const [name, expectedHash] of Object.entries(PROTECTED_HISTORICAL_ZIP_MANIFEST)) {
      const entry = byName.get(name);
      const filePath = path.join(directory, name);
      if (!entry?.isFile() || !lstatSync(filePath).isFile()) throw new Error(HISTORICAL_ZIP_ERROR);
      const actualHash = String(await hashFile(filePath));
      if (actualHash !== expectedHash) throw new Error(HISTORICAL_ZIP_ERROR);
      snapshot.push({ path: filePath, sha256: actualHash });
    }

    if (entries.some(({ name }) => HISTORICAL_ZIP_NAME.test(name) && !Object.hasOwn(PROTECTED_HISTORICAL_ZIP_MANIFEST, name))) {
      throw new Error(HISTORICAL_ZIP_ERROR);
    }
    return snapshot;
  } catch {
    throw new Error(HISTORICAL_ZIP_ERROR);
  }
}

export async function assertHistoricalZipSnapshotUnchanged(
  previousSnapshot,
  { root = process.cwd(), hashFile = sha256File } = {},
) {
  try {
    const previous = [...previousSnapshot].sort((a, b) => a.path.localeCompare(b.path));
    const current = await captureHistoricalZipSnapshot({ root, hashFile });
    if (JSON.stringify(current) !== JSON.stringify(previous)) throw new Error(HISTORICAL_ZIP_ERROR);
  } catch {
    throw new Error(HISTORICAL_ZIP_ERROR);
  }
}

export function assertFreshArtifact({ currentMtimeMs, previousMtimeMs, startedAtMs }) {
  if (currentMtimeMs < startedAtMs - 1_000) {
    throw new Error("Release ZIP predates this release run.");
  }
  if (previousMtimeMs !== null && currentMtimeMs <= previousMtimeMs) {
    throw new Error("Release ZIP was not refreshed by this release run.");
  }
}
