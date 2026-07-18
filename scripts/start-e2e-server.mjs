import { cpSync } from "node:fs";
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
process.chdir(serverRoot);
await import(pathToFileURL(path.join(serverRoot, "server.js")).href);
