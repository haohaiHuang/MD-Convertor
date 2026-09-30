import { isAbsoluteDirPath } from "./preload-contract.cjs";

/**
 * System IPC handlers: opening a directory in the OS file manager (S3's 「打开目录」).
 *
 * Pure module (Electron's ipcMain/shell are injected) so the validation stays testable
 * outside Electron — same pattern as output.mjs. The renderer-provided path is untrusted
 * and re-validated here even though the sandboxed preload already rejects bad input: the
 * two layers are independent defenses and neither may be removed.
 *
 * `shell.openPath` resolves with "" on success and a human-readable description on
 * failure; that text goes to the log, and the renderer gets a code it can translate.
 */
export function createSystemChannels({ ipcMain, shell, warn = console.warn }) {
  ipcMain.handle("md-convertor:system:open-path", async (_event, payload) => {
    const { dirPath } = payload ?? {};
    if (!isAbsoluteDirPath(dirPath)) return { ok: false, code: "INVALID_DIR_PATH" };

    try {
      const failure = await shell.openPath(dirPath);
      if (failure) {
        warn(`Opening the output directory failed: ${failure}`);
        return { ok: false, code: "OPEN_PATH_FAILED" };
      }
      return { ok: true, path: dirPath };
    } catch (error) {
      const code = error?.code ?? "OPEN_PATH_FAILED";
      warn(`Opening the output directory failed: ${code}`);
      return { ok: false, code };
    }
  });
}
