import { describe, expect, it, vi } from "vitest";
import type { AppError } from "@/lib/errors";
import { listLocalCliModels, parseCliModelList, runCliCommand } from "./models";

const PI_OUTPUT = [
  "provider              model                         context  max-out  thinking  images",
  "Agnes                 agnes-2.5-flash               128K     16.4K    no        yes   ",
  "deepseek              deepseek-v4-flash             1M       384K     yes       no    ",
  "deepseek              deepseek-v4-flash             1M       384K     yes       no    ",
  "",
].join("\n");

async function expectAppError(run: () => Promise<unknown>): Promise<AppError> {
  try {
    await run();
  } catch (error) {
    const appError = error as AppError;
    expect(appError.name).toBe("AppError");
    return appError;
  }
  throw new Error("expected an AppError");
}

describe("parseCliModelList", () => {
  it("reads the model column of a table listing", () => {
    expect(parseCliModelList(PI_OUTPUT)).toEqual([
      "agnes-2.5-flash",
      "deepseek-v4-flash",
    ]);
  });

  it("does not mistake other columns for models", () => {
    expect(parseCliModelList(PI_OUTPUT)).not.toContain("Agnes");
    expect(parseCliModelList(PI_OUTPUT)).not.toContain("128K");
  });

  it("returns nothing for empty or unrecognised output", () => {
    expect(parseCliModelList("")).toEqual([]);
    expect(parseCliModelList("no header here\nplain text\n")).toEqual([]);
  });
});

describe("listLocalCliModels", () => {
  it("returns an empty list for a CLI without listing support, without running it", async () => {
    const run = vi.fn();
    await expect(listLocalCliModels({ cliId: "claude", executablePath: "/usr/bin/claude", run }))
      .resolves.toEqual([]);
    expect(run).not.toHaveBeenCalled();
  });

  it("runs the listing flag of a CLI that supports it", async () => {
    const run = vi.fn(async () => ({ stdout: PI_OUTPUT, exitCode: 0, failure: null }));
    await expect(listLocalCliModels({ cliId: "pi", executablePath: "/usr/bin/pi", run }))
      .resolves.toEqual(["agnes-2.5-flash", "deepseek-v4-flash"]);
    expect(run).toHaveBeenCalledWith("/usr/bin/pi", ["--list-models"]);
  });

  it("requires an executable path", async () => {
    const run = vi.fn();
    const error = await expectAppError(() => listLocalCliModels({ cliId: "pi", executablePath: null, run }));
    expect(error).toMatchObject({ status: 409, code: "TRANSLATE_NOT_CONFIGURED" });
    expect(run).not.toHaveBeenCalled();
  });

  it("rejects an unknown CLI id", async () => {
    const error = await expectAppError(() =>
      listLocalCliModels({ cliId: "nope" as never, executablePath: "/usr/bin/nope", run: vi.fn() }));
    expect(error).toMatchObject({ status: 400, code: "INVALID_CLI_ID" });
  });

  it("maps a failing CLI to a provider error without echoing its output", async () => {
    const run = vi.fn(async () => ({ stdout: "", stderr: "token sk-leaked", exitCode: 2, failure: null }));
    const error = await expectAppError(() =>
      listLocalCliModels({ cliId: "pi", executablePath: "/usr/bin/pi", run }));
    expect(error).toMatchObject({ status: 502, code: "TRANSLATE_PROVIDER_ERROR" });
    expect(error.message).not.toContain("sk-leaked");
  });

  it("maps a CLI that never answers to a provider error", async () => {
    const run = vi.fn(async () => {
      throw new Error("timeout");
    });
    const error = await expectAppError(() =>
      listLocalCliModels({ cliId: "pi", executablePath: "/usr/bin/pi", run }));
    expect(error).toMatchObject({ status: 502, code: "TRANSLATE_PROVIDER_ERROR" });
  });
});

describe.skipIf(process.platform !== "darwin")("runCliCommand", () => {
  it("captures stdout and the exit code", async () => {
    await expect(runCliCommand("/bin/echo", ["hello"])).resolves.toMatchObject({ stdout: "hello\n", exitCode: 0 });
    await expect(runCliCommand("/bin/sh", ["-c", "exit 3"])).resolves.toMatchObject({ exitCode: 3 });
  });

  it("does not hand application secrets to the child process", async () => {
    const previous = process.env.MD_CONVERTOR_SECRETS;
    process.env.MD_CONVERTOR_SECRETS = "smoke-secret";
    try {
      const result = await runCliCommand("/usr/bin/env", []);
      expect(result.stdout).not.toContain("MD_CONVERTOR_SECRETS");
      expect(result.stdout).toContain("PATH=");
    } finally {
      if (previous === undefined) {
        delete process.env.MD_CONVERTOR_SECRETS;
      } else {
        process.env.MD_CONVERTOR_SECRETS = previous;
      }
    }
  });

  it("gives up on a CLI that hangs", async () => {
    await expect(runCliCommand("/bin/sleep", ["5"], 150)).resolves.toMatchObject({
      exitCode: null,
      stdout: "",
      failure: "timeout",
    });
  });

  it("writes the prompt to stdin and collects the answer", async () => {
    const result = await runCliCommand("/bin/cat", [], 5_000, { input: "prompt over stdin" });
    expect(result).toMatchObject({ stdout: "prompt over stdin", exitCode: 0, failure: null });
  });

  it("runs inside the given working directory", async () => {
    const { mkdtemp, realpath, rm } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const directory = await mkdtemp(join(tmpdir(), "md-convertor-cli-test-"));
    try {
      const result = await runCliCommand("/bin/pwd", [], 5_000, { cwd: directory });
      expect(result.stdout.trim()).toBe(await realpath(directory));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("kills the child when the caller cancels", async () => {
    const controller = new AbortController();
    const running = runCliCommand("/bin/sleep", ["5"], 5_000, { signal: controller.signal });
    setTimeout(() => controller.abort(), 50);
    await expect(running).resolves.toMatchObject({ exitCode: null, stdout: "", failure: "aborted" });
  });

  it("does not start a child for an already aborted caller", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(runCliCommand("/bin/cat", [], 5_000, { signal: controller.signal })).resolves.toMatchObject({
      exitCode: null,
      failure: "aborted",
    });
  });
});
