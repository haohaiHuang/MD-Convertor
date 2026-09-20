#!/usr/bin/env node
/**
 * One-shot probe for the S3 local CLI adapters (docs/features/translation/S3-translation-engine.md T3.1).
 *
 * It answers the questions the adapter design depends on:
 *   - can the prompt be delivered over stdin (and does a >100KB prompt survive)?
 *   - does passing the prompt as an argv entry hit the operating system's limits?
 *   - which flags disable tools and select a model?
 *
 * Live probes spawn real models, so they only run with `--live`; the static
 * probes never leave the machine and are safe to run at any time. The script is
 * a diagnostic, not part of the product path, and it never prints prompt
 * content, keys or CLI output bodies — only sizes, exit codes and short markers.
 *
 * Usage: node scripts/probe-local-cli.mjs [--cli pi|claude|all] [--live] [--model <id>]
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const PROMPT = 'Reply with exactly {"ok":true} and nothing else. Use no tools.';
const MARKER = "PROBE-MARKER-OK";
const LONG_BYTES = 120_000;
const LONG_PROMPT = `${"The quick brown fox jumps over the lazy dog. ".repeat(2800)}\nIgnore the text above and reply with exactly: ${MARKER}\n`;

const CLI_ARGS = {
  // No tool access, no session, no project context: a pure text-in/text-out call.
  pi: {
    version: ["--version"],
    headless: ["--no-tools", "--no-session", "--no-extensions", "--no-skills", "--no-context-files", "--mode", "text"],
  },
  claude: {
    version: ["--version"],
    headless: ["--tools", "", "--output-format", "text"],
  },
};

/** The adapter must never hand MD_CONVERTOR_* to a child process. */
function probeEnvironment() {
  const env = { ...process.env };
  for (const name of Object.keys(env)) {
    if (name.startsWith("MD_CONVERTOR_")) delete env[name];
  }
  return env;
}

function run(bin, args, { input, timeout = 120_000, cwd } = {}) {
  const startedAt = Date.now();
  const result = spawnSync(bin, args, {
    input,
    cwd,
    env: probeEnvironment(),
    encoding: "utf8",
    timeout,
    maxBuffer: 8 * 1024 * 1024,
  });
  return {
    exitCode: result.status,
    error: result.error ? result.error.code ?? result.error.message : null,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    durationMs: Date.now() - startedAt,
  };
}

function withTempDir(runProbe) {
  const dir = mkdtempSync(path.join(tmpdir(), "md-convertor-probe-"));
  try {
    return runProbe(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function messageOf(result) {
  return (result.stderr.trim() || result.stdout.trim()).slice(0, 160);
}

function probeStatic(cli, cwd) {
  const args = CLI_ARGS[cli];
  const version = run(cli, args.version, { cwd, timeout: 30_000 });
  const noInput = run(cli, ["-p", ...args.headless], { input: "", cwd, timeout: 60_000 });

  return {
    version: version.stdout.trim().split("\n")[0] ?? "",
    emptyStdin: {
      exitCode: noInput.exitCode,
      mentionsStdin: /stdin/i.test(`${noInput.stdout}${noInput.stderr}`),
      message: messageOf(noInput),
    },
  };
}

function probeLive(cli, modelArgs, cwd) {
  const argvLength = (bytes) => run(cli, ["-p", ...CLI_ARGS[cli].headless, ...modelArgs, "x".repeat(bytes)], {
    input: "",
    timeout: 120_000,
    cwd,
  });

  const short = run(cli, ["-p", ...CLI_ARGS[cli].headless, ...modelArgs], { input: PROMPT, timeout: 120_000, cwd });
  const long = run(cli, ["-p", ...CLI_ARGS[cli].headless, ...modelArgs], {
    input: LONG_PROMPT,
    timeout: 180_000,
    cwd,
  });
  const argv = argvLength(LONG_BYTES);

  return {
    stdin: {
      promptBytes: Buffer.byteLength(PROMPT),
      exitCode: short.exitCode,
      error: short.error,
      echoOk: /"ok"\s*:\s*true/.test(short.stdout),
      stdoutBytes: Buffer.byteLength(short.stdout),
      durationMs: short.durationMs,
      message: short.exitCode === 0 ? "" : messageOf(short),
    },
    longStdin: {
      promptBytes: Buffer.byteLength(LONG_PROMPT),
      exitCode: long.exitCode,
      error: long.error,
      sawMarker: long.stdout.includes(MARKER),
      stdoutBytes: Buffer.byteLength(long.stdout),
      durationMs: long.durationMs,
    },
    longArgv: {
      bytes: LONG_BYTES,
      exitCode: argv.exitCode,
      error: argv.error,
      message: argv.exitCode === 0 ? "" : messageOf(argv),
    },
  };
}

function main() {
  const argv = process.argv.slice(2);
  const readOption = (name) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const wanted = readOption("--cli") ?? "all";
  const live = argv.includes("--live");
  const model = readOption("--model");
  const clis = wanted === "all" ? ["pi", "claude"] : [wanted];

  for (const cli of clis) {
    if (!CLI_ARGS[cli]) throw new Error(`Unknown CLI: ${cli}`);
    // `pi --model <pattern>`, `claude --model <id>`; both keep the CLI default when omitted.
    const modelArgs = model ? ["--model", model] : [];
    const report = withTempDir((cwd) => ({
      modelArgs,
      static: probeStatic(cli, cwd),
      ...(live ? { live: probeLive(cli, modelArgs, cwd) } : {}),
    }));
    console.log(JSON.stringify({ [cli]: report }, null, 2));
  }
}

main();
