import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetRuntimeSecrets, resolveProviderKey, setRuntimeSecret } from "./credentials";

const provider = { id: "openai" };

function seedInjectedSecrets(value: unknown): void {
  process.env.MD_CONVERTOR_SECRETS = Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

describe("resolveProviderKey", () => {
  beforeEach(() => {
    delete process.env.MD_CONVERTOR_SECRETS;
    resetRuntimeSecrets();
  });

  afterEach(() => {
    delete process.env.MD_CONVERTOR_SECRETS;
    resetRuntimeSecrets();
  });

  it("returns null when nothing is configured", async () => {
    expect(await resolveProviderKey(provider)).toBeNull();
    expect(await resolveProviderKey({ id: "missing" })).toBeNull();
  });

  it("reads the injected secrets payload for the requested provider only", async () => {
    seedInjectedSecrets({ openai: "sk-from-store", other: "sk-other" });
    expect(await resolveProviderKey(provider)).toEqual({ key: "sk-from-store" });
    expect(await resolveProviderKey({ id: "missing" })).toBeNull();
  });

  it("survives an unparsable injected payload", async () => {
    process.env.MD_CONVERTOR_SECRETS = "not-base64-json";
    expect(await resolveProviderKey({ id: "openai" })).toBeNull();
  });

  it("never reads a key from the process environment", async () => {
    process.env.MD_CONVERTOR_TEST_KEY = "sk-from-env";
    process.env.OPENAI_API_KEY = "sk-from-env";
    try {
      expect(await resolveProviderKey(provider)).toBeNull();
    } finally {
      delete process.env.MD_CONVERTOR_TEST_KEY;
      delete process.env.OPENAI_API_KEY;
    }
  });

  it("updates the runtime map without a restart", async () => {
    expect(await resolveProviderKey(provider)).toBeNull();
    setRuntimeSecret("openai", "sk-saved-now");
    expect(await resolveProviderKey(provider)).toEqual({ key: "sk-saved-now" });
  });

  it("keeps secrets isolated per provider", async () => {
    setRuntimeSecret("first", "sk-first");
    expect(await resolveProviderKey({ id: "second" })).toBeNull();
  });

  it("trims stored values and ignores empty ones", async () => {
    setRuntimeSecret("openai", "  sk-padded  ");
    expect(await resolveProviderKey(provider)).toEqual({ key: "sk-padded" });

    setRuntimeSecret("openai", "   ");
    expect(await resolveProviderKey(provider)).toBeNull();
  });
});
