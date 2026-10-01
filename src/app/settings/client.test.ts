import { describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS } from "@/types/settings";

import { backLabel, inputDirLabel, outputCodeMessage, putSettings } from "./client";

/**
 * `electron/output.mjs` maps a failed write to the raw `error.code` from Node's fs
 * layer, so the renderer receives real filesystem codes (EACCES/ENOENT/…), not the
 * generic `OUTPUT_SAVE_FAILED`. Those are exactly the cases where the user needs a
 * readable reason: the download already had to degrade to the browser path.
 */
describe("outputCodeMessage", () => {
  const filesystemCodes: [string, string][] = [
    ["EACCES", "没有写入权限"],
    ["ENOENT", "目录不存在"],
    ["ENOSPC", "磁盘空间不足"],
    ["EROFS", "只读"],
  ];

  it.each(filesystemCodes)("explains the filesystem code %s", (code, expected) => {
    expect(outputCodeMessage(code, "文件写入失败。")).toContain(expected);
  });

  it("falls back for an unknown code", () => {
    expect(outputCodeMessage("EWEIRD", "文件写入失败。")).toBe("文件写入失败。");
  });

  it("falls back when the bridge reported no code at all", () => {
    expect(outputCodeMessage(undefined, "文件写入失败。")).toBe("文件写入失败。");
  });
});

/**
 * `/api/settings` validates the root keys strictly, so the response-only `defaults` field has
 * to come off again before the round-tripped payload goes back (L6).
 */
describe("putSettings", () => {
  it("strips the response-only defaults field before sending", async () => {
    const bodies: string[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      bodies.push(String(init.body));
      return new Response(JSON.stringify(DEFAULT_SETTINGS), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    try {
      await putSettings({ ...DEFAULT_SETTINGS, defaults: { inputDir: "/Users/someone/Downloads" } });
    } finally {
      vi.unstubAllGlobals();
    }

    expect(bodies).toHaveLength(1);
    expect(JSON.parse(bodies[0])).toEqual(DEFAULT_SETTINGS);
  });
});

/**
 * L6: the settings card and the scan panel must show the same thing for an unset input
 * directory, so both render through this helper instead of repeating the fallback chain.
 */
describe("inputDirLabel", () => {
  it("prefers the directory the user chose", () => {
    const settings = { ...DEFAULT_SETTINGS, input: { defaultPath: "/Users/someone/Documents" } };
    expect(inputDirLabel({ ...settings, defaults: { inputDir: "/Users/someone/Downloads" } })).toBe(
      "/Users/someone/Documents",
    );
  });

  it("shows the directory the server would scan when nothing is chosen", () => {
    expect(inputDirLabel({ ...DEFAULT_SETTINGS, defaults: { inputDir: "/Users/someone/Downloads" } })).toBe(
      "/Users/someone/Downloads",
    );
  });

  it("falls back to the wording when the payload carries no resolved default", () => {
    expect(inputDirLabel(DEFAULT_SETTINGS)).toBe("系统下载目录");
    expect(inputDirLabel(null)).toBe("系统下载目录");
  });
});

/**
 * feat-043 S1 (T1.5): the settings back capsule names the screen it returns to. The visible
 * text is the accessible name (no aria-label), so the e2e specs locate the button by exactly
 * these strings, including the 「← 」 prefix.
 */
describe("backLabel", () => {
  it("names the home screen", () => {
    expect(backLabel("home")).toBe("← 返回首页");
  });

  it("names the local-documents screen", () => {
    expect(backLabel("local-docs")).toBe("← 返回文档处理");
  });

  it("names the converter screen", () => {
    expect(backLabel("convert")).toBe("← 返回转换");
  });

  it("falls back to the plain label for a missing or unknown origin", () => {
    expect(backLabel(null)).toBe("← 返回");
    expect(backLabel(undefined)).toBe("← 返回");
    expect(backLabel("somewhere-else")).toBe("← 返回");
  });
});
