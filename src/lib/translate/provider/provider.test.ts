import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { resetRuntimeSecrets, setRuntimeSecret } from "@/lib/provider/credentials";
import { DEFAULT_SETTINGS, type Settings } from "@/types/settings";
import type { CliRunner } from "./local-cli";
import type { ModelMessage } from "./provider";
import { createModelCaller, resolveEffectiveModel, type ModelCallDeps } from "./provider";

function settings(overrides: {
  mode?: Settings["mode"];
  providers?: Settings["cloud"]["providers"];
  activeProviderId?: string | null;
  clis?: Settings["local"]["clis"];
  activeCliId?: Settings["local"]["activeCliId"];
}): Settings {
  const base: Settings = structuredClone(DEFAULT_SETTINGS);
  return {
    ...base,
    mode: overrides.mode ?? base.mode,
    cloud: {
      providers: overrides.providers ?? base.cloud.providers,
      activeProviderId: overrides.activeProviderId ?? base.cloud.activeProviderId,
    },
    local: {
      clis: overrides.clis ?? base.local.clis,
      activeCliId: overrides.activeCliId ?? base.local.activeCliId,
    },
  };
}

const PROVIDER = {
  id: "provider-1",
  name: "Local gateway",
  baseUrl: "http://127.0.0.1:11434/v1",
  keyStored: false,
  models: ["model-a"],
  selectedModel: "model-a",
};

const MESSAGES: ModelMessage[] = [{ role: "user", content: "hi" }];

function expectAppError(run: () => Promise<unknown> | unknown): Promise<AppError> {
  return Promise.resolve()
    .then(run)
    .then(
      () => {
        throw new Error("expected an AppError");
      },
      (error: unknown) => {
        if (error instanceof AppError) return error;
        throw error;
      },
    );
}

afterEach(() => {
  resetRuntimeSecrets();
  vi.unstubAllEnvs();
});

describe("resolveEffectiveModel", () => {
  it("resolves the active cloud provider and its selected model", () => {
    const config = resolveEffectiveModel(
      settings({ mode: "cloud", providers: [PROVIDER], activeProviderId: "provider-1" }),
      {},
    );
    expect(config).toEqual({
      kind: "cloud",
      providerId: "provider-1",
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "model-a",
    });
  });

  it("resolves the active local CLI without requiring a model", () => {
    const config = resolveEffectiveModel(
      settings({
        mode: "local",
        activeCliId: "pi",
        clis: [
          { id: "pi", name: "pi", enabled: true, detectedPath: "/opt/bin/pi", models: [], selectedModel: null },
          { id: "claude", name: "claude", enabled: false, detectedPath: null, models: [], selectedModel: null },
        ],
      }),
      {},
    );
    expect(config).toEqual({ kind: "local", cliId: "pi", executablePath: "/opt/bin/pi", model: null });
  });

  it.each([
    ["no active provider", settings({ mode: "cloud" })],
    ["active provider without a model", settings({ mode: "cloud", providers: [{ ...PROVIDER, selectedModel: null }], activeProviderId: "provider-1" })],
    ["no active CLI", settings({ mode: "local" })],
    [
      "active CLI that is disabled",
      settings({
        mode: "local",
        activeCliId: "pi",
        clis: [{ id: "pi", name: "pi", enabled: false, detectedPath: "/opt/bin/pi", models: [], selectedModel: null }],
      }),
    ],
    [
      "active CLI that is not installed",
      settings({
        mode: "local",
        activeCliId: "claude",
        clis: [{ id: "claude", name: "claude", enabled: true, detectedPath: null, models: [], selectedModel: null }],
      }),
    ],
  ])("asks for configuration when there is %s", async (_name, current) => {
    const error = await expectAppError(() => resolveEffectiveModel(current, {}));
    expect(error).toMatchObject({ status: 409, code: "TRANSLATE_NOT_CONFIGURED" });
  });

  it("prefers the built-in test provider whenever the flag is set", async () => {
    expect(resolveEffectiveModel(settings({ mode: "cloud" }), { MD_CONVERTOR_TEST_PROVIDER: "1" })).toEqual({
      kind: "test",
      model: "md-convertor-test",
    });
    // Any other value leaves the normal configuration path in charge.
    const error = await expectAppError(() =>
      resolveEffectiveModel(settings({ mode: "cloud" }), { MD_CONVERTOR_TEST_PROVIDER: "0" }),
    );
    expect(error).toMatchObject({ status: 409, code: "TRANSLATE_NOT_CONFIGURED" });
  });
});

describe("createModelCaller", () => {
  it("calls an OpenAI-compatible endpoint with the provider key", async () => {
    setRuntimeSecret("provider-1", "sk-test-placeholder");
    const fetch = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "answer" } }] }), { status: 200 }),
    );
    const call = createModelCaller(
      resolveEffectiveModel(settings({ mode: "cloud", providers: [PROVIDER], activeProviderId: "provider-1" }), {}),
      { deps: { fetch } as ModelCallDeps },
    );
    await expect(call(MESSAGES)).resolves.toBe("answer");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("uses a key saved through the runtime store", async () => {
    setRuntimeSecret("provider-1", "sk-runtime-placeholder");
    const fetch = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] })));
    const call = createModelCaller(
      resolveEffectiveModel(settings({ mode: "cloud", providers: [PROVIDER], activeProviderId: "provider-1" }), {}),
      { deps: { fetch, lookup: async () => [{ address: "93.184.216.34", family: 4 }] } },
    );
    await expect(call(MESSAGES)).resolves.toBe("ok");
  });

  it("asks for a key when the provider has none", async () => {
    const error = await expectAppError(() =>
      createModelCaller(
        resolveEffectiveModel(settings({ mode: "cloud", providers: [PROVIDER], activeProviderId: "provider-1" }), {}),
        {},
      )(MESSAGES),
    );
    expect(error).toMatchObject({ status: 409, code: "TRANSLATE_NOT_CONFIGURED" });
  });

  it("runs the local CLI with the configured model", async () => {
    const run = vi.fn<CliRunner>(async () => ({ stdout: '{"ok":true}', exitCode: 0, failure: null }));
    const call = createModelCaller(
      {
        kind: "local",
        cliId: "pi",
        executablePath: "/opt/bin/pi",
        model: "agnes-2.5-flash",
      },
      { deps: { run } },
    );
    await expect(call(MESSAGES)).resolves.toBe('{"ok":true}');
    expect(run.mock.calls[0]?.[0]).toBe("/opt/bin/pi");
    expect(run.mock.calls[0]?.[1]).toContain("agnes-2.5-flash");
  });

  it("answers through the built-in test provider", async () => {
    const call = createModelCaller({ kind: "test", model: "md-convertor-test" }, {});
    await expect(call([{ role: "user", content: 'Blocks:\n[{"i":0,"t":"hello world"}]' }])).resolves.toContain('"i":0');
  });
});
