/// <reference types="chrome" />

// TypeScript 6 no longer pulls every package under `node_modules/@types` into the program, so the
// `chrome` global that `@types/chrome` declares has to be referenced explicitly. One reference here
// covers every extension file; keep this file import-free so it stays a pure type reference.
