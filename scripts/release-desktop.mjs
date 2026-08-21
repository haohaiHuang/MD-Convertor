import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import packageJson from "../package.json" with { type: "json" };
import {
  assertFreshArtifact,
  assertHistoricalZipSnapshotUnchanged,
  assertProtectedArchive,
  assertProtectedBaseline,
  captureHistoricalZipSnapshot,
  HISTORICAL_ZIP_ERROR,
  PROTECTED_ARCHIVE_ERROR,
  PROTECTED_BASELINE_ERROR,
} from "./release-guards.mjs";

export const RELEASE_VERSION_ERROR = "Release version must be 0.2.1.";

function getArtifactPaths(root, version) {
  const zipPath = path.join(
    root,
    "out",
    "make",
    "zip",
    "darwin",
    "arm64",
    `MD-Convertor-darwin-arm64-${version}.zip`,
  );
  const appPath = path.join(root, "out", "MD-Convertor-darwin-arm64", "MD-Convertor.app");
  return {
    zipPath,
    appPath,
    executablePath: path.join(appPath, "Contents", "MacOS", "MD-Convertor"),
    plistPath: path.join(appPath, "Contents", "Info.plist"),
  };
}

function runCommand(command, args, { root = process.cwd() } = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}.`);
  }
}

function readPlistValue(key, plistPath) {
  return execFileSync("/usr/bin/plutil", ["-extract", key, "raw", "-o", "-", plistPath], {
    encoding: "utf8",
  }).trim();
}

function verifyZippedApplication(zipPath, version) {
  const extractionRoot = mkdtempSync(path.join(tmpdir(), "md-convertor-zip-verify-"));
  const plistEntry = "MD-Convertor.app/Contents/Info.plist";
  const executableEntry = "MD-Convertor.app/Contents/MacOS/MD-Convertor";
  try {
    execFileSync("/usr/bin/unzip", ["-qq", zipPath, plistEntry, executableEntry, "-d", extractionRoot]);
    const plistPath = path.join(extractionRoot, plistEntry);
    const executablePath = path.join(extractionRoot, executableEntry);
    const shortVersion = readPlistValue("CFBundleShortVersionString", plistPath);
    const bundleVersion = readPlistValue("CFBundleVersion", plistPath);
    if (shortVersion !== version || bundleVersion !== version) {
      throw new Error(`ZIP application version mismatch: expected ${version}, found ${shortVersion}/${bundleVersion}.`);
    }
    const executableDescription = execFileSync("/usr/bin/file", [executablePath], { encoding: "utf8" });
    if (!executableDescription.includes("arm64")) {
      throw new Error(`ZIP application architecture is not arm64: ${executableDescription.trim()}`);
    }
  } finally {
    rmSync(extractionRoot, { recursive: true, force: true });
  }
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

export function verifyFreshArtifact({
  root = process.cwd(),
  version = packageJson.version,
  previousZip = null,
  startedAtMs = Date.now(),
} = {}) {
  const { zipPath, appPath, executablePath, plistPath } = getArtifactPaths(root, version);
  if (!existsSync(zipPath)) throw new Error(`Expected ZIP was not generated: ${zipPath}`);
  if (!existsSync(executablePath) || !existsSync(plistPath)) {
    throw new Error(`Expected application bundle was not generated: ${appPath}`);
  }

  const zip = statSync(zipPath);
  assertFreshArtifact({
    currentMtimeMs: zip.mtimeMs,
    previousMtimeMs: previousZip?.mtimeMs ?? null,
    startedAtMs,
  });

  const shortVersion = readPlistValue("CFBundleShortVersionString", plistPath);
  const bundleVersion = readPlistValue("CFBundleVersion", plistPath);
  if (shortVersion !== version || bundleVersion !== version) {
    throw new Error(`Application version mismatch: expected ${version}, found ${shortVersion}/${bundleVersion}.`);
  }

  const executableDescription = execFileSync("/usr/bin/file", [executablePath], { encoding: "utf8" });
  if (!executableDescription.includes("arm64")) {
    throw new Error(`Application architecture is not arm64: ${executableDescription.trim()}`);
  }

  const zipEntries = execFileSync("/usr/bin/unzip", ["-Z1", zipPath], { encoding: "utf8" });
  if (!zipEntries.includes("MD-Convertor.app/Contents/Info.plist")) {
    throw new Error("Release ZIP does not contain the expected MD-Convertor.app bundle.");
  }
  verifyZippedApplication(zipPath, version);
  return zip;
}

function errorMessage(error) {
  return error instanceof Error && error.message ? error.message : "Release failed.";
}

function combineReleaseErrors(primaryError, historicalError) {
  return new Error(`${errorMessage(primaryError)}\n${errorMessage(historicalError)}`, {
    cause: primaryError,
  });
}

/**
 * Run the complete release workflow with source and archived-release guards around it.
 * Dependencies are injectable so guard ordering and failure handling stay tested
 * without running live checks or producing a desktop artifact.
 */
export async function runRelease({
  root = process.cwd(),
  version = packageJson.version,
  runCommand: run = runCommand,
  assertProtectedBaseline: assertBaseline = assertProtectedBaseline,
  assertProtectedArchive: assertArchive = assertProtectedArchive,
  captureHistoricalZipSnapshot: captureSnapshot = captureHistoricalZipSnapshot,
  assertHistoricalZipSnapshotUnchanged: assertSnapshotUnchanged = assertHistoricalZipSnapshotUnchanged,
  verifyFreshArtifact: verifyArtifactOverride,
  sha256: hashFile = sha256File,
  now = Date.now,
  startedAtMs: startedAtOverride,
  previousZip: previousZipOverride,
} = {}) {
  if (version !== "0.2.1") throw new Error(RELEASE_VERSION_ERROR);
  const paths = getArtifactPaths(root, version);
  const startedAtMs = startedAtOverride ?? now();
  const previousZip = previousZipOverride === undefined
    ? (existsSync(paths.zipPath) ? statSync(paths.zipPath) : null)
    : previousZipOverride;
  const verifyArtifact = verifyArtifactOverride ?? (() => verifyFreshArtifact({
    root,
    version,
    previousZip,
    startedAtMs,
  }));

  let snapshot;
  let snapshotCaptured = false;
  let primaryError;
  let result;

  try {
    try {
      await assertBaseline({ root });
    } catch {
      throw new Error(PROTECTED_BASELINE_ERROR);
    }
    try {
      await assertArchive();
    } catch {
      throw new Error(PROTECTED_ARCHIVE_ERROR);
    }
    try {
      snapshot = await captureSnapshot();
    } catch {
      throw new Error(HISTORICAL_ZIP_ERROR);
    }
    snapshotCaptured = true;

    await run("./init.sh", [], { root });
    await run("npm", ["run", "test:e2e"], { root });
    await run("npm", ["run", "test:live"], { root });
    await run("npm", ["run", "desktop:make"], { root });
    const zip = await verifyArtifact({ root, version, previousZip, startedAtMs, paths });
    const digest = await hashFile(paths.zipPath);
    result = { zip, digest, zipPath: paths.zipPath, version };
  } catch (error) {
    primaryError = error;
  }

  let historicalError;
  if (snapshotCaptured) {
    try {
      await assertSnapshotUnchanged(snapshot);
    } catch {
      historicalError = new Error(HISTORICAL_ZIP_ERROR);
    }
  }

  if (primaryError && historicalError) throw combineReleaseErrors(primaryError, historicalError);
  if (primaryError) throw primaryError;
  if (historicalError) throw historicalError;
  return result;
}

async function main() {
  const { zip, digest, zipPath, version } = await runRelease();
  console.log("=== Release Artifact Verified ===");
  console.log(`Path: ${zipPath}`);
  console.log(`Version: ${version}`);
  console.log("Architecture: arm64");
  console.log(`Bytes: ${zip.size}`);
  console.log(`SHA-256: ${digest}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? `ERROR: ${error.message}` : "ERROR: Release failed.");
    process.exitCode = 1;
  }
}
