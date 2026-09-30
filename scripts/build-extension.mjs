import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdir, copyFile, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// S2 appends the real `content.js` (injected on click, the only context with a DOM) and
// `worker.js` (MV3 service worker) entries, plus the manifest that points Chrome at them.
const targets = [
  {
    entry: "extension/src/convert/index.ts",
    outfile: "extension/dist-test/core.js",
    format: "iife",
    globalName: "mdConvertorCore",
  },
  { entry: "extension/src/content.ts", outfile: "extension/dist/content.js", format: "iife" },
  { entry: "extension/src/worker.ts", outfile: "extension/dist/worker.js", format: "iife" },
];

// `turndown` maps `@mixmark-io/domino` to an empty stub via its `browser` field; if a Node
// builtin or jsdom/domino ever leaks into the bundle, the artifact would silently break in
// the browser. Fail the build instead.
const forbidden = ['require("node:', "jsdom", "domino"];

for (const target of targets) {
  const outfile = path.join(root, target.outfile);
  await mkdir(path.dirname(outfile), { recursive: true });
  await build({
    entryPoints: [path.join(root, target.entry)],
    outfile,
    bundle: true,
    minify: true,
    sourcemap: false,
    format: target.format,
    globalName: target.globalName,
    platform: "browser",
    target: "chrome110",
    logLevel: "silent",
  });

  const source = await readFile(outfile, "utf8");
  for (const needle of forbidden) {
    if (source.includes(needle)) {
      throw new Error(`${target.outfile} contains a forbidden Node-only reference: ${needle}`);
    }
  }
  const { size } = await stat(outfile);
  console.log(`${target.outfile}  ${(size / 1024).toFixed(1)} KB`);
}

const manifest = path.join(root, "extension/manifest.json");
await copyFile(manifest, path.join(root, "extension/dist/manifest.json"));
console.log("extension/dist/manifest.json");

// T4: ship a loadable ZIP next to the site, so the home-screen download button resolves.
// The extension must live in its own folder — "load unpacked" takes a directory, and `ditto
// --keepParent` puts `md-convertor-extension/` at the archive root. macOS `ditto` only, no zip dep.
//
// Two vitest files (`extension-build` and `extension-package`) each call this build, in parallel
// forks. The staging directory is therefore per-process and the archive is packed beside it and
// renamed into place: a shared staging directory plus a shared output path made the first draft
// flaky (one process `rm -rf`-ed the directory the other was packing, and a reader could see a
// half-written ZIP).
const packageRoot = path.join(root, "extension/dist-package", String(process.pid));
const packageDir = path.join(packageRoot, "md-convertor-extension");
await rm(packageRoot, { recursive: true, force: true });
await mkdir(packageDir, { recursive: true });
for (const name of ["manifest.json", "content.js", "worker.js", "使用说明.md"]) {
  const from = name === "使用说明.md" ? path.join(root, "extension", name) : path.join(root, "extension/dist", name);
  await copyFile(from, path.join(packageDir, name));
}

const zipPath = path.join(root, "public/md-convertor-extension.zip");
await mkdir(path.dirname(zipPath), { recursive: true });
const packed = path.join(packageRoot, "pack.zip");
execFileSync("/usr/bin/ditto", ["-c", "-k", "--norsrc", "--noextattr", "--keepParent", packageDir, packed]);
await rename(packed, zipPath);
await rm(packageRoot, { recursive: true, force: true });
console.log("public/md-convertor-extension.zip");
