import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The real Electron Packager filter, so scope assertions exercise Packager's own matching
 * semantics rather than a re-implementation of them. Packager matches each rule against
 * `"/" + path relative to the packaged directory`, which is why rules read like
 * "/electron/main.mjs" and why an absolute path can never be tested directly.
 */
const { userPathFilter } = require("@electron/packager/dist/copy-filter.js");
const forgeConfig = require("../forge.config.cjs");

const filter = userPathFilter({
  dir: projectRoot,
  ignore: forgeConfig.packagerConfig.ignore,
  // Pruning only applies under /node_modules, which no scope test exercises; leaving it off keeps
  // the filter from reading package manifests it does not need.
  prune: false,
  quiet: true,
  out: path.join(projectRoot, "out"),
  name: "MD-Convertor",
  platform: "darwin",
  arch: "arm64",
});

/** True when Electron Packager would copy this project-relative path into the app bundle. */
export async function isPackaged(relativePath: string): Promise<boolean> {
  return await filter(path.join(projectRoot, relativePath));
}
