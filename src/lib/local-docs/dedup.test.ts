import { describe, expect, it } from "vitest";
import {
  buildDocMarker,
  decideLocalDoc,
  localDocFilename,
  parseDocMarker,
  stripDocMarker,
  type DocMarker,
} from "./dedup";

const MARKER: DocMarker = {
  source: "/Users/someone/Downloads/notes.md",
  size: 1234,
  mtimeMs: 1758672000000,
  sha256: "a".repeat(64),
  outputPath: "/Users/someone/Documents/out/notes.md",
  processedAt: "2026-09-24T10:00:00.000Z",
};

describe("buildDocMarker", () => {
  it("writes one HTML comment line that carries the marker payload", () => {
    const line = buildDocMarker(MARKER);

    expect(line.startsWith("<!-- md-convertor: ")).toBe(true);
    expect(line.endsWith(" -->")).toBe(true);
    expect(line).not.toContain("\n");
    expect(parseDocMarker(line)).toEqual(MARKER);
  });

  it("round-trips through a full markdown document", () => {
    const markdown = `${buildDocMarker(MARKER)}\n# 标题\n\n正文\n`;
    expect(parseDocMarker(markdown)).toEqual(MARKER);
  });
});

describe("parseDocMarker", () => {
  it("returns null when the document has no marker", () => {
    expect(parseDocMarker("# 标题\n\n正文\n")).toBeNull();
    expect(parseDocMarker("")).toBeNull();
  });

  it("returns null for corrupt JSON instead of throwing", () => {
    expect(parseDocMarker("<!-- md-convertor: {not json} -->\nbody")).toBeNull();
    expect(parseDocMarker("<!-- md-convertor: {\"source\":} -->\nbody")).toBeNull();
  });

  it("returns null for a JSON literal that is not the expected object", () => {
    expect(parseDocMarker("<!-- md-convertor: null -->\nbody")).toBeNull();
    expect(parseDocMarker('<!-- md-convertor: "notes.md" -->\nbody')).toBeNull();
    expect(parseDocMarker("<!-- md-convertor: 42 -->\nbody")).toBeNull();
  });

  it("returns null when a field is missing or has the wrong type", () => {
    const withoutSha = { ...MARKER } as Record<string, unknown>;
    delete withoutSha.sha256;
    expect(parseDocMarker(`<!-- md-convertor: ${JSON.stringify(withoutSha)} -->`)).toBeNull();

    const badSize = { ...MARKER, size: "1234" };
    expect(parseDocMarker(`<!-- md-convertor: ${JSON.stringify(badSize)} -->`)).toBeNull();

    const emptySource = { ...MARKER, source: "" };
    expect(parseDocMarker(`<!-- md-convertor: ${JSON.stringify(emptySource)} -->`)).toBeNull();
  });

  it("returns null when the payload carries an unknown field", () => {
    const extra = { ...MARKER, note: "手工加的" };
    expect(parseDocMarker(`<!-- md-convertor: ${JSON.stringify(extra)} -->`)).toBeNull();
  });

  it("only reads the marker at the top of the file", () => {
    expect(parseDocMarker(`# 标题\n${buildDocMarker(MARKER)}\n`)).toBeNull();
  });
});

describe("stripDocMarker", () => {
  it("removes the marker line and keeps the body", () => {
    const markdown = `${buildDocMarker(MARKER)}\n# 标题\n\n正文\n`;
    expect(stripDocMarker(markdown)).toBe("# 标题\n\n正文\n");
  });

  it("returns a document without a marker unchanged (does not swallow the first line)", () => {
    const markdown = "# 标题\n\n正文\n";
    expect(stripDocMarker(markdown)).toBe(markdown);
  });

  it("returns an empty string when only a marker is present", () => {
    expect(stripDocMarker(buildDocMarker(MARKER))).toBe("");
  });
});

describe("decideLocalDoc", () => {
  const file = { source: MARKER.source, size: MARKER.size, mtimeMs: MARKER.mtimeMs };

  it("is new when the output has no marker", () => {
    expect(decideLocalDoc(null, file, MARKER.outputPath)).toBe("new");
  });

  it("is skip when the marker matches the source and the output path", () => {
    expect(decideLocalDoc(MARKER, file, MARKER.outputPath)).toBe("skip");
  });

  it("is check when the source changed size or mtime", () => {
    expect(decideLocalDoc(MARKER, { ...file, size: file.size + 1 }, MARKER.outputPath)).toBe("check");
    expect(decideLocalDoc(MARKER, { ...file, mtimeMs: file.mtimeMs + 1000 }, MARKER.outputPath)).toBe("check");
  });

  it("is new when the output path changed", () => {
    expect(decideLocalDoc(MARKER, file, "/Users/someone/Documents/other/notes.md")).toBe("new");
  });

  it("is new when the marker belongs to a different source file", () => {
    expect(decideLocalDoc(MARKER, { ...file, source: "/tmp/notes.md" }, MARKER.outputPath)).toBe("new");
  });
});

describe("localDocFilename", () => {
  it("keeps a clean stem and swaps the extension for .md", () => {
    expect(localDocFilename("Notes.md")).toBe("Notes.md");
    expect(localDocFilename("Notes.MD")).toBe("Notes.md");
    expect(localDocFilename("会议记录 2026.md")).toBe("会议记录 2026.md");
  });

  it("sanitizes characters that cannot appear in a file name", () => {
    // A stamped suffix is what keeps two sources apart when cleaning maps them onto one name
    // (issue: `a?.md` and `a*.md` both cleaned to `a-.md` and the second write silently won).
    expect(localDocFilename("a/b:c?.md")).toMatch(/^a-b-c-[0-9a-f]{8}\.md$/);
  });

  it("keeps names that only collide after cleaning apart", () => {
    const names = ["a?.md", "a*.md", "a<b.md", "a|b.md"].map(localDocFilename);

    expect(new Set(names).size).toBe(4);
  });

  it("stamps a deterministic hash, so a rescan predicts the same output path", () => {
    expect(localDocFilename("a?.md")).toBe(localDocFilename("a?.md"));
    expect(localDocFilename("a?.md")).not.toBe(localDocFilename("a*.md"));
  });

  it("never stamps a name that did not need cleaning, nor collides with a stamped one", () => {
    expect(localDocFilename("a-.md")).toBe("a-.md");
    expect(localDocFilename("a?.md")).not.toBe("a-.md");
  });

  it("falls back to a stable name when cleaning leaves nothing", () => {
    expect(localDocFilename("....md")).toMatch(/^document-[0-9a-f]{8}\.md$/);
    expect(localDocFilename("????.md")).not.toBe(localDocFilename("****.md"));
  });
});
