import { beforeEach, describe, expect, it } from "vitest";

import { homeModeFromSearch, pendingHomeMode, setPendingHomeMode } from "./home-mode";

describe("homeModeFromSearch", () => {
  it("reads the screen the settings page came from", () => {
    expect(homeModeFromSearch("?from=convert")).toBe("convert");
    expect(homeModeFromSearch("?from=local-docs")).toBe("local-docs");
  });

  it("falls back to the landing screen for anything unknown", () => {
    expect(homeModeFromSearch("")).toBe("home");
    expect(homeModeFromSearch("?from=home")).toBe("home");
    expect(homeModeFromSearch("?from=/etc/passwd")).toBe("home");
    expect(homeModeFromSearch("?next=convert")).toBe("home");
  });
});

describe("pending home mode", () => {
  beforeEach(() => setPendingHomeMode("home"));

  it("remembers the screen across the settings round trip", () => {
    setPendingHomeMode("local-docs");
    expect(pendingHomeMode()).toBe("local-docs");
  });

  it("keeps reading the same value, so a StrictMode double initializer agrees", () => {
    setPendingHomeMode("convert");
    expect(pendingHomeMode()).toBe("convert");
    expect(pendingHomeMode()).toBe("convert");
  });
});
