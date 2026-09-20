import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildServerEnv,
  encodeSecretsPayload,
  mergePathEntries,
  parseDotEnv,
  readDotEnvFile,
  readLoginShellPath,
  resolvePathEnv,
} from "./env.mjs";

const SYSTEM_DIRS = "/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:/opt/homebrew/bin";

describe("mergePathEntries", () => {
  it("deduplicates while preserving first-seen order", () => {
    expect(mergePathEntries(["/a", "/b", "/a", "/c", "/b"])).toEqual(["/a", "/b", "/c"]);
  });

  it("drops empty entries and trims whitespace", () => {
    expect(mergePathEntries(["", "  ", " /a ", "/b:"])).toEqual(["/a", "/b:"]);
  });
});

describe("resolvePathEnv", () => {
  it("merges process PATH, login shell PATH, user directories, and system directories", () => {
    expect(resolvePathEnv({
      processPath: "/usr/bin:/custom",
      loginShellPath: "/custom:/opt/homebrew/bin",
      homeDir: "/Users/test",
    })).toBe(
      "/usr/bin:/custom:/opt/homebrew/bin:/Users/test/.npm-global/bin:/Users/test/.local/bin:/Users/test/bin:/bin:/usr/sbin:/sbin:/usr/local/bin",
    );
  });

  it("still produces the system directories with empty inputs", () => {
    expect(resolvePathEnv({ processPath: "", loginShellPath: "", homeDir: "" })).toBe(SYSTEM_DIRS);
  });

  it("keeps one trailing copy of a system directory", () => {
    expect(resolvePathEnv({ processPath: "/opt/homebrew/bin", homeDir: "" })).toBe(
      `/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin`,
    );
  });
});

describe("parseDotEnv", () => {
  it("parses simple assignments", () => {
    expect(parseDotEnv("OPENAI_API_KEY=sk-1\nANTHROPIC_API_KEY=sk-2")).toEqual({
      OPENAI_API_KEY: "sk-1",
      ANTHROPIC_API_KEY: "sk-2",
    });
  });

  it("ignores comments, blanks, and malformed lines", () => {
    expect(parseDotEnv("# comment\n\n  # indented comment\nnot a pair\n=missing\n1BAD=x\nOK=1\n")).toEqual({ OK: "1" });
  });

  it("accepts an export prefix", () => {
    expect(parseDotEnv("export OPENAI_API_KEY=sk-1")).toEqual({ OPENAI_API_KEY: "sk-1" });
  });

  it("strips single and double quotes", () => {
    expect(parseDotEnv(`A="a b"\nB='c d'\nC="keep # hash"\nD=`))
      .toEqual({ A: "a b", B: "c d", C: "keep # hash", D: "" });
  });

  it("strips an unquoted trailing comment", () => {
    expect(parseDotEnv("A=value # note\nB=1#notacomment")).toEqual({ A: "value", B: "1#notacomment" });
  });

  it("keeps equals signs inside values", () => {
    expect(parseDotEnv("A=base64==\nB=a=b")).toEqual({ A: "base64==", B: "a=b" });
  });

  it("lets the last duplicate key win", () => {
    expect(parseDotEnv("A=1\nA=2")).toEqual({ A: "2" });
  });

  it("handles CRLF content", () => {
    expect(parseDotEnv("A=1\r\nB=2\r\n")).toEqual({ A: "1", B: "2" });
  });
});

describe("readLoginShellPath", () => {
  it("returns the trimmed login shell PATH", () => {
    const calls = [];
    const output = readLoginShellPath((file, args) => {
      calls.push([file, args]);
      return "/opt/homebrew/bin:/custom/bin\n";
    });
    expect(output).toBe("/opt/homebrew/bin:/custom/bin");
    expect(calls).toEqual([["/bin/zsh", ["-lc", "echo -n $PATH"]]]);
  });

  it("returns an empty string when the shell call fails", () => {
    expect(readLoginShellPath(() => {
      throw new Error("no shell");
    })).toBe("");
  });

  it("returns an empty string for non-string output", () => {
    expect(readLoginShellPath(() => undefined)).toBe("");
  });
});

describe("readDotEnvFile", () => {
  let directory;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "md-convertor-env-"));
  });

  afterEach(async () => {
    await rm(directory, { force: true, recursive: true });
  });

  it("parses an existing file", async () => {
    const filePath = path.join(directory, ".env");
    await writeFile(filePath, "OPENAI_API_KEY=sk-1\n");
    await expect(readDotEnvFile(filePath)).resolves.toEqual({ OPENAI_API_KEY: "sk-1" });
  });

  it("tolerates a missing file", async () => {
    await expect(readDotEnvFile(path.join(directory, "missing.env"))).resolves.toEqual({});
  });
});

describe("buildServerEnv", () => {
  const userDataDir = "/Users/test/Library/Application Support/MD-Convertor";

  it("injects the user data directory, merged PATH, and encoded secrets", () => {
    const env = buildServerEnv({
      baseEnv: { ELECTRON_RUN_AS_NODE: "1", MD_CONVERTOR_SECRETS: "stale-value" },
      pathEnv: "/merged/bin:/usr/bin",
      userDataDir,
      secrets: { openai: "sk-1" },
      dotEnv: { OPENAI_API_KEY: "sk-2" },
    });

    expect(env).toMatchObject({
      ELECTRON_RUN_AS_NODE: "1",
      PATH: "/merged/bin:/usr/bin",
      MD_CONVERTOR_USER_DATA: userDataDir,
      OPENAI_API_KEY: "sk-2",
    });
    expect(env.MD_CONVERTOR_SECRETS).not.toBe("stale-value");
    expect(JSON.parse(Buffer.from(env.MD_CONVERTOR_SECRETS, "base64").toString("utf8"))).toEqual({ openai: "sk-1" });
  });

  it("lets the launching environment win over a .env entry", () => {
    const env = buildServerEnv({
      baseEnv: { OPENAI_API_KEY: "from-shell" },
      pathEnv: "/usr/bin",
      userDataDir,
      dotEnv: { OPENAI_API_KEY: "from-file", ANTHROPIC_API_KEY: "sk-3" },
    });

    expect(env.OPENAI_API_KEY).toBe("from-shell");
    expect(env.ANTHROPIC_API_KEY).toBe("sk-3");
  });

  it("sends an empty secrets map when the keychain has nothing stored", () => {
    const env = buildServerEnv({ baseEnv: {}, pathEnv: "/usr/bin", userDataDir });

    expect(Buffer.from(env.MD_CONVERTOR_SECRETS, "base64").toString("utf8")).toBe("{}");
    expect(env.MD_CONVERTOR_USER_DATA).toBe(userDataDir);
  });
});

describe("encodeSecretsPayload", () => {
  it("encodes a provider id map as base64 JSON", () => {
    const payload = encodeSecretsPayload({ openai: "sk-1", local: "sk-2" });
    expect(JSON.parse(Buffer.from(payload, "base64").toString("utf8"))).toEqual({ openai: "sk-1", local: "sk-2" });
  });

  it("encodes an empty map", () => {
    expect(Buffer.from(encodeSecretsPayload({}), "base64").toString("utf8")).toBe("{}");
  });
});
