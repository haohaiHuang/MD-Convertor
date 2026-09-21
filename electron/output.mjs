import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { isAbsoluteDirPath, isValidOutputFilename } from "./preload-contract.cjs";

/**
 * Output IPC handlers: directory picking and direct file writes.
 *
 * Pure module (Electron's ipcMain/dialog are injected) so the validation and
 * write path stay testable outside Electron — same pattern as secrets.mjs.
 * The renderer-provided dirPath/filename are untrusted: both are re-validated
 * here even though the sandboxed preload already rejects bad input, because
 * the two layers are independent defenses and neither may be removed.
 */
export function createOutputChannels({ ipcMain, dialog, warn = console.warn }) {
  ipcMain.handle("md-convertor:output:select-directory", async (_event, options = {}) => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      ...options,
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, code: "CANCELLED" };
    }
    return { ok: true, path: result.filePaths[0] };
  });

  ipcMain.handle("md-convertor:output:save-file", async (_event, payload) => {
    const { dirPath, filename, content } = payload ?? {};
    if (!isAbsoluteDirPath(dirPath)) return { ok: false, code: "INVALID_DIR_PATH" };
    if (!isValidOutputFilename(filename)) return { ok: false, code: "INVALID_FILENAME" };
    if (typeof content !== "string") return { ok: false, code: "INVALID_CONTENT" };

    try {
      await mkdir(dirPath, { recursive: true });
      const filePath = path.join(dirPath, filename);
      await writeFile(filePath, content, "utf8");
      return { ok: true, path: filePath };
    } catch (error) {
      const code = error?.code ?? "OUTPUT_SAVE_FAILED";
      warn(`Saving the markdown file failed: ${code}`);
      return { ok: false, code };
    }
  });
}
