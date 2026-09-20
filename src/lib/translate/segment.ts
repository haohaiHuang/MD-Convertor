import { AppError } from "@/lib/errors";

/**
 * Splits a converted document into translatable prose blocks and untouched
 * structural blocks (FSD §3). `prefix`/`text`/`suffix` always concatenate back
 * to the original bytes, so an untouched document reassembles byte for byte.
 */
export type SegmentKind = "text" | "skip";

export type Segment = {
  index: number;
  kind: SegmentKind;
  prefix: string;
  text: string;
  suffix: string;
};

type Piece = Omit<Segment, "index">;

type Line = { raw: string; body: string; eol: string };

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
const HEADING = /^(#{1,6})([ \t]+)(.*)$/;
const BLOCKQUOTE = /^((?: {0,3}>)+)([ \t]?)(.*)$/;
const LIST_ITEM = /^([ \t]*)([-*+]|\d{1,9}[.)])([ \t]+)(.*)$/;
const RULE = /^ {0,3}(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/;
const META_LINE = /^ {0,3}>+[ \t]*(?:转换时间|来源)[：:]/;
const REFERENCE_DEFINITION = /^ {0,3}\[[^\]]+\]:[ \t]*\S/;
const HTML_LINE = /^ {0,3}<(?:!--|!|\/?[a-zA-Z])/;
const INDENTED_CODE = /^(?: {4}|\t)/;

const PROTECTED_INLINE = [
  /^<(?:[a-zA-Z][a-zA-Z0-9+.-]*:[^<>\s]*)>/, // autolink
  /^<!--[\s\S]*?-->/,
  /^<\/?[a-zA-Z][^<>]*>/, // html tag
  /^https?:\/\/[^\s<>()\[\]"'`]+/, // bare url
];

function isBlank(body: string): boolean {
  return /^[ \t]*$/.test(body);
}

function splitLines(source: string): Line[] {
  const lines: Line[] = [];
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== "\n") continue;
    const raw = source.slice(start, index + 1);
    const hasCr = raw.length > 1 && raw[raw.length - 2] === "\r";
    lines.push({
      raw,
      body: hasCr ? raw.slice(0, -2) : raw.slice(0, -1),
      eol: hasCr ? "\r\n" : "\n",
    });
    start = index + 1;
  }
  if (start < source.length) {
    const raw = source.slice(start);
    lines.push({ raw, body: raw, eol: "" });
  }
  return lines;
}

function countRun(text: string, index: number, char: string): number {
  let length = 0;
  while (text[index + length] === char) length += 1;
  return length;
}

function findCodeSpanEnd(raw: string, index: number): number | null {
  const ticks = countRun(raw, index, "`");
  let cursor = index + ticks;
  while (cursor < raw.length) {
    if (raw[cursor] !== "`") {
      cursor += 1;
      continue;
    }
    const run = countRun(raw, cursor, "`");
    if (run === ticks) return cursor + run;
    cursor += run;
  }
  return null;
}

function findClosingParen(raw: string, open: number): number | null {
  let depth = 0;
  for (let index = open; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === "<") {
      const end = raw.indexOf(">", index + 1);
      if (end < 0) return null;
      index = end;
      continue;
    }
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return null;
}

type LinkMatch = { image: boolean; textStart: number; textEnd: number; end: number };

function findLink(raw: string, index: number): LinkMatch | null {
  const image = raw.startsWith("![", index);
  const bracket = image ? index + 1 : index;
  if (raw[bracket] !== "[") return null;
  let close = -1;
  for (let cursor = bracket + 1; cursor < raw.length; cursor += 1) {
    if (raw[cursor] === "\\") {
      cursor += 1;
      continue;
    }
    if (raw[cursor] === "[") return null;
    if (raw[cursor] === "]") {
      close = cursor;
      break;
    }
  }
  if (close < 0 || raw[close + 1] !== "(") return null;
  const paren = findClosingParen(raw, close + 1);
  if (paren === null) return null;
  return { image, textStart: bracket + 1, textEnd: close, end: paren + 1 };
}

function readProtected(raw: string, index: number): { end: number; piece: Piece } | null {
  if (raw[index] === "`") {
    const end = findCodeSpanEnd(raw, index);
    if (end !== null) {
      return { end, piece: { kind: "skip", prefix: "", text: raw.slice(index, end), suffix: "" } };
    }
  }
  if (raw[index] === "!" || raw[index] === "[") {
    const link = findLink(raw, index);
    if (link) {
      const text = raw.slice(link.textStart, link.textEnd);
      return {
        end: link.end,
        piece: {
          kind: text.trim() === "" ? "skip" : "text",
          prefix: link.image ? "![" : "[",
          text,
          suffix: raw.slice(link.textEnd, link.end),
        },
      };
    }
  }
  const rest = raw.slice(index);
  for (const pattern of PROTECTED_INLINE) {
    const match = pattern.exec(rest);
    if (match) {
      return { end: index + match[0].length, piece: { kind: "skip", prefix: "", text: match[0], suffix: "" } };
    }
  }
  return null;
}

/** Splits one line body into prose pieces and protected inline spans. */
function splitInline(raw: string): Piece[] {
  const pieces: Piece[] = [];
  let plainStart = 0;
  let index = 0;
  const flushPlain = (end: number) => {
    if (end <= plainStart) return;
    pieces.push({ kind: "text", prefix: "", text: raw.slice(plainStart, end), suffix: "" });
  };
  while (index < raw.length) {
    const found = readProtected(raw, index);
    if (!found) {
      index += 1;
      continue;
    }
    flushPlain(index);
    pieces.push(found.piece);
    index = found.end;
    plainStart = index;
  }
  flushPlain(raw.length);
  return pieces;
}

function emitInline(inner: string, containerPrefix: string, eol: string, out: Piece[]): void {
  if (inner.trim() === "") {
    out.push({ kind: "skip", prefix: "", text: containerPrefix + inner + eol, suffix: "" });
    return;
  }
  const pieces = splitInline(inner);
  pieces.forEach((piece, position) => {
    out.push({
      kind: piece.kind,
      prefix: (position === 0 ? containerPrefix : "") + piece.prefix,
      text: piece.text,
      suffix: piece.suffix + (position === pieces.length - 1 ? eol : ""),
    });
  });
}

function isTableSeparator(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed.includes("|") || !trimmed.includes("-")) return false;
  const cells = trimmed.replace(/^\|/, "").replace(/\|$/, "").split("|");
  return cells.length > 0 && cells.every((cell) => /^[ \t]*:?-+:?[ \t]*$/.test(cell));
}

/** Marks data rows of a GitHub table: lines adjacent to a separator row that carry a pipe. */
function markTableRows(bodies: readonly string[]): boolean[] {
  const rows = bodies.map(() => false);
  for (let index = 0; index < bodies.length; index += 1) {
    if (!isTableSeparator(bodies[index] ?? "")) continue;
    for (let above = index - 1; above >= 0 && (bodies[above] ?? "").includes("|"); above -= 1) rows[above] = true;
    for (let below = index + 1; below < bodies.length && (bodies[below] ?? "").includes("|"); below += 1) rows[below] = true;
  }
  return rows;
}

function splitTableCells(body: string): string[] {
  const cells: string[] = [];
  let start = 0;
  for (let index = 0; index < body.length; index += 1) {
    if (body[index] !== "|") continue;
    let backslashes = 0;
    for (let cursor = index - 1; cursor >= 0 && body[cursor] === "\\"; cursor -= 1) backslashes += 1;
    if (backslashes % 2 === 1) continue;
    cells.push(body.slice(start, index));
    start = index + 1;
  }
  cells.push(body.slice(start));
  return cells;
}

function emitCell(core: string, cellPrefix: string, cellSuffix: string, out: Piece[]): void {
  const pieces = splitInline(core);
  pieces.forEach((piece, position) => {
    out.push({
      kind: piece.kind,
      prefix: (position === 0 ? cellPrefix : "") + piece.prefix,
      text: piece.text,
      suffix: piece.suffix + (position === pieces.length - 1 ? cellSuffix : ""),
    });
  });
}

function emitTableRow(body: string, eol: string, out: Piece[]): void {
  const start = out.length;
  const cells = splitTableCells(body);
  let pending = "";
  for (let position = 0; position < cells.length; position += 1) {
    if (position > 0) pending += "|";
    const token = cells[position] ?? "";
    const lead = /^[ \t]*/.exec(token)?.[0] ?? "";
    const trail = /[ \t]*$/.exec(token)?.[0] ?? "";
    const core = token.slice(lead.length, token.length - trail.length);
    if (core === "") {
      pending += token;
      continue;
    }
    emitCell(core, pending + lead, trail, out);
    pending = "";
  }
  if (out.length === start) {
    out.push({ kind: "skip", prefix: "", text: body + eol, suffix: "" });
    return;
  }
  const last = out[out.length - 1];
  if (last) last.suffix += pending + eol;
}

function findFenceEnd(lines: readonly Line[], openIndex: number, fence: string): number {
  const marker = fence[0];
  for (let index = openIndex + 1; index < lines.length; index += 1) {
    const match = FENCE_CLOSE.exec(lines[index]?.body ?? "");
    if (!match) continue;
    const candidate = match[1] ?? "";
    if (candidate[0] === marker && candidate.length >= fence.length) return index;
  }
  return lines.length - 1;
}

function addSkipLine(line: Line, out: Piece[]): void {
  out.push({ kind: "skip", prefix: "", text: line.raw, suffix: "" });
}

export function segmentMarkdown(markdown: string): Segment[] {
  const lines = splitLines(markdown);
  const tableRows = markTableRows(lines.map((line) => line.body));
  const pieces: Piece[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line) break;
    const { body, eol } = line;

    const fence = FENCE_OPEN.exec(body);
    if (fence) {
      const end = findFenceEnd(lines, index, fence[1] ?? "");
      const raw = lines.slice(index, end + 1).map((entry) => entry.raw).join("");
      pieces.push({ kind: "skip", prefix: "", text: raw, suffix: "" });
      index = end + 1;
      continue;
    }

    if (
      isBlank(body) ||
      RULE.test(body) ||
      META_LINE.test(body) ||
      REFERENCE_DEFINITION.test(body) ||
      HTML_LINE.test(body) ||
      isTableSeparator(body)
    ) {
      addSkipLine(line, pieces);
      index += 1;
      continue;
    }

    if (tableRows[index]) {
      emitTableRow(body, eol, pieces);
      index += 1;
      continue;
    }

    const heading = HEADING.exec(body);
    if (heading) {
      emitInline(heading[3] ?? "", (heading[1] ?? "") + (heading[2] ?? ""), eol, pieces);
      index += 1;
      continue;
    }

    const quote = BLOCKQUOTE.exec(body);
    if (quote) {
      emitInline(quote[3] ?? "", (quote[1] ?? "") + (quote[2] ?? ""), eol, pieces);
      index += 1;
      continue;
    }

    const item = LIST_ITEM.exec(body);
    if (item) {
      emitInline(item[4] ?? "", (item[1] ?? "") + (item[2] ?? "") + (item[3] ?? ""), eol, pieces);
      index += 1;
      continue;
    }

    if (INDENTED_CODE.test(body)) {
      addSkipLine(line, pieces);
      index += 1;
      continue;
    }

    emitInline(body, "", eol, pieces);
    index += 1;
  }

  return pieces.map((piece, position) => ({ index: position, ...piece }));
}

/** Prose blocks that are worth sending to the model. */
export function translatableSegments(segments: readonly Segment[]): Segment[] {
  return segments.filter((segment) => segment.kind === "text" && segment.text.trim() !== "");
}

/** Puts model output back between the preserved prefixes and suffixes. */
export function reassemble(segments: readonly Segment[], translations: ReadonlyMap<number, string>): string {
  return segments
    .map((segment) => {
      if (segment.kind === "skip") return segment.prefix + segment.text + segment.suffix;
      const translation = translations.get(segment.index);
      return segment.prefix + (translation ?? segment.text) + segment.suffix;
    })
    .join("");
}

/** Guards against running an analysis that was produced for a different document. */
export function assertBlockAlignment(segments: readonly Segment[], blocks: readonly { index: number }[]): void {
  const aligned =
    blocks.length === segments.length && blocks.every((block, position) => block.index === segments[position]?.index);
  if (!aligned) {
    throw new AppError(409, "TRANSLATE_ANALYSIS_STALE", "文档已变化，请重新判定。");
  }
}
