import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOutputChannels } from "./output.mjs";

let directory;

afterEach(async () => {
  if (directory) await rm(directory, { force: true, recursive: true });
  directory = undefined;
  vi.restoreAllMocks();
});

function fakeIpcMain() {
  const handlers = new Map();
  return {
    handle(channel, handler) {
      handlers.set(channel, handler);
    },
    handler(channel) {
      if (!handlers.has(channel)) throw new Error(`no handler registered for ${channel}`);
      return handlers.get(channel);
    },
  };
}

function makeDialog({ canceled = false, filePaths = [] } = {}) {
  return { showOpenDialog: vi.fn(async () => ({ canceled, filePaths })) };
}

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "md-convertor-output-"));
});

describe("createOutputChannels", () => {
  it("registers handlers for both output channels", () => {
    const ipcMain = fakeIpcMain();
    const dialog = makeDialog();

    createOutputChannels({ ipcMain, dialog, warn: () => {} });

    expect(() => ipcMain.handler("md-convertor:output:select-directory")).not.toThrow();
    expect(() => ipcMain.handler("md-convertor:output:save-file")).not.toThrow();
  });

  it("returns the picked directory from the dialog", async () => {
    const ipcMain = fakeIpcMain();
    const dialog = makeDialog({ canceled: false, filePaths: ["/Users/someone/Documents"] });

    createOutputChannels({ ipcMain, dialog, warn: () => {} });

    const handler = ipcMain.handler("md-convertor:output:select-directory");
    await expect(handler({}, { properties: ["openDirectory"] })).resolves.toEqual({
      ok: true,
      path: "/Users/someone/Documents",
    });
  });

  it("reports CANCELLED when the dialog is dismissed", async () => {
    const ipcMain = fakeIpcMain();
    const dialog = makeDialog({ canceled: true, filePaths: [] });

    createOutputChannels({ ipcMain, dialog, warn: () => {} });

    const handler = ipcMain.handler("md-convertor:output:select-directory");
    await expect(handler({}, { properties: ["openDirectory"] })).resolves.toEqual({
      ok: false,
      code: "CANCELLED",
    });
  });

  it("shows the directory dialog with openDirectory and createDirectory", async () => {
    const ipcMain = fakeIpcMain();
    const dialog = makeDialog({ canceled: true, filePaths: [] });

    createOutputChannels({ ipcMain, dialog, warn: () => {} });

    const handler = ipcMain.handler("md-convertor:output:select-directory");
    await handler({}, {});
    expect(dialog.showOpenDialog).toHaveBeenCalledTimes(1);
    expect(dialog.showOpenDialog.mock.calls[0][0]).toMatchObject({
      properties: expect.arrayContaining(["openDirectory", "createDirectory"]),
    });
  });

  it.each([
    ["a parent traversal filename", "/Users/someone/Documents", "../x.md"],
    ["a nested filename", "/Users/someone/Documents", "a/b.md"],
    ["a windows filename", "/Users/someone/Documents", "a\\b.md"],
    ["a home reference filename", "/Users/someone/Documents", "~/.md"],
    ["an empty filename", "/Users/someone/Documents", ""],
    ["a non-string filename", "/Users/someone/Documents", 42],
    ["a missing filename", "/Users/someone/Documents", undefined],
    ["an over-long filename", "/Users/someone/Documents", "a".repeat(256)],
  ])("refuses %s without touching the disk", async (_label, dirPath, filename) => {
    const ipcMain = fakeIpcMain();
    createOutputChannels({ ipcMain, dialog: makeDialog(), warn: () => {} });

    const handler = ipcMain.handler("md-convertor:output:save-file");
    const result = await handler({}, { dirPath, filename, content: "# Hello" });

    expect(result.ok).toBe(false);
    expect(typeof result.code).toBe("string");
    expect(result.code).not.toBe("IPC_FAILED");
    expect(result).not.toHaveProperty("path");
    expect(readdir(directory)).resolves.toEqual([]);
  });

  it.each([
    ["a home dirPath", "~/Documents"],
    ["a relative dirPath", "Documents/notes"],
    ["a traversal dirPath", "/Users/someone/../someone_else"],
    ["an empty dirPath", ""],
    ["a non-string dirPath", 42],
    ["a missing dirPath", undefined],
  ])("refuses %s without touching the disk", async (_label, dirPath) => {
    const ipcMain = fakeIpcMain();
    createOutputChannels({ ipcMain, dialog: makeDialog(), warn: () => {} });

    const handler = ipcMain.handler("md-convertor:output:save-file");
    const result = await handler({}, { dirPath, filename: "notes.md", content: "# Hello" });

    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("path");
    expect(readdir(directory)).resolves.toEqual([]);
  });

  it("refuses a non-string content without touching the disk", async () => {
    const ipcMain = fakeIpcMain();
    createOutputChannels({ ipcMain, dialog: makeDialog(), warn: () => {} });

    const handler = ipcMain.handler("md-convertor:output:save-file");
    const result = await handler({}, { dirPath: directory, filename: "notes.md", content: 42 });

    expect(result.ok).toBe(false);
    expect(readdir(directory)).resolves.toEqual([]);
  });

  it("writes the file into the directory and reports its path", async () => {
    const ipcMain = fakeIpcMain();
    createOutputChannels({ ipcMain, dialog: makeDialog(), warn: () => {} });

    const handler = ipcMain.handler("md-convertor:output:save-file");
    const target = path.join(directory, "notes.md");
    const result = await handler({}, { dirPath: directory, filename: "notes.md", content: "# Hello" });

    expect(result).toEqual({ ok: true, path: target });
    await expect(readFile(target, "utf8")).resolves.toBe("# Hello");
  });

  it("creates a missing directory tree before writing (mkdir -p self-heal)", async () => {
    const ipcMain = fakeIpcMain();
    createOutputChannels({ ipcMain, dialog: makeDialog(), warn: () => {} });

    const nested = path.join(directory, "a", "b");
    const handler = ipcMain.handler("md-convertor:output:save-file");
    const result = await handler({}, { dirPath: nested, filename: "notes.md", content: "# Deep" });

    expect(result).toEqual({ ok: true, path: path.join(nested, "notes.md") });
    await expect(readFile(path.join(nested, "notes.md"), "utf8")).resolves.toBe("# Deep");
  });

  it("overwrites an existing file with the same name", async () => {
    const ipcMain = fakeIpcMain();
    createOutputChannels({ ipcMain, dialog: makeDialog(), warn: () => {} });

    const handler = ipcMain.handler("md-convertor:output:save-file");
    await handler({}, { dirPath: directory, filename: "notes.md", content: "# First" });
    const result = await handler({}, { dirPath: directory, filename: "notes.md", content: "# Second" });

    expect(result.ok).toBe(true);
    await expect(readFile(path.join(directory, "notes.md"), "utf8")).resolves.toBe("# Second");
  });

  it("maps a write failure to its error code without leaking the path", async () => {
    const warn = vi.fn();
    const ipcMain = fakeIpcMain();
    createOutputChannels({ ipcMain, dialog: makeDialog(), warn });

    const handler = ipcMain.handler("md-convertor:output:save-file");
    // A file where a directory is needed makes mkdir fail with ENOTDIR.
    const blocker = path.join(directory, "blocker");
    const { writeFile } = await import("node:fs/promises");
    await writeFile(blocker, "not a directory");
    const result = await handler({}, {
      dirPath: path.join(blocker, "sub"),
      filename: "notes.md",
      content: "# Hello",
    });

    expect(result).toEqual({ ok: false, code: "ENOTDIR" });
    expect(warn).toHaveBeenCalledTimes(1);
    const logged = warn.mock.calls[0].map(String).join(" ");
    expect(logged).toContain("ENOTDIR");
    expect(logged).not.toContain("# Hello");
  });
});
