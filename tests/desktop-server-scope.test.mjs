import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  DESKTOP_SERVER_ENTRIES,
  DESKTOP_SERVER_REQUIRED_FILES,
  DESKTOP_SERVER_SCOPE,
} from "../scripts/desktop-server-entries.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const serverRoot = path.join(projectRoot, ".desktop", "server");
// `.desktop/server` only exists after `npm run desktop:prepare`, which a bare `./init.sh` never
// runs. The artifact checks are skipped rather than silently returning when it is absent: a
// passing case that inspected nothing is a report that lies. The whitelist pins below always run.
const prepared = existsSync(serverRoot);

describe.skipIf(!prepared)("prepared desktop server", () => {
  it("contains exactly the runtime entries and nothing from the repository", () => {
    const actual = readdirSync(serverRoot).sort();
    expect(actual).toEqual([...DESKTOP_SERVER_SCOPE].sort());
  });

  it.each(DESKTOP_SERVER_REQUIRED_FILES)("keeps %s", (relativePath) => {
    expect(existsSync(path.join(serverRoot, relativePath)), `${relativePath} is read at runtime`).toBe(true);
  });
});

describe("desktop server whitelist", () => {
  it.each(["docs", "src", "e2e", "tests", "coverage", "out", "extension", "playwright-report"])(
    "never allows the repository's %s directory into the bundle",
    (entry) => {
      expect(DESKTOP_SERVER_ENTRIES).not.toContain(entry);
    },
  );

  it.each(["PROGRESS.md", "session-handoff.md", "feature_list.json", "AGENTS.md", "CHANGELOG.md"])(
    "never allows %s into the bundle",
    (entry) => {
      expect(DESKTOP_SERVER_ENTRIES).not.toContain(entry);
    },
  );
});
