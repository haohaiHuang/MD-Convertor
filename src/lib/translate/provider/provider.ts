import { AppError } from "@/lib/errors";
import { resolveProviderKey } from "@/lib/provider/credentials";
import type { Settings } from "@/types/settings";
import { TRANSLATE_CALL_TIMEOUT_MS } from "../limits";
import { callLocalCli, type CliRunner } from "./local-cli";
import { callOpenAiCompatible } from "./openai-compatible";
import { createTestProviderCaller, TEST_PROVIDER_MODEL, TEST_PROVIDER_ENV } from "./test-provider";
import type { ProviderEndpointDeps } from "@/lib/provider/endpoint";

export type ModelMessage = { role: "system" | "user"; content: string };

/** Sends messages to the configured model and returns its raw text answer. */
export type ModelCaller = (messages: readonly ModelMessage[]) => Promise<string>;

export type ModelCallDeps = ProviderEndpointDeps & { run?: CliRunner };

export type EffectiveModelConfig =
  | { kind: "cloud"; providerId: string; baseUrl: string; model: string }
  | { kind: "local"; cliId: string; executablePath: string; model: string | null }
  | { kind: "test"; model: string };

export type ModelCallOptions = {
  deps?: ModelCallDeps;
  signal?: AbortSignal;
  timeoutMs?: number;
};

function notConfigured(message: string): AppError {
  return new AppError(409, "TRANSLATE_NOT_CONFIGURED", message);
}

/**
 * Reads the model that is currently in effect out of the settings (FSD §2).
 *
 * Nothing is cached: settings change while the server runs, and one extra
 * object read per task is cheaper than a stale-model bug.
 */
export type ModelEnv = Readonly<Record<string, string | undefined>>;

export function resolveEffectiveModel(settings: Settings, env: ModelEnv = process.env): EffectiveModelConfig {
  if (env[TEST_PROVIDER_ENV] === "1") {
    return { kind: "test", model: TEST_PROVIDER_MODEL };
  }

  if (settings.mode === "cloud") {
    const provider = settings.cloud.providers.find((entry) => entry.id === settings.cloud.activeProviderId);
    if (!provider) {
      throw notConfigured("尚未选择云端 Provider。");
    }
    const model = provider.selectedModel?.trim();
    if (!model) {
      throw notConfigured(`尚未为 ${provider.name} 选择模型。`);
    }
    return {
      kind: "cloud",
      providerId: provider.id,
      baseUrl: provider.baseUrl,
      model,
    };
  }

  const cli = settings.local.clis.find((entry) => entry.id === settings.local.activeCliId);
  if (!cli) {
    throw notConfigured("尚未选择本机 CLI。");
  }
  if (!cli.enabled) {
    throw notConfigured(`已停用 ${cli.name}。`);
  }
  const executablePath = cli.detectedPath?.trim();
  if (!executablePath) {
    throw notConfigured(`尚未检测到 ${cli.name}。`);
  }
  return { kind: "local", cliId: cli.id, executablePath, model: cli.selectedModel?.trim() || null };
}

/**
 * Builds the caller for one task. The abort signal and the per-call timeout are
 * bound here, so the batching code below only ever sees `messages -> text`.
 */
export function createModelCaller(config: EffectiveModelConfig, options: ModelCallOptions = {}): ModelCaller {
  const { deps, signal, timeoutMs = TRANSLATE_CALL_TIMEOUT_MS } = options;

  if (config.kind === "test") {
    return createTestProviderCaller();
  }

  if (config.kind === "local") {
    return (messages) =>
      callLocalCli({
        cliId: config.cliId,
        executablePath: config.executablePath,
        model: config.model,
        messages,
        signal,
        timeoutMs,
        run: deps?.run,
      });
  }

  const resolved = resolveProviderKey({ id: config.providerId });
  if (!resolved) {
    throw notConfigured("尚未配置该 Provider 的密钥。");
  }

  return (messages) =>
    callOpenAiCompatible({
      baseUrl: config.baseUrl,
      apiKey: resolved.key,
      model: config.model,
      messages,
      signal,
      timeoutMs,
      deps,
    });
}
