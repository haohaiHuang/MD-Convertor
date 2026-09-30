import { describe, expect, it, vi } from "vitest";
import { createSystemChannels } from "./system.mjs";

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

function makeShell({ failure = "", throws = null } = {}) {
  return {
    openPath: vi.fn(async () => {
      if (throws) throw throws;
      return failure;
    }),
  };
}

describe("createSystemChannels", () => {
  it("registers the open-path channel", () => {
    const ipcMain = fakeIpcMain();
    createSystemChannels({ ipcMain, shell: makeShell(), warn: () => {} });

    expect(() => ipcMain.handler("md-convertor:system:open-path")).not.toThrow();
  });

  it("opens the directory and reports it back", async () => {
    const ipcMain = fakeIpcMain();
    const shell = makeShell();
    createSystemChannels({ ipcMain, shell, warn: () => {} });

    const handler = ipcMain.handler("md-convertor:system:open-path");
    await expect(handler({}, { dirPath: "/Users/someone/Downloads/processed" })).resolves.toEqual({
      ok: true,
      path: "/Users/someone/Downloads/processed",
    });
    expect(shell.openPath).toHaveBeenCalledTimes(1);
    expect(shell.openPath).toHaveBeenCalledWith("/Users/someone/Downloads/processed");
  });

  it("opens a directory whose segment contains a tilde (iCloud Drive)", async () => {
    const ipcMain = fakeIpcMain();
    const shell = makeShell();
    createSystemChannels({ ipcMain, shell, warn: () => {} });

    const handler = ipcMain.handler("md-convertor:system:open-path");
    const result = await handler({}, { dirPath: "/Users/someone/Library/Mobile Documents/com~apple~CloudDocs/Docs" });

    expect(result.ok).toBe(true);
    expect(shell.openPath).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a home shorthand", "~/Downloads"],
    ["a relative path", "Downloads/notes"],
    ["a traversal segment", "/Users/someone/../someone_else"],
    ["a home shorthand segment", "/Users/someone/~/notes"],
    ["an empty path", ""],
    ["a non-string path", 42],
    ["a missing path", undefined],
  ])("refuses %s without asking the OS to open anything", async (_label, dirPath) => {
    const ipcMain = fakeIpcMain();
    const shell = makeShell();
    createSystemChannels({ ipcMain, shell, warn: () => {} });

    const handler = ipcMain.handler("md-convertor:system:open-path");
    const result = await handler({}, { dirPath });

    expect(result).toEqual({ ok: false, code: "INVALID_DIR_PATH" });
    expect(shell.openPath).not.toHaveBeenCalled();
  });

  it("refuses a missing payload instead of throwing", async () => {
    const ipcMain = fakeIpcMain();
    const shell = makeShell();
    createSystemChannels({ ipcMain, shell, warn: () => {} });

    const handler = ipcMain.handler("md-convertor:system:open-path");
    await expect(handler({})).resolves.toEqual({ ok: false, code: "INVALID_DIR_PATH" });
  });

  it("reports the OS failure to the renderer without leaking the message", async () => {
    const warn = vi.fn();
    const ipcMain = fakeIpcMain();
    createSystemChannels({ ipcMain, shell: makeShell({ failure: "The application is not found." }), warn });

    const handler = ipcMain.handler("md-convertor:system:open-path");
    const result = await handler({}, { dirPath: "/Users/someone/Downloads" });

    expect(result).toEqual({ ok: false, code: "OPEN_PATH_FAILED" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("not found");
  });

  it("maps a thrown failure to its code instead of rejecting", async () => {
    const ipcMain = fakeIpcMain();
    const failure = Object.assign(new Error("denied"), { code: "EPERM" });
    createSystemChannels({ ipcMain, shell: makeShell({ throws: failure }), warn: () => {} });

    const handler = ipcMain.handler("md-convertor:system:open-path");
    await expect(handler({}, { dirPath: "/Users/someone/Downloads" })).resolves.toEqual({
      ok: false,
      code: "EPERM",
    });
  });
});
