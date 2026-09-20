import type { ModelCaller, ModelMessage } from "./provider";

export const TEST_PROVIDER_ENV = "MD_CONVERTOR_TEST_PROVIDER";
export const TEST_PROVIDER_MODEL = "md-convertor-test";

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/;

type Payload = { i: number; t: string }[];

function readBlocks(prompt: string): Payload {
  const raw = /Blocks:\s*(\[[\s\S]*\])\s*$/.exec(prompt)?.[1];
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.flatMap((entry) => {
      const block = entry as { i?: unknown; t?: unknown };
      return typeof block.i === "number" && typeof block.t === "string" ? [{ i: block.i, t: block.t }] : [];
    });
  } catch {
    return [];
  }
}

/**
 * Built-in stand-in for a real model (`MD_CONVERTOR_TEST_PROVIDER=1`), used by
 * the end-to-end tests so they never reach the network (FSD §5, S3 T3.10).
 *
 * Analyze labels CJK blocks `zh-Hans` and everything else `en`; translate
 * prefixes the target language. Without the flag this module is unreachable.
 */
export function createTestProviderCaller(): ModelCaller {
  return async (messages: readonly ModelMessage[]): Promise<string> => {
    const prompt = messages
      .filter((message) => message.role === "user")
      .map((message) => message.content)
      .join("\n");
    const blocks = readBlocks(prompt);
    const target = /^Target language:\s*(.+)$/m.exec(prompt)?.[1]?.trim();

    if (target) {
      return JSON.stringify({ blocks: blocks.map((block) => ({ i: block.i, t: `[${target}] ${block.t}` })) });
    }
    return JSON.stringify({
      blocks: blocks.map((block) => ({ i: block.i, lang: CJK.test(block.t) ? "zh-Hans" : "en" })),
    });
  };
}
