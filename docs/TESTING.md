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
| `npm run build:extension` | Bundle the browser extension into `extension/dist/` | No |
| `npm run test:extension` | Extension browser smoke + real-extension integration (builds first) | No |

Live comparisons do not save or print webpage bodies. Override live fixtures only through the documented environment variables in the test sources; never commit private or copyrighted page content.

`npm run test:e2e` is the gate, not the inner loop: it builds, then runs every case on three engines with `workers: 1` (the translation engine holds a process-wide task lock, so parallel workers would race it), which is about two minutes. While iterating, run `npx playwright test` directly - it reuses the build already in `.next/standalone` and skips the rebuild - and narrow with `--project=chromium` plus `-g "<case name>"`. Reach for three engines when the change is finished. When proving a timing fix, `-g "<case name>" --project=firefox --repeat-each=N` is the shape that pays: a race that fires in 15% of runs is caught with high confidence in about twenty runs, so repeating hundreds of times buys nothing but wall-clock.

`playwright.config.ts` sets `MOZ_DISABLE_CONTENT_SANDBOX=1` for the run and explains why in place: Firefox gives its content process its own macOS Seatbelt profile, and macOS refuses nested sandboxes, so inside a process-level sandbox Firefox exits with `sandbox_init() failed with error "Operation not permitted"` and every case burns the 30s timeout. It is the only switch that works - the pref equivalent (`security.sandbox.content.level: 0`) kills the process - and it does not weaken the suite, which only loads pages served from `127.0.0.1:3000` out of this repository. The `??=` form keeps an explicit caller value, so the sandbox can be put back with `MOZ_DISABLE_CONTENT_SANDBOX=0 npm run test:e2e`.

Unset `HTTP_PROXY` / `HTTPS_PROXY` (and their lowercase forms) before an e2e run and set `NO_PROXY=127.0.0.1,localhost`: Playwright inherits them, and Firefox additionally follows the system proxy, which has produced `NS_ERROR_PROXY_CONNECTION_REFUSED` failures in the past.

`npm run test:e2e` takes a hash of the tracked working tree before and after the run and fails if it moved. Do not edit tracked files while it runs - that trips the guard and looks like an e2e failure when it is not.

The config keeps `reuseExistingServer: false` on purpose, so the run always starts a server from the build it just made rather than trusting whatever is listening. The cost is that a run that is killed midway leaves its server on port 3000, and the next run then dies in seconds with `http://127.0.0.1:3000/health is already used`. Identify the leftover before touching it - `lsof -nP -iTCP:3000 -sTCP:LISTEN`, then `lsof -p <pid> -a -d cwd` must show `.next/standalone` under this repository - and kill it by that exact PID. Never pattern-kill.

Compare layout rectangles with `rectsInOneFrame` from `e2e/geometry.ts`, never by calling `boundingBox()` twice. Each `boundingBox()` call is its own round trip, so anything that moves the page between the two calls is measured as a broken layout. Scrolling is the usual culprit: `fill()` scrolls its field into view, that scroll can still be landing when the call returns, and the two samples then disagree by the scroll delta. On the settings Base URL row this reproduced in 15% of firefox runs as a convincing 131px "misalignment" (`urlY` 821 via two calls, 690 via one, `scrollY` 132) even though the elements never moved relative to each other. Reading every rectangle inside one `evaluate` call closes that window, because the browser cannot run a scroll or a re-render between two `getBoundingClientRect()` calls in the same task. Waiting on `document.fonts.ready` does not help here - it runs before the `fill()` that triggers the scroll.

Translation tests need no network and no key: `scripts/start-e2e-server.mjs` sets `MD_CONVERTOR_TEST_PROVIDER=1`, which makes `/api/translate/*` use an in-process stub model. The branch does not exist when the flag is unset, so a production run still returns 409 `TRANSLATE_NOT_CONFIGURED` without a configured model. Keep the flag out of any production or release command.

## Coverage

The baseline covers:

- URL, DNS, redirect, SSRF, proxy, request/byte budgets, cancellation, and timeout behavior
- Readability extraction, body fallback, WeChat validation detection, and Markdown golden output
- standard and multi-node code blocks, tables, lists, links, and Mermaid preservation
- rich-text semantic gating, sanitization, HTML/plain-text fallback, and 5 MiB request limits
- image formats, lazy sources, Data URI validation, 8 MiB source limit, 30-image limit, optimization, and 20 MiB output degradation
- copy, download, clear actions, stop, statistics, responsive layout, and Back to Top
- settings contract and `settings.json` storage, key encryption and the preload bridge, provider endpoint policy, model listing, local CLI scan/models, language presets
- translation segmentation and reassembly, prompt contract and parsing, provider adapters, limits and error codes, language-ratio decisions, and non-target byte fidelity
- the translation task budget: `translateTaskTimeoutMs(batchCount)` returns `max(120s, batches × 180s + 30s)`, and both endpoints size their deadline from the real batch count (a long article of many short paragraphs is not cut off at a fixed 120s)
- the translation checkbox, 原文 / 译文 tabs, copy and download per tab, progress, cancel, retry, and the ratio dialog

`vitest.config.ts` limits coverage to `src/lib/**/*.ts` plus the convert and translate routes, excludes test files and `src/types/**`, and sets per-file thresholds. Every `src/lib/translate/**` module has its own threshold (95/90/100/95, or 90/75/100/90 for `segment.ts`). Coverage is currently 95.71% statements over 79 files / 1067 tests (includes the extension layers 1–2; the desktop-only figure was 95.28% over 64 files / 866 tests).

E2E runs against the production standalone service and fails if tracked files change. `playwright.config.ts` sets `workers: 1` because the translation engine holds one process-wide task slot; parallel workers would collide with 429 `TRANSLATE_BUSY`.

The specs that convert fulfil `**/api/convert` or `**/api/convert-paste` inside the browser, so `e2e/convert-api.spec.ts` is the only place that reaches the real route handlers: it posts a loopback link and expects 403 `PRIVATE_TARGET` (offline, but only reachable once the route has loaded its Playwright import) and extracts real pasted content through the paste route. `next.config.ts` keeps that import loadable by tracing `node_modules/playwright-core/browsers.json`, the data file Next.js otherwise omits; without it a standalone server answers 500 for every link, which packaging used to hide by re-copying the whole package.

## Browser Extension

The browser extension (`extension/`, Chromium MV3) is a separate product from the desktop app. The desktop artifact is still only built and accepted for `darwin/arm64`; the extension is accepted in Chromium and produces no desktop artifact, so it stays out of `desktop:release`. Editing only `extension/` does not bump the version in `package.json` either - the extension version is its own, in `extension/manifest.json`.

Five layers, and only the first two are part of `./init.sh`:

| Layer | What it proves | Command | In `init.sh` |
|---|---|---|---|
| 1 pure unit | extraction, sanitizing, filenames, image planning, reference rewriting (vitest + jsdom) | `npm test` | Yes |
| 2 stubbed orchestration | service-worker `run(tabId)` against a hand-written fake `chrome.*` | `npm test` | Yes |
| 3 in-browser smoke | the esbuild bundle converts a real article in a real page (proves no Node-only dependency survived bundling) | `npm run test:extension` | No |
| 4 real extension integration | a real MV3 extension loaded in Chromium writes real files to disk through a local fixture site | `npm run test:extension` | No |
| 5 manual acceptance | toolbar click and `activeTab` consent in real Chrome (below) | human checklist | No |

`npm run test:extension` runs `build:extension` first. `build:extension` writes the gitignored `extension/dist/` (exactly `manifest.json`, `content.js`, `worker.js`) plus `extension/dist-test/core.js` for the smoke layer. Run the suite with proxy variables unset, as with `test:e2e` - it drives a real browser, and the fixture site is loopback-only. Layers 3 and 4 use their own `playwright.extension.config.ts` (`testDir: ./extension/tests`, Chromium only, `workers: 1`, no `webServer`); the desktop `playwright.config.ts` and `scripts/run-e2e.mjs` are not involved.

Measured 2026-09-24: 15 passed in about four seconds in an agent shell with no sandbox flags. `MD_CONVERTOR_EXTENSION_CHROMIUM_ARGS` (comma-separated) still exists as an escape hatch - `--no-sandbox,--disable-gpu` is needed by the *packaged Electron app* when it runs inside a process-level sandbox, not by Playwright's own Chromium.

Traps worth knowing before changing this suite:

- **Never pass `downloadsPath` to the extension context.** Playwright always sends CDP `Browser.setDownloadBehavior { behavior: "allowAndName" }`, which saves every download as a bare `<guid>` and drops the requested subdirectory. The harness works around it by pre-writing `download.default_directory` into the profile's `Default/Preferences` and sending `behavior: "default"` itself once the context is up (see `extension/tests/harness.ts`). Assertions read the real files, not `chrome.downloads.search`.
- **`chrome.downloads.download()` resolves when the download starts, not when it finishes**, and `run()` does not wait for the markdown. Reading the file as soon as its name appears has produced empty or truncated content roughly once in ten runs. Use `waitForDownloadComplete(worker, name)`, which polls `search({})` until `state === "complete"`. Images are safe: `waitForImage` resolves before `run()` returns.
- **`playwright.extension.config.ts` keeps `testMatch: "**/*.spec.ts"`** because vitest files (for example `extension-build.test.mjs`) live in the same directory; a looser pattern hands them to Playwright, which then fails with `Vitest failed to access its internal state`.
- **Fixture paths inside a spec resolve from the spec's directory**, not the repository root: use `path.resolve(__dirname, "../..")`.
- **A fully failed article leaves an empty `<title>.images/` directory.** Chrome creates the target directory before the request, an interrupted download removes only the partial file, and `chrome.downloads` cannot delete a directory. The integration spec accepts "absent or empty" rather than calling it a defect.

The fixture site is `extension/tests/fixtures/server.ts` (unit-tested by `server.test.ts`, which layer 1 collects): `/article` (repeated image plus a relative-path image), `/article-cookie` (its image needs the `md-session` cookie), `/article-missing` (a 404 image), `/article-special` (title containing `/` and `:`), `/no-article`, and `/img/*` plus `/protected/secret.png`, which answers 403 without the cookie. It listens on an ephemeral port and hands the origin back to the spec.

Toolbar click and `activeTab` consent cannot be automated - Playwright cannot click browser chrome. Layer 4 therefore copies the built extension to a temporary directory and adds `host_permissions` to that copy only (`copyExtensionWithHostPermission`), then calls the service worker directly. That leaves the manual checklist below as the only evidence for the real click path.

Manual acceptance (run in Terminal, not from a sandboxed agent shell):

1. Open `chrome://extensions`, enable developer mode, choose "Load unpacked", and select `extension/dist`.
2. On an ordinary article, click the toolbar icon: a `<title>.md` plus `<title>.images/` appear in the download directory with the desktop app not running, and the images render in Typora or Obsidian.
3. Repeat on an article that only appears when signed in and whose images need the session: the images should still download.
4. Click the same article twice: the second export overwrites (no `(1)` suffix) and the markdown and its image directory stay paired.
5. One article with 30 or more images: watch for interrupted downloads (MV3 service-worker suspension).
6. Note whether "Ask where to save each file" is enabled; one prompt per image is expected behavior when it is.

This checklist was run and passed on 2026-09-24 (all six items; item 5 used a throwaway 40-image page, and all 40 images landed with no MV3 interruption). The record lives in [`features/browser-extension/S3-e2e-and-acceptance.md`](features/browser-extension/S3-e2e-and-acceptance.md) under 「人工验收记录（T3.4）」. Re-run it whenever the extension's manifest, service worker, or download path changes.

## Release Guard

`npm run desktop:release` requires:

- package version exactly `0.3.6`
- Node.js 24.x, but not 24.16.0: that patch stalls inside `yauzl` while unpacking the Electron archive, so `electron-forge make` never produces a ZIP. Node 24.14.1 and 24.15.0 both pass the full gate
- the historical archive set: every manifest ZIP that still exists must keep its fixed SHA-256, and no unlisted release ZIP may appear in `~/Downloads/MD-Convertor-archive/releases/`
- a ZIP created during the current run
- packaged version `0.3.6`
- an arm64 executable and complete application bundle

The guard rechecks historical artifacts on both success and failure. A Forge command that exits without a new ZIP is a failure.

Desktop preparation has an integration regression that requires the prepared server to omit `node_modules/electron` while retaining Playwright, Playwright Core, Sharp's arm64 packages, and the bundled Chromium Headless Shell. A fresh unpacked app should contain only the outer Electron runtime. The `0.3.3` round (`feat-034`, 2026-09-20) introduced that pruning: the distributable ZIP fell from `358,726,788` to `232,947,408` bytes (120 MiB smaller) with no runtime change, verified by the full gate plus a packaged smoke test on the installed build.

The 0.1.3 read-only archive copy and the 0.1.0–0.2.0 ZIPs were lost from this Mac and cannot be restored, so the guard retires an absent entry: it prints a `Historical Archive Notice` for each missing file and continues. Anything that does exist is still hash-checked, a writable or tampered file still aborts the run, and unknown release ZIPs are still rejected. `0.2.1` was re-downloaded from its GitHub release on 2026-09-18 and matched its recorded SHA-256 byte for byte, so that entry is enforced again. The `v0.1.3` source tag remains a hard precondition.

The `0.3.0` gate ran on 2026-09-18 and passed end to end (baseline, three-engine E2E, live, packaging).

The `0.3.1` gate ran on 2026-09-20 and passed the same way.

The `0.3.2` gate, also on 2026-09-20, added one small fix: the packaged app starts its local server from the bundled `MD-Convertor Helper` instead of the app's own executable (`electron/server-binary.mjs`, three unit tests), which removes the extra bouncing `exec` icon the Dock showed while the app was running.

The `0.3.5` gate ran on 2026-09-21 and passed end to end. It carries the visual refresh (`feat-039`, CSS only): the accent tokens moved from green to navy (`#176b5d` → `#2a395c`), the ten hand-tuned interface weights collapsed into one `--weight-ui` token, and `-webkit-font-smoothing: antialiased` was switched on. `tests/palette.test.ts` fails on any colour literal outside the token whitelist, and `e2e/theme.spec.ts` reads the computed styles on both pages, so a stale palette or a stray weight cannot pass silently.

The `0.3.6` gate ran on 2026-09-22 and passed end to end. It carries `feat-041`: a default folder for downloaded Markdown (the Output card in Settings, and a `write through the desktop bridge / fall back to the browser download` fork on 下载), plus that feature's T3.0 packaging narrowing (the archive keeps only `package.json` and `electron/`, 253 entries → 10). Counts: `./init.sh` 68 files / 999 tests, three-engine E2E 239 passed / 4 skipped, live 2 passed. See [`features/default-save-path/S3-release.md`](features/default-save-path/S3-release.md).

The `0.3.4` gate ran on 2026-09-21 and passed end to end. It carries `feat-036` (a "use paste instead" hint under a failed link fetch), `feat-037` (the cloud card's「清除」resets the whole card) and the application icon: `assets/icon.icns` now replaces Electron's default icon and `assets/` is excluded from the asar. `tests/app-icon.test.ts` guards the icon (1024px transparent master, required icns types, the `forge.config.cjs` wiring trap, and the exclusion) and `electron.icns` inside the bundle was compared with the repository file by SHA-256.

A later fix for long-article translation timeouts (`feat-024`, 2026-09-18) changed the task budget to scale with the batch count. A later round (`feat-029`, 2026-09-18) made a cloud provider's four fields mandatory to save, let the settings page pull models from an unsaved draft without writing anything, and replaced the saved key in its input box with an eight-dot placeholder. It is covered by unit tests for the form rules and the draft model route (`src/lib/settings/provider-form.test.ts`, `src/app/api/provider/models/route.test.ts`) plus three new settings E2E cases and three rewritten ones (the old「拉取模型先保存草稿」expectations no longer hold). Another round raised the per-call ceiling from 60s to 180s (`feat-027`) and fixed a timeout that was reported as an unreadable answer, and it removed the「当前生效」mode badge (`feat-028`). All of it was verified by unit tests, a full `./init.sh` baseline, a three-engine E2E run, and a real-machine probe against the user's cloud provider (a 121-block document that used to fail at the 60s ceiling now returns 200). The version decision landed on `0.3.1`: `package.json`, the lock file, `feature_list.json` and the release guard all read `0.3.1` (the guard test moved to RED first, then to 29 passing). A further round (`feat-031`, 2026-09-20) raised `next` to 16.3.5 and `sharp` to 0.35.4 so `npm audit --omit=dev` reports no production advisories, dropped the gear glyph from the header, renamed both convert buttons to 「转换」, aligned the rich-text convert button's right edge with the paste box above it, and made the key box read-only while a key is stored. The last round (`feat-032`, 2026-09-20) dropped the green「MD」square and set the wordmark in Michroma, vendoring the font and its OFL licence under `public/fonts/` and loading it with `next/font/local`; `tests/brand-font.test.ts` guards the two files, the E2E brand case compares the served woff2 with the repository file by SHA-256, and the build was re-run with all network access denied (`sandbox-exec … (deny network*) npm run build`, exit 0) to prove it no longer reaches Google. The artifact recorded below is the pre-fix `0.3.0` build, kept as history; everything from `feat-024` onwards shipped in the `0.3.1`–`0.3.6` artifacts.

## Gated Artifact (0.3.6)

- Path: `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.6.zip`
- Size: `235,956,668` bytes
- SHA-256: `9b89d55c5c3cbf63519d56136f63e14170de26489623ea149c0a1daf0569f351`
- Package: version `0.3.6`, arm64, macOS 12.0+
- Automated evidence: 68 files / 999 tests, 95.28% statements (86.64% branches, 98.34% functions), three-engine E2E 239 passed / 4 skipped, live 2/2
- Archive scope: the asar holds **10 entries / `35,261` bytes**, down from 253 entries / `2,670,300` bytes — `package.json` plus the eight `electron/` runtime modules. `tests/forge-package-scope.test.ts` guards the allowlist in both directions.
- Default-folder feature in the bundle: the archive carries both IPC channels (`md-convertor:output:select-directory`, `md-convertor:output:save-file`), and the traced server carries the settings-page copy, the 使用默认目录 label and the 已保存到 result string.
- Packaged smoke: preload bridge and runtime secret round trip passed; the user's `settings.json` / `secrets.json` were byte-identical before and after
- Published: [GitHub Release `v0.3.6`](https://github.com/haohaiHuang/MD-Convertor/releases/tag/v0.3.6)
- Signing: not Developer ID signed or notarized, so the artifact is suitable for personal testing only

## Historical Artifact (0.3.5)

- Path: `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.5.zip`
- Size: `237,335,837` bytes
- SHA-256: `313bbbc341c94da0a5ca92f668f2df06cea9f734e47d7af65880500aa192d45f`
- Package: version `0.3.5`, arm64, macOS 12.0+
- Automated evidence: 64 files / 866 tests, 95.28% statements, three-engine E2E 206 passed / 4 skipped, live 2/2
- Visual refresh in the bundle: the served CSS carries `--accent:#2a395c`, `--accent-soft:#eef1f6`, `--muted:#565e6b`, `--paper:#f9fafb`, `--weight-body:400`, `--weight-ui:400` and `font-smoothing:antialiased`, with zero occurrences of the retired palette (`176b5d`, `0f5147`, `dcece7`, `202a28`). The installed build was re-read over CDP: page background `rgb(249, 250, 251)`, «转换» and «设置» both at weight `400`.
- Icon: unchanged from `0.3.4`; `Contents/Resources/electron.icns` still hashes to `e8cbc7e7…48bf`
- Bundled runtime: still 0 entries under `server/node_modules/electron`; no `/assets` entries in the asar
- Packaged smoke: preload bridge and runtime secret round trip passed on the installed build
- Published: [GitHub Release `v0.3.5`](https://github.com/haohaiHuang/MD-Convertor/releases/tag/v0.3.5)
- Signing: not Developer ID signed or notarized, so the artifact is suitable for personal testing only

## Historical Artifact (0.3.4)

- Path: `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.4.zip`
- Size: `237,272,966` bytes
- SHA-256: `6910120e004170cc1ff91d29315f883226a852cd012c3e9a1e335e6056b42704`
- Package: version `0.3.4`, arm64, macOS 12.0+
- Automated evidence: 63 files / 863 tests, 95.28% statements, three-engine E2E 187 passed / 2 skipped, live 2/2
- Icon: `assets/icon.icns` (`972,218` bytes, `e8cbc7e7…48bf`) and `assets/icon-1024.png`; the bundle copy `Contents/Resources/electron.icns` hashes identically to the repository file
- Bundled runtime: still 0 entries under `server/node_modules/electron`; the asar holds 230 entries and none under `/assets`
- Packaged smoke: preload bridge and runtime secret round trip passed on the installed build
- Published: [GitHub Release `v0.3.4`](https://github.com/haohaiHuang/MD-Convertor/releases/tag/v0.3.4) (tag `e251267`) — server-side asset size matches the local artifact byte for byte
- Signing: not Developer ID signed or notarized, so the artifact is suitable for personal testing only

The size grew by about 4.3 MB over `0.3.3` for reasons unrelated to the icon change: this build's Next.js output tracing picked up the optional `@img/sharp-wasm32` and `@emnapi/runtime` fallback packages plus three build-hash static files. The icon itself did not grow the app: `electron.icns` went from Electron's 272 KB default to a 972 KB custom one, and `assets/` no longer ships inside the asar.

## Historical Artifact (0.3.3)

- Path: `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.3.zip` (no longer present under `out/`; GitHub release asset and `/tmp/s19/` copy)
- Size: `232,947,408` bytes
- SHA-256: `1bf807dfe294860c24345efe5caf2b0fcbd54f88476df7085c9bd03b47b37a72`
- Package: version `0.3.3`, arm64, macOS 12.0+
- Automated evidence: 62 files / 859 tests, 95.28% statements, three-engine E2E 178 passed / 2 skipped, live 2/2
- Packaged smoke: preload bridge and runtime secret round trip passed on the installed build (unpacked app 539 MB, down from 843 MB)
- Published: [GitHub Release `v0.3.3`](https://github.com/haohaiHuang/MD-Convertor/releases/tag/v0.3.3), tagged at `3897cd1` — the commit whose sources this ZIP was built from (server-side asset size and SHA-256 match the local artifact byte for byte)
- Signing: not Developer ID signed or notarized, so the artifact is suitable for personal testing only

## Historical Artifact (0.3.2)

- Path: `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.2.zip`
- Size: `358,726,788` bytes
- SHA-256: `8fb7a93f33a07bb03b0b8558df4ff0c2abe40a14eee13fd9dc0348fedcc7f1ba`
- Package: version `0.3.2`, arm64, macOS 12.0+
- Automated evidence: 62 files / 858 tests, 95.28% statements, three-engine E2E 178 passed / 2 skipped, live 2/2
- Published: [GitHub Release `v0.3.2`](https://github.com/haohaiHuang/MD-Convertor/releases/tag/v0.3.2), tagged at `1c3ed80` — the commit whose sources this ZIP was built from (asset size matches byte for byte)
- Signing: not Developer ID signed or notarized, so the artifact is suitable for personal testing only

## Historical Artifact (0.3.1)

- Path: `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.1.zip`
- Size: `358,723,706` bytes
- SHA-256: `c7411c587b3842a76f79118ecdc6d061993a0a99c98e4801c14ff947f10e161b`
- Package: version `0.3.1`, arm64, macOS 12.0+
- Automated evidence: 61 files / 855 tests, 95.28% statements, three-engine E2E 178 passed / 2 skipped, live 2/2
- Published: [GitHub Release `v0.3.1`](https://github.com/haohaiHuang/MD-Convertor/releases/tag/v0.3.1), tagged at `af7f6db` — the commit whose sources this ZIP was built from

## Historical Artifact (0.3.0, kept as history)

- Path: `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.0.zip`
- Size: `358,562,540` bytes
- SHA-256: `2a0e236e97e51d97fd24c7002a923ef5703ad8245234531f2eb3aa1350c81147`
- Package: version `0.3.0`, arm64, macOS 12.0+
- Automated evidence: 58 files / 835 tests, 95.25% statements, three-engine E2E 142 passed / 2 skipped, live 2/2
- Packaged smoke: preload bridge and runtime secret round trip passed
- Signing: not Developer ID signed or notarized, so the artifact is suitable for personal testing only

## Historical Anchor (0.2.1)

- Path: `~/Downloads/MD-Convertor-archive/releases/MD-Convertor-darwin-arm64-0.2.1.zip`
- Size: `354,635,067` bytes
- SHA-256: `32c1d96af58a7701e6d2fe0bf619be0f8f224803355c6ef63aad43c85569463e`
- Package: version `0.2.1`, arm64, macOS 12.0+
- Automated evidence: 322 tests, 60/60 three-engine E2E, stable live 2/2
- WeChat diagnostic: 12/12 code blocks and 279 lines matched in memory

## Packaged Smoke Test

Run the packaged app with the smoke environment variables to verify the preload bridge and the provider key path without manual clicking:

```bash
ELECTRON_SMOKE_TEST=1 ELECTRON_SMOKE_TEST_SECRETS=1 \
  out/MD-Convertor-darwin-arm64/MD-Convertor.app/Contents/MacOS/MD-Convertor
```

- `ELECTRON_SMOKE_TEST=1` checks that `window.mdConvertor.secrets` exists and that `safeStorage` reports encryption as available.
- `ELECTRON_SMOKE_TEST_SECRETS=1` additionally proves the key path: a provider without any key returns 409 `TRANSLATE_NOT_CONFIGURED`, saving a key makes the running server reach the endpoint (502 `TRANSLATE_PROVIDER_ERROR` against the test address) without a restart, and removing the key returns to 409. The smoke removes the key and restores settings before exiting. No environment variable can supply a provider key any more, so the smoke sets one through the bridge only.

Back up `settings.json` and `secrets.json` (default `~/Library/Application Support/MD-Convertor/`) and record their md5 before running the smoke against a real installation; the smoke is supposed to leave them byte-identical, and an md5 mismatch is the signal that it did not.

### Two traps when the smoke is launched from an agent shell

Both were hit on 2026-09-22 (T3.4 of `feat-041`) and neither is a defect in the artifact:

- **`ELECTRON_RUN_AS_NODE` is inherited.** A shell started from an Electron host (WorkBuddy, VS Code, and others) exports `ELECTRON_RUN_AS_NODE=1`, and an Electron binary that sees it starts as plain Node.js instead of as an app. The symptom is not an error: the log holds `Welcome to Node.js v24.x` and a `>` prompt, the process waits on stdin forever, and it looks like a hang. Launch the smoke through `env -u ELECTRON_RUN_AS_NODE …` (and `NODE_OPTIONS=` to drop any host-injected `--require`).
- **Chromium cannot sandbox itself inside another sandbox.** Where the shell already runs under macOS seatbelt — the WorkBuddy Bash tool does — Chromium's helper processes fail with `sandbox initialization failed: Operation not permitted`, the GPU process dies (`exit_code=6`), and the run ends on `FATAL: GPU process isn't usable. Goodbye.` (exit 133). This is the same root cause that makes Playwright's Firefox unable to run there. It is an artifact of the executing environment, not of the build: the same bundle runs normally when launched from Finder. Inside such a shell the smoke can still produce its functional evidence with `--no-sandbox --disable-gpu`, which yields `exit 0` and both `Preload bridge smoke passed` and `Runtime secret smoke passed`; for the canonical run — Chromium's sandbox on, exactly as a user gets it — open Terminal and run the command above there, where no outer sandbox exists.

## Verifying Package Contents

Read the archive instead of extracting it, and never extract inside the repository (see the gotcha below):

```bash
APP=out/MD-Convertor-darwin-arm64/MD-Convertor.app
A="$APP/Contents/Resources/app.asar"
npx asar list "$A" | grep -c node_modules/electron    # 0 after the 0.3.3 trim
npx asar list "$A" | grep -c '^/\.next'              # 0: the built frontend is not in the asar
npx asar list "$A" | grep -c '^/docs'                # 0 after T3.0: only package.json + /electron
LC_ALL=C grep -c "<a string from the change under test>" "$A"
```

The archive holds **only what the runtime reads**: `package.json` (Electron resolves `main` from it) and `/electron` (the Electron-side modules, including the preload). Everything else in the repository root — `src`, `docs`, `e2e`, `tests`, `scripts`, `.workbuddy`, `AGENTS.md`, `CHANGELOG*`, `PROGRESS.md`, `session-handoff.md`, `feature_list.json`, `README*`, `init.sh`, `public`, and the build/lint/test configs — is excluded on purpose (`forge.config.cjs`, task T3.0 of `docs/features/default-save-path/S3-release.md`). `tests/forge-package-scope.test.ts` guards that list in both directions, so a future edit cannot quietly drop `electron/` out of the package.

Two copies of the frontend exist and neither is in the asar: the built frontend and its server `node_modules` live under `Contents/Resources/server/`, loaded through `extraResource`; the repository-root `public/` is copied there by `scripts/prepare-desktop.mjs`. So a match (or a miss) in the asar proves nothing about the frontend, and a miss there does not mean the change is not packaged. Check each layer for what it actually serves:

```bash
npx asar list "$A" | grep electron/main.mjs              # asar: the Electron entry module
npx asar list "$A" | grep -c '^/src'                     # 0: sources are not in the asar
strings "$A" | grep -c resolveServerBinary              # asar: ASCII strings in the Electron code
grep -rl "<a string from the change under test>" "$APP/Contents/Resources/server/.next" | head
test -f "$APP/Contents/Resources/server/node_modules/playwright-core/browsers.json" && echo present
```

Two traps while searching the asar:

- macOS BSD grep returns **0 for multibyte patterns in a binary file** unless `LC_ALL=C` is set (`grep -c "中文串" app.asar` looks like a clean miss). `strings` has the same blind spot for any non-ASCII code. For real confidence, extract to `/tmp` and grep the tree.
- `npx asar extract-file <asar> <path> /tmp/out` ignores the third argument, so the file lands in the current directory under its basename (`page.tsx`) and stdout stays empty. Extract to `/tmp`, or use the read-only commands above. Details: `~/.pi/agent/TROUBLESHOOTING.md` §4.

## Manual Acceptance

1. Extract the ZIP and move `MD-Convertor.app` to Applications.
2. Verify the checksum before bypassing any Gatekeeper warning.
3. Launch the app and test one public link plus one rich-text paste.
4. Confirm clear, stop, copy, download, statistics, embedded images, code blocks, Mermaid behavior, and Back to Top.
5. Open the downloaded Markdown in the intended reader.

The package is unsigned and not notarized. It is approved only for personal testing until an Apple Developer ID signing and notarization flow is configured.
