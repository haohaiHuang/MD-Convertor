export type ImageOutcome =
  | { placeholder: string; path: string }
  | { placeholder: string; url: string };

const PLACEHOLDER_WORD_CHAR = "[\\p{L}\\p{N}]";

// Only what can terminate a bare link destination is escaped: whitespace, parentheses, DEL (which
// CommonMark forbids in a bare destination), and the three characters that would be read as a
// fragment/query/escape sequence. Everything else stays verbatim — percent-encoding CJK would turn
// a readable file name into noise, and the desktop reader runs `decodeURIComponent` on whatever it
// finds here (`src/lib/local-docs/inline-images.ts`), so every escape must be real UTF-8 bytes.
const DESTINATION_UNSAFE = /[\s\x7f()%#?<>"\\]/gu;

export function escapeDestination(value: string): string {
  return value.replace(DESTINATION_UNSAFE, (char) =>
    // `encodeURIComponent` leaves `(` and `)` alone, and those two are the whole reason this
    // function exists, so they are spelled out.
    char === "(" ? "%28" : char === ")" ? "%29" : encodeURIComponent(char),
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// `md-convertor-image-1` must not be found inside `md-convertor-image-10`, so every placeholder is
// matched with a "not followed by a word character" lookahead rather than a plain substring search.
function placeholderPattern(placeholder: string): RegExp {
  return new RegExp(`${escapeRegExp(placeholder)}(?!${PLACEHOLDER_WORD_CHAR})`, "gu");
}

// Turns the placeholders the content script wrote into real paths. An image that could not be
// downloaded keeps its original URL, and the line explaining why goes on its own line right below
// (an inline comment would end up inside the paragraph text).
export function rewriteImageReferences(markdown: string, plans: ImageOutcome[]): string {
  if (plans.length === 0) return markdown;

  const replacements = plans.map((plan) => ({
    pattern: placeholderPattern(plan.placeholder),
    value: "path" in plan ? escapeDestination(plan.path) : plan.url,
    failure: "path" in plan ? null : `<!-- 图片未下载：${plan.url} -->`,
  }));

  return markdown
    .split("\n")
    .flatMap((line) => {
      let replaced = line;
      const comments: string[] = [];
      for (const { pattern, value, failure } of replacements) {
        const next = replaced.replace(pattern, value);
        if (next === replaced) continue;
        replaced = next;
        if (failure) comments.push(failure);
      }
      return comments.length === 0 ? [replaced] : [replaced, ...comments];
    })
    .join("\n");
}
