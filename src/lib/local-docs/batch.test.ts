import { describe, expect, it } from "vitest";

import { applyRowStatus, nextPending, planBatch, summarize, type BatchRow } from "./batch";

const FILES = [
  { name: "a.md", size: 10, mtimeMs: 1, state: "new" as const },
  { name: "b.md", size: 20, mtimeMs: 2, state: "skip" as const },
  { name: "c.md", size: 30, mtimeMs: 3, state: "check" as const },
];

const BRIDGE = { inputDir: "/in", outputDir: "/out", hasBridge: true };

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

describe("planBatch", () => {
  it("checks new and changed documents and leaves processed ones unchecked", () => {
    const plan = planBatch(FILES, BRIDGE);
    expect(plan.rows.map((entry) => [entry.name, entry.checked, entry.forced])).toEqual([
      ["a.md", true, false],
      ["b.md", false, false],
      ["c.md", true, false],
    ]);
    expect(plan.refusal).toBeNull();
    expect(plan.suggestedOutputDir).toBeNull();
  });

  it("carries the scan's size, mtime and state so the list can render them", () => {
    const [first] = planBatch(FILES, BRIDGE).rows;
    expect(first).toMatchObject({ id: "a.md", name: "a.md", size: 10, mtimeMs: 1, state: "new" });
    expect(first.status).toEqual({ phase: "idle" });
  });

  it("does not mutate the scanned files it was handed", () => {
    const files = structuredClone(FILES);
    planBatch(files, BRIDGE);
    expect(files).toEqual(FILES);
  });

  it("refuses with no bridge, with no output directory, and when both directories are the same", () => {
    expect(planBatch(FILES, { ...BRIDGE, hasBridge: false }).refusal).toBe("no-bridge");
    expect(planBatch(FILES, { ...BRIDGE, outputDir: null }).refusal).toBe("no-output");
    expect(planBatch(FILES, { ...BRIDGE, outputDir: "/in" }).refusal).toBe("same-dir");
  });

  it("gives the one-click fix for the same-directory refusal", () => {
    const plan = planBatch(FILES, { ...BRIDGE, inputDir: "/in/", outputDir: "/in/" });
    expect(plan.refusal).toBe("same-dir");
    expect(plan.suggestedOutputDir).toBe("/in/processed");
  });

  it("keeps the list visible while refusing, so the cause is not hidden behind an empty panel", () => {
    expect(planBatch(FILES, { ...BRIDGE, outputDir: "/in" }).rows).toHaveLength(3);
  });

  it("prefers no-bridge over the other refusals", () => {
    expect(planBatch(FILES, { inputDir: "/in", outputDir: "/in", hasBridge: false }).refusal).toBe("no-bridge");
  });

  it("needs an input directory before it can call anything 'the same'", () => {
    expect(planBatch(FILES, { inputDir: null, outputDir: "/in", hasBridge: true }).refusal).toBeNull();
  });
});

describe("applyRowStatus", () => {
  it("patches one row without touching the others or the input array", () => {
    const rows = [row({ id: "a" }), row({ id: "b" })];
    const next = applyRowStatus(rows, "b", { status: { phase: "done", embedded: 2, kept: 1 } });

    expect(next).not.toBe(rows);
    expect(next[0]).toBe(rows[0]);
    expect(next[1].status).toEqual({ phase: "done", embedded: 2, kept: 1 });
    expect(rows[1].status).toEqual({ phase: "idle" });
  });

  it("patches the checkbox and the force flag", () => {
    const rows = [row({ id: "a", checked: false })];
    const next = applyRowStatus(rows, "a", { checked: true, forced: true });
    expect(next[0]).toMatchObject({ checked: true, forced: true });
  });

  it("ignores an unknown id instead of throwing mid-run", () => {
    const rows = [row({ id: "a" })];
    expect(applyRowStatus(rows, "missing", { checked: false })[0]).toBe(rows[0]);
  });
});

describe("nextPending", () => {
  it("returns the first checked row that has not started", () => {
    const rows = [row({ id: "a", checked: false }), row({ id: "b" }), row({ id: "c" })];
    expect(nextPending(rows)?.id).toBe("b");
  });

  it("skips rows that are running or already finished", () => {
    const rows = [
      row({ id: "a", status: { phase: "running" } }),
      row({ id: "b", status: { phase: "skipped" } }),
      row({ id: "c", status: { phase: "failed", message: "boom" } }),
      row({ id: "d" }),
    ];
    expect(nextPending(rows)?.id).toBe("d");
  });

  it("leaves a processed row alone unless the user checked it", () => {
    expect(nextPending([row({ id: "a", state: "skip", checked: false })])).toBeNull();
    expect(nextPending([row({ id: "a", state: "skip", checked: true, forced: true })])?.id).toBe("a");
  });

  it("returns null once nothing is left", () => {
    expect(nextPending([row({ id: "a", status: { phase: "done", embedded: 0, kept: 0 } })])).toBeNull();
  });
});

describe("summarize", () => {
  it("counts the finished rows and adds up their image stats", () => {
    const rows = [
      row({ id: "a", status: { phase: "done", embedded: 3, kept: 1 } }),
      row({ id: "b", status: { phase: "done", embedded: 0, kept: 2 } }),
      row({ id: "c", status: { phase: "skipped" } }),
      row({ id: "d", status: { phase: "failed", message: "boom" } }),
      row({ id: "e" }),
    ];
    expect(summarize(rows)).toEqual({ done: 2, skipped: 1, failed: 1, embeddedImages: 3, keptImages: 3 });
  });

  it("counts nothing before the run starts", () => {
    expect(summarize([row(), row()])).toEqual({ done: 0, skipped: 0, failed: 0, embeddedImages: 0, keptImages: 0 });
  });
});
