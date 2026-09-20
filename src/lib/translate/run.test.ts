import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import type { ProviderFetch } from "@/lib/provider/endpoint";
import { resetRuntimeSecrets, setRuntimeSecret } from "@/lib/provider/credentials";
import { DEFAULT_SETTINGS, type Settings } from "@/types/settings";
import type { TranslationAnalysis } from "@/types/translation";
import { batchBlocks } from "./run";
import { analyzeTranslation, resetTaskLock, runTranslation } from "./run";
import { TRANSLATE_CALL_TIMEOUT_MS, TRANSLATE_TASK_BASE_TIMEOUT_MS } from "./limits";
import { segmentMarkdown, translatableSegments } from "./segment";

const TARGET = "zh-Hans";

const PROVIDER = {
  id: "provider-1",
  name: "Local gateway",
  baseUrl: "http://127.0.0.1:11434/v1",
  keyStored: true,
  models: ["model-a"],
  selectedModel: "model-a",
};

function cloudSettings(): Settings {
  const settings = structuredClone(DEFAULT_SETTINGS);
  settings.cloud.providers = [structuredClone(PROVIDER)];
  settings.cloud.activeProviderId = "provider-1";
  return settings;
}

/** One HTTP answer whose block payload the test controls. */
function answer(
  factory: (blocks: { i: number; t: string }[], target: boolean) => unknown,
): {
  fetch: ProviderFetch;
  calls: string[];
} {
  const calls: string[] = [];
  const fetchImpl: ProviderFetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as { messages: { role: string; content: string }[] };
    const prompt = body.messages.map((message) => message.content).join("\n");
    calls.push(prompt);
    const raw = /Blocks:\s*(\[[\s\S]*\])\s*$/.exec(prompt)?.[1] ?? "[]";
    const target = /^Target language:/m.test(prompt);
    const payload = await factory(JSON.parse(raw), target);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }), {
      status: 200,
    });
  };
  return { fetch: fetchImpl, calls };
}

function analyzeFetch(): ProviderFetch {
  return answer((blocks) => ({
    blocks: blocks.map((block) => ({ i: block.i, lang: /[\u4e00-\u9fff]/.test(block.t) ? "zh-Hans" : "en" })),
  })).fetch;
}

function translateFetch(): ProviderFetch {
  return answer((blocks) => ({ blocks: blocks.map((block) => ({ i: block.i, t: `[zh] ${block.t}` })) })).fetch;
}

/** Wraps every translated block in markers so untouched bytes stay identifiable. */
function markerFetch(): ProviderFetch {
  return answer((blocks) => ({ blocks: blocks.map((block) => ({ i: block.i, t: `«${block.t}»` })) })).fetch;
}

/**
 * S5 T5.2 golden document: prose in both languages plus every structural
 * construct the reassembly has to survive (heading, inline code, link, table
 * cells, bold, list, blockquote, fenced code, trailing paragraph).
 */
const GOLDEN_MARKDOWN = [
  "# Mixed article",
  "",
  "English intro with `code()` and a [link](https://example.com/a?b=1).",
  "",
  "中文段落保持不变。",
  "",
  "| Column | 列 |",
  "| --- | --- |",
  "| Alpha | 阿尔法 |",
  "| **Bold** | 粗体 |",
  "",
  "- English item",
  "- 中文项目",
  "",
  "> English quote",
  "",
  "```js",
  "const x = 1;",
  "```",
  "",
  "Final English paragraph.",
  "",
].join("\n");

const GOLDEN_NON_TARGET = [
  "# «Mixed article»",
  "",
  "«English intro with »`code()`« and a »[«link»](https://example.com/a?b=1)«.»",
  "",
  "中文段落保持不变。",
  "",
  "| «Column» | 列 |",
  "| --- | --- |",
  "| «Alpha» | 阿尔法 |",
  "| «**Bold**» | 粗体 |",
  "",
  "- «English item»",
  "- 中文项目",
  "",
  "> «English quote»",
  "",
  "```js",
  "const x = 1;",
  "```",
  "",
  "«Final English paragraph.»",
  "",
].join("\n");

function deps(overrides: Record<string, unknown> = {}) {
  return {
    readSettings: async () => cloudSettings(),
    env: {},
    deps: { fetch: analyzeFetch() },
    ...overrides,
  };
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

beforeEach(() => {
  // Keys live in the runtime store in production; tests never touch a real one.
  setRuntimeSecret("provider-1", "sk-test-placeholder");
});

afterEach(() => {
  resetTaskLock();
  resetRuntimeSecrets();
  vi.restoreAllMocks();
});

describe("batchBlocks", () => {
  const block = (i: number, length: number) => ({ i, t: "x".repeat(length) });

  it("keeps a small document in one batch", () => {
    expect(batchBlocks([block(0, 10), block(1, 10)])).toHaveLength(1);
  });

  it("starts a new batch at the block count limit", () => {
    const batches = batchBlocks(Array.from({ length: 21 }, (_, index) => block(index, 1)));
    expect(batches.map((batch) => batch.length)).toEqual([20, 1]);
  });

  it("starts a new batch at the character limit", () => {
    const batches = batchBlocks([block(0, 5_000), block(1, 5_000), block(2, 100)]);
    expect(batches.map((batch) => batch.length)).toEqual([1, 2]);
    expect(batches[0]?.map((entry) => entry.i)).toEqual([0]);
  });

  it("never splits a single oversized block", () => {
    const batches = batchBlocks([block(0, 20_000)]);
    expect(batches).toHaveLength(1);
    expect(batches[0]?.[0]?.t).toHaveLength(20_000);
  });

  it("keeps the input order of the blocks", () => {
    const batches = batchBlocks([block(3, 1), block(7, 1), block(9, 1)]);
    expect(batches.flat().map((entry) => entry.i)).toEqual([3, 7, 9]);
  });
});

describe("analyzeTranslation", () => {
  it("labels blocks, computes the ratio and reports the model", async () => {
    const markdown = "# Title\n\nEnglish paragraph.\n\n中文段落。\n";
    const { analysis, warnings, meta } = await analyzeTranslation({
      markdown,
      targetLanguage: TARGET,
      deps: deps(),
    });

    expect(analysis.targetLanguage).toBe(TARGET);
    expect(analysis.totalChars).toBe(28);
    expect(analysis.targetChars).toBe(5);
    expect(analysis.ratio).toBeCloseTo(5 / 28, 6);
    expect(analysis.blocks.map((block) => block.language)).toEqual([
      "other",
      "skipped",
      "other",
      "skipped",
      "target",
    ]);
    expect(warnings).toEqual([]);
    expect(meta).toMatchObject({ targetLanguage: TARGET, model: "model-a" });
    expect(meta.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("never sends skipped blocks to the model", async () => {
    const { fetch, calls } = answer((blocks) => ({ blocks: blocks.map((block) => ({ i: block.i, lang: "en" })) }));
    const markdown = "```js\nconst secret = 1;\n```\n\nEnglish paragraph.\n";
    await analyzeTranslation({ markdown, targetLanguage: TARGET, deps: deps({ deps: { fetch } }) });

    expect(calls).toHaveLength(1);
    expect(calls[0]).not.toContain("secret");
  });

  it("rejects a document with no prose", async () => {
    const error = await expectAppError(() =>
      analyzeTranslation({ markdown: "```js\ncode();\n```\n", targetLanguage: TARGET, deps: deps() }),
    );
    expect(error).toMatchObject({ status: 400, code: "TRANSLATE_EMPTY_INPUT" });
  });

  it("rejects prose beyond the character ceiling", async () => {
    const markdown = "x".repeat(200_001);
    const error = await expectAppError(() =>
      analyzeTranslation({ markdown, targetLanguage: TARGET, deps: deps() }),
    );
    expect(error).toMatchObject({ status: 413, code: "TRANSLATE_INPUT_TOO_LARGE" });
  });

  it("splits a long document into batches of at most 20 blocks", async () => {
    const paragraphs = Array.from({ length: 21 }, (_, index) => `Paragraph number ${index} with some words.`);
    const { fetch, calls } = answer((blocks) => ({ blocks: blocks.map((block) => ({ i: block.i, lang: "en" })) }));
    await analyzeTranslation({
      markdown: `${paragraphs.join("\n\n")}\n`,
      targetLanguage: TARGET,
      deps: deps({ deps: { fetch } }),
    });
    expect(calls).toHaveLength(2);
  });

  it("asks for configuration before calling anything", async () => {
    const fetch = vi.fn<ProviderFetch>();
    const error = await expectAppError(() =>
      analyzeTranslation({
        markdown: "English paragraph.\n",
        targetLanguage: TARGET,
        deps: { readSettings: async () => structuredClone(DEFAULT_SETTINGS), env: {}, deps: { fetch } },
      }),
    );
    expect(error).toMatchObject({ status: 409, code: "TRANSLATE_NOT_CONFIGURED" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports a busy engine while another task holds the lock", async () => {
    let release = (): void => {};
    const blocked = answer(async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return { blocks: [{ i: 0, lang: "en" }] };
    });
    const first = analyzeTranslation({
      markdown: "English paragraph.\n",
      targetLanguage: TARGET,
      deps: deps({ deps: { fetch: blocked.fetch } }),
    });
    const error = await expectAppError(() =>
      analyzeTranslation({ markdown: "English paragraph.\n", targetLanguage: TARGET, deps: deps() }),
    );
    expect(error).toMatchObject({ status: 429, code: "TRANSLATE_BUSY" });
    release();
    await expect(first).resolves.toBeTruthy();
  });

  it("rejects when the answer is not the agreed contract", async () => {
    const fetch: ProviderFetch = async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "sorry, I cannot" } }] }), { status: 200 });
    const error = await expectAppError(() =>
      analyzeTranslation({ markdown: "English paragraph.\n", targetLanguage: TARGET, deps: deps({ deps: { fetch } }) }),
    );
    expect(error).toMatchObject({ status: 502, code: "TRANSLATE_INVALID_RESPONSE" });
  });

  it("maps a cancelled request and releases the lock", async () => {
    const controller = new AbortController();
    const fetch: ProviderFetch = async (_url, init) => {
      controller.abort();
      const reason = init?.signal?.reason;
      throw reason instanceof Error ? reason : Object.assign(new Error("aborted"), { name: "AbortError" });
    };
    const error = await expectAppError(() =>
      analyzeTranslation({
        markdown: "English paragraph.\n",
        targetLanguage: TARGET,
        signal: controller.signal,
        deps: deps({ deps: { fetch } }),
      }),
    );
    expect(error).toMatchObject({ status: 499, code: "TRANSLATE_CANCELLED" });

    await expect(
      analyzeTranslation({ markdown: "English paragraph.\n", targetLanguage: TARGET, deps: deps() }),
    ).resolves.toBeTruthy();
  });

  it("maps an exceeded task deadline to a timeout", async () => {
    const fetch: ProviderFetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
        );
      });
    const error = await expectAppError(() =>
      analyzeTranslation({
        markdown: "English paragraph.\n",
        targetLanguage: TARGET,
        deps: deps({ deps: { fetch }, taskTimeoutMs: 30 }),
      }),
    );
    expect(error).toMatchObject({ status: 504, code: "TRANSLATE_TIMEOUT" });
  });

  it("keeps the request signal out of the deadline mapping", async () => {
    const controller = new AbortController();
    const error = await expectAppError(() =>
      analyzeTranslation({
        markdown: "English paragraph.\n",
        targetLanguage: TARGET,
        signal: controller.signal,
        deps: deps({
          deps: {
            fetch: async () => {
              controller.abort();
              throw Object.assign(new Error("aborted"), { name: "AbortError" });
            },
          },
          taskTimeoutMs: 5_000,
        }),
      }),
    );
    expect(error).toMatchObject({ status: 499, code: "TRANSLATE_CANCELLED" });
  });

  it("scales the task deadline with the batch count", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    // 21 short paragraphs stay under the character ceiling but need two batches at 20 blocks each.
    const markdown = Array.from({ length: 21 }, (_, index) => `Paragraph number ${index}.`).join("\n\n") + "\n";

    await analyzeTranslation({ markdown, targetLanguage: TARGET, deps: deps() });

    expect(timeout).toHaveBeenCalledWith(2 * TRANSLATE_CALL_TIMEOUT_MS + TRANSLATE_TASK_BASE_TIMEOUT_MS);
  });
});

describe("runTranslation", () => {
  async function analysisOf(markdown: string): Promise<TranslationAnalysis> {
    const { analysis } = await analyzeTranslation({ markdown, targetLanguage: TARGET, deps: deps() });
    return analysis;
  }

  it("replaces prose and leaves every other byte alone", async () => {
    const markdown = "# Title\n\nEnglish paragraph.\n\n```js\nsecret();\n```\n\n- item one\n";
    const { markdown: translated, meta, warnings } = await runTranslation({
      markdown,
      targetLanguage: TARGET,
      analysis: await analysisOf(markdown),
      scope: "all",
      deps: deps({ deps: { fetch: translateFetch() } }),
    });

    expect(translated).toBe(
      "# [zh] Title\n\n[zh] English paragraph.\n\n```js\nsecret();\n```\n\n- [zh] item one\n",
    );
    expect(warnings).toEqual([]);
    expect(meta).toMatchObject({ scope: "all", batches: 1, translatedBlocks: 3, model: "model-a" });
  });

  it("leaves target-language blocks untouched for scope non-target", async () => {
    const markdown = "English paragraph.\n\n中文段落。\n";
    const analysis = await analysisOf(markdown);
    const { markdown: translated, meta } = await runTranslation({
      markdown,
      targetLanguage: TARGET,
      analysis,
      scope: "non-target",
      deps: deps({ deps: { fetch: translateFetch() } }),
    });

    expect(translated).toBe("[zh] English paragraph.\n\n中文段落。\n");
    expect(meta.translatedBlocks).toBe(1);
  });

  it("golden: non-target scope preserves every untouched byte, order and structure", async () => {
    const analysis = await analysisOf(GOLDEN_MARKDOWN);
    const segments = segmentMarkdown(GOLDEN_MARKDOWN);
    const languageOf = (segment: (typeof segments)[number]) => analysis.blocks[segment.index]?.language;
    const targetBlocks = segments.filter((segment) => languageOf(segment) === "target");
    const otherBlocks = segments.filter((segment) => languageOf(segment) === "other");
    expect(targetBlocks.length).toBe(5);
    expect(otherBlocks.length).toBe(11);

    const { markdown: translated, meta } = await runTranslation({
      markdown: GOLDEN_MARKDOWN,
      targetLanguage: TARGET,
      analysis,
      scope: "non-target",
      deps: deps({ deps: { fetch: markerFetch() } }),
    });

    // Exact structure: markers only ever replace `other` prose, nothing else moves.
    expect(translated).toBe(GOLDEN_NON_TARGET);
    // Byte fidelity: dropping the markers gives the input back, character for character.
    expect(translated.split("«").join("").split("»").join("")).toBe(GOLDEN_MARKDOWN);
    // Target-language prose is neither replaced nor wrapped.
    for (const segment of targetBlocks) {
      expect(translated).toContain(segment.text);
      expect(translated).not.toContain(`«${segment.text}»`);
    }
    for (const segment of otherBlocks) {
      expect(translated).toContain(`«${segment.text}»`);
    }
    expect(meta).toMatchObject({ scope: "non-target", translatedBlocks: otherBlocks.length });
  });

  it("returns the document unchanged with a warning when nothing needs translating", async () => {
    const markdown = "中文段落。\n";
    const fetch = vi.fn<ProviderFetch>();
    const { markdown: translated, warnings, meta } = await runTranslation({
      markdown,
      targetLanguage: TARGET,
      analysis: await analysisOf(markdown),
      scope: "non-target",
      deps: deps({ deps: { fetch } }),
    });

    expect(translated).toBe(markdown);
    expect(warnings).toEqual(["没有需要翻译的段落。"]);
    expect(meta).toMatchObject({ batches: 0, translatedBlocks: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("asks the client to analyze again when the document changed", async () => {
    const analysis = await analysisOf("English paragraph.\n");
    const error = await expectAppError(() =>
      runTranslation({
        markdown: "English paragraph.\n\nA new paragraph.\n",
        targetLanguage: TARGET,
        analysis,
        scope: "all",
        deps: deps({ deps: { fetch: translateFetch() } }),
      }),
    );
    expect(error).toMatchObject({ status: 409, code: "TRANSLATE_ANALYSIS_STALE" });
  });

  it("asks the client to analyze again when the target language changed", async () => {
    const markdown = "English paragraph.\n";
    const analysis = await analysisOf(markdown);
    const error = await expectAppError(() =>
      runTranslation({
        markdown,
        targetLanguage: "ja",
        analysis,
        scope: "all",
        deps: deps({ deps: { fetch: translateFetch() } }),
      }),
    );
    expect(error).toMatchObject({ status: 409, code: "TRANSLATE_ANALYSIS_STALE" });
  });

  it("honours the character ceiling on the blocks it would send", async () => {
    const markdown = `${Array.from({ length: 60 }, (_, index) => `Paragraph ${index} ${"word ".repeat(700)}`.trim()).join("\n\n")}\n`;
    const segments = segmentMarkdown(markdown);
    const translatable = translatableSegments(segments);
    expect(translatable.reduce((total, segment) => total + segment.text.length, 0)).toBeGreaterThan(200_000);

    const fetch = vi.fn<ProviderFetch>();
    const error = await expectAppError(() =>
      runTranslation({
        markdown,
        targetLanguage: TARGET,
        analysis: {
          targetLanguage: TARGET,
          totalChars: 0,
          targetChars: 0,
          ratio: 0,
          blocks: segments.map((segment) => ({
            index: segment.index,
            language: segment.kind === "skip" || segment.text.trim() === "" ? "skipped" : "other",
            chars: segment.kind === "skip" ? 0 : segment.text.length,
          })),
        },
        scope: "all",
        deps: deps({ deps: { fetch } }),
      }),
    );
    expect(error).toMatchObject({ status: 413, code: "TRANSLATE_INPUT_TOO_LARGE" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
