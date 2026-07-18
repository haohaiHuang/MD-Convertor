import { createHash } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import packageJson from "../package.json" with { type: "json" };
import { assertFreshArtifact } from "./release-guards.mjs";

const root = process.cwd();
const version = packageJson.version;
const zipPath = path.join(root, "out", "make", "zip", "darwin", "arm64", `MD-Convertor-darwin-arm64-${version}.zip`);
const appPath = path.join(root, "out", "MD-Convertor-darwin-arm64", "MD-Convertor.app");
const executablePath = path.join(appPath, "Contents", "MacOS", "MD-Convertor");
const plistPath = path.join(appPath, "Contents", "Info.plist");
const previousZip = existsSync(zipPath) ? statSync(zipPath) : null;
const startedAt = Date.now();

function run(command, args) {
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

function readPlistValue(key) {
  return execFileSync("/usr/bin/plutil", ["-extract", key, "raw", "-o", "-", plistPath], {
    encoding: "utf8",
  }).trim();
}

async function sha256(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function verifyFreshArtifact() {
  if (!existsSync(zipPath)) throw new Error(`Expected ZIP was not generated: ${zipPath}`);
  if (!existsSync(executablePath) || !existsSync(plistPath)) {
    throw new Error(`Expected application bundle was not generated: ${appPath}`);
  }

  const zip = statSync(zipPath);
  assertFreshArtifact({
    currentMtimeMs: zip.mtimeMs,
    previousMtimeMs: previousZip?.mtimeMs ?? null,
    startedAtMs: startedAt,
  });

  const shortVersion = readPlistValue("CFBundleShortVersionString");
  const bundleVersion = readPlistValue("CFBundleVersion");
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
  return zip;
}

try {
  run("./init.sh", []);
  run("npm", ["run", "test:e2e"]);
  run("npm", ["run", "test:live"]);
  run("npm", ["run", "desktop:make"]);
  const zip = verifyFreshArtifact();
  const digest = await sha256(zipPath);
  console.log("=== Release Artifact Verified ===");
  console.log(`Path: ${zipPath}`);
  console.log(`Version: ${version}`);
  console.log("Architecture: arm64");
  console.log(`Bytes: ${zip.size}`);
  console.log(`SHA-256: ${digest}`);
} catch (error) {
  console.error(error instanceof Error ? `ERROR: ${error.message}` : "ERROR: Release failed.");
  process.exitCode = 1;
}
