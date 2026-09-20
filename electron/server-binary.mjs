import fs from "node:fs";
import path from "node:path";

/**
 * Picks the Node runtime for the local server process.
 *
 * Spawning the application's own executable would make LaunchServices treat the
 * child as a second launch of the app bundle, so the Dock shows it with the
 * generic executable icon and never finishes its launch animation. The Helper
 * bundle sets LSUIElement, so it runs the same Electron runtime as Node while
 * staying out of the Dock.
 */
export function resolveServerBinary(execPath) {
  const executableName = path.basename(execPath);
  const helper = path.join(
    path.dirname(path.dirname(execPath)),
    "Frameworks",
    `${executableName} Helper.app`,
    "Contents",
    "MacOS",
    `${executableName} Helper`,
  );
  if (!fs.existsSync(helper)) {
    throw new Error(`Desktop helper runtime is missing: ${helper}`);
  }
  return helper;
}
