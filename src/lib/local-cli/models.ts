import { spawn, type ChildProcess } from "node:child_process";
import { AppError } from "@/lib/errors";
import { findCliDefinition } from "./registry";

const CLI_TIMEOUT_MS = 10_000;
const MAX_OUTPUT_BYTES = 1024 * 1024;
const SECRET_ENV_PREFIX = "MD_CONVERTOR_";

export type CliRunResult = {
  stdout: string;
  stderr?: string;
  /** null when the CLI was killed (timeout, cancel or spawn failure). */
  exitCode: number | null;
  /** Why the run ended without an exit code; null on a normal exit. */
  failure: "timeout" | "aborted" | "spawn" | null;
};

/** Optional extras for a single run: prompt on stdin, isolated cwd, cancellation. */
export type CliRunOptions = {
  input?: string;
  cwd?: string;
  signal?: AbortSignal;
};

export type RunCli = (executablePath: string, args: string[]) => Promise<CliRunResult>;

/**
 * Reads the model column out of a `pi --list-models` style table.
 *
 * The column position comes from the header row, so padding changes or extra
 * columns do not turn neighbouring cells into model ids. Output without a
 * `model` header yields no models; the user can always type one manually.
 */
export function parseCliModelList(stdout: string): string[] {
  const rows = stdout.split("\n").map((row) => row.replace(/\r$/, ""));
  const headerIndex = rows.findIndex((row) =>
    row.split(/\s{2,}/).some((cell) => cell.trim() === "model"),
  );
  if (headerIndex < 0) {
    return [];
  }

  const modelIndex = rows[headerIndex].split(/\s{2,}/).findIndex((cell) => cell.trim() === "model");
  const models: string[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const id = row.split(/\s{2,}/)[modelIndex]?.trim() ?? "";
    if (id && !models.includes(id)) {
      models.push(id);
    }
  }
  return models;
}

/** Child environment without application secrets. */
function cliEnvironment(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const name of Object.keys(env)) {
    if (name.startsWith(SECRET_ENV_PREFIX)) {
      delete env[name];
    }
  }
  return env;
}

export function runCliCommand(
  executablePath: string,
  args: string[],
  timeoutMs = CLI_TIMEOUT_MS,
  options: CliRunOptions = {},
): Promise<CliRunResult> {
  return new Promise((resolve) => {
    let settled = false;
    let stdout = "";
    let stderr = "";
    const finish = (exitCode: number | null, failure: CliRunResult["failure"] = null): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
      resolve({ stdout, stderr, exitCode, failure });
    };

    if (options.signal?.aborted) {
      resolve({ stdout, stderr, exitCode: null, failure: "aborted" });
      return;
    }

    let child: ChildProcess;
    try {
      child = spawn(executablePath, args, {
        stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
        cwd: options.cwd,
        env: cliEnvironment(),
        shell: false,
      });
    } catch {
      resolve({ stdout, stderr, exitCode: null, failure: "spawn" });
      return;
    }

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(null, "timeout");
    }, timeoutMs);

    function onAbort(): void {
      child.kill("SIGKILL");
      finish(null, "aborted");
    }
    options.signal?.addEventListener("abort", onAbort, { once: true });

    if (options.input !== undefined) {
      child.stdin?.on("error", () => undefined);
      child.stdin?.end(options.input);
    }

    child.stdout?.on("data", (chunk: Buffer) => {
      if (stdout.length < MAX_OUTPUT_BYTES) {
        stdout += chunk.toString("utf8");
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderr.length < MAX_OUTPUT_BYTES) {
        stderr += chunk.toString("utf8");
      }
    });
    child.on("error", () => finish(null, "spawn"));
    child.on("close", (code) => finish(code));
  });
}

export type ListLocalCliModelsOptions = {
  cliId: string;
  executablePath: string | null;
  run?: RunCli;
};

export async function listLocalCliModels({
  cliId,
  executablePath,
  run = runCliCommand,
}: ListLocalCliModelsOptions): Promise<string[]> {
  const definition = findCliDefinition(cliId);
  if (!definition) {
    throw new AppError(400, "INVALID_CLI_ID", "未知的本地 CLI。");
  }
  if (!definition.listModelsArgs) {
    return [];
  }

  const executable = executablePath?.trim();
  if (!executable) {
    throw new AppError(409, "TRANSLATE_NOT_CONFIGURED", `尚未检测到 ${definition.name}。`);
  }

  let result: CliRunResult;
  try {
    result = await run(executable, definition.listModelsArgs);
  } catch {
    throw new AppError(502, "TRANSLATE_PROVIDER_ERROR", `无法从 ${definition.name} 获取模型列表。`);
  }

  if (result.exitCode !== 0) {
    // CLI output is never echoed: it can contain credentials or prompts.
    throw new AppError(
      502,
      "TRANSLATE_PROVIDER_ERROR",
      `${definition.name} 无法列出模型（退出码 ${result.exitCode ?? "超时"}）。`,
    );
  }

  return parseCliModelList(result.stdout);
}
