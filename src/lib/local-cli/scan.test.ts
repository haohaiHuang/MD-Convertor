import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { findCliExecutable, pathDirectories, scanLocalClis } from "./scan";

describe("pathDirectories", () => {
  it("keeps PATH order and drops duplicates and empty entries", () => {
    expect(pathDirectories(["/a", "/b", "/a", "", "  ", "/c"].join(path.delimiter))).toEqual(["/a", "/b", "/c"]);
  });

  it("tolerates a missing PATH", () => {
    expect(pathDirectories(undefined)).toEqual([]);
    expect(pathDirectories("")).toEqual([]);
  });
});

describe("scanLocalClis", () => {
  it("reports the first executable found along PATH for each CLI", async () => {
    const isExecutable = vi.fn(async (candidate: string) =>
      candidate === "/a/claude" || candidate === "/b/pi");
    const clis = await scanLocalClis({ pathEnv: "/a:/b", isExecutable });

    expect(clis).toEqual([
      { id: "pi", name: "pi", path: "/b/pi", installed: true },
      { id: "claude", name: "claude", path: "/a/claude", installed: true },
    ]);
    expect(isExecutable).toHaveBeenCalledWith("/a/pi");
  });

  it("reports uninstalled CLIs without failing", async () => {
    const clis = await scanLocalClis({ pathEnv: "/a", isExecutable: async () => false });
    expect(clis).toEqual([
      { id: "pi", name: "pi", path: null, installed: false },
      { id: "claude", name: "claude", path: null, installed: false },
    ]);
  });

  it("never probes anything when PATH is empty", async () => {
    const isExecutable = vi.fn(async () => true);
    const clis = await scanLocalClis({ pathEnv: "", isExecutable });
    expect(isExecutable).not.toHaveBeenCalled();
    expect(clis.every((cli) => !cli.installed)).toBe(true);
  });

  it("swallows probe errors", async () => {
    const isExecutable = vi.fn(async () => {
      throw new Error("EACCES");
    });
    const clis = await scanLocalClis({ pathEnv: "/a", isExecutable });
    expect(clis.every((cli) => !cli.installed)).toBe(true);
  });
});

describe("findCliExecutable", () => {
  it("returns the resolved path of a known CLI", async () => {
    const isExecutable = async (candidate: string) => candidate === "/a/pi";
    await expect(findCliExecutable("pi", { pathEnv: "/a", isExecutable })).resolves.toBe("/a/pi");
  });

  it("returns null for a CLI that is not installed", async () => {
    await expect(findCliExecutable("claude", { pathEnv: "/a", isExecutable: async () => false }))
      .resolves.toBeNull();
  });

  it("returns null for an unknown CLI id", async () => {
    await expect(findCliExecutable("nope" as never, { pathEnv: "/a", isExecutable: async () => true }))
      .resolves.toBeNull();
  });
});
