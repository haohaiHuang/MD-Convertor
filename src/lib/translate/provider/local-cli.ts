import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AppError } from "@/lib/errors";
import { findCliDefinition } from "@/lib/local-cli/registry";
import { runCliCommand, type CliRunOptions, type CliRunResult } from "@/lib/local-cli/models";
import { TRANSLATE_CALL_TIMEOUT_MS } from "../limits";
import type { ModelMessage } from "./provider";

export type CliRunner = (
  executablePath: string,
  args: string[],
  timeoutMs?: number,
  options?: CliRunOptions,
) => Promise<CliRunResult>;

export type LocalCliCallOptions = {
  cliId: string;
  executablePath: string | null;
  model: string | null;
  messages: readonly ModelMessage[];
  signal?: AbortSignal;
  timeoutMs?: number;
  run?: CliRunner;
};

function promptText(messages: readonly ModelMessage[]): string {
  return messages.map((message) => message.content).join("\n\n");
}

/**
 * Calls a locally installed CLI in non-interactive print mode (FSD §6, probe
 * conclusions in docs/features/translation/S3-translation-engine.md §T3.1).
 *
 * The prompt goes through stdin only, the child runs in a throwaway directory
 * with `MD_CONVERTOR_*` stripped, and CLI output is never echoed back: a
 * failing run reports its exit status only.
 */
export async function callLocalCli({
  cliId,
  executablePath,
  model,
  messages,
  signal,
  timeoutMs = TRANSLATE_CALL_TIMEOUT_MS,
  run = runCliCommand,
}: LocalCliCallOptions): Promise<string> {
  const definition = findCliDefinition(cliId);
  if (!definition) {
    throw new AppError(400, "INVALID_CLI_ID", "未知的本地 CLI。");
  }

  const executable = executablePath?.trim();
  if (!executable) {
    throw new AppError(409, "TRANSLATE_NOT_CONFIGURED", `尚未检测到 ${definition.name}。`);
  }

  const selected = model?.trim();
  const args = [...definition.printArgs];
  if (selected) {
    args.push(definition.modelFlag, selected);
  }

  const directory = await mkdtemp(join(tmpdir(), "md-convertor-translate-"));
  let result: CliRunResult;
  try {
    result = await run(executable, args, timeoutMs, { input: promptText(messages), cwd: directory, signal });
  } catch {
    throw new AppError(502, "TRANSLATE_PROVIDER_ERROR", `无法运行本机 CLI ${definition.name}。`);
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }

  if (result.failure === "timeout") {
    throw new AppError(504, "TRANSLATE_TIMEOUT", `${definition.name} 调用超时，请稍后重试。`);
  }
  if (result.failure === "aborted") {
    throw new AppError(499, "TRANSLATE_CANCELLED", "已取消翻译。");
  }
  if (result.failure === "spawn" || result.exitCode !== 0) {
    // CLI output may contain credentials or the prompt: report the exit status only.
    throw new AppError(
      502,
      "TRANSLATE_PROVIDER_ERROR",
      `${definition.name} 调用失败（退出码 ${result.exitCode ?? "无"}）。`,
    );
  }
  if (result.stdout.trim() === "") {
    throw new AppError(502, "TRANSLATE_PROVIDER_ERROR", `${definition.name} 没有返回内容。`);
  }

  return result.stdout;
}
