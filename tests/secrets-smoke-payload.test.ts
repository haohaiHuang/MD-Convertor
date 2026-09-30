import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { projectRoot } from "./packaged-app-scope";

/**
 * The packaged secrets smoke (`ELECTRON_SMOKE_TEST_SECRETS=1`) round-trips the GET
 * `/api/settings` payload straight back into PUT. Since the local-docs work the GET response
 * carries a response-only `defaults` field, and PUT rejects unknown root keys with
 * `INVALID_SETTINGS` (`src/app/api/settings/route.test.ts` pins that). Without the strip the
 * smoke dies on setup against any real installation, so the strip is the contract here.
 */
describe("packaged secrets smoke / settings round trip", () => {
  const main = readFileSync(path.join(projectRoot, "electron", "main.mjs"), "utf8");

  it("drops the response-only defaults field before PUT", () => {
    const stripped = main.indexOf("delete current.defaults;");
    const put = main.indexOf('callApi("PUT", {');

    expect(stripped).toBeGreaterThan(-1);
    expect(put).toBeGreaterThan(stripped);
  });
});
