/**
 * Finds the image references of a Markdown document, with the exact span of each URL.
 *
 * Only the URL span is reported for replacement, so the surrounding bytes (`alt`, `title`,
 * other tag attributes) are never rewritten. Fenced blocks and inline code are masked out
 * first: a code sample must not be touched, and it must not count against the image limit.
 * Reference-style syntax (`![alt][id]`) is deliberately not handled (S2 known limitation).
 */

export type ImageRefSyntax = "inline" | "html";

export type ImageRef = {
  /** Whole reference: `![alt](dest)` or the `<img …>` tag. */
  start: number;
  end: number;
  /** The URL value only — the single span a replacement may touch. */
  targetStart: number;
  targetEnd: number;
  syntax: ImageRefSyntax;
  target: string;
  alt: string;
};

// The destination may keep the page title verbatim (the extension writes `<title>.images/…`),
// so spaces and balanced parentheses are allowed; a space must still never cross a line break.
const INLINE_IMAGE = /!\[([^\]]*)\]\(\s*(<[^>\n]*>|(?:[^\s()\n]|\([^()\n]*\)|\(|[^\S\n])+?)(?:\s+(?:"[^"]*"|'[^']*'|\([^()]*\)))?\s*\)/gd;
// The lookbehind keeps `data-src="…"` from being read as the real `src`.
const HTML_IMAGE = /<img\b[^>]*?(?<![\w-])src\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gid;

function maskRange(chars: string[], from: number, to: number): void {
  for (let index = from; index < to; index += 1) chars[index] = " ";
}

/** Same length as the input, with fenced blocks and inline code blanked out. */
function maskCode(markdownText: string): string {
  const chars = markdownText.split("");
  let offset = 0;
  let fence: string | null = null;

  for (const line of markdownText.split("\n")) {
    const lineEnd = offset + line.length;
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(line);

    if (fence !== null) {
      maskRange(chars, offset, lineEnd);
      const closes = fenceMatch
        && fenceMatch[1][0] === fence[0]
        && fenceMatch[1].length >= fence.length
        && line.slice(fenceMatch[0].length).trim() === "";
      if (closes) fence = null;
    } else if (fenceMatch) {
      fence = fenceMatch[1];
      maskRange(chars, offset, lineEnd);
    } else {
      for (const match of line.matchAll(/(`+)[^`]*\1/g)) {
        maskRange(chars, offset + match.index, offset + match.index + match[0].length);
      }
    }

    offset = lineEnd + 1;
  }

  return chars.join("");
}

export function scanImageRefs(markdownText: string): ImageRef[] {
  const text = String(markdownText);
  const masked = maskCode(text);
  const refs: ImageRef[] = [];

  for (const match of masked.matchAll(INLINE_IMAGE)) {
    const raw = match[2];
    const [rawStart, rawEnd] = match.indices![2]!;
    const pointy = raw.startsWith("<") && raw.endsWith(">");
    const targetStart = pointy ? rawStart + 1 : rawStart;
    const targetEnd = pointy ? rawEnd - 1 : rawEnd;
    refs.push({
      start: match.index,
      end: match.index + match[0].length,
      targetStart,
      targetEnd,
      syntax: "inline",
      target: masked.slice(targetStart, targetEnd),
      alt: match[1],
    });
  }

  for (const match of masked.matchAll(HTML_IMAGE)) {
    const quoted = match.indices![2] ?? match.indices![3];
    const raw = match.indices![4];
    const [targetStart, targetEnd] = quoted ?? raw!;
    const close = masked.indexOf(">", match.index + match[0].length);
    const end = close === -1 ? match.index + match[0].length : close + 1;
    const altMatch = /\balt\s*=\s*("([^"]*)"|'([^']*)')/i.exec(masked.slice(match.index, end));
    refs.push({
      start: match.index,
      end,
      targetStart,
      targetEnd,
      syntax: "html",
      target: masked.slice(targetStart, targetEnd),
      alt: altMatch?.[2] ?? altMatch?.[3] ?? "",
    });
  }

  return refs.sort((left, right) => left.start - right.start);
}
