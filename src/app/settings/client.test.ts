import { describe, expect, it } from "vitest";

import { outputCodeMessage } from "./client";

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
