# Testing and Release Guide

**English** | [简体中文](TESTING.zh.md)

## Environment

- Apple Silicon Mac
- Node.js 24.x and npm
- Chromium, Firefox, and WebKit installed with `npx playwright install chromium firefox webkit`
- Network access for live checks and first-time Electron/Chromium dependency downloads

Use `npm ci` to restore dependencies after a clean checkout.

## Commands

| Command | Purpose | Release-blocking |
|---|---|---|
| `./init.sh` | Harness validation, lint, typecheck, coverage tests, production build | Yes |
| `npm run test:e2e` | Chromium, Firefox, and WebKit UI regression | Yes |
| `npm run test:live` | Stable WalkingLabs link/paste comparison | Release only |
| `npm run test:live:wechat` | Full in-memory WeChat article comparison | Diagnostic |
| `npm run desktop:package` | Build unpacked arm64 app | No |
| `npm run desktop:make` | Build unsigned ZIP | No |
| `npm run desktop:release` | Run the complete gate and build a fresh verified ZIP | Yes |

Live comparisons do not save or print webpage bodies. Override live fixtures only through the documented environment variables in the test sources; never commit private or copyrighted page content.

## Coverage

The baseline covers:

- URL, DNS, redirect, SSRF, proxy, request/byte budgets, cancellation, and timeout behavior
- Readability extraction, body fallback, WeChat validation detection, and Markdown golden output
- standard and multi-node code blocks, tables, lists, links, and Mermaid preservation
- rich-text semantic gating, sanitization, HTML/plain-text fallback, and 5 MiB request limits
- image formats, lazy sources, Data URI validation, 8 MiB source limit, 30-image limit, optimization, and 20 MiB output degradation
- copy, download, clear actions, stop, statistics, responsive layout, and Back to Top

E2E runs against the production standalone service and fails if tracked files change.

## Release Guard

`npm run desktop:release` requires:

- package version exactly `0.2.1`
- Node.js 24.x
- unchanged fixed hashes for historical ZIPs in `~/Downloads/MD-Convertor-archive/releases/`
- a ZIP created during the current run
- packaged version `0.2.1`
- an arm64 executable and complete application bundle

The guard rechecks historical artifacts on both success and failure. A Forge command that exits without a new ZIP is a failure.

## Verified 0.2.1 Artifact

- Path: `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.2.1.zip`
- Size: `354,635,067` bytes
- SHA-256: `32c1d96af58a7701e6d2fe0bf619be0f8f224803355c6ef63aad43c85569463e`
- Package: version `0.2.1`, arm64, macOS 12.0+
- Automated evidence: 322 tests, 60/60 three-engine E2E, stable live 2/2
- WeChat diagnostic: 12/12 code blocks and 279 lines matched in memory

## Manual Acceptance

1. Extract the ZIP and move `MD-Convertor.app` to Applications.
2. Verify the checksum before bypassing any Gatekeeper warning.
3. Launch the app and test one public link plus one rich-text paste.
4. Confirm clear, stop, copy, download, statistics, embedded images, code blocks, Mermaid behavior, and Back to Top.
5. Open the downloaded Markdown in the intended reader.

The package is unsigned and not notarized. It is approved only for personal testing until an Apple Developer ID signing and notarization flow is configured.
