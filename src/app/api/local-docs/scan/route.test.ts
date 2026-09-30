import { chmod, mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDocMarker } from "@/lib/local-docs/dedup";
import { defaultDownloadsDir } from "@/lib/local-docs/scan";
import { POST } from "./route";

let root = "";

function scanRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://127.0.0.1:3210/api/local-docs/scan", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function writeSource(dir: string, name: string, content = `# ${name}\n`): Promise<{ size: number; mtimeMs: number }> {
  const filePath = path.join(dir, name);
  await writeFile(filePath, content);
  const stats = await stat(filePath);
  return { size: stats.size, mtimeMs: stats.mtimeMs };
}

/** Writes a product whose marker describes `source`, so the scan can classify it. */
async function writeProduct(
  outputDir: string,
  productName: string,
  source: { sourcePath: string; size: number; mtimeMs: number; outputPath: string },
): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  const marker = buildDocMarker({
    source: source.sourcePath,
    size: source.size,
    mtimeMs: source.mtimeMs,
    sha256: "b".repeat(64),
    outputPath: source.outputPath,
    processedAt: "2026-09-24T10:00:00.000Z",
  });
  await writeFile(path.join(outputDir, productName), `${marker}\n# 产物\n`);
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "local-docs-scan-"));
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await chmod(root, 0o755).catch(() => undefined);
  await rm(root, { recursive: true, force: true });
});

describe("defaultDownloadsDir", () => {
  it("uses the directory the desktop app reports", () => {
    expect(defaultDownloadsDir({ MD_CONVERTOR_DOWNLOADS_DIR: "/Users/someone/Downloads" })).toBe(
      "/Users/someone/Downloads",
    );
  });

  it("falls back to ~/Downloads when the desktop app cannot report one", () => {
    const expected = path.join(homedir(), "Downloads");
    expect(defaultDownloadsDir({})).toBe(expected);
    expect(defaultDownloadsDir({ MD_CONVERTOR_DOWNLOADS_DIR: "   " })).toBe(expected);
  });
});

describe("POST /api/local-docs/scan caller validation", () => {
  it("rejects a cross-origin request", async () => {
    const response = await POST(scanRequest({}, { origin: "https://attacker.example" }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_API_ORIGIN" } });
  });

  it("requires the application token when one is configured", async () => {
    vi.stubEnv("MD_CONVERTOR_SESSION_TOKEN", "route-session-token");
    const response = await POST(scanRequest({ dirPath: root }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_SESSION_TOKEN" } });
  });
});

describe("POST /api/local-docs/scan", () => {
  it("lists only the .md files of one level, sorted by name, and writes nothing", async () => {
    await writeSource(root, "b.md");
    await writeSource(root, "a.md", "# a\n\n正文\n");
    await writeFile(path.join(root, "notes.txt"), "not markdown");
    await mkdir(path.join(root, "sub.md"), { recursive: true });
    await writeFile(path.join(root, "sub.md", "nested.md"), "# nested\n");
    const beforeListing = await readdir(root);

    const response = await POST(scanRequest({ dirPath: root }));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.dirPath).toBe(root);
    expect(body.truncated).toBe(false);
    expect(body.files.map((file: { name: string }) => file.name)).toEqual(["a.md", "b.md"]);
    expect(body.files[0]).toMatchObject({ name: "a.md", state: "new" });
    expect(typeof body.files[0].size).toBe("number");
    expect(typeof body.files[0].mtimeMs).toBe("number");
    expect(await readdir(root)).toEqual(beforeListing);
  });

  it("reports every file as new when no output directory is given", async () => {
    await writeSource(root, "notes.md");

    const response = await POST(scanRequest({ dirPath: root }));
    const body = await response.json();

    expect(body.files).toEqual([expect.objectContaining({ name: "notes.md", state: "new" })]);
  });

  it("falls back to the downloads directory when dirPath is omitted", async () => {
    await writeSource(root, "from-downloads.md");
    vi.stubEnv("MD_CONVERTOR_DOWNLOADS_DIR", root);

    const response = await POST(scanRequest({}));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.dirPath).toBe(root);
    expect(body.downloadsDir).toBe(root);
    expect(body.files.map((file: { name: string }) => file.name)).toEqual(["from-downloads.md"]);
  });

  it("marks an unchanged product as skip", async () => {
    const outputDir = path.join(root, "out");
    const sourcePath = path.join(root, "notes.md");
    const source = await writeSource(root, "notes.md");
    await writeProduct(outputDir, "notes.md", {
      sourcePath,
      size: source.size,
      mtimeMs: source.mtimeMs,
      outputPath: path.join(outputDir, "notes.md"),
    });

    const response = await POST(scanRequest({ dirPath: root, outputDir }));
    const body = await response.json();

    expect(body.files).toEqual([expect.objectContaining({ name: "notes.md", state: "skip" })]);
  });

  it("marks a product whose source size or mtime moved as check", async () => {
    const outputDir = path.join(root, "out");
    const sourcePath = path.join(root, "notes.md");
    const source = await writeSource(root, "notes.md", "# notes\n\n原始\n");
    await writeProduct(outputDir, "notes.md", {
      sourcePath,
      size: source.size,
      mtimeMs: source.mtimeMs - 5000,
      outputPath: path.join(outputDir, "notes.md"),
    });

    const response = await POST(scanRequest({ dirPath: root, outputDir }));
    const body = await response.json();

    expect(body.files).toEqual([expect.objectContaining({ name: "notes.md", state: "check" })]);
  });

  it("marks a product left by a different source as new", async () => {
    const outputDir = path.join(root, "out");
    const source = await writeSource(root, "notes.md");
    await writeProduct(outputDir, "notes.md", {
      sourcePath: "/tmp/elsewhere/notes.md",
      size: source.size,
      mtimeMs: source.mtimeMs,
      outputPath: path.join(outputDir, "notes.md"),
    });

    const response = await POST(scanRequest({ dirPath: root, outputDir }));
    const body = await response.json();

    expect(body.files).toEqual([expect.objectContaining({ name: "notes.md", state: "new" })]);
  });

  it("caps the listing at 500 files and reports truncated", async () => {
    await Promise.all(
      Array.from({ length: 501 }, (_, index) =>
        writeFile(path.join(root, `file-${String(index).padStart(3, "0")}.md`), "# x\n")),
    );

    const response = await POST(scanRequest({ dirPath: root }));
    const body = await response.json();

    expect(body.truncated).toBe(true);
    expect(body.files).toHaveLength(500);
    expect(body.files[0].name).toBe("file-000.md");
    expect(body.files.at(-1).name).toBe("file-499.md");
  });

  it("maps a missing directory to ENOENT", async () => {
    const response = await POST(scanRequest({ dirPath: path.join(root, "gone") }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "ENOENT", message: "目录不存在。" } });
  });

  it("maps a file where a directory was expected to ENOTDIR", async () => {
    const filePath = path.join(root, "notes.md");
    await writeFile(filePath, "# notes\n");

    const response = await POST(scanRequest({ dirPath: filePath }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "ENOTDIR", message: "扫描目录不合法。" } });
  });

  it("maps an unreadable directory to EACCES", async () => {
    const locked = path.join(root, "locked");
    try {
      await mkdir(locked);
      await writeFile(path.join(locked, "notes.md"), "# notes\n");
      await chmod(locked, 0o000);

      const response = await POST(scanRequest({ dirPath: locked }));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: { code: "EACCES", message: "没有读取权限。" } });
    } finally {
      await chmod(locked, 0o755).catch(() => undefined);
    }
  });

  it("rejects a relative directory path and a traversal segment", async () => {
    const relative = await POST(scanRequest({ dirPath: "Downloads" }));
    expect(relative.status).toBe(400);
    expect(await relative.json()).toMatchObject({ error: { code: "INVALID_DIR_PATH" } });

    const traversal = await POST(scanRequest({ dirPath: `${root}/../elsewhere` }));
    expect(traversal.status).toBe(400);
    expect(await traversal.json()).toMatchObject({ error: { code: "INVALID_DIR_PATH" } });
  });
});
