import { constants } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import type { LocalCliId } from "@/types/settings";
import { LOCAL_CLI_REGISTRY, findCliDefinition, type LocalCliDefinition } from "./registry";

export type CliScanEntry = {
  id: LocalCliId;
  name: string;
  /** First executable found along PATH, or null when the CLI is not installed. */
  path: string | null;
  installed: boolean;
};

export type CliScanDeps = {
  pathEnv?: string;
  isExecutable?: (candidate: string) => Promise<boolean>;
};

export function pathDirectories(pathEnv: string | undefined): string[] {
  const seen = new Set<string>();
  const directories: string[] = [];
  for (const entry of pathEnv?.split(path.delimiter) ?? []) {
    const directory = entry.trim();
    if (!directory || seen.has(directory)) {
      continue;
    }
    seen.add(directory);
    directories.push(directory);
  }
  return directories;
}

async function defaultIsExecutable(candidate: string): Promise<boolean> {
  try {
    await access(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function probeExecutable(
  definition: LocalCliDefinition,
  directories: string[],
  isExecutable: (candidate: string) => Promise<boolean>,
): Promise<string | null> {
  for (const directory of directories) {
    const candidate = path.join(directory, definition.name);
    try {
      if (await isExecutable(candidate)) {
        return candidate;
      }
    } catch {
      // Unreadable directory entry: keep scanning the rest of PATH.
    }
  }
  return null;
}

export async function scanLocalClis(deps: CliScanDeps = {}): Promise<CliScanEntry[]> {
  const directories = pathDirectories(deps.pathEnv ?? process.env.PATH);
  const isExecutable = deps.isExecutable ?? defaultIsExecutable;

  const entries: CliScanEntry[] = [];
  for (const definition of LOCAL_CLI_REGISTRY) {
    const found = await probeExecutable(definition, directories, isExecutable);
    entries.push({ id: definition.id, name: definition.name, path: found, installed: found !== null });
  }
  return entries;
}

export async function findCliExecutable(id: string, deps: CliScanDeps = {}): Promise<string | null> {
  const definition = findCliDefinition(id);
  if (!definition) {
    return null;
  }
  const directories = pathDirectories(deps.pathEnv ?? process.env.PATH);
  return probeExecutable(definition, directories, deps.isExecutable ?? defaultIsExecutable);
}
