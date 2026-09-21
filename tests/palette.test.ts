import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const appDir = path.join(process.cwd(), "src", "app");

/** Every colour surface the navy refresh owns: the token source, its two consumers and the favicon. */
const COLOUR_SURFACES = [
  "globals.css",
  "page.module.css",
  "settings/page.module.css",
  "icon.svg",
];

/**
 * The navy palette. `--warning*` and `--danger*` are listed only to document that they are
 * deliberately untouched, not because the refresh computes them.
 */
const TOKENS: Record<string, string> = {
  "--paper": "#f9fafb",
  "--surface": "#ffffff",
  "--ink": "#1c2230",
  "--muted": "#565e6b",
  "--line": "#dbdfe7",
  "--accent": "#2a395c",
  "--accent-dark": "#232f4e",
  "--accent-soft": "#eef1f6",
  "--warning": "#8a5a12",
  "--warning-soft": "#fff3d6",
  "--danger": "#a33b32",
  "--danger-soft": "#fbe9e6",
};

/** Tinted literals, semantic borders and plain whites that are allowed to stay as literals. */
const ALLOWED_LITERALS = [
  // globals.css: body gradients and the shadow.
  "#fbfbfd",
  "rgb(30 35 50 / 10%)",
  "rgb(42 57 92 / 9%)",
  // page.module.css: translucent fills, focus rings, shadows and the cooled code block.
  "rgb(255 255 255 / 58%)",
  "rgb(255 255 255 / 62%)",
  "rgb(30 35 50 / 8%)",
  "rgb(249 250 251 / 90%)",
  "rgb(42 57 92 / 12%)",
  "rgb(42 57 92 / 18%)",
  "rgb(42 57 92 / 20%)",
  "rgb(42 57 92 / 22%)",
  "rgb(42 57 92 / 24%)",
  "rgb(42 57 92 / 28%)",
  "rgb(42 57 92 / 34%)",
  "rgba(20, 24, 36, 0.22)",
  "rgba(20, 24, 36, 0.45)",
  "#939ba9",
  "#a9b1bf",
  "#a9b3c6",
  "#f4f6f9",
  "#1e222b",
  "#edeff4",
  // Semantic borders and fills, frozen by the feature scope.
  "#dfaaa3",
  "#edc8c2",
  "#eed79c",
  "#fbe9e7",
  "#8d3b2f",
  // Plain whites.
  "#fff",
  "#ffffff",
  ...Object.values(TOKENS),
];

/** The moss-green / warm-cream palette that must not survive anywhere. */
const RETIRED_LITERALS = [
  "#176b5d",
  "#0f5147",
  "#dcece7",
  "#bfe3da",
  "#17201f",
  "#65706d",
  "#d8dcd5",
  "#f7f5ef",
  "#fffefa",
  "#fbfaf6",
  "#fbfbfa",
  "#c8dfd8",
  "#a7c9c0",
  "#202a28",
  "#edf4f1",
  "#929b98",
  "#aab4b0",
  "#f7f9f8",
  "rgb(23 107 93",
  "rgb(34 50 45",
  "rgb(247 250 248",
  "rgba(22, 34, 28",
];

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ");
}

function readSurface(file: string) {
  return normalize(readFileSync(path.join(appDir, file), "utf8"));
}

function collectLiterals(css: string) {
  return new Set(css.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/g) ?? []);
}

const allowed = new Set(ALLOWED_LITERALS.map(normalize));

describe("navy palette", () => {
  it("declares the refreshed token set in globals.css", () => {
    const globals = readSurface("globals.css");
    const declared = new Map(
      [...globals.matchAll(/--([a-z-]+):\s*([^;]+);/g)].map(([, name, value]) => [`--${name}`, value.trim()]),
    );

    for (const [token, value] of Object.entries(TOKENS)) {
      expect(declared.get(token), token).toBe(value);
    }
  });

  it("only uses literals from the palette across all four colour surfaces", () => {
    const offenders = COLOUR_SURFACES.flatMap((file) =>
      [...collectLiterals(readSurface(file))]
        .filter((literal) => !allowed.has(literal))
        .map((literal) => `${file}: ${literal}`),
    );

    expect(offenders).toEqual([]);
  });

  it("leaves no retired literal or orphan token fallback behind", () => {
    const sources = COLOUR_SURFACES.map((file) => [file, readSurface(file)] as const);

    for (const literal of RETIRED_LITERALS) {
      for (const [file, css] of sources) {
        expect(css, `${file} still contains ${literal}`).not.toContain(literal);
      }
    }

    for (const [file, css] of sources) {
      expect(css, `${file} still references the undefined --surface-muted`).not.toContain("--surface-muted");
    }
  });
});
