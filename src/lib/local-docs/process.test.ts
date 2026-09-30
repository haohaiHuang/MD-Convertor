import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, stat, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { buildDocMarker, parseDocMarker, stripDocMarker } from "./dedup";
import { processLocalDoc, type ProcessDeps } from "./process";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nKAAAAAASUVORK5CYII=",
  "base64",
);

let root: string;
let sourceDir: string;
let outputDir: string;

beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "md-convertor-process-"));
  sourceDir = path.join(root, "in");
  outputDir = path.join(root, "out");
  await mkdir(sourceDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(sourceDir, "photo.png"), onePixelPng);
});

const signal = new AbortController().signal;

function writeSource(name: string, markdown: string): Promise<string> {
  const sourcePath = path.join(sourceDir, name);
  return writeFile(sourcePath, markdown).then(() => sourcePath);
}

function writeProduct(markdown: string, name = "a.md"): Promise<string> {
  const productPath = path.join(outputDir, name);
  return writeFile(productPath, markdown).then(() => productPath);
}

function count() {
  const calls = { inline: 0, analyze: 0, translate: 0 };
  return calls;
}

/** Fakes keep the pipeline hermetic: no network, no model, no disk write from the library. */
function deps(markdown: string, calls = count()) {
  const seen = { analyzeInput: "", translateInput: "" };
  const fake: ProcessDeps = {
    inlineImages: vi.fn(async () => {
      calls.inline += 1;
      return { markdown, warnings: [], stats: { embedded: 0, kept: 0 } };
    }),
    analyze: vi.fn(async ({ markdown: input }) => {
      calls.analyze += 1;
      seen.analyzeInput = input;
      return {
        analysis: { targetLanguage: "zh-Hans", totalChars: 100, targetChars: 80, ratio: 0.8, blocks: [] },
        warnings: [],
        meta: { targetLanguage: "zh-Hans", model: null, durationMs: 1 },
      };
    }),
    translate: vi.fn(async ({ markdown: input, scope }) => {
      calls.translate += 1;
      seen.translateInput = input;
      return {
        markdown: "# 译文\n\n正文",
        warnings: [],
        meta: { targetLanguage: "zh-Hans", model: null, durationMs: 1, scope, batches: 1, translatedBlocks: 1 },
      };
    }),
  };
  return { fake, calls, seen };
}

describe("processLocalDoc — fresh document", () => {
  it("runs the whole pipeline and returns a marked product without writing it", async () => {
    const sourcePath = await writeSource("fresh.md", "# 标题\n\n![图](photo.png)\n");
    const before = await readdir(outputDir);

    const result = await processLocalDoc({ sourcePath, outputDir, signal });

    expect(result.skipped).toBe(false);
    if (result.skipped) return;
    expect(result.filename).toBe("fresh.md");
    expect(result.stats).toEqual({ embedded: 1, kept: 0 });
    expect(result.translation).toEqual({ ran: false, scope: null });
    expect(result.markdown).toContain("data:image/png;base64,");

    const source = await readFile(sourcePath);
    const sourceStats = await stat(sourcePath);
    const sha256 = createHash("sha256").update(source).digest("hex");
    expect(parseDocMarker(result.markdown)).toEqual({
      source: sourcePath,
      size: sourceStats.size,
      mtimeMs: sourceStats.mtimeMs,
      sha256,
      outputPath: path.join(outputDir, "fresh.md"),
      processedAt: expect.any(String),
    });
    expect(result.sha256).toBe(sha256);
    // Read-only: the library never writes the product itself (S3 does, through the bridge).
    expect(await readdir(outputDir)).toEqual(before);
  });
});

describe("processLocalDoc — dedup", () => {
  it("skips an up-to-date product without touching images or the model", async () => {
    const sourcePath = await writeSource("done.md", "# 已完成\n");
    const first = await processLocalDoc({ sourcePath, outputDir, signal });
    expect(first.skipped).toBe(false);
    if (first.skipped) return;
    await writeProduct(first.markdown, "done.md");

    const { fake, calls } = deps("# 不该被用到\n");
    const second = await processLocalDoc({ sourcePath, outputDir, signal }, fake);

    expect(second).toEqual({ skipped: true, reason: "processed" });
    expect(calls).toEqual({ inline: 0, analyze: 0, translate: 0 });
  });

  it("falls back to the hash when only the mtime moved", async () => {
    const sourcePath = await writeSource("touched.md", "# 内容未变\n");
    const first = await processLocalDoc({ sourcePath, outputDir, signal });
    if (first.skipped) throw new Error("expected a fresh product");
    await writeProduct(first.markdown, "touched.md");

    const moved = new Date(Date.now() + 60_000);
    await utimes(sourcePath, moved, moved);

    const { fake, calls } = deps("# 不该被用到\n");
    const second = await processLocalDoc({ sourcePath, outputDir, signal }, fake);

    expect(second).toEqual({ skipped: true, reason: "processed" });
    expect(calls.inline).toBe(0);
  });

  it("reprocesses when the content changed even though the size did not", async () => {
    const sourcePath = await writeSource("samesize.md", "# 版本一\n");
    const first = await processLocalDoc({ sourcePath, outputDir, signal });
    if (first.skipped) throw new Error("expected a fresh product");
    await writeProduct(first.markdown, "samesize.md");

    // Same byte length, so only the hash can tell the two revisions apart.
    await writeFile(sourcePath, "# 版本二\n");
    const moved = new Date(Date.now() + 120_000);
    await utimes(sourcePath, moved, moved);

    const second = await processLocalDoc({ sourcePath, outputDir, signal });
    expect(second.skipped).toBe(false);
    if (second.skipped) return;
    expect(second.markdown).toContain("# 版本二");
  });

  it("reprocesses when the content changed and when force is set", async () => {
    const sourcePath = await writeSource("changed.md", "# 第一版\n");
    const first = await processLocalDoc({ sourcePath, outputDir, signal });
    if (first.skipped) throw new Error("expected a fresh product");
    await writeProduct(first.markdown, "changed.md");

    await writeFile(sourcePath, "# 第二版\n");
    const changed = await processLocalDoc({ sourcePath, outputDir, signal });
    expect(changed.skipped).toBe(false);

    const forced = await processLocalDoc({ sourcePath, outputDir, signal, force: true });
    expect(forced.skipped).toBe(false);
  });
});

describe("processLocalDoc — translation", () => {
  const staleMarker = buildDocMarker({
    source: "/tmp/earlier.md",
    size: 1,
    mtimeMs: 1,
    sha256: "0".repeat(64),
    outputPath: "/tmp/earlier-out.md",
    processedAt: "2026-01-01T00:00:00.000Z",
  });
  const inlined = `${staleMarker}\n\n# 标题\n\n正文\n`;

  it("hands the model the document without its marker line", async () => {
    const sourcePath = await writeSource("translate.md", "# 标题\n");
    const { fake, calls, seen } = deps(inlined);

    const result = await processLocalDoc(
      { sourcePath, outputDir, signal, translate: true, targetLanguage: "zh-Hans" },
      fake,
    );

    expect(calls.translate).toBe(1);
    expect(seen.analyzeInput).toBe(stripDocMarker(inlined));
    expect(seen.translateInput).toBe(stripDocMarker(inlined));
    expect(result.skipped).toBe(false);
    if (result.skipped) return;
    expect(result.translation).toEqual({ ran: true, scope: "non-target" });
    expect(parseDocMarker(result.markdown)).not.toBeNull();
    expect(result.markdown.endsWith("# 译文\n\n正文")).toBe(true);
  });

  it("does not call the model when translation is switched off", async () => {
    const sourcePath = await writeSource("no-translate.md", "# 标题\n");
    const { fake, calls } = deps(inlined);

    const result = await processLocalDoc({ sourcePath, outputDir, signal, translate: false }, fake);

    expect(calls).toEqual({ inline: 1, analyze: 0, translate: 0 });
    expect(result.skipped).toBe(false);
    if (result.skipped) return;
    expect(result.translation).toEqual({ ran: false, scope: null });
  });

  it("does not translate a document that is already in the target language", async () => {
    const sourcePath = await writeSource("already.md", "# 已经是中文\n");
    const { fake, calls } = deps(inlined);
    fake.analyze = vi.fn(async ({ markdown: input }) => {
      calls.analyze += 1;
      void input;
      return {
        analysis: { targetLanguage: "zh-Hans", totalChars: 100, targetChars: 99, ratio: 0.99, blocks: [] },
        warnings: [],
        meta: { targetLanguage: "zh-Hans", model: null, durationMs: 1 },
      };
    });

    const result = await processLocalDoc(
      { sourcePath, outputDir, signal, translate: true, targetLanguage: "zh-Hans" },
      fake,
    );

    expect(calls).toEqual({ inline: 1, analyze: 1, translate: 0 });
    expect(result.skipped).toBe(false);
    if (result.skipped) return;
    expect(result.translation).toEqual({ ran: false, scope: null });
  });

  it("translates everything only when the analysis says so", async () => {
    const sourcePath = await writeSource("all.md", "# 标题\n");
    const { fake, seen } = deps(inlined);
    fake.analyze = vi.fn(async ({ markdown: input }) => {
      seen.analyzeInput = input;
      return {
        analysis: { targetLanguage: "zh-Hans", totalChars: 100, targetChars: 10, ratio: 0.1, blocks: [] },
        warnings: [],
        meta: { targetLanguage: "zh-Hans", model: null, durationMs: 1 },
      };
    });

    const result = await processLocalDoc(
      { sourcePath, outputDir, signal, translate: true, targetLanguage: "zh-Hans" },
      fake,
    );

    expect(result.skipped).toBe(false);
    if (result.skipped) return;
    expect(result.translation).toEqual({ ran: true, scope: "all" });
  });
  it("refuses to translate without a target language", async () => {
    const sourcePath = await writeSource("no-lang.md", "# 标题\n");
    const { fake, calls } = deps(inlined);

    await expect(processLocalDoc({ sourcePath, outputDir, signal, translate: true }, fake))
      .rejects.toMatchObject({ code: "INVALID_TARGET_LANGUAGE", status: 400 });
    expect(calls).toEqual({ inline: 1, analyze: 0, translate: 0 });
  });
});

describe("processLocalDoc — guards", () => {
  it("refuses a path that is not a plain .md file in a safe directory", async () => {
    for (const sourcePath of ["../../etc/hosts.md", `${sourceDir}/../escape.md`, path.join(sourceDir, "note.txt"), "relative.md"]) {
      await expect(processLocalDoc({ sourcePath, outputDir, signal }))
        .rejects.toMatchObject({ code: "INVALID_FILE_PATH", status: 400 });
    }
  });

  it("refuses an unsafe output directory", async () => {
    const sourcePath = await writeSource("guard.md", "# x\n");
    await expect(processLocalDoc({ sourcePath, outputDir: `${outputDir}/../out2`, signal }))
      .rejects.toMatchObject({ code: "INVALID_DIR_PATH", status: 400 });
  });

  it("reports a missing source file with the fs code", async () => {
    await expect(processLocalDoc({ sourcePath: path.join(sourceDir, "gone.md"), outputDir, signal }))
      .rejects.toMatchObject({ code: "ENOENT", status: 400 });
  });
});

describe("processLocalDoc — B1: ext-image paths with spaces and parentheses", () => {
  it("embeds a local image whose folder keeps the page title (spaces + parentheses)", async () => {
    const imageDir = path.join(sourceDir, "X 上的 姚金刚 (@yaojingang).images");
    await mkdir(imageDir, { recursive: true });
    await writeFile(path.join(imageDir, "001-a.png"), onePixelPng);
    const sourcePath = await writeSource(
      "spaced.md",
      "# 标题\n\n[![](X 上的 姚金刚 (@yaojingang).images/001-a.png)](https://x.com/a)\n",
    );

    const result = await processLocalDoc({ sourcePath, outputDir, signal });

    expect(result.skipped).toBe(false);
    if (result.skipped) return;
    expect(result.stats).toEqual({ embedded: 1, kept: 0 });
    expect(result.markdown).toContain("data:image/png;base64,");
  });
});
