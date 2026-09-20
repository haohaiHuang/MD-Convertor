import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveServerBinary } from "./server-binary.mjs";

const temporaryDirectories = [];

async function makeBundle({ withHelper = true } = {}) {
  const bundle = await mkdtemp(path.join(os.tmpdir(), "server-binary-"));
  temporaryDirectories.push(bundle);
  const contents = path.join(bundle, "Contents");
  await mkdir(path.join(contents, "MacOS"), { recursive: true });
  await copyFile("/bin/echo", path.join(contents, "MacOS", "MD-Convertor"));
  if (withHelper) {
    const helperDirectory = path.join(
      contents,
      "Frameworks",
      "MD-Convertor Helper.app",
      "Contents",
      "MacOS",
    );
    await mkdir(helperDirectory, { recursive: true });
    await copyFile("/bin/echo", path.join(helperDirectory, "MD-Convertor Helper"));
  }
  return path.join(contents, "MacOS", "MD-Convertor");
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("desktop server runtime binary", () => {
  it("uses the LSUIElement helper bundle instead of the application executable", async () => {
    const execPath = await makeBundle();
    const binary = resolveServerBinary(execPath);

    expect(binary).not.toBe(execPath);
    expect(binary).toBe(
      path.join(
        path.dirname(path.dirname(execPath)),
        "Frameworks",
        "MD-Convertor Helper.app",
        "Contents",
        "MacOS",
        "MD-Convertor Helper",
      ),
    );
  });

  it("keeps the helper name in sync with the executable name", async () => {
    const execPath = await makeBundle();
    const renamed = execPath.replace(/MD-Convertor$/, "Other-Name");

    expect(() => resolveServerBinary(renamed)).toThrow(/Other-Name Helper/);
  });

  it("fails loudly when the helper bundle is missing", async () => {
    const execPath = await makeBundle({ withHelper: false });

    expect(() => resolveServerBinary(execPath)).toThrow(/helper runtime is missing/i);
  });
});
