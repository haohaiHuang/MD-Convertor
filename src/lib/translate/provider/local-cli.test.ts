import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import type { CliRunOptions, CliRunResult } from "@/lib/local-cli/models";
import { callLocalCli, type CliRunner } from "./local-cli";

const MESSAGES = [
  { role: "system" as const, content: "SYSTEM-INSTRUCTIONS" },
  { role: "user" as const, content: "USER-BLOCKS" },
];

type Recorded = { executablePath: string; args: string[]; timeoutMs?: number; options: CliRunOptions };

function fakeRunner(result: Partial<CliRunResult> = {}): { run: CliRunner; calls: Recorded[] } {
  const calls: Recorded[] = [];
  const run: CliRunner = async (executablePath, args, timeoutMs, options = {}) => {
    calls.push({ executablePath, args, timeoutMs, options });
    expect(options.cwd).toBeTruthy();
    return { stdout: "answer", stderr: "", exitCode: 0, failure: null, ...result };
  };
  return { run, calls };
}

function expectAppError(run: () => Promise<unknown>): Promise<AppError> {
  return run().then(
    () => {
      throw new Error("expected an AppError");
    },
    (error: unknown) => {
      if (error instanceof AppError) return error;
      throw error;
    },
  );
}

describe("callLocalCli argument construction", () => {
  it("runs pi non-interactively without tools, session or context files", async () => {
    const { run, calls } = fakeRunner();
    await callLocalCli({
      cliId: "pi",
      executablePath: "/opt/bin/pi",
      model: "agnes-2.5-flash",
      messages: MESSAGES,
      run,
    });
    expect(calls[0]?.executablePath).toBe("/opt/bin/pi");
    expect(calls[0]?.args).toEqual([
      "-p",
      "--no-tools",
      "--no-session",
      "--no-extensions",
      "--no-skills",
      "--no-context-files",
      "--mode",
      "text",
      "--model",
      "agnes-2.5-flash",
    ]);
  });

  it("runs claude with every tool disabled and no model flag when none is set", async () => {
    const { run, calls } = fakeRunner();
    await callLocalCli({
      cliId: "claude",
      executablePath: "/opt/bin/claude",
      model: null,
      messages: MESSAGES,
      run,
    });
    expect(calls[0]?.args).toEqual(["-p", "--tools", "", "--output-format", "text"]);
    expect(calls[0]?.args).not.toContain("--model");
  });

  it("never grants a tool permission", async () => {
    for (const cliId of ["pi", "claude"]) {
      const { run, calls } = fakeRunner();
      await callLocalCli({ cliId, executablePath: "/opt/bin/cli", model: null, messages: MESSAGES, run });
      const args = calls[0]?.args.join(" ") ?? "";
      expect(args).not.toMatch(/allowedTools|permission-mode|dangerously|--full-tools/);
    }
  });
});

describe("callLocalCli transport", () => {
  it("sends the whole prompt over stdin, never over argv", async () => {
    const { run, calls } = fakeRunner();
    await callLocalCli({
      cliId: "pi",
      executablePath: "/opt/bin/pi",
      model: null,
      messages: MESSAGES,
      run,
    });
    const { args, options } = calls[0]!;
    expect(args.join(" ")).not.toContain("SYSTEM-INSTRUCTIONS");
    expect(options.input).toContain("SYSTEM-INSTRUCTIONS");
    expect(options.input).toContain("USER-BLOCKS");
  });

  it("passes the call timeout and the cancel signal through", async () => {
    const controller = new AbortController();
    const { run, calls } = fakeRunner();
    await callLocalCli({
      cliId: "pi",
      executablePath: "/opt/bin/pi",
      model: null,
      messages: MESSAGES,
      timeoutMs: 4_321,
      signal: controller.signal,
      run,
    });
    expect(calls[0]?.timeoutMs).toBe(4_321);
    expect(calls[0]?.options.signal).toBe(controller.signal);
  });

  it("uses a throwaway working directory that is cleaned up afterwards", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    let directory = "";
    const run: CliRunner = async (_executablePath, _args, _timeoutMs, options = {}) => {
      directory = options.cwd ?? "";
      expect(directory.startsWith(tmpdir())).toBe(true);
      expect(directory).not.toBe(process.cwd());
      expect((await import("node:fs")).existsSync(directory)).toBe(true);
      return { stdout: "ok", exitCode: 0, failure: null };
    };
    await callLocalCli({ cliId: "pi", executablePath: "/opt/bin/pi", model: null, messages: MESSAGES, run });
    expect(directory).not.toBe("");
    expect((await import("node:fs")).existsSync(directory)).toBe(false);
    await expect(mkdtemp(join(tmpdir(), "probe-"))).resolves.toBeTruthy();
  });
});

describe("callLocalCli failures", () => {
  it("maps a non-zero exit code without echoing CLI output", async () => {
    const { run } = fakeRunner({ stdout: "SECRET-BODY", exitCode: 1 });
    const error = await expectAppError(() =>
      callLocalCli({ cliId: "claude", executablePath: "/opt/bin/claude", model: null, messages: MESSAGES, run }),
    );
    expect(error).toMatchObject({ status: 502, code: "TRANSLATE_PROVIDER_ERROR" });
    expect(error.message).toContain("1");
    expect(error.message).not.toContain("SECRET-BODY");
  });

  it("treats an empty answer as a provider error", async () => {
    const { run } = fakeRunner({ stdout: "   \n", exitCode: 0 });
    const error = await expectAppError(() =>
      callLocalCli({ cliId: "pi", executablePath: "/opt/bin/pi", model: null, messages: MESSAGES, run }),
    );
    expect(error).toMatchObject({ status: 502, code: "TRANSLATE_PROVIDER_ERROR" });
  });

  it("maps a timeout to TRANSLATE_TIMEOUT", async () => {
    const { run } = fakeRunner({ stdout: "", exitCode: null, failure: "timeout" });
    const error = await expectAppError(() =>
      callLocalCli({ cliId: "pi", executablePath: "/opt/bin/pi", model: null, messages: MESSAGES, run }),
    );
    expect(error).toMatchObject({ status: 504, code: "TRANSLATE_TIMEOUT" });
  });

  it("maps a cancelled run to TRANSLATE_CANCELLED", async () => {
    const { run } = fakeRunner({ stdout: "", exitCode: null, failure: "aborted" });
    const error = await expectAppError(() =>
      callLocalCli({ cliId: "pi", executablePath: "/opt/bin/pi", model: null, messages: MESSAGES, run }),
    );
    expect(error).toMatchObject({ status: 499, code: "TRANSLATE_CANCELLED" });
  });

  it("maps a failed spawn to a provider error", async () => {
    const { run } = fakeRunner({ stdout: "", exitCode: null, failure: "spawn" });
    const error = await expectAppError(() =>
      callLocalCli({ cliId: "pi", executablePath: "/opt/bin/pi", model: null, messages: MESSAGES, run }),
    );
    expect(error).toMatchObject({ status: 502, code: "TRANSLATE_PROVIDER_ERROR" });
  });

  it("rejects an unknown CLI and a missing executable", async () => {
    const run = vi.fn<CliRunner>();
    await expect(
      expectAppError(() =>
        callLocalCli({ cliId: "nope", executablePath: "/opt/bin/nope", model: null, messages: MESSAGES, run }),
      ),
    ).resolves.toMatchObject({ status: 400, code: "INVALID_CLI_ID" });
    await expect(
      expectAppError(() => callLocalCli({ cliId: "pi", executablePath: " ", model: null, messages: MESSAGES, run })),
    ).resolves.toMatchObject({ status: 409, code: "TRANSLATE_NOT_CONFIGURED" });
    expect(run).not.toHaveBeenCalled();
  });
});
