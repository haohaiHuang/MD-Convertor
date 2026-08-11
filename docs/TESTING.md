# Testing and Release Guide

**English** | [简体中文](TESTING.zh.md)

## Prerequisites

The project requires Node.js 24.x and npm. `./init.sh` rejects other Node.js major versions before running any checks. Desktop development and dynamic-page conversion require Chromium; complete UI acceptance requires all three Playwright engines.

```bash
npm install
npx playwright install chromium
npx playwright install chromium firefox webkit
```

For ordinary desktop development, the Chromium-only command is sufficient. Install all three engines before `npm run test:e2e` or `npm run desktop:release`.

## Verification tiers

| Command | Purpose | Network |
|---|---|---|
| `./init.sh` | Harness checks, lint, typecheck, unit/security/golden tests, and production build | Not required when dependencies are installed |
| `npm run test:coverage` | Source coverage and security-critical thresholds | No |
| `npm run test:e2e` | Chromium, Firefox, and WebKit interaction/layout acceptance against the production standalone service; rejects tracked-file side effects | Local test service only |
| `npm run test:live` | Release-blocking WalkingLabs link/paste Mermaid conversion | Yes |
| `npm run test:live:wechat` | Real WeChat article comparison; diagnostic only because upstream behavior varies | Yes |
| `npm run desktop:package` | Build an unpacked Apple Silicon `.app` | No, when caches are present |
| `npm run desktop:make` | Build the Apple Silicon ZIP | No, when caches are present |
| `npm run desktop:release` | Run baseline, three-browser E2E, stable live checks, and ZIP packaging | Yes |
| `npx vitest run scripts/release-guards.test.mjs` | Verify the immutable 0.1.3 tag/archive, historical ZIP manifest, version isolation, and release failure handling | No |

`test:live` uses an accepted WalkingLabs Mermaid page and does not run in daily unit tests. The WeChat comparison remains available as `test:live:wechat`, but temporary upstream verification or timeout behavior does not block a personal-test release. Both tests compare results in memory and never save or print page content. Override the fixtures when needed:

```bash
MD_CONVERTOR_LIVE_URL=https://mp.weixin.qq.com/s/example npm run test:live:wechat
MD_CONVERTOR_MERMAID_LIVE_URL=https://example.com/mermaid-page npm run test:live
```

If WeChat coverage falls below 95%, diagnostics include only coverage, character count, image count, extraction mode, and warning codes—not body text. The Mermaid gate checks both browser extraction and pasted HTML conversion of the same page, including text/image statistics, raster Data URIs, the 20 MiB limit, and absence of raw SVG. Daily coverage focuses on `src/lib` and the conversion APIs, with thresholds for URL security, browser rendering, real proxy HTTP/CONNECT I/O, API authentication, rate limiting, timeouts, and orchestration.

## Mermaid verification

- `src/lib/convert-mermaid.test.ts`: source containers and existing `language-mermaid` blocks produce fenced code; empty placeholders force Chromium; browser failure returns an explicit warning; trusted screenshots are used only when body coverage is at least 95%.
- `src/lib/browser.test.ts`: replacing dynamic nodes cannot skip later diagrams; source-only containers are excluded from screenshot selection; container/standalone SVG screenshots, the 30-image limit, 4096px/8 MiB degradation, cancellation, cleanup, and Google Fonts blocking are covered.
- `src/lib/convert-mermaid-image.test.ts`: internal browser placeholders accept only raster Data URIs returned by the current request; malformed ordinary images still follow link-mode degradation rules.
- `src/lib/convert-paste.test.ts` and `src/lib/convert-paste-mermaid-image.test.ts`: pasted Mermaid source produces fences; sanitized SVG becomes PNG and affects statistics; tests cover `foreignObject`, removal of `<style>` and inline `style`, the fixed light palette, small generated images, 31-diagram accounting/warnings, 2048px limits, an opaque white background, active-content-only input, failed rasterization, and Canvas fallback.
- `tests/live/mermaid-page.test.ts`: the real WalkingLabs page must produce at least one safe raster image without saving or printing page content.

## v0.2 rich text paste verification

Rich text mode processes only clipboard content explicitly supplied by the user and does not replace link-mode fetching. Unit and API coverage includes:

- `src/lib/paste.test.ts`: DOM semantic gating, title fallback, paste sanitization, targeted `data-src`/`data-lazy-src`, and HTML-to-plain-text fallback.
- `src/lib/markdown.test.ts`, `src/lib/images.test.ts`, and `src/lib/convert-paste.test.ts`: Turndown/GFM output, literal plain text, optional source metadata, lazy-first images, strict `data:` decoding/format checks, 30-image/8 MiB/20 MiB budgets, authenticated/temporary/`blob:` degradation, and cancellation.
- `src/app/api/convert-paste/route.test.ts` and `src/lib/paste-request.test.ts`: loopback/origin/token authentication, HTML/text fields, credential-free `sourceUrl`, declared and streamed UTF-8 5 MiB limits, 429/499/504, and logs that exclude body/HTML/URL data.
- `scripts/release-guards.test.mjs`: immutable `v0.1.3` tag, external read-only archive, fixed 0.1.0–0.1.3 ZIP manifest, non-0.2.0 rejection, post-run historical verification, and private failure messages.

Browser E2E covers dual-MIME rich text paste, plain-text and edited fallback, replacement paste, source URL present/absent, frontend/backend 5 MiB rejection, cancellation with preserved input, copy/download, and statistics in Chromium, Firefox, and WebKit. The final suite passed 60/60 and retained all original link-mode coverage.

Manual acceptance should confirm that the Rich Text tab displays pasted plain text, the recognition hint changes correctly between rich/plain/edited states, valid source URLs add source metadata while blank values omit it, stopped content remains editable, and images requiring authentication, temporary signatures, `blob:` URLs, or cookies fall back to alt text with a warning. Paste mode must never read cookies or bypass login pages, paywalls, or CAPTCHAs.

## Release and smoke-test environment variables

| Variable | Purpose |
|---|---|
| `MD_CONVERTOR_LIVE_URL` | Override the default non-blocking WeChat diagnostic article |
| `ELECTRON_SMOKE_TEST=1` | Exit after the packaged window loads |
| `ELECTRON_CONVERSION_SMOKE_URL` | Convert a public URL through the packaged app's local API, then exit |
| `ELECTRON_SMOKE_MIN_TEXT_CHARS` | Minimum non-Base64 characters for conversion smoke tests |
| `ELECTRON_SMOKE_MIN_IMAGE_COUNT` | Minimum embedded images for conversion smoke tests |
| `ELECTRON_CACHE` | Override the Electron ZIP cache |
| `PLAYWRIGHT_BROWSERS_PATH` | Override the Playwright browser cache |

`MD_CONVERTOR_SESSION_TOKEN`, `ELECTRON_RENDERER_URL`, `PLAYWRIGHT_EXECUTABLE_PATH`, and `ELECTRON_RUN_AS_NODE` are set internally by Electron or the development/build scripts. Do not configure them for normal use. Production APIs reject requests when the session token is absent.

## Node.js 24 and release artifact verification

The runtime is fixed to Node.js 24.x. Electron Forge 7.11.2 was previously observed to exit during finalization under Node.js 24.16.0 without producing an artifact. A clean Node.js 24.14.1 run completed `npm run desktop:release`, produced a fresh ZIP, and passed packaged-app smoke tests; `QA-006` is therefore closed. Node.js 24.14.1 remains the verified packaging combination.

Before running `init.sh`, E2E, live, or Forge, `desktop:release` rejects versions other than `0.2.0` and verifies the immutable `v0.1.3` tag, external read-only archive, and four fixed 0.1.x ZIPs. Historical artifacts are checked again after both success and failure. The script records the start time and previous ZIP mtime; after Forge it requires a refreshed ZIP, extracts it, validates the packaged version and arm64 executable, checks package structure, and prints size and SHA-256. Early Forge exit, stale ZIP reuse, or mismatched metadata fails the command.

Electron 43 no longer downloads its runtime automatically during `npm install`; `desktop:prepare` explicitly invokes the official `install-electron` package. The first package build downloads and caches the matching darwin/arm64 ZIP, while later builds reuse the cache.

The current artifact was generated after `feat-016` on 2026-08-11:

- Path: `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.2.0.zip`
- Size: `354,636,241` bytes
- SHA-256: `5becae36a53e91129a0dbcb93c3f7f5f3197326b2c83df6f10cb8494d8116485`
- Contents: `feat-015`, complete link/paste Mermaid fixes from `feat-013`, and clear-link/back-to-top interactions from `feat-016`

The final Node.js 24.14.1 `desktop:release` passed 27 test files / 317 tests, 60/60 E2E checks, WalkingLabs link/paste live checks 2/2, Forge, fresh ZIP validation, packaged version, and arm64 verification. The WeChat comparison remains a non-blocking diagnostic; the user separately confirmed that a public WeChat article still converted correctly.

## Historical 0.1.3 acceptance

Version 0.1.3 remains an immutable historical baseline. Its packaged-window stop, copy, and download flows passed; clipboard and downloaded content matched; a long WeChat article produced a 7,749,363-byte document with 17,643 non-Base64 characters and 30 embedded images. A second Apple Silicon Mac also passed installation and use acceptance on 2026-07-20.

The unsigned app may be blocked by Gatekeeper. First verify the ZIP SHA-256, then right-click Open in Finder. If macOS reports that the app is damaged, remove only the quarantine attribute:

```bash
xattr -dr com.apple.quarantine "/Applications/MD-Convertor.app"
```

If required, prepend `sudo`. The broader `xattr -cr` also worked during acceptance but removes every extended attribute and is not the recommended default. Never bypass Gatekeeper for an app whose source or checksum is untrusted.

Historical 0.1.3 artifact:

- Path: `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.1.3.zip`
- Size: `239,281,512` bytes
- SHA-256: `66909aa8759ec41fdde875204773958d32b33a2c903e7b4eb0858a50fb1bdf89`

## Common failures

- Missing E2E browsers: run `npx playwright install chromium firefox webkit`.
- Missing Electron or Chromium cache: while online, run `npm run desktop:prepare` and `npx playwright install chromium`.
- `test:live` failure: verify that the WalkingLabs fixture is public and structurally unchanged; do not skip Mermaid security or image assertions. A `test:live:wechat` failure is diagnostic and does not weaken its 95% comparison threshold.
- Forge finalizes without a new ZIP: `desktop:release` fails automatically. Preserve the error and investigate the toolchain before rerunning the complete Node.js 24 release gate.
- Wrong Node.js version: switch to Node.js 24.x; do not use another major version for verification or release evidence.
- E2E reports tracked-file changes: inspect the diff and fix the side effect rather than committing generated changes.
- Another Mac reports that the app is damaged: verify the ZIP checksum and use the precise quarantine command above. If it still cannot launch, stop instead of applying broader security bypasses.
