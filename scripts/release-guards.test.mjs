import { execFileSync } from "node:child_process";
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertFreshArtifact,
  assertHistoricalZipSnapshotUnchanged,
  assertProtectedArchive,
  assertProtectedBaseline,
  captureHistoricalZipSnapshot,
  PROTECTED_ARCHIVE_SHA256,
  PROTECTED_BASELINE_COMMIT,
  PROTECTED_HISTORICAL_ZIP_MANIFEST,
  HISTORICAL_ZIP_ERROR,
} from "./release-guards.mjs";
import { RELEASE_VERSION_ERROR, runRelease, verifyFreshArtifact } from "./release-desktop.mjs";

describe("protected 0.1.3 source baseline guard", () => {
  it("requires both main and the peeled v0.1.3 tag to match the full fixed commit", () => {
    const refs = [];
    expect(() => assertProtectedBaseline({
      revParse: (ref) => {
        refs.push(ref);
        return PROTECTED_BASELINE_COMMIT;
      },
    })).not.toThrow();
    expect(refs).toEqual(["main", "v0.1.3^{commit}"]);
  });

  it.each([
    ["main", "0000000000000000000000000000000000000000"],
    ["v0.1.3^{commit}", "1111111111111111111111111111111111111111"],
  ])("rejects a %s mismatch without exposing ref, path, or hash details", (badRef, badCommit) => {
    const sentinelPath = "/tmp/release-guard-private-path";
    const error = (() => {
      try {
        assertProtectedBaseline({
          root: sentinelPath,
          revParse: (ref) => ref === badRef ? badCommit : PROTECTED_BASELINE_COMMIT,
        });
        return null;
      } catch (caught) {
        return caught;
      }
    })();

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Protected 0.1.3 source baseline is not intact.");
    expect(error.message).not.toContain(sentinelPath);
    expect(error.message).not.toContain(badRef);
    expect(error.message).not.toContain(badCommit);
  });
});

describe("protected 0.1.3 archive guard", () => {
  async function makeArchiveFixture() {
    const home = await mkdtemp(path.join(tmpdir(), "release-archive-"));
    const archivePath = path.join(
      home,
      "Downloads",
      "MD-Convertor-0.1.3-release",
      "MD-Convertor-darwin-arm64-0.1.3.zip",
    );
    await mkdir(path.dirname(archivePath), { recursive: true });
    await writeFile(archivePath, "fixture");
    return { home, archivePath };
  }

  it("accepts a read-only regular archive with the fixed SHA-256", async () => {
    const { home, archivePath } = await makeArchiveFixture();
    try {
      await chmod(archivePath, 0o444);
      await expect(assertProtectedArchive({
        homedir: home,
        hashFile: async (filePath) => {
          expect(filePath).toBe(archivePath);
          return PROTECTED_ARCHIVE_SHA256;
        },
      })).resolves.toBeUndefined();
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("rejects a missing archive without exposing its path", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "release-archive-missing-"));
    try {
      await expect(assertProtectedArchive({ homedir: home })).rejects.toThrow(
        "Protected 0.1.3 archive is not intact.",
      );
      try {
        await assertProtectedArchive({ homedir: home });
      } catch (error) {
        expect(error.message).not.toContain(home);
      }
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("rejects a writable archive even when its hash matches", async () => {
    const { home, archivePath } = await makeArchiveFixture();
    try {
      await chmod(archivePath, 0o644);
      await expect(assertProtectedArchive({
        homedir: home,
        hashFile: async () => PROTECTED_ARCHIVE_SHA256,
      })).rejects.toThrow("Protected 0.1.3 archive is not intact.");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("rejects a hash mismatch without exposing the expected or actual hash", async () => {
    const { home, archivePath } = await makeArchiveFixture();
    const actualHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    try {
      await chmod(archivePath, 0o444);
      await expect(assertProtectedArchive({ homedir: home, hashFile: async () => actualHash }))
        .rejects.toThrow("Protected 0.1.3 archive is not intact.");
      try {
        await assertProtectedArchive({ homedir: home, hashFile: async () => actualHash });
      } catch (error) {
        expect(error.message).not.toContain(actualHash);
        expect(error.message).not.toContain(PROTECTED_ARCHIVE_SHA256);
      }
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("protected historical 0.1.x ZIP snapshot guard", () => {
  const historicalNames = Object.keys(PROTECTED_HISTORICAL_ZIP_MANIFEST);

  it("pins all release hashes in the version-controlled manifest", () => {
    expect(PROTECTED_HISTORICAL_ZIP_MANIFEST).toEqual({
      "MD-Convertor-darwin-arm64-0.1.0.zip": "674720e2348c8948746bedcea91b5ef22191575cb2213199d0d595d70dae0593",
      "MD-Convertor-darwin-arm64-0.1.1.zip": "d3fc7e83cf7c7ffb370f2413c614e41d3bf52a689195b6d80dcbba15175c53ef",
      "MD-Convertor-darwin-arm64-0.1.2.zip": "fbb645e1ad55b28373bc94f3974c85ca3a9aa3de58f73ce2530b9628ac84baf5",
      "MD-Convertor-darwin-arm64-0.1.3.zip": "66909aa8759ec41fdde875204773958d32b33a2c903e7b4eb0858a50fb1bdf89",
    });
  });

  async function makeHistoricalFixture() {
    const root = await mkdtemp(path.join(tmpdir(), "release-history-"));
    const directory = path.join(root, "out", "make", "zip", "darwin", "arm64");
    await mkdir(directory, { recursive: true });
    return { root, directory };
  }

  async function writeHistoricalFiles(directory, names = historicalNames) {
    for (const name of names) await writeFile(path.join(directory, name), `fixture:${name}`);
  }

  function manifestHash(filePath) {
    return PROTECTED_HISTORICAL_ZIP_MANIFEST[path.basename(filePath)];
  }

  it("captures every fixed manifest ZIP with its fixed SHA-256", async () => {
    const { root, directory } = await makeHistoricalFixture();
    try {
      await writeHistoricalFiles(directory);
      await writeFile(path.join(directory, "MD-Convertor-darwin-arm64-0.1.3-beta.zip"), "ignored");
      await writeFile(path.join(directory, "MD-Convertor-darwin-arm64-0.2.0.zip"), "ignored");

      await expect(captureHistoricalZipSnapshot({ root, hashFile: async (filePath) => manifestHash(filePath) }))
        .resolves.toEqual(historicalNames.map((name) => ({
          path: path.join(directory, name),
          sha256: PROTECTED_HISTORICAL_ZIP_MANIFEST[name],
        })));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a missing historical ZIP directory", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "release-history-missing-directory-"));
    try {
      await expect(captureHistoricalZipSnapshot({ root })).rejects.toThrow(HISTORICAL_ZIP_ERROR);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a missing manifest ZIP", async () => {
    const { root, directory } = await makeHistoricalFixture();
    try {
      await writeHistoricalFiles(directory, historicalNames.slice(1));
      await expect(captureHistoricalZipSnapshot({ root, hashFile: async (filePath) => manifestHash(filePath) }))
        .rejects.toThrow(HISTORICAL_ZIP_ERROR);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("accepts an exact unchanged fixed manifest snapshot", async () => {
    const { root, directory } = await makeHistoricalFixture();
    try {
      await writeHistoricalFiles(directory);
      const hashFile = async (filePath) => manifestHash(filePath);
      const snapshot = await captureHistoricalZipSnapshot({ root, hashFile });
      await expect(assertHistoricalZipSnapshotUnchanged(snapshot, { root, hashFile })).resolves.toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a modified manifest hash", async () => {
    const { root, directory } = await makeHistoricalFixture();
    try {
      await writeHistoricalFiles(directory);
      let modified = false;
      const target = historicalNames[3];
      const hashFile = async (filePath) => modified && path.basename(filePath) === target
        ? "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        : manifestHash(filePath);
      const snapshot = await captureHistoricalZipSnapshot({ root, hashFile });
      modified = true;
      await expect(assertHistoricalZipSnapshotUnchanged(snapshot, { root, hashFile }))
        .rejects.toThrow(HISTORICAL_ZIP_ERROR);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a newly added strict 0.1.x ZIP", async () => {
    const { root, directory } = await makeHistoricalFixture();
    try {
      await writeHistoricalFiles(directory);
      const hashFile = async (filePath) => manifestHash(filePath);
      const snapshot = await captureHistoricalZipSnapshot({ root, hashFile });
      await writeFile(path.join(directory, "MD-Convertor-darwin-arm64-0.1.4.zip"), "new-zip");
      await expect(assertHistoricalZipSnapshotUnchanged(snapshot, { root, hashFile }))
        .rejects.toThrow(HISTORICAL_ZIP_ERROR);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps historical errors private", async () => {
    const { root, directory } = await makeHistoricalFixture();
    const sentinelHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    try {
      await writeHistoricalFiles(directory);
      await expect(captureHistoricalZipSnapshot({
        root,
        hashFile: async () => sentinelHash,
      })).rejects.toSatisfy((error) => {
        expect(error.message).toBe(HISTORICAL_ZIP_ERROR);
        expect(error.message).not.toContain(root);
        expect(error.message).not.toContain(sentinelHash);
        return true;
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

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

describe("fresh desktop ZIP verification", () => {
  const plist = (version) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleShortVersionString</key><string>${version}</string>
<key>CFBundleVersion</key><string>${version}</string>
</dict></plist>`;

  async function makeFreshArtifactFixture({ zipVersion = "0.2.0", zipExecutable = "/bin/echo" } = {}) {
    const root = await mkdtemp(path.join(tmpdir(), "release-artifact-"));
    const sideApp = path.join(root, "out", "MD-Convertor-darwin-arm64", "MD-Convertor.app");
    const sideContents = path.join(sideApp, "Contents");
    const zipRoot = path.join(root, "zip-input");
    const zipApp = path.join(zipRoot, "MD-Convertor.app");
    const zipContents = path.join(zipApp, "Contents");
    const zipPath = path.join(root, "out", "make", "zip", "darwin", "arm64", "MD-Convertor-darwin-arm64-0.2.0.zip");

    await mkdir(path.join(sideContents, "MacOS"), { recursive: true });
    await writeFile(path.join(sideContents, "Info.plist"), plist("0.2.0"));
    await copyFile("/bin/echo", path.join(sideContents, "MacOS", "MD-Convertor"));
    await mkdir(path.join(zipContents, "MacOS"), { recursive: true });
    await writeFile(path.join(zipContents, "Info.plist"), plist(zipVersion));
    if (zipExecutable === "/bin/echo") {
      await copyFile(zipExecutable, path.join(zipContents, "MacOS", "MD-Convertor"));
    } else {
      await writeFile(path.join(zipContents, "MacOS", "MD-Convertor"), zipExecutable);
    }
    await mkdir(path.dirname(zipPath), { recursive: true });
    execFileSync("/usr/bin/zip", ["-qry", zipPath, "MD-Convertor.app"], { cwd: zipRoot });
    return { root };
  }

  it("rejects a ZIP whose bundled version differs from the verified side application", async () => {
    const { root } = await makeFreshArtifactFixture({ zipVersion: "0.1.3" });
    try {
      expect(() => verifyFreshArtifact({ root, version: "0.2.0", startedAtMs: 0 }))
        .toThrow("ZIP application version mismatch");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a ZIP whose bundled executable is not arm64", async () => {
    const { root } = await makeFreshArtifactFixture({ zipExecutable: "not a Mach-O executable" });
    try {
      expect(() => verifyFreshArtifact({ root, version: "0.2.0", startedAtMs: 0 }))
        .toThrow("ZIP application architecture is not arm64");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("desktop release protection orchestration", () => {
  function makeReleaseFixture(overrides = {}) {
    const events = [];
    return {
      events,
      options: {
        root: "/tmp/release-orchestration-root",
        version: "0.2.0",
        runCommand: (command, args) => {
          events.push(`run:${command} ${args.join(" ")}`.trim());
        },
        assertProtectedBaseline: () => {
          events.push("baseline");
        },
        assertProtectedArchive: async () => {
          events.push("archive");
        },
        captureHistoricalZipSnapshot: async () => {
          events.push("snapshot");
          return [];
        },
        assertHistoricalZipSnapshotUnchanged: async () => {
          events.push("history");
        },
        verifyFreshArtifact: () => {
          events.push("verify");
          return { size: 1234 };
        },
        sha256: async () => {
          events.push("digest");
          return "digest";
        },
        ...overrides,
      },
    };
  }

  it("runs protected preflight before every release command and checks history last", async () => {
    const { events, options } = makeReleaseFixture();

    await expect(runRelease(options)).resolves.toMatchObject({
      zip: { size: 1234 },
      digest: "digest",
    });
    expect(events).toEqual([
      "baseline",
      "archive",
      "snapshot",
      "run:./init.sh",
      "run:npm run test:e2e",
      "run:npm run test:live",
      "run:npm run desktop:make",
      "verify",
      "digest",
      "history",
    ]);
  });

  it("runs the historical guard after a primary release failure", async () => {
    const { events, options } = makeReleaseFixture({
      runCommand: (command, args) => {
        events.push(`run:${command} ${args.join(" ")}`.trim());
        throw new Error("primary release failure");
      },
    });

    await expect(runRelease(options)).rejects.toThrow("primary release failure");
    expect(events).toEqual([
      "baseline",
      "archive",
      "snapshot",
      "run:./init.sh",
      "history",
    ]);
  });

  it("keeps historical protection failure visible when the release also fails", async () => {
    const sentinelPath = "/tmp/release-history-private-path";
    const sentinelHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const { options } = makeReleaseFixture({
      runCommand: () => {
        throw new Error("primary release failure");
      },
      assertHistoricalZipSnapshotUnchanged: async () => {
        throw new Error(`${sentinelPath} ${sentinelHash}`);
      },
    });

    try {
      await runRelease(options);
      throw new Error("expected release to fail");
    } catch (error) {
      expect(error.message).toContain("primary release failure");
      expect(error.message).toContain(HISTORICAL_ZIP_ERROR);
      expect(error.message).not.toContain(sentinelPath);
      expect(error.message).not.toContain(sentinelHash);
    }
  });

  it("rejects a protected 0.1.x release version before running any command", async () => {
    const { events, options } = makeReleaseFixture({ version: "0.1.3" });

    await expect(runRelease(options)).rejects.toThrow(RELEASE_VERSION_ERROR);
    expect(events).toEqual([]);
  });
});

describe("desktop release live checks", () => {
  it("keeps the upstream-variable WeChat comparison outside the blocking live command", async () => {
    const packageJson = JSON.parse(await readFile(
      new URL("../package.json", import.meta.url),
      "utf8",
    ));

    expect(packageJson.scripts["test:live"]).toBe(
      "vitest run --config vitest.live.config.ts tests/live/mermaid-page.test.ts",
    );
    expect(packageJson.scripts["test:live:wechat"]).toBe(
      "vitest run --config vitest.live.config.ts tests/live/wechat-article.test.ts",
    );
  });
});
