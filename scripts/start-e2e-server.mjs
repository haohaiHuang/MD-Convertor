import { cpSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const serverRoot = path.join(root, ".next", "standalone");
cpSync(path.join(root, ".next", "static"), path.join(serverRoot, ".next", "static"), {
  recursive: true,
});
cpSync(path.join(root, "public"), path.join(serverRoot, "public"), { recursive: true });

process.env.HOSTNAME = "127.0.0.1";
process.env.NODE_ENV = "production";
process.env.PORT = "3000";
// Keep e2e settings out of the real user data directory.
process.env.MD_CONVERTOR_USER_DATA = mkdtempSync(path.join(os.tmpdir(), "md-convertor-e2e-"));
// Must match extraHTTPHeaders in playwright.config.ts; the guard requires it in production.
process.env.MD_CONVERTOR_SESSION_TOKEN = "md-convertor-e2e-token";
// Built-in stand-in model so the translation flow never reaches the network.
process.env.MD_CONVERTOR_TEST_PROVIDER = "1";
console.log(`E2E settings directory: ${process.env.MD_CONVERTOR_USER_DATA}`);
process.chdir(serverRoot);
await import(pathToFileURL(path.join(serverRoot, "server.js")).href);
