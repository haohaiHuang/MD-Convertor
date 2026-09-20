import { describe, expect, it } from "vitest";
import { LOCAL_CLI_IDS } from "@/types/settings";
import { LOCAL_CLI_REGISTRY, findCliDefinition } from "./registry";

describe("LOCAL_CLI_REGISTRY", () => {
  it("describes every supported CLI exactly once", () => {
    expect(LOCAL_CLI_REGISTRY.map((entry) => entry.id)).toEqual([...LOCAL_CLI_IDS]);
  });

  it("lists models through a flag only where the CLI supports it", () => {
    expect(findCliDefinition("pi")).toMatchObject({ name: "pi", listModelsArgs: ["--list-models"] });
    expect(findCliDefinition("claude")).toMatchObject({ name: "claude", listModelsArgs: null });
  });

  it("rejects unknown CLI ids", () => {
    expect(findCliDefinition("unknown")).toBeNull();
    expect(findCliDefinition("")).toBeNull();
  });
});
