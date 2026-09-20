import { AppError } from "@/lib/errors";
import { isBcp47 } from "@/types/settings";
import type { ModelCaller, ModelMessage } from "./provider/provider";

/** A block as the model sees it: stable id plus the only text it may rewrite. */
export type PromptBlock = { i: number; t: string };

export type AnalyzeEntry = { i: number; lang: string };

export type TranslationEntry = { i: number; t: string };

const ANALYZE_SYSTEM = [
  "You identify the human language of Markdown text blocks.",
  'Answer with a single JSON object: {"blocks":[{"i":<block id>,"lang":"<BCP-47 tag>"}]}.',
  'Use BCP-47 tags such as "en", "zh-Hans" or "ja".',
  "Return exactly one entry per input block, in the given order.",
  "Output JSON only: no prose, no comments, no markdown fences.",
].join(" ");

const TRANSLATE_SYSTEM = [
  "You translate Markdown text blocks.",
  'Answer with a single JSON object: {"blocks":[{"i":<block id>,"t":"<translation>"}]}.',
  "Translate the complete text of every block into the requested target language.",
  "Copy Markdown markers (such as #, -, >, *, |), URLs, inline code spans, HTML tags, numbers and placeholders exactly as given.",
  "If a block is already in the target language, copy it unchanged.",
  "Return exactly one entry per input block, in the given order.",
  "Output JSON only: no prose, no comments, no markdown fences.",
].join(" ");

function blockPayload(blocks: readonly PromptBlock[]): string {
  return JSON.stringify(blocks.map((block) => ({ i: block.i, t: block.t })));
}

export function buildAnalyzeMessages(blocks: readonly PromptBlock[]): ModelMessage[] {
  return [
    { role: "system", content: ANALYZE_SYSTEM },
    { role: "user", content: `Blocks:\n${blockPayload(blocks)}` },
  ];
}

export function buildTranslateMessages(blocks: readonly PromptBlock[], targetLanguage: string): ModelMessage[] {
  return [
    { role: "system", content: TRANSLATE_SYSTEM },
    { role: "user", content: `Target language: ${targetLanguage}\nBlocks:\n${blockPayload(blocks)}` },
  ];
}

function invalidResponse(): AppError {
  return new AppError(502, "TRANSLATE_INVALID_RESPONSE", "模型返回内容不符合约定格式，请重试。");
}

/** Reads the outermost JSON object, tolerating a fence or surrounding chatter. */
function readEnvelope(raw: string): unknown {
  let text = raw.trim();
  const fenced = /^```[^\n]*\n([\s\S]*?)\n?```$/.exec(text);
  if (fenced) text = (fenced[1] ?? "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw invalidResponse();
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw invalidResponse();
  }
}

function readEntries(raw: string, expectedIds: readonly number[], key: "lang" | "t"): { i: number; value: string }[] {
  const envelope = readEnvelope(raw);
  const blocks = (envelope as { blocks?: unknown } | null)?.blocks;
  if (!Array.isArray(blocks) || blocks.length !== expectedIds.length) throw invalidResponse();

  const seen = new Set<number>();
  const entries: { i: number; value: string }[] = [];
  for (const block of blocks) {
    const entry = block as { i?: unknown; lang?: unknown; t?: unknown } | null;
    const id = entry?.i;
    const value = entry?.[key];
    if (typeof id !== "number" || !Number.isInteger(id) || typeof value !== "string") throw invalidResponse();
    if (!expectedIds.includes(id) || seen.has(id)) throw invalidResponse();
    seen.add(id);
    entries.push({ i: id, value });
  }
  if (seen.size !== expectedIds.length) throw invalidResponse();
  return entries;
}

export function parseAnalyzeResponse(raw: string, expectedIds: readonly number[]): AnalyzeEntry[] {
  return readEntries(raw, expectedIds, "lang").map(({ i, value }) => {
    if (!isBcp47(value)) throw invalidResponse();
    return { i, lang: value };
  });
}

export function parseTranslateResponse(raw: string, expectedIds: readonly number[]): TranslationEntry[] {
  return readEntries(raw, expectedIds, "t").map(({ i, value }) => {
    if (value.trim() === "" || /^\s*(?:```|~~~)/.test(value)) throw invalidResponse();
    return { i, t: value };
  });
}

/** One retry on a bad answer, then TRANSLATE_INVALID_RESPONSE (FSD §5). */
async function requestWithRetry<T>(call: ModelCaller, messages: ModelMessage[], parse: (raw: string) => T): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await call(messages);
    try {
      return parse(raw);
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== "TRANSLATE_INVALID_RESPONSE") throw error;
    }
  }
  throw invalidResponse();
}

export function requestAnalyze(call: ModelCaller, blocks: readonly PromptBlock[]): Promise<AnalyzeEntry[]> {
  const ids = blocks.map((block) => block.i);
  return requestWithRetry(call, buildAnalyzeMessages(blocks), (raw) => parseAnalyzeResponse(raw, ids));
}

export function requestTranslation(
  call: ModelCaller,
  blocks: readonly PromptBlock[],
  targetLanguage: string,
): Promise<TranslationEntry[]> {
  const ids = blocks.map((block) => block.i);
  return requestWithRetry(call, buildTranslateMessages(blocks, targetLanguage), (raw) =>
    parseTranslateResponse(raw, ids),
  );
}
