import { build } from "esbuild";
import { mkdir, copyFile, readFile, stat } from "node:fs/promises";
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
