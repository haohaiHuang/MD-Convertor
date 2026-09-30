import { describe, expect, it, vi } from "vitest";

import type { BatchRow } from "@/lib/local-docs/batch";
import type { ProcessLocalDocResult } from "@/lib/local-docs/process";

import { runBatch, type BatchRunContext, type ProcessRequest } from "./client";

function row(overrides: Partial<BatchRow> = {}): BatchRow {
  return {
    id: "a.md",
    name: "a.md",
    size: 10,
    mtimeMs: 1,
    state: "new",
    checked: true,
    forced: false,
    status: { phase: "idle" },
    ...overrides,
  };
}

function product(filename: string, embedded = 1, kept = 0): ProcessLocalDocResult {
  return {
    skipped: false,
    markdown: `# ${filename}`,
    filename,
    sha256: "deadbeef",
    warnings: [],
    stats: { embedded, kept },
    translation: { ran: false, scope: null },
  };
}

function context(overrides: Partial<BatchRunContext> = {}): BatchRunContext {
  return {
    inputDir: "/in",
    outputDir: "/out",
    translate: false,
    targetLanguage: "zh",
    processDoc: vi.fn(async (request: ProcessRequest) => product(request.path.split("/").pop() ?? "x.md")),
    saveFile: vi.fn(async () => ({ ok: true, path: "/out/x.md" })),
    ...overrides,
  };
}

describe("runBatch", () => {
  it("processes the checked rows one at a time, in list order", async () => {
    const log: string[] = [];
    const ctx = context({
      processDoc: vi.fn(async (request: ProcessRequest) => {
        log.push(`process:${request.path}`);
        return product(request.path.split("/").pop() ?? "x.md");
      }),
      saveFile: vi.fn(async (_dirPath, filename) => {
        log.push(`save:${filename}`);
        return { ok: true };
      }),
    });

    const rows = await runBatch([row({ id: "a.md" }), row({ id: "b.md", name: "b.md" })], ctx);

    expect(log).toEqual(["process:/in/a.md", "save:a.md", "process:/in/b.md", "save:b.md"]);
    expect(rows.map((entry) => entry.status)).toEqual([
      { phase: "done", embedded: 1, kept: 0 },
      { phase: "done", embedded: 1, kept: 0 },
    ]);
  });

  it("sends the output directory, the force flag and the translation choice of each row", async () => {
    const processDoc = vi.fn(async () => product("a.md"));
    await runBatch(
      [row({ id: "a.md", forced: true }), row({ id: "b.md", name: "b.md", checked: false })],
      context({ processDoc, translate: true, targetLanguage: "en" }),
    );

    expect(processDoc).toHaveBeenCalledTimes(1);
    expect(processDoc).toHaveBeenCalledWith({
      path: "/in/a.md",
      outputPath: "/out",
      force: true,
      translate: true,
      targetLanguage: "en",
    });
  });

  it("leaves unchecked rows untouched", async () => {
    const processDoc = vi.fn(async () => product("a.md"));
    const rows = await runBatch([row({ id: "a.md", checked: false })], context({ processDoc }));
    expect(processDoc).not.toHaveBeenCalled();
    expect(rows[0].status).toEqual({ phase: "idle" });
  });

  it("leaves an unchecked processed row alone instead of asking the server", async () => {
    const processDoc = vi.fn(async () => product("a.md"));
    const saveFile = vi.fn(async () => ({ ok: true }));
    const rows = await runBatch(
      [row({ id: "a.md", state: "skip", checked: false, forced: false })],
      context({ processDoc, saveFile }),
    );

    expect(processDoc).not.toHaveBeenCalled();
    expect(saveFile).not.toHaveBeenCalled();
    expect(rows[0].status).toEqual({ phase: "idle" });
  });

  it("sends a forced processed row to the server like any other", async () => {
    const processDoc = vi.fn(async () => product("a.md"));
    await runBatch([row({ id: "a.md", state: "skip", forced: true })], context({ processDoc }));
    expect(processDoc).toHaveBeenCalledTimes(1);
  });

  it("treats the server's own skip as a skipped row and writes nothing", async () => {
    const saveFile = vi.fn(async () => ({ ok: true }));
    const rows = await runBatch(
      [row({ id: "a.md", state: "check", forced: true })],
      context({ processDoc: vi.fn(async () => ({ skipped: true, reason: "processed" }) as ProcessLocalDocResult), saveFile }),
    );

    expect(saveFile).not.toHaveBeenCalled();
    expect(rows[0].status).toEqual({ phase: "skipped" });
  });

  it("fails one row and keeps going with the rest", async () => {
    const processDoc = vi.fn(async (request: ProcessRequest) => {
      if (request.path.endsWith("a.md")) throw new Error("源文件不存在。");
      return product("b.md", 2, 3);
    });
    const rows = await runBatch(
      [row({ id: "a.md" }), row({ id: "b.md", name: "b.md" })],
      context({ processDoc }),
    );

    expect(processDoc).toHaveBeenCalledTimes(2);
    expect(rows[0].status).toEqual({ phase: "failed", message: "源文件不存在。" });
    expect(rows[1].status).toEqual({ phase: "done", embedded: 2, kept: 3 });
  });

  it("turns a refused write into that row's failure and continues", async () => {
    const rows = await runBatch(
      [row({ id: "a.md" }), row({ id: "b.md", name: "b.md" })],
      context({
        saveFile: vi.fn(async (_dirPath, filename) =>
          filename === "a.md" ? { ok: false, code: "EACCES" } : { ok: true }),
      }),
    );

    expect(rows[0].status).toEqual({ phase: "failed", message: "没有写入权限。" });
    expect(rows[1].status).toEqual({ phase: "done", embedded: 1, kept: 0 });
  });

  it("catches a bridge that throws instead of resolving (preload validators throw)", async () => {
    const rows = await runBatch(
      [row({ id: "a.md" }), row({ id: "b.md", name: "b.md" })],
      context({
        saveFile: vi.fn(async (_dirPath, filename) => {
          if (filename === "a.md") throw new TypeError("dirPath must be an absolute path.");
          return { ok: true };
        }),
      }),
    );

    expect(rows[0].status).toEqual({ phase: "failed", message: "dirPath must be an absolute path." });
    expect(rows[1].status).toEqual({ phase: "done", embedded: 1, kept: 0 });
  });

  it("reports an unknown failure without an empty message", async () => {
    const rows = await runBatch([row()], context({ processDoc: vi.fn(async () => Promise.reject("nope")) }));
    expect(rows[0].status).toEqual({ phase: "failed", message: "处理失败。" });
  });

  it("publishes the list after every transition so the panel can render progress", async () => {
    const seen: string[][] = [];
    await runBatch(
      [row({ id: "a.md" })],
      context({ onRows: (rows) => seen.push(rows.map((entry) => entry.status.phase)) }),
    );

    expect(seen).toEqual([["idle"], ["running"], ["done"]]);
  });
});
