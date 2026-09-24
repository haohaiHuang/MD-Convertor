import { build } from "esbuild";
import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// S1 ships one browser-only bundle so the smoke test can prove the convert core has no
// Node dependency. S2 appends the real `content.js` / `worker.js` entries and copies the
// manifest into `extension/dist/`.
const targets = [
  {
    entry: "extension/src/convert/index.ts",
    outfile: "extension/dist-test/core.js",
    format: "iife",
    globalName: "mdConvertorCore",
  },
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
