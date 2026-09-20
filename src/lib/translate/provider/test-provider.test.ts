import { describe, expect, it } from "vitest";
import { createTestProviderCaller } from "./test-provider";

const call = createTestProviderCaller();

describe("test provider", () => {
  it("labels CJK blocks as the target and other blocks as English", async () => {
    const answer = await call([
      { role: "user", content: 'Blocks:\n[{"i":0,"t":"hello"},{"i":2,"t":"你好"}]' },
    ]);
    expect(JSON.parse(answer)).toEqual({
      blocks: [
        { i: 0, lang: "en" },
        { i: 2, lang: "zh-Hans" },
      ],
    });
  });

  it("prefixes translations with the requested target language", async () => {
    const answer = await call([{ role: "user", content: 'Target language: ja\nBlocks:\n[{"i":1,"t":"hello"}]' }]);
    expect(JSON.parse(answer)).toEqual({ blocks: [{ i: 1, t: "[ja] hello" }] });
  });

  it("ignores the system prompt", async () => {
    const answer = await call([
      { role: "system", content: "Target language: de is part of the instructions" },
      { role: "user", content: 'Blocks:\n[{"i":0,"t":"hello"}]' },
    ]);
    expect(JSON.parse(answer)).toEqual({ blocks: [{ i: 0, lang: "en" }] });
  });

  it("answers with no blocks when the prompt carries none", async () => {
    expect(JSON.parse(await call([{ role: "user", content: "hello" }]))).toEqual({ blocks: [] });
  });

  it("drops entries that are not blocks instead of inventing ids", async () => {
    const answer = await call([
      { role: "user", content: 'Blocks:\n[{"i":0,"t":"keep"},{"i":"1"},{"t":"no id"},7]' },
    ]);
    expect(JSON.parse(answer)).toEqual({ blocks: [{ i: 0, lang: "en" }] });
  });
});
