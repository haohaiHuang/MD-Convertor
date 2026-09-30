import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseDocMarker } from "@/lib/local-docs/dedup";
import { DEFAULT_SETTINGS } from "@/types/settings";
import { POST } from "./route";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nKAAAAAASUVORK5CYII=",
  "base64",
);

let root = "";
let sourceDir = "";
let outputDir = "";
let userData = "";

function processRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://127.0.0.1:3210/api/local-docs/process", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

/** Stores a settings file so the route's "no output directory given" fallback can be exercised. */
async function writeSettings(defaultPath: string | null): Promise<void> {
  await writeFile(
    path.join(userData, "settings.json"),
    JSON.stringify({ ...DEFAULT_SETTINGS, output: { defaultPath, useDefaultPath: defaultPath !== null } }),
  );
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "local-docs-process-route-"));
  sourceDir = path.join(root, "in");
  outputDir = path.join(root, "out");
  userData = path.join(root, "user-data");
  await mkdir(sourceDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });
  await mkdir(userData, { recursive: true });
  await writeFile(path.join(sourceDir, "photo.png"), onePixelPng);
  vi.stubEnv("MD_CONVERTOR_USER_DATA", userData);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

describe("POST /api/local-docs/process caller validation", () => {
  it("rejects a cross-origin request", async () => {
    const response = await POST(processRequest({}, { origin: "https://attacker.example" }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_API_ORIGIN" } });
  });
});

describe("POST /api/local-docs/process", () => {
  it("returns the processed document without writing anything", async () => {
    const sourcePath = path.join(sourceDir, "notes.md");
    await writeFile(sourcePath, "# 标题\n\n![图](photo.png)\n");
    const before = await readdir(outputDir);
    const sourceStats = await stat(sourcePath);

    const response = await POST(processRequest({ path: sourcePath, outputPath: outputDir }));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      skipped: false,
      filename: "notes.md",
      stats: { embedded: 1, kept: 0 },
      translation: { ran: false, scope: null },
      warnings: [],
    });
    expect(body.markdown).toContain("data:image/png;base64,");
    expect(parseDocMarker(body.markdown)).toMatchObject({
      source: sourcePath,
      size: sourceStats.size,
      mtimeMs: sourceStats.mtimeMs,
      outputPath: path.join(outputDir, "notes.md"),
    });
    expect(await readdir(outputDir)).toEqual(before);
  });

  it("reports an up-to-date product as skipped", async () => {
    const sourcePath = path.join(sourceDir, "again.md");
    await writeFile(sourcePath, "# 已完成\n");

    const first = await POST(processRequest({ path: sourcePath, outputPath: outputDir }));
    const product = await first.json();
    await writeFile(path.join(outputDir, "again.md"), product.markdown);

    const second = await POST(processRequest({ path: sourcePath, outputPath: outputDir }));
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ skipped: true, reason: "processed" });
  });

  it("falls back to the configured output directory", async () => {
    const sourcePath = path.join(sourceDir, "configured.md");
    await writeFile(sourcePath, "# 标题\n");
    await writeSettings(outputDir);

    const response = await POST(processRequest({ path: sourcePath }));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(parseDocMarker(body.markdown)?.outputPath).toBe(path.join(outputDir, "configured.md"));
  });

  it("asks for an output directory when neither the request nor the settings has one", async () => {
    const sourcePath = path.join(sourceDir, "nowhere.md");
    await writeFile(sourcePath, "# 标题\n");
    await writeSettings(null);

    const response = await POST(processRequest({ path: sourcePath }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "INVALID_DIR_PATH", message: expect.stringContaining("输出目录") },
    });
  });

  it("rejects a path that is not a plain .md file", async () => {
    const response = await POST(processRequest({ path: path.join(sourceDir, "note.txt"), outputPath: outputDir }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_FILE_PATH" } });
  });

  it("maps a missing source file to ENOENT", async () => {
    const response = await POST(processRequest({ path: path.join(sourceDir, "gone.md"), outputPath: outputDir }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "ENOENT", message: "源文件不存在。" } });
  });
});
