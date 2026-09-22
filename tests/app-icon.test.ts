import { readFileSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { isPackaged } from "./packaged-app-scope";

const masterPath = path.join(process.cwd(), "assets/icon-1024.png");
const icnsPath = path.join(process.cwd(), "assets/icon.icns");

describe("app icon assets", () => {
  it("keeps a transparent 1024px master in the repository", async () => {
    const meta = await sharp(masterPath).metadata();

    expect(meta.format).toBe("png");
    expect(meta.width).toBe(1024);
    expect(meta.height).toBe(1024);
    expect(meta.hasAlpha).toBe(true);
  });

  it("ships an icns covering the full macOS size range", () => {
    const icns = readFileSync(icnsPath);

    expect(icns.subarray(0, 4).toString("latin1")).toBe("icns");
    expect(icns.readUInt32BE(4)).toBe(icns.byteLength);

    const types = new Set<string>();
    for (let offset = 8; offset + 8 <= icns.byteLength; ) {
      const type = icns.subarray(offset, offset + 4).toString("latin1");
      const length = icns.readUInt32BE(offset + 4);
      if (length < 8) {
        break;
      }
      types.add(type);
      offset += length;
    }

    for (const type of ["icp4", "icp5", "ic07", "ic08", "ic09", "ic10"]) {
      expect(types.has(type)).toBe(true);
    }
  });

  it("wires the icon into the packager", () => {
    const forgeConfig = readFileSync(path.join(process.cwd(), "forge.config.cjs"), "utf8");

    expect(forgeConfig).toMatch(/icon:\s*path\.resolve\(__dirname, "assets\/icon\.icns"\)/);
  });

  it("keeps the icon sources out of the packaged app", async () => {
    // 打包器直接读磁盘上的 assets/icon.icns，因此这份 2.9 MB 母版只需要留在仓库里。
    // 断言的是打包器实际会不会收录，而不是配置文件的措辞 —— 后者换个写法就会误报。
    expect(await isPackaged("assets/icon.icns")).toBe(false);
    expect(await isPackaged("assets/icon-1024.png")).toBe(false);
  });
});
