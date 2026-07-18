import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";

function trackedDiffHash() {
  try {
    const diff = execFileSync("git", ["diff", "--no-ext-diff", "--binary", "HEAD", "--", "."], {
      cwd: process.cwd(),
      encoding: "buffer",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return createHash("sha256").update(diff).digest("hex");
  } catch {
    return null;
  }
}

const beforeHash = trackedDiffHash();
const build = spawnSync("npm", ["run", "build"], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});
const playwright = path.join(process.cwd(), "node_modules", ".bin", "playwright");
const result = build.status === 0 && !build.error
  ? spawnSync(playwright, ["test", ...process.argv.slice(2)], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    })
  : build;
const afterHash = trackedDiffHash();

if (beforeHash !== null && afterHash !== beforeHash) {
  console.error("ERROR: E2E modified tracked files. Restore the unintended changes before continuing.");
  process.exitCode = 1;
} else if (result.error) {
  console.error(result.error.message);
  process.exitCode = 1;
} else if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
} else {
  console.log("E2E tracked-file check passed.");
}
