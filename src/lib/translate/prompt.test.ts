import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import {
  buildAnalyzeMessages,
  buildTranslateMessages,
  parseAnalyzeResponse,
  parseTranslateResponse,
  requestAnalyze,
  requestTranslation,
} from "./prompt";

const BLOCKS = [
  { i: 0, t: "第一段。" },
  { i: 3, t: "Second block." },
];

function expectAppError(run: () => unknown): AppError {
  try {
    run();
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error("expected an AppError");
}

function parts(messages: readonly { role: string; content: string }[]): { system: string; user: string } {
  return {
    system: messages.find((message) => message.role === "system")?.content ?? "",
    user: messages.find((message) => message.role === "user")?.content ?? "",
  };
}

describe("prompt construction", () => {
  it("asks for JSON only and lists every block id", () => {
    const messages = parts(buildAnalyzeMessages(BLOCKS));
    expect(messages.system).toMatch(/JSON/);
    expect(messages.user).toContain('"i":0');
    expect(messages.user).toContain('"i":3');
    expect(messages.user).toContain("Second block.");
    expect(messages.system + messages.user).not.toMatch(/chain of thought|explain your/i);
  });

  it("names the target language in the translation prompt", () => {
    const messages = parts(buildTranslateMessages(BLOCKS, "zh-Hans"));
    expect(messages.user).toContain("zh-Hans");
    expect(messages.user).toContain('"t":"第一段。"');
    expect(messages.system).toMatch(/JSON/);
  });
});

describe("parseAnalyzeResponse", () => {
  it("accepts a plain JSON envelope", () => {
    expect(parseAnalyzeResponse('{"blocks":[{"i":0,"lang":"zh-Hans"},{"i":3,"lang":"en"}]}', [0, 3])).toEqual([
      { i: 0, lang: "zh-Hans" },
      { i: 3, lang: "en" },
    ]);
  });

  it("strips an outermost code fence", () => {
    const raw = '```json\n{"blocks":[{"i":0,"lang":"zh"}]}\n```';
    expect(parseAnalyzeResponse(raw, [0])).toEqual([{ i: 0, lang: "zh" }]);
  });

  it("takes the outermost JSON object out of surrounding prose", () => {
    const raw = 'Sure! Here you go: {"blocks":[{"i":0,"lang":"en"}]} Hope that helps.';
    expect(parseAnalyzeResponse(raw, [0])).toEqual([{ i: 0, lang: "en" }]);
  });

  it.each([
    ["empty output", "", [0]],
    ["non JSON", "no json here", [0]],
    ["missing block", '{"blocks":[{"i":0,"lang":"en"}]}', [0, 1]],
    ["duplicate block", '{"blocks":[{"i":0,"lang":"en"},{"i":0,"lang":"en"}]}', [0]],
    ["unknown block", '{"blocks":[{"i":9,"lang":"en"}]}', [0]],
    ["missing language", '{"blocks":[{"i":0}]}', [0]],
    ["language is not a tag", '{"blocks":[{"i":0,"lang":"Chinese"}]}', [0]],
    ["wrong shape", '{"blocks":"nope"}', [0]],
  ])("rejects %s", (_name, raw, expected) => {
    const error = expectAppError(() => parseAnalyzeResponse(raw, expected));
    expect(error).toMatchObject({ status: 502, code: "TRANSLATE_INVALID_RESPONSE" });
  });
});

describe("parseTranslateResponse", () => {
  it("accepts translations for every id", () => {
    expect(parseTranslateResponse('{"blocks":[{"i":0,"t":"First."},{"i":3,"t":"第二块。"}]}', [0, 3])).toEqual([
      { i: 0, t: "First." },
      { i: 3, t: "第二块。" },
    ]);
  });

  it.each([
    ["empty text", '{"blocks":[{"i":0,"t":"   "}]}'],
    ["fenced body", '{"blocks":[{"i":0,"t":"```js\\nconst a = 1;\\n```"}]}'],
    ["missing id", '{"blocks":[]}'],
    ["non string text", '{"blocks":[{"i":0,"t":42}]}'],
  ])("rejects %s", (_name, raw) => {
    const error = expectAppError(() => parseTranslateResponse(raw, [0]));
    expect(error).toMatchObject({ status: 502, code: "TRANSLATE_INVALID_RESPONSE" });
  });

  it("keeps the model output out of the error message", () => {
    const error = expectAppError(() => parseTranslateResponse("", [0]));
    expect(error.message).not.toContain("blocks");
  });
});

describe("retry behaviour", () => {
  it("retries once and returns the second answer", async () => {
    const call = vi.fn<(messages: unknown) => Promise<string>>();
    call.mockResolvedValueOnce("not json").mockResolvedValueOnce('{"blocks":[{"i":0,"lang":"en"}]}');
    await expect(requestAnalyze(call, [BLOCKS[0]!])).resolves.toEqual([{ i: 0, lang: "en" }]);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("gives up after the second invalid answer", async () => {
    const call = vi.fn(async () => "still not json");
    await expect(requestAnalyze(call, [BLOCKS[0]!])).rejects.toMatchObject({
      status: 502,
      code: "TRANSLATE_INVALID_RESPONSE",
    });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("does not retry a provider failure", async () => {
    const call = vi.fn(async () => {
      throw new AppError(502, "TRANSLATE_PROVIDER_ERROR", "模型服务返回 500。");
    });
    await expect(requestTranslation(call, [BLOCKS[0]!], "en")).rejects.toMatchObject({
      code: "TRANSLATE_PROVIDER_ERROR",
    });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("sends the translation prompt with the target language", async () => {
    const call = vi.fn(async (messages: readonly { content: string }[]) =>
      messages[1]?.content.includes("zh-Hant") ? '{"blocks":[{"i":0,"t":"譯文"}]}' : "bad",
    );
    await expect(requestTranslation(call, [BLOCKS[0]!], "zh-Hant")).resolves.toEqual([{ i: 0, t: "譯文" }]);
  });
});
