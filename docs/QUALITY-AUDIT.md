# Quality Audit

## Current Verdict

Version `0.3.6` passed its own release gate on 2026-09-22 - baseline, three-browser E2E, live, packaging, and artifact verification all passed - producing `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.6.zip`, then published as GitHub Release `v0.3.6`. It carries `feat-041` (a default folder for downloaded Markdown: the Output card in Settings, and a 下载 button that writes straight into that folder or falls back to the system save dialog and names the reason) plus that feature's packaging narrowing, which cut the packaged archive from 253 entries / `2,670,300` bytes to 10 entries / `35,261` bytes. `0.3.5` passed its own gate on 2026-09-21 and stays as history. Version `0.3.4` passed its own release gate on 2026-09-21 - baseline, three-browser E2E, live, packaging, and artifact verification all passed - producing `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.4.zip`, then published as GitHub Release `v0.3.4`. It carries the `feat-036` link-failure paste hint, the `feat-037` cloud-card reset, and the application icon (`assets/icon.icns` replacing Electron's default, with `assets/` excluded from the asar). `0.3.3` passed its own gate on 2026-09-20 and stays as history (`out/` no longer holds its ZIP); `0.3.2` and `0.3.1` passed the same gate earlier that day and were published as GitHub Releases `v0.3.2` (tag `1c3ed80`) and `v0.3.1` (tag `af7f6db`). The `0.3.0` gate ran end to end on 2026-09-18 and that artifact predates `feat-024` onward; it is kept as history. The historical-archive precondition was retired for the 0.1.0-0.2.0 ZIPs and the 0.1.3 read-only copy, which were lost from this Mac and cannot be restored; every archive that still exists is hash-checked exactly as before, and `0.2.1` was re-downloaded from its GitHub release and matched its recorded SHA-256 byte for byte. The `v0.1.3` source tag remains a hard precondition. QA-012 (the advisory set found in `next` and `sharp`) is resolved: as of 2026-09-20 `next` is 16.3.5 and `sharp` is 0.35.4, and `npm audit --omit=dev` reports no production advisories. The remaining release constraint is the absence of Developer ID signing and notarization, which the user decided on 2026-09-20 not to pursue: every artifact stays personal-testing only, and the `v0.3.1`-`v0.3.6` release notes say so plainly.

## Post-0.3.0 Fix Detail (feat-024, 2026-09-18)

A real-machine report ("翻译任务超时" on a 9,100-character article) exposed the fixed 120s whole-task budget. Batching counts blocks (≤20) as well as characters (≤8,000), so an article made of many short paragraphs needs far more batches than its size suggests — the measured `pi` cost was not the problem (1–2s for a small prompt, 7s for an 8,000-character batch with `--model deepseek-flash`).

| Check | Result |
|---|---|
| Fix | `translateTaskTimeoutMs(batchCount) = max(120s, batches × 180s + 30s)`; both endpoints size the deadline from the real batch count |
| Unchanged | 200,000-character ceiling, 429 lock, 499 cancel mapping, 504 timeout mapping. The per-call ceiling went 60s → 180s after the 0.3.0 build (QA-013) |
| Tests | 59 files / 839 tests, 95.27% statements, lint + `tsc --noEmit` + production build clean (`./init.sh` exit 0) |
| Real machine | the same article re-translated successfully from `out/MD-Convertor-darwin-arm64/MD-Convertor.app`; the server log has no `TRANSLATE_TIMEOUT` line |
| Release gate | **not re-run in that round**: the recorded 0.3.0 ZIP predates the fix. The gate ran later, as part of `0.3.1`, and passed on 2026-09-20 |
| Residual risk | more batches still means more repeated CLI start-up cost; raising `TRANSLATE_BATCH_MAX_BLOCKS` is the first candidate if a future article is still slow |

## Post-0.3.0 Rounds (feat-024 - feat-034, 2026-09-18 to 2026-09-20)

Everything from `feat-024` through `feat-034` shipped in the gated `0.3.1`, `0.3.2` and `0.3.3` artifacts; `feat-035` followed on top of the `0.3.3` tag, and `feat-036`, `feat-037` plus the application icon are part of the gated `0.3.4` artifact. It is unit-tested, baseline-verified, three-engine E2E verified, and (for the translation and UI rounds) exercised on the packaged app by the user.

| Round | Change | Evidence |
|---|---|---|
| feat-024 | translation task budget scales with the real batch count | `src/lib/translate/limits.test.ts`, `run.test.ts`; real article re-translated |
| feat-025 / feat-026 | settings-page UI fixes, per-provider cards, draft model pull | settings E2E rewritten + real-machine screenshots |
| feat-027 / feat-028 | per-call ceiling 60s -> 180s, aborted body read reported as a timeout, 「当前生效」badge removed | unit tests + a 121-block real-machine document returning 200 |
| feat-029 / feat-030 | four mandatory provider fields, read-only saved-key box, single cloud card | `provider-form.test.ts`, provider/models route tests, settings E2E |
| feat-031 | version 0.3.1, `next` 16.3.5 + `sharp` 0.35.4, header/button layout, read-only key box | release-guard tests 29 passed, `npm audit --omit=dev` clean, home E2E layout assertions |
| feat-032 | green「MD」square dropped, wordmark set in Michroma, font + OFL licence vendored under `public/fonts/` and loaded with `next/font/local` | `tests/brand-font.test.ts`, E2E brand case comparing the served woff2 with the repository file by SHA-256, build re-run with all network denied |
| feat-033 | the local server runs from the bundled `MD-Convertor Helper` instead of the app executable, so the Dock no longer shows a second bouncing `exec` tile | `electron/server-binary.test.mjs` (3 cases), `lsappinfo` shows the child as `type="UIElement"` on the Helper bundle, before/after Dock screenshots |
| feat-034 | the bundled server no longer carries a second Electron runtime, so the distributable ZIP drops from 358,726,788 to 232,947,408 bytes and the unpacked app from 843 MB to 539 MB | `scripts/prepare-desktop.test.mjs` (staged copy removed, source and project copies kept), ZIP audit (0 entries under `server/node_modules/electron`, Playwright / Playwright Core / Sharp / headless shell retained), packaged smoke test |
| feat-036 | a failed link fetch now suggests switching to rich-text paste, with a button that swaps tabs and moves focus | `e2e/home.spec.ts` (new case; the invalid-paste case asserts the hint stays absent), packaged-app probe |
| feat-037 | the cloud card's clearing action resets the whole card: it deletes the stored key, clears the draft, and writes `providers: []` + `activeProviderId: null` | `e2e/settings.spec.ts` (header layout by `boundingBox()`, cleared-state assertions, PUT body), packaged-app probe |
| app icon | `assets/icon.icns` replaces Electron's default icon and `assets/` is excluded from the asar, so the app no longer wears the generic Electron icon | `tests/app-icon.test.ts` (4 cases: 1024px transparent master, required icns types, the `forge.config.cjs` wiring trap, the ignore pattern), bundle `electron.icns` compared with the repository file by SHA-256, asar shows 0 `/assets` entries |
| Gate | `0.3.1` gated on 2026-09-20 (exit 0) and published as GitHub Release `v0.3.1`; `0.3.2` gated on 2026-09-20 (exit 0) and published as GitHub Release `v0.3.2`; `0.3.3` gated on 2026-09-20 (exit 0) and published as GitHub Release `v0.3.3`; `0.3.4` gated on 2026-09-21 (exit 0) and published as GitHub Release `v0.3.4` | `npm run desktop:release`, ZIP size and SHA-256 recorded in `docs/TESTING.md` |

## Verified Release (0.3.6)

| Check | Result |
|---|---|
| Node.js | 24.14.1 (24.16.0 stalls inside `yauzl` while unpacking the Electron archive, so `electron-forge make` never produces a ZIP) |
| Baseline | lint, typecheck, coverage, production build passed |
| Tests | 68 files / 999 tests passed, 95.28% statements (86.64% branches, 98.34% functions) |
| Browser E2E | Chromium, Firefox, WebKit — 239 passed / 4 skipped |
| Stable live gate | WalkingLabs link/paste — 2/2 passed |
| Production dependency audit | no production advisories (QA-012 closed) |
| Package | 0.3.6, arm64, macOS 12.0+ |
| ZIP bytes | 235,956,668 |
| ZIP SHA-256 | `9b89d55c5c3cbf63519d56136f63e14170de26489623ea149c0a1daf0569f351` |
| Archive scope | asar **10 entries / `35,261` bytes** (`package.json` + the eight `electron/` modules), down from 253 entries; `tests/forge-package-scope.test.ts` guards the allowlist both ways |
| Feature in the bundle | both IPC channels present in the asar, and the traced server carries the settings copy, the 使用默认目录 label and the 已保存到 result string |
| Bundled runtime | 0 entries under `server/node_modules/electron` |
| Real machine | installed to `/Applications/MD-Convertor.app` (546 MB, replacing `0.3.5`, which is kept at `~/Downloads/MD-Convertor-archive/installed-apps/`); packaged smoke passed; the user's `settings.json` / `secrets.json` md5 identical before and after |
| Published | GitHub Release [`v0.3.6`](https://github.com/haohaiHuang/MD-Convertor/releases/tag/v0.3.6), tag `3578822` (the wrap-up commit), marked **Latest**; asset `MD-Convertor-darwin-arm64-0.3.6.zip` uploaded at `235,956,668` bytes, and the server-side digest the API reports is `sha256:9b89d55c5c3cbf63519d56136f63e14170de26489623ea149c0a1daf0569f351` — byte-for-byte the local ZIP |
| Signing | not signed, not notarized |

The ZIP is `1,379,169` bytes (1.32 MiB) smaller than `0.3.5`, and the unpacked app is unchanged within rounding (`du -sm` reports 549 MB for the archived `0.3.5` bundle and 547 MB for `0.3.6`). `feat-041`'s own packaging change removes only asar entries, so both numbers come from ordinary build-to-build variation.

## Verified Release (0.3.4)

| Check | Result |
|---|---|
| Node.js | 24.15.0 (24.16.0 stalls inside `yauzl` while unpacking the Electron archive, so `electron-forge make` never produces a ZIP) |
| Baseline | lint, typecheck, coverage, production build passed |
| Tests | 63 files / 863 tests passed, 95.28% statements |
| Browser E2E | Chromium, Firefox, WebKit — 187 passed / 2 skipped |
| Stable live gate | WalkingLabs link/paste — 2/2 passed |
| Production dependency audit | no production advisories (QA-012 closed) |
| Package | 0.3.4, arm64, macOS 12.0+ |
| ZIP bytes | 237,272,966 |
| ZIP SHA-256 | `6910120e004170cc1ff91d29315f883226a852cd012c3e9a1e335e6056b42704` |
| Icon | `assets/icon.icns` 972,218 bytes `e8cbc7e7…48bf`; bundle `electron.icns` hashes identically; 0 `/assets` entries in the 230-entry asar |
| Bundled runtime | 0 entries under `server/node_modules/electron` |
| Real machine | installed to `/Applications` (previous 0.3.4-with-v1-icon build kept at `/tmp/icon-v1-app`); packaged smoke test passed; Helper runs as `UIElement` so no ghost Dock icon |
| Published | GitHub Release [`v0.3.4`](https://github.com/haohaiHuang/MD-Convertor/releases/tag/v0.3.4), tag `e251267` (the tree this ZIP was built from), marked Latest; asset uploaded and byte-count checked |
| Signing | not signed, not notarized |

The package is about 4.3 MB larger than `0.3.3`; the delta comes from this build's Next.js output tracing picking up the optional `@img/sharp-wasm32` and `@emnapi/runtime` fallback packages plus three build-hash static files, not from the icon (`electron.icns` went from a 272 KB default to a 972 KB custom icon while `assets/` stopped shipping inside the asar).

## Verified Release (0.3.3, historical)

| Check | Result |
|---|---|
| Node.js | 24.14.1 (24.16.0 stalls inside `yauzl` while unpacking the Electron archive, so `electron-forge make` never produces a ZIP; 24.15.0 also passes) |
| Baseline | lint, typecheck, coverage, production build passed |
| Tests | 62 files / 859 tests passed, 95.28% statements |
| Browser E2E | Chromium, Firefox, WebKit — 178 passed / 2 skipped |
| Stable live gate | WalkingLabs link/paste — 2/2 passed |
| Production dependency audit | no production advisories (QA-012 closed) |
| Package | 0.3.3, arm64, macOS 12.0+ |
| ZIP bytes | 232,947,408 |
| ZIP SHA-256 | `1bf807dfe294860c24345efe5caf2b0fcbd54f88476df7085c9bd03b47b37a72` |
| Bundled runtime | 0 entries under `server/node_modules/electron`; playwright 75, playwright-core 129, `@img/sharp-darwin-arm64` 7, `@img/sharp-libvips-darwin-arm64` 10, `server/browser/chrome-headless-shell` (159,293,248 bytes), 24 MD-Convertor Helper entries under `Contents/Frameworks` |
| Real machine | installed to `/Applications` replacing `0.3.2` (previous build kept at `/tmp/s18-old-0.3.2.app`); packaged smoke test passed |
| Published | GitHub Release [`v0.3.3`](https://github.com/haohaiHuang/MD-Convertor/releases/tag/v0.3.3), tag `3897cd1`, asset uploaded and byte-count checked |
| Signing | not signed, not notarized |

## Verified Release (0.3.2, historical)

| Check | Result |
|---|---|
| Node.js | 24.15.0 |
| Baseline | lint, typecheck, coverage, production build passed |
| Tests | 62 files / 858 tests passed, 95.28% statements |
| Browser E2E | Chromium, Firefox, WebKit — 178 passed / 2 skipped |
| Stable live gate | WalkingLabs link/paste — 2/2 passed |
| Production dependency audit | no production advisories (QA-012 closed) |
| Package | 0.3.2, arm64, macOS 12.0+ |
| ZIP bytes | 358,726,788 |
| ZIP SHA-256 | `8fb7a93f33a07bb03b0b8558df4ff0c2abe40a14eee13fd9dc0348fedcc7f1ba` |
| Real machine | installed to `/Applications`; `lsappinfo` reports the server child as `type="UIElement"` on the Helper bundle, and the Dock shows no extra tile |
| Published | GitHub Release [`v0.3.2`](https://github.com/haohaiHuang/MD-Convertor/releases/tag/v0.3.2), tag `1c3ed80`, asset uploaded and byte-count checked |
| Signing | not signed, not notarized |

## Verified Release (0.3.1, historical)

| Check | Result |
|---|---|
| Node.js | 24.15.0 |
| Baseline | lint, typecheck, coverage, production build passed |
| Tests | 61 files / 855 tests passed, 95.28% statements |
| Browser E2E | Chromium, Firefox, WebKit — 178 passed / 2 skipped |
| Stable live gate | WalkingLabs link/paste — 2/2 passed |
| Production dependency audit | no production advisories (QA-012 closed) |
| Package | 0.3.1, arm64, macOS 12.0+ |
| ZIP bytes | 358,723,706 |
| ZIP SHA-256 | `c7411c587b3842a76f79118ecdc6d061993a0a99c98e4801c14ff947f10e161b` |
| Published | GitHub Release [`v0.3.1`](https://github.com/haohaiHuang/MD-Convertor/releases/tag/v0.3.1), asset uploaded and byte-count checked |
| Signing | not signed, not notarized |

## Verified Release (0.3.0, historical)

| Check | Result |
|---|---|
| Node.js | 24.15.0 |
| Baseline | lint, typecheck, coverage, production build passed |
| Tests | 58 files / 835 tests passed, 95.25% statements |
| Browser E2E | Chromium, Firefox, WebKit — 142 passed / 2 skipped |
| Stable live gate | WalkingLabs link/paste — 2/2 passed |
| Packaged smoke | preload bridge and runtime secret round trip passed |
| Production dependency audit | 1 critical / 1 high / 1 moderate (see QA-012) |
| Package | 0.3.0, arm64, macOS 12.0+ |
| ZIP bytes | 358,562,540 |
| ZIP SHA-256 | `2a0e236e97e51d97fd24c7002a923ef5703ad8245234531f2eb3aa1350c81147` |
| Signing | not signed, not notarized |

## Historical Anchor (0.2.1)

| Check | Result |
|---|---|
| Node.js | 24.14.1 |
| Baseline | lint, typecheck, coverage, production build passed |
| Tests | 28 files / 322 tests passed |
| Browser E2E | Chromium, Firefox, WebKit — 60/60 passed |
| Stable live gate | WalkingLabs link/paste — 2/2 passed |
| WeChat diagnostic | 12/12 code blocks and 279 lines matched in memory |
| Package | 0.2.1, arm64, macOS 12.0+ |
| ZIP bytes | 354,635,067 |
| ZIP SHA-256 | `32c1d96af58a7701e6d2fe0bf619be0f8f224803355c6ef63aad43c85569463e` |

## Security and Privacy Boundaries

- Link, redirect, browser-subresource, and image requests retain public-network validation, IP pinning, request/byte budgets, and cancellation.
- The local API retains loopback, origin, content-type, and per-launch token checks.
- Pasted HTML is semantically gated and sanitized; rendered Mermaid SVG is independently sanitized and rasterized before embedding.
- Logs and live comparisons do not save or print URLs, article bodies, clipboard HTML, or images.
- The application has no account, analytics, database, history, or cloud synchronization.
- Article text leaves the machine only when the user checks the translation box and a conversion completes, and only toward the local agent CLI or cloud provider they configured. Provider keys are encrypted at rest and never reach `settings.json`, the renderer, logs, or any child process environment.
- Translation providers deliberately accept loopback and private addresses for self-hosted models, while webpage scraping keeps public-network-only validation; the two policies are independent and neither relaxes the other.

## Open Risks

### QA-008 — Unsigned and not notarized

- Severity: release constraint
- Status: accepted, not planned (user decision 2026-09-20: no Developer ID signing or notarization)
- Impact: another Mac may show an unidentified-developer or damaged-app warning. Every artifact stays suitable for personal testing only; no public distribution is planned.
- Mitigation for personal testing: verify the published SHA-256, then use Finder Open/Privacy & Security or remove only `com.apple.quarantine`.
- If distribution is ever wanted: sign with an Apple Developer ID and notarize the application, then re-run the release gate and update every recorded artifact hash.

### QA-LIVE — WeChat upstream variability

- Severity: non-blocking diagnostic risk
- Status: accepted
- Impact: verification or timeout responses may make the fixed WeChat sample intermittently unavailable.
- Mitigation: `npm run test:live` keeps stable release-blocking samples; `npm run test:live:wechat` preserves the full in-memory comparison as a separate diagnostic.

### QA-012 — New advisories in production dependencies

- Severity: security watch item
- Status: resolved 2026-09-20 (`next` 16.3.5, `sharp` 0.35.4, production audit clean); discovered 2026-09-18 during the 0.3.0 gate
- Evidence: `npm audit --omit=dev` reports 1 critical (`next` 16.0.0–16.3.2, unauthenticated RCE advisories GHSA-p293-qw3h-jr36 and GHSA-2xp9-vwfh-vxw4), 1 high (`sharp` < 0.35.4, libheif advisories GHSA-g89c-p67h-r497 and GHSA-2jg2-4ch7-h545), and 1 moderate (`baseline-browser-mapping` 2.0.0–2.10.x). Installed at the time: `next@16.3.0`, `sharp@0.35.3`. Both were raised on 2026-09-20 to `next@16.3.5` and `sharp@0.35.4` (with `@img/sharp-*` 0.35.4 and `@img/sharp-libvips-*` 1.3.3), and `npm audit --omit=dev` now reports 0 vulnerabilities.
- Impact: the advisories target Windows-hosted Next.js servers and the Image Optimization API with AVIF input; this application is a macOS-only single-user loopback service and does not use the image optimizer. Residual risk for personal testing is low, but the pinned versions are known-vulnerable.
- Mitigation: deferred in 0.3.0 because upgrades were outside that change's scope, then applied on 2026-09-20 in the `0.3.1` round after `./init.sh` (60 files / 853 tests), the three-engine E2E suite and `npm run test:live` all passed.
- Re-verify: `npm audit --omit=dev`, `npm ls next sharp`, and a re-run release gate.

### QA-013 — A long per-call ceiling holds a stuck task open

- Severity: UX trade-off, accepted
- Status: accepted, introduced by `feat-027`
- Impact: a per-call ceiling of 180s means a provider that stops responding holds a task open for up to `batches × 180s + 30s` before the user sees a timeout. The whole-task deadline still bounds every task, and the user can cancel at any time.
- Evidence for the value: with the user's cloud provider, one small translate batch took 38–60s of reasoning tokens; the previous 60s ceiling aborted the call mid-body every time.
- Mitigation if it proves too slow: lower the batch size for cloud providers, or expose the ceiling as a setting. Both are product decisions, not fixes.
- Re-verify: `src/lib/translate/limits.test.ts`, `src/lib/translate/run.test.ts`, and a real-machine cloud run from `out/`.

### QA-DEV — Development dependency advisories

- Severity: non-runtime maintenance risk
- Status: accepted for 0.3.0
- Evidence: `npm audit --omit=dev --json` reports 3 production advisories (see QA-012); the full tree reports 1 critical, 28 high, and 3 low advisories in development/build tooling.
- Mitigation: packaged runtime dependencies are independently prepared and the release artifact passes the complete gate. Review compatible toolchain upgrades in a separately authorized iteration; do not use force upgrades that change the supported stack without regression evidence.

### QA-009 — Provider keys and the runtime secret path

- Severity: security watch item
- Status: mitigated in 0.3.0
- Impact: a cloud provider key could leak if it were written to `settings.json`, logged, echoed into an error message, or passed to a child process.
- Mitigation: keys are encrypted with Electron `safeStorage` in a mode `0600` `secrets.json`; `settings.json` never carries a key; every new local route logs only `{requestId, status, code, durationMs}`; `/api/runtime/secrets` never persists or logs its body; the CLI child environment has every `MD_CONVERTOR_*` variable removed; the renderer never receives a key. Saving or clearing a key takes effect without a restart and falls back to the environment variable afterwards.
- Re-verify: `electron/secrets.test.mjs`, `electron/preload.test.cjs`, `electron/runtime-secrets.test.mjs`, the settings and runtime route tests, and the packaged smoke run with `ELECTRON_SMOKE_TEST_SECRETS=1`.

### QA-010 — Article content leaves the machine when translation is on

- Severity: privacy boundary change
- Status: accepted, documented
- Impact: with the translation box checked, document text is sent to the endpoint the user configured — a local agent CLI, or a cloud provider the user added. There is no additional in-app warning; the checkbox is the consent.
- Mitigation: `docs/PRODUCT.md` and both READMEs now state the boundary explicitly; translation never starts unasked, is cancellable, and never sends anything on the skip paths (already in the target language, empty prose, or "不翻译"). MD-Convertor still uploads nothing to its own service, keeps no history or cache, and stores no article text.
- Re-verify: `docs/PRODUCT.md` privacy section, the translate e2e cases that assert `runs 0` on every skip path, and the absence of body text in translation logs and error responses.

### QA-011 — Local agent CLI as a subprocess

- Severity: security watch item
- Status: mitigated in 0.3.0
- Impact: a spawned CLI could inherit secrets, receive the prompt on a command line, or flood the app with output.
- Mitigation: `shell: false`, a fixed argument registry, prompt on stdin only, a one-use temporary working directory, `MD_CONVERTOR_*` removed from the child environment, 1 MiB output caps, and timeout kills. stdout/stderr are never echoed; a non-zero exit reports the status code and exit code only. The `claude` CLI has no reachable model on this Mac, so that path has mock-spawn unit evidence only.
- Re-verify: `src/lib/translate/provider/local-cli.test.ts` and `src/lib/local-cli/models.test.ts`.

## Repository Hygiene

- Completed plans, task records, prior progress/audit snapshots, WorkBuddy files, and release ZIPs through 0.2.0 are archived under `~/Downloads/MD-Convertor-archive/`. The 0.1.0–0.2.0 ZIPs and the read-only 0.1.3 copy were later lost from this Mac without any recoverable copy; 0.2.1 was re-downloaded from its GitHub release and re-verified against its recorded SHA-256.
- The current repository tree contains only active source, current documentation, tests, and the ignored `out/` build output (a pre-fix 0.3.0 ZIP plus the unsigned 0.3.1, 0.3.2, 0.3.3 and 0.3.4 packaged apps).
- Historical Git commits and tags are intentionally retained; no history was rewritten.
- Release guards verify fixed historical ZIP hashes from the external archive before and after a release attempt; an absent entry is reported as retired and any present entry is still hash-checked.

## Re-verification Checklist for 0.3.6

- `./init.sh` green on Node.js 24.x: lint, `tsc --noEmit`, coverage with every per-file threshold, production build. Last green: 68 files / 999 tests, 95.28% statements (2026-09-22, inside the `0.3.6` gate).
- `npm run test:e2e` green across Chromium, Firefox, and WebKit. Last green: 239 passed / 4 skipped (2026-09-22, inside the `0.3.6` gate).
- `tests/forge-package-scope.test.ts` green: the packaged asar still holds exactly `package.json` plus the `electron/` runtime modules, and nothing the runtime reads is missing from it.
- The two desktop-bridge channels (`md-convertor:output:select-directory`, `md-convertor:output:save-file`) are present in the packaged asar, and `electron/output.mjs` still re-validates `dirPath` and `filename` in the main process rather than trusting the preload.
- `npm run desktop:release` passed with version `0.3.6` on 2026-09-22: historical ZIP snapshot unchanged before and after, fresh ZIP, packaged version, arm64 executable, bundle structure, size, and SHA-256.
- `npm run test:live` result recorded, even when it is skipped or fails because the network is unavailable. Last green: 2/2.
- Packaged smoke test with `ELECTRON_SMOKE_TEST=1` and `ELECTRON_SMOKE_TEST_SECRETS=1` prints the preload bridge and runtime secret results and leaves `settings.json` / `secrets.json` byte-identical. Launch it from a plain Terminal: a shell inside an Electron host exports `ELECTRON_RUN_AS_NODE=1`, and a shell already under macOS seatbelt cannot let Chromium sandbox itself (both traps are written up in `docs/TESTING.md`).
- No key, article body, or CLI output appears in logs, error messages, test output, or the repository.
- The historical `v0.1.3` tag is intact, no historical ZIP that still exists changed its hash, and every retired entry is reported by the gate.

## Re-verification Checklist for 0.3.4

- `./init.sh` green on Node.js 24.x: lint, `tsc --noEmit`, coverage with every per-file threshold, production build. Last green: 63 files / 863 tests, 95.28% statements (2026-09-21, inside the `0.3.4` gate).
- `npm run test:e2e` green across Chromium, Firefox, and WebKit. Last green: 187 passed / 2 skipped (2026-09-21, inside the `0.3.4` gate).
- `tests/app-icon.test.ts` green, and the packaged `Contents/Resources/electron.icns` must hash identically to `assets/icon.icns`.
- `npm run desktop:release` passed with version `0.3.4` on 2026-09-21: historical ZIP snapshot unchanged before and after, fresh ZIP, packaged version, arm64 executable, bundle structure, size, and SHA-256.

## Re-verification Checklist for 0.3.3 (historical)

- `./init.sh` green on Node.js 24.x: lint, `tsc --noEmit`, coverage with every per-file threshold, production build. Last green: 62 files / 859 tests, 95.28% statements (2026-09-20, unchanged on 2026-09-21).
- `npm run test:e2e` green across Chromium, Firefox, and WebKit. Last green: 187 passed / 2 skipped (2026-09-21, after the feat-036 link-failure paste hint and the feat-037 cloud-card reset; the 0.3.3 gate itself ran 178).
- After the 0.3.3 release, `next.config.ts` gained `outputFileTracingIncludes` for `node_modules/playwright-core/browsers.json` and `e2e/convert-api.spec.ts` was added (feat-035, committed on top of the 0.3.3 tag). Source and the published 0.3.3 ZIP are therefore no longer byte-identical, while the packaged app stays file-equivalent because desktop preparation re-copies the full Playwright packages.
- Two further UI-only rounds sit on top of the tag: feat-036 adds a「改用富文本粘贴」hint under a failed link fetch (page-local state, no interface change) and feat-037 turns the cloud card's「清除」into a full reset (keychain entry plus the provider record). Neither touches the fetch SSRF policy, the provider endpoint policy, the settings contract, or any limit, so no re-audit of QA-001 through QA-013 is required.
- `npm run test:live` result recorded, even when it is skipped or fails because the network is unavailable. Last green: 2/2 (after one transient DNS failure).
- `npm run desktop:release` passed with version `0.3.3` on 2026-09-20 (and with `0.3.2` and `0.3.1` earlier the same day): historical ZIP snapshot unchanged before and after, fresh ZIP, packaged version, arm64 executable, bundle structure, size, and SHA-256.
- Packaged smoke test with `ELECTRON_SMOKE_TEST=1` and `ELECTRON_SMOKE_TEST_SECRETS=1` prints the preload bridge and runtime secret results.
- No key, article body, or CLI output appears in logs, error messages, test output, or the repository.
- The historical `v0.1.3` tag is intact, no historical ZIP that still exists changed its hash, and every retired entry is reported by the gate.

## Release Decision

Approved for personal testing. Not approved for frictionless public distribution, and QA-008 is accepted rather than being worked: the user decided on 2026-09-20 not to buy a Developer ID / notarize, so signing stays out of scope until that decision changes. `0.3.6` passed its gate on 2026-09-22 and was published as GitHub Release `v0.3.6` (235,956,668 bytes, SHA-256 `9b89d55c…f351`); it adds the default Markdown save folder and narrows the packaged archive to what the app actually reads. `0.3.5` passed its gate on 2026-09-21 and was published as GitHub Release `v0.3.5` (tag `5f98307`). `0.3.4` passed its gate on 2026-09-21 and was published as GitHub Release `v0.3.4` (237,272,966 bytes, SHA-256 `6910120e…2704`); that ZIP was rebuilt after the user's second icon version was put in place and the tag was moved onto that commit, so the tag, the released ZIP and `checkout v0.3.4` agree. QA-012 no longer applies: `next` is 16.3.5 and `sharp` is 0.35.4 as of 2026-09-20 and `npm audit --omit=dev` reports no production advisories. `0.3.3` passed its gate on 2026-09-20 and was published as GitHub Release `v0.3.3`; `0.3.2` passed its gate on 2026-09-20 and was published as GitHub Release `v0.3.2` (tag `1c3ed80`); `0.3.1` passed its gate and was published as GitHub Release `v0.3.1` earlier the same day. The release notes state that the build is unsigned and intended for personal testing.

## Archived Round Log

### 2026-09-24（第三轮）— S1 转换核心落地（插件第一条真实代码）

- 交付 `extension/src/convert/{index,extract,markdown,images,naming,sanitize}.ts`：纯函数、输入是 DOM、无 Node 依赖；`buildArticle(document, sourceUrl, { sanitize, now })` 是唯一入口，返回 `{ title, markdown, images, sourceUrl } | null`。
- 构建与验证接线：`scripts/build-extension.mjs`（esbuild 精确锁 `0.28.1`，IIFE 全局 `mdConvertorCore` → `extension/dist-test/core.js` 50.0 KB，自检无 `require("node:`/jsdom/domino）+ `playwright.extension.config.ts` + 浏览器冒烟；`package.json` 加 `build:extension`/`test:extension`，`vitest.config.ts` 收进扩展单测并给四个核心文件加覆盖率阈值。
- TDD：每个任务留有 RED（缺模块 / 真断言失败），证据在 `feature_list.json` 的 `feat-040.verification`；T1.3 测试与实现同一次写入，RED 是「模块不存在」那次运行，已如实注明。
- 四处偏离已就地记录（`S1-convert-core.md` 的 Result + FSD §3.2）：`htmlToArticleMarkdown` 收 `HTMLElement` 而非字符串；惰性图在常规分支也先提升（Readability 丢 `data-*`）；常规分支也设 50 字符下限（导航栏会被当正文）；无法解析的 `href` 摘掉属性。
- 门禁：`NODE_OPTIONS= ./init.sh` exit 0（Node 24.15.0，**75 files / 1035 tests**，95.48%；上轮 68 / 999、95.28%）；`npm run test:extension` 1 passed（chromium；沙箱内加 `--no-sandbox,--disable-gpu`）。
- 未做：无 `manifest.json` / service worker / content script / 任何 `chrome.*` / `extension/dist/`（属 S2）；未 bump 版本（0.3.6 不动）、未跑 `desktop:release`、未跑 `test:e2e`。本轮按用户要求**提交到本地、未 push**（GitHub 等大阶段完成再推）。
- 提交门（本机 `subagent` 不可用，三道路由改为就地审）：ponytail 无可删项（只余 3 条判断题：单元素 `targets` 数组、`forbidden` 名单两处重复、惰性图属性名两处知晓）；code-review 两轴只出一条 spec 差距 —— T1.5 写了「固定快照」而测试只用 `toContain`，已改为逐字符锁头部 5 行；neat-freak 死引用、相对时间、尺寸、软链四项均过（AGENTS.md 121 行 / 12.7KB，handoff 126 行 / 22.0KB）。

### 2026-09-24（第二轮）— 文档结构收口：handoff 退役历史、全局指令点名两处

- 项目 `AGENTS.md` 原先只点名 `~/.codex/AGENTS.md`，而 pi 会话加载的是 `~/.pi/agent/AGENTS.md`（两份内容不同：pi 版多「证据先于断言」「本机环境已知问题」「工作流」）。已改为**两份都点名**并注明各自由谁加载；Startup Workflow 第 2 步同步。
- `session-handoff.md` **457 行 / 139KB → 122 行 / 21.7KB**（−73% 行数、−84% 体积）：删掉 `Previous Change`、`Archived Change Log ×4`、`Release Evidence` 与 `Next Stage Entry` 下的 S6/S5 要点。删除依据（实测）：83% 体积是历史；21 份阶段文档**全部已有 `## Handoff`**，handoff 内 142 行的「S1–S6 实际交付接口 / 与文档的偏差」逐条比对确认是它们的压缩副本；`Release Evidence` 与 `docs/TESTING.md` + `## Verified Release` 表重复。**零新文件、零改名**（21 处引用与 `init.sh` 的 `required_files` 不动）。
- 新规则写进 `AGENTS.md` 的 Required State Artifacts 与 End of Session：handoff 只写现役（≤150 行 / ≤25KB）；阶段间交接写阶段文档的 `## Handoff`；轮次历史每条 ≤10 行进本表。
- 纯文档轮，未动 `src/` / `electron/` / 打包配置 / `extension/`；`./init.sh` exit 0（68 files / 999 tests，95.28%）。

### 2026-09-24（第一轮）— 浏览器插件（B / feat-040）实施规划定稿，A/B 顺序反转

- 用户裁定顺序反转：**B（插件，`feat-040`）先做**；A（桌面端文档处理，`feat-042`）改为独立另案（无顺序、无代码依赖）。理由：这条线里只有 B 需要「当前浏览器会话」，A 能吃任意现成 `.md`。
- 用户裁定 **B 自带转换核心**（`extension/src/convert/`，纯函数 + 注入环境依赖），**不改桌面端任何文件**；代价是两端可能漂移，对冲是「将来统一只是搬家，不是重写」。连带把 `PLAN` §4.4 从「两端输出必须一致」更正为「提取正文与文本转换规则一致」。
- PRD §3 六条全部裁定（仅工具栏按钮 / 不做预览 / 同名覆盖 / 标题净化照抄 `src/lib/markdown.ts:46` / 不允许改文件名 / 图片全失败仍写 md），另加失败图保留原 URL + `<!-- 图片未下载：<url> -->`、角标 `✓`/`!` 反馈、不做 popup/通知/整页兜底。
- 新增施工文档 `docs/features/browser-extension/`（`FSD.md` + `S1-convert-core.md` + `S2-extension-shell-and-writes.md` + `S3-e2e-and-acceptance.md`）；四组规则冲突就地解掉；提交 `ab1d653`。
- 纯文档轮，未 bump 版本（0.3.6 不动）、未跑 `desktop:release`；`./init.sh` exit 0。

### 2026-09-22 — feat-041 默认 MD 保存路径 + 0.3.6 发布（本轮收尾归档）

- S1（设置契约 + IPC）：`Settings` 新增 `output: { defaultPath, useDefaultPath }`，旧 `settings.json` 缺该字段时按默认值补齐而不判为损坏；Electron 新增 `md-convertor:output:select-directory` 与 `md-convertor:output:save-file` 两个通道，`electron/output.mjs` 写成可注入纯模块（`ipcMain` / `dialog` 注入），`dirPath` 与 `filename` 在沙箱化 preload 与主进程各校验一次。提交 `ac8f91a`。
- S2（下载三态分叉）：主页面 `downloadMarkdown()` 分叉为「桥接直写 / 浏览器下载」，新增 fs 错误码映射（`src/app/settings/client.ts`），失败时在结果区说明原因并降级；设置页新增「输出」卡片（只读路径展示、选择目录按钮、使用默认目录开关）。提交 `f9b7534`。
- 真机缺陷修复：`isAbsoluteDirPath` 原先把路径里每个 `~` 都当家目录简写，而 iCloud 云盘的数据落在 `com~apple~CloudDocs` 下，于是真实用户选出的目录被判非法；且该拒绝以未捕获的 promise 拒绝抛出，表现为「点下载毫无反应：不写文件、不下载、不报错」。改为 `~` 仅在路径段开头才算简写，并让所有拒绝都走结果区说明 + 降级。提交 `dde369e`。
- 反馈修复：直写成功原先没有任何可见确认（文件落盘了、页面看不出变化），改为「下载」按钮短暂显示「已保存」+ 结果区带 ✓ 的状态卡片，失败改用警告色。提交 `867aa2a`。
- S3/T3.0（打包收窄）：`forge.config.cjs` 的 11 条黑名单换成「保留清单」——asar 只留 `package.json` 与 `electron/`（`main.mjs`、`preload.cjs`、`preload-contract.cjs`、`env.mjs`、`output.mjs`、`runtime-secrets.mjs`、`server-binary.mjs`、`secrets.mjs`），**253 条 / `2,670,300` bytes → 10 条 / `35,261` bytes**；`tests/forge-package-scope.test.ts` 双向守卫（RED 26 failed / 18 passed → GREEN 44 passed）。提交 `7cf1111`。
- 同轮顺手修掉的既有 e2e flake（范围外，已在 `PROGRESS.md` 留下教训）：几何断言原先用两次 `boundingBox()` 比较 `y`，而 `fill()` 触发的滚动会在两次采样之间落定，把滚动位移量成布局错位（firefox 40 次跑出 6 次 131px「错位」，实为 `821 = 689 + 132`）。改为 `rectsInOneFrame()` 单帧读取后 firefox 300/300。同时把 firefox 的 `MOZ_DISABLE_CONTENT_SANDBOX=1` 固化进 `playwright.config.ts`，三引擎自此自足可跑。提交 `14e9684`。
- S3/T3.1+T3.2+T3.3：`npm run desktop:release` exit 0（Node 24.14.1，2m54s）—— 68 files / 999 tests、95.28%、三引擎 e2e 239 passed / 4 skipped、live 2/2；产物 `MD-Convertor-darwin-arm64-0.3.6.zip` 235,956,668 bytes、SHA-256 `9b89d55c…f351`；独立复核 `unzip -t` 3511 条目、包内版本 0.3.6、Mach-O arm64、asar 恰 10 条目。T3.1 与 T3.2 **刻意合并为一次**，因为 `release-desktop.mjs` 内部已依次 await `init.sh` → `test:e2e` → `test:live` → `desktop:make`。
- S3/T3.4：旧 `0.3.5` 从 `/Applications` 移到 `~/Downloads/MD-Convertor-archive/installed-apps/`；安装源改用**发布 ZIP 本身**解压（因此完全不碰正在运行的 `out/` bundle）；`ditto` 到 `/Applications`（546 MB）、`defaults read` 为 0.3.6 / 0.3.6、arm64、lsregister 注册。冒烟 `ELECTRON_SMOKE_TEST=1 ELECTRON_SMOKE_TEST_SECRETS=1` **exit 0**（须 `env -u ELECTRON_RUN_AS_NODE`；在外层沙箱内还须 `--no-sandbox --disable-gpu`——两个坑已写入 `docs/TESTING.md`）；用户 `settings.json` / `secrets.json` 的 md5 前后逐字节一致。
- S3/T3.5：真机两态走查由用户于 2026-09-22 签字通过（开默认目录：不弹框、文件落盘；关默认目录：弹框）。
- **一处就地更正**：T3.0 的动机最初表述为「私有工作文档会随发布物一起公开」。核实后该定性**不成立**——仓库是 public，`PROGRESS.md`、`session-handoff.md`、`feature_list.json`、`AGENTS.md`、`docs/**` 早已在 `origin/main` 上公开（逐个 `git cat-file -e origin/main:<file>` 确认），打进 asar 不构成新增暴露；唯一真正非公开的是 `.workbuddy/memory/*.md`（`.gitignore` 第 10 行，从未进入任何提交）。收窄本身仍然正确（少装 2500 余条运行时不读的条目、asar 从 2.6 MB 降到 35 KB），但理由已就地更正。

### 2026-09-21 — feat-039 视觉刷新 + 0.3.5 发布（上一轮收尾归档）

- S1（色彩系统）：`tests/palette.test.ts` 先 3 failed / 33 个白名单外字面量 → 35 处字面量替换 GREEN；`e2e/theme.spec.ts` 先 2 failed → 2 passed。提交 `972ff4a`。
- S2（字重收敛 + 抗锯齿）：e2e 扩 6 用例先 RED（3 failed / 3 passed）→ token `--weight-body: 400` / `--weight-ui: 400`、19 处替换、`.preview` 守卫、全局 antialiased 后 GREEN；真机复核后 `--weight-body` 300 → 400 回退（细体小字识别度不足），S2 净效果为「界面字重收敛为一档 400 + 抗锯齿」。提交 `fae16bc`。
- 富文本「清空」按钮归位（不属 feat-039）：`page.tsx` 把按钮移进 `.sourceRow`、删除 `.pasteActions`；e2e 先红（y 差 58px）后绿。提交 `a03b175`。
- S3（发布）：版本升级 TDD（release-guards fixture 先 5 failed → 29 passed）；`npm run desktop:release` exit 0（Node 24.15.0）—— 64 files / 866 tests、95.28%、三引擎 e2e 206 passed / 4 skipped、live 2/2；产物 `MD-Convertor-darwin-arm64-0.3.5.zip` 237,335,837 bytes、SHA-256 `313bbbc341c94da0a5ca92f668f2df06cea9f734e47d7af65880500aa192d45f`；安装 `/Applications`；GitHub Release `v0.3.5`（tag 指向 `5f98307`）。首跑门禁的 `E2E modified tracked files` 为并行编辑文档导致的误报，冻结编辑后重跑即绿。提交 `5f98307`。
- 真机目视（CDP）：首页/设置页 computed 全为新色板、字重 400、antialiased；包内旧墨绿零命中。

### 2026-09-21 及更早（feat-024 – feat-038，0.3.1 – 0.3.4 线）— 叙述退役指针

- 这一段的逐轮叙述原先只存在于 `session-handoff.md`，2026-09-24 随该文件瘦身退役，**不再单独回填**：完整原文见 `git show ab1d653:session-handoff.md`（4 个 `## Archived Change Log` 段 + `## Release Evidence`），逐 feature 的完成条件与验证证据见 `feature_list.json` 的 `verification`，产物字节数 / SHA-256 / 门禁计数见 `docs/TESTING.md` 与上文 `## Verified Release (0.3.x)` 各表，实现细节以 git 历史为准。
- 仍然有效的操作约束（Firefox 沙箱开关、代理污染 Playwright、同帧几何断言、`ELECTRON_RUN_AS_NODE`、`MD_CONVERTOR_USER_DATA` 不能隔离打包应用、安装源用发布 ZIP）已留在 `session-handoff.md` 的 `## Environment Notes` 与仓库根 `PROGRESS.md` 的约束清单里，**没有随历史段一起删掉**。
