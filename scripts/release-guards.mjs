import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, lstatSync, readdirSync } from "node:fs";
import { homedir as defaultHomedir } from "node:os";
import path from "node:path";

export const PROTECTED_BASELINE_COMMIT = "ce041c9c826eb7ebdb576482dfa8ef5a6ac3e286";
export const PROTECTED_BASELINE_ERROR = "Protected 0.1.3 source baseline is not intact.";
export const PROTECTED_ARCHIVE_SHA256 = "66909aa8759ec41fdde875204773958d32b33a2c903e7b4eb0858a50fb1bdf89";
export const PROTECTED_ARCHIVE_ERROR = "Protected 0.1.3 archive is not intact.";
export const HISTORICAL_ZIP_ERROR = "Protected historical release artifacts changed.";
export const HISTORICAL_ARCHIVE_RETIRED_NOTICE =
  "Historical release archives are absent from this machine and cannot be restored; tamper verification is retired for the missing entries.";
export const PROTECTED_HISTORICAL_ZIP_MANIFEST = Object.freeze({
  "MD-Convertor-darwin-arm64-0.1.0.zip": "674720e2348c8948746bedcea91b5ef22191575cb2213199d0d595d70dae0593",
  "MD-Convertor-darwin-arm64-0.1.1.zip": "d3fc7e83cf7c7ffb370f2413c614e41d3bf52a689195b6d80dcbba15175c53ef",
  "MD-Convertor-darwin-arm64-0.1.2.zip": "fbb645e1ad55b28373bc94f3974c85ca3a9aa3de58f73ce2530b9628ac84baf5",
  "MD-Convertor-darwin-arm64-0.1.3.zip": PROTECTED_ARCHIVE_SHA256,
  "MD-Convertor-darwin-arm64-0.2.0.zip": "5becae36a53e91129a0dbcb93c3f7f5f3197326b2c83df6f10cb8494d8116485",
  "MD-Convertor-darwin-arm64-0.2.1.zip": "32c1d96af58a7701e6d2fe0bf619be0f8f224803355c6ef63aad43c85569463e",
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

/**
 * The protected 0.1.3 archive was lost from this machine and cannot be restored, so an
 * absent archive is reported as retired instead of blocking every future release.
 * Tamper checks stay in force for as long as the file exists.
 */
export async function assertProtectedArchive({ homedir = defaultHomedir(), hashFile = sha256File } = {}) {
  const archivePath = getProtectedArchivePath(homedir);
  let stats;
  try {
    stats = lstatSync(archivePath);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return { status: "retired" };
    throw new Error(PROTECTED_ARCHIVE_ERROR);
  }
  try {
    if (!stats.isFile() || (stats.mode & 0o222) !== 0) throw new Error(PROTECTED_ARCHIVE_ERROR);
    if (await hashFile(archivePath) !== PROTECTED_ARCHIVE_SHA256) throw new Error(PROTECTED_ARCHIVE_ERROR);
  } catch {
    throw new Error(PROTECTED_ARCHIVE_ERROR);
  }
  return { status: "verified" };
}

export function getHistoricalZipArchiveDirectory(homedir = defaultHomedir()) {
  return path.join(homedir, "Downloads", "MD-Convertor-archive", "releases");
}

const HISTORICAL_ZIP_NAME = /^MD-Convertor-darwin-arm64-\d+\.\d+\.\d+\.zip$/;

export async function captureHistoricalZipSnapshot({
  homedir = defaultHomedir(),
  hashFile = sha256File,
} = {}) {
  try {
    return await readHistoricalZipSnapshot(getHistoricalZipArchiveDirectory(homedir), hashFile);
  } catch {
    throw new Error(HISTORICAL_ZIP_ERROR);
  }
}

/**
 * Missing entries are retired (the archives were lost and cannot be restored); anything
 * that still exists is hash-checked exactly as before, and unknown releases are rejected.
 */
async function readHistoricalZipSnapshot(directory, hashFile) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return [];
    throw new Error(HISTORICAL_ZIP_ERROR);
  }

  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const snapshot = [];

  for (const [name, expectedHash] of Object.entries(PROTECTED_HISTORICAL_ZIP_MANIFEST)) {
    const entry = byName.get(name);
    if (entry === undefined) continue;
    if (!entry.isFile()) throw new Error(HISTORICAL_ZIP_ERROR);
    const filePath = path.join(directory, name);
    const actualHash = String(await hashFile(filePath));
    if (actualHash !== expectedHash) throw new Error(HISTORICAL_ZIP_ERROR);
    snapshot.push({ path: filePath, sha256: actualHash });
  }

  if (entries.some(({ name }) => HISTORICAL_ZIP_NAME.test(name) && !Object.hasOwn(PROTECTED_HISTORICAL_ZIP_MANIFEST, name))) {
    throw new Error(HISTORICAL_ZIP_ERROR);
  }
  return snapshot;
}

export function listRetiredHistoricalZips(snapshot) {
  const present = new Set([...snapshot].map((entry) => path.basename(entry.path)));
  return Object.keys(PROTECTED_HISTORICAL_ZIP_MANIFEST).filter((name) => !present.has(name));
}

export async function assertHistoricalZipSnapshotUnchanged(
  previousSnapshot,
  { homedir = defaultHomedir(), hashFile = sha256File } = {},
) {
  try {
    const previous = [...previousSnapshot].sort((a, b) => a.path.localeCompare(b.path));
    const current = await captureHistoricalZipSnapshot({ homedir, hashFile });
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
