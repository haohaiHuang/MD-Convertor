# Quality Audit

## Current Verdict

**Current released version: `0.3.11`** (published 2026-11-16 as GitHub Release `v0.3.11`, tag `78c474e`; `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.11.zip`, 237,921,860 bytes, SHA-256 `a63e5192…0154d`, server-side digest matched). It carries feat-044 (distinct batch product names, `realpath` image boundary, the extension waiting for its download, `audit:runtime` in the gate), feat-045 (Electron `43.8.10`, `next` floor `^16.4.6`) and the writer half of the B1 finding (percent-encoded image references). Gate evidence: `init.sh` 96 files / 1295 passed / 5 skipped, three-engine E2E 351 passed / 6 skipped, live 2/2, `npm audit --omit=dev` 0. Per-round details and the six known-undecided flakes: see `## Archived Round Log` below and `session-handoff.md` Environment Notes.

**Latest round: 2026-11-26 (round 37, UI audit remediation)** — a read-only UI/UX audit first produced a decision board (`/tmp/mdc-audit/decision-board.html`) with every finding's problem screenshot beside a live-rendered proposed fix. The user picked seven to fix, three to defer (P1 home h1, W5 control-border contrast, W6 result-page width) and one to retract (W3 was a false positive: the invalid-URL `role="alert"` does appear while typing). Fixed: W1 (long file names no longer wrap the status column), W2 (zh-CN short date instead of US AM/PM), W4a (settings link focus ring), W4b (URL input halo matches the source field), W7 (>500-file truncation warns instead of reading as an empty directory), W8 (24×24 checkbox hit area), P4 (select-all indeterminate). Two implementation defects were caught before green: a value import of `MAX_SCANNED_FILES` pulled `node:fs` into the browser bundle (extracted to `src/lib/local-docs/limits.ts`), and the indeterminate effect sat after an early return (moved above). Evidence: 7 RED→GREEN e2e cases, `./init.sh` 96 files / 1301 passed, three-engine e2e **375 passed / 6 skipped / 0 failed**, `tsc`/lint/build clean. Commit-gate round 2 (ponytail + Spec, zero Critical) raised 6 small items, all fixed before commit: W1 case now pins the nowrap contract only, the plugin link's focus ring is covered by e2e, both CHANGELOGs record the W3 withdrawal, the dead `MAX_SCANNED_FILES` re-export is removed, `hourCycle:'h23'` is pinned with a midnight case, and the e2e scan stub imports the real `ScannedLocalDoc` type. No bump, no commit, no release; `0.3.12` remains unpublished.

**Previous round: 2026-11-26 (round 36, entry-card titles aligned)** — the two start-screen cards centre their content, so the card whose note wrapped to fewer lines began lower and the pair read as left-high, right-low (10.84px). A first attempt pinned the content to the top of the card; the user rejected that (the whole block jumped to the top of the capsule), so the fix is narrower: layout and 220px height unchanged, and the note reserves two lines (`min-height: 2lh`), which leaves the taller card pixel-identical and lifts the shorter one by ~11px. RED-first: `e2e/home.spec.ts` now pins both title tops within 1px plus equal space above the title and below the note on both cards. `./init.sh` 96 files / 1301 passed; three-engine e2e 354 passed / 6 skipped. Not committed, not released (the `0.3.12` bump from round 35 stands). **Previous round: 2026-11-26 (round 35, feat-046 on-demand keychain + first-launch docs; version face bumped to `0.3.12`, not released, not committed)** — the app used to open the encrypted key store on every launch, and because the build is ad-hoc signed (QA-008) each new cdhash looked like a stranger to the login keychain, so a build with an **empty** `secrets.json` still asked for the login password. `exportPlaintext()` now returns `{}` as soon as the store has no entries, before `safeStorage.isEncryptionAvailable()`; `set()` stays the only writer and still asks at the moment a key is saved, which is the intended on-demand model. Evidence: the new RED-first case (counts every `safeStorage` call, failed `expected 1 to be +0`) and `./init.sh` 96 files / 1301 passed; `desktop:make` built `0.3.12` (237,926,019 bytes) and that fresh bundle — a new cdhash, outside every keychain ACL — started in the agent shell that previously hung inside `SecItemCopyMatching`, served `/health` 200 and the extension ZIP, and produced no keychain prompt in `log show`. Docs: README (both languages) now leads with Control-click (or right-click) → Open and states the on-demand rule; PRODUCT and ARCHITECTURE carry the same clause; CHANGELOG has an `[Unreleased]` entry. The leftover `Electron Safe Storage` keychain item from development and packaged smoke runs was deleted (`MD-Convertor Safe Storage` untouched).

**Previous round: 2026-11-16 (round 34, `0.3.11` committed, pushed and published)** — `ab3b7da` (implementation + ledger, 18 files) and `78c474e` (bookkeeping) pushed, `git tag v0.3.11 78c474e`, then `desktop:release` passed on the second attempt: `init.sh` 96 files / 1295 passed + 5 skipped, three-engine E2E 351 passed / 6 skipped, live 2/2, `desktop:make` artifact check. The first attempt died on one firefox hydration timeout in `e2e/paste.spec.ts:221` (5/5 green in isolation, same flake family as the six logged below). Artifact 237,921,860 bytes / SHA-256 `a63e5192…0154d`, uploaded in a skeleton-then-upload pair (10m01s), server-side digest matched and `releases/latest` resolves to `v0.3.11`.

**Previous round: 2026-11-16 (round 33, ledger drift fix plus the three queued remediations, no release; version face stays `0.3.11`)** — first the drift: feat-044 had already been committed as `0c64834` (plus bookkeeping `4c81a99`) while PROGRESS, session-handoff, this file and the remediation FSD still called it uncommitted, so the 19 current-state claims were corrected and every historical round entry was left untouched (those were true when written). Then the three authorised items: the extension now percent-encodes local image references (writer side of the 2026-09-30 B1 finding, so titles with spaces or parentheses keep their images), Electron moved `43.3.0` → `43.8.10` (its twelve shipped-runtime advisories are gone; the full tree went 50 → 49 and production stays 0), and the `next` manifest floor was corrected to `^16.4.6` to match the locked server. Evidence: `./init.sh` 96 files / 1300 passed, `test:extension` 16 passed, three-engine E2E 351 passed / 6 skipped, `desktop:make` producing a 0.3.11 ZIP whose framework reports 43.8.10, plus a packaged smoke (preload bridge + a real conversion) on that bundle. No version bump, no release; committed as `ab3b7da` and pushed at the user's instruction.

**Previous round: 2026-11-14 (round 32, remediation of the external audit's P2 items, no release; version face is `0.3.11`)** — four code fixes proven by RED-first tests: distinct product names for sources whose names have to be cleaned (batch overwrites are gone, and the list shows the real product name), `realpath` boundary checks for local images so a symlink cannot read outside the source tree, the extension now waits for its Markdown download to reach `complete` before reporting success, and `npm run audit:runtime` wired into the release gate (production advisories block, Electron's 12 tracked advisories print). Evidence: `npm run test:coverage` 96 files / 1291 passed, three-engine E2E 351 passed / 6 skipped, `test:extension` 45 passed at `--repeat-each=3`. Details: [`features/audit-p2-remediation/FSD.md`](features/audit-p2-remediation/FSD.md).

**Previous audit round: 2026-11-14 (round 31, no release)** — a full-project read-only audit followed by the user-approved remediation: production dependency advisories cleared (dompurify 3.4.17, next 16.4.6, sharp 0.35.5, undici, source-map-js — `package-lock.json` only), README/PRODUCT/ARCHITECTURE brought back in sync with 0.3.10 in both languages, the stale one-shot probe script and a duplicate 116 MB Electron cache removed, and the doc-consistency drift fixed (this verdict rewritten as a short statement; QA-012 re-closed with a recurring-audit note). Gate evidence: `npm audit --omit=dev` 0 vulnerabilities, `./init.sh` 95 files / 1274 passed / 0 skipped. Historical per-version release verdicts (0.3.1–0.3.9) now live only in `## Archived Round Log` and `docs/TESTING.md`; the previous unbounded verdict paragraphs were collapsed here because they had grown into the drift source this round set out to fix.

Historical release verdicts for `0.3.1`–`0.3.9` (sizes, SHA-256s, gate evidence, per-round fix detail) have been collapsed into `## Archived Round Log` below and the per-version records in `docs/TESTING.md`; the original unbounded paragraphs are preserved in git history (commit `97c3301` and earlier).

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
- Status: **resolved twice — most recently 2026-11-14** (audit-remediation round: `dompurify` 3.4.17, `next` 16.4.6, `sharp` 0.35.5, `undici` ≥ 8.12.2, `source-map-js` 1.2.2; `npm audit --omit=dev` reports 0 vulnerabilities, `./init.sh` 95 files / 1274 tests green). Originally discovered 2026-09-18 during the 0.3.0 gate and first resolved 2026-09-20 (`next` 16.3.5, `sharp` 0.35.4).
- 2026-11-14 finding: post-2026-09-20 disclosures had re-opened the exposure — `dompurify` ≤ 3.4.16 (critical, DOM XSS family), `next` 16.0.0–16.4.0 (critical, incl. RCE in Image Optimization), `sharp` < 0.35.5 (librsvg CVE-2026-96889), `undici` 8.0.0–8.12.1 (multiple DoS/splitting), `source-map-js` ≤ 1.2.1. All were patch-level upgrades within the existing `package.json` ranges; only `package-lock.json` changed.
- Impact: this application is a macOS-only single-user loopback service and does not use the Next.js image optimizer, but DOMPurify is the HTML sanitization core, so the critical advisories were treated as real. Fix evidence: `npm audit --omit=dev` → 0 vulnerabilities; baseline re-run green (95 files / 1274 passed / 0 skipped, `NODE_OPTIONS= ./init.sh`).
- Re-verify: `npm audit --omit=dev`, `npm ls dompurify next sharp undici source-map-js`, and a re-run release gate before the next release. **This is a recurring watch item: re-run the production audit at every release gate, not only when it fails.**
- Historical (2026-09-18 discovery, resolved 2026-09-20 in the 0.3.1 round): 1 critical (`next` 16.0.0–16.3.2 RCE), 1 high (`sharp` < 0.35.4 libheif), 1 moderate (`baseline-browser-mapping`).

### QA-013 — A long per-call ceiling holds a stuck task open

- Severity: UX trade-off, accepted
- Status: accepted, introduced by `feat-027`
- Impact: a per-call ceiling of 180s means a provider that stops responding holds a task open for up to `batches × 180s + 30s` before the user sees a timeout. The whole-task deadline still bounds every task, and the user can cancel at any time.
- Evidence for the value: with the user's cloud provider, one small translate batch took 38–60s of reasoning tokens; the previous 60s ceiling aborted the call mid-body every time.
- Mitigation if it proves too slow: lower the batch size for cloud providers, or expose the ceiling as a setting. Both are product decisions, not fixes.
- Re-verify: `src/lib/translate/limits.test.ts`, `src/lib/translate/run.test.ts`, and a real-machine cloud run from `out/`.

### QA-DEV — Development dependency advisories (including Electron, which ships)

- Severity: maintenance risk, one of them a packaged-runtime risk
- Status: **resolved for the shipped runtime on 2026-11-16** (Electron upgraded, `feat-045`); the production half has been gated since 2026-11-14
- Evidence (2026-11-16, `npm audit --json` after the upgrade): production tree `--omit=dev` = **0** advisories; full tree = **49** (3 low / 14 moderate / 27 high / 5 critical) in build and test tooling; **`electron` no longer appears in the report at all**. Before the upgrade (2026-11-14, commit `fb63c06`) the full tree was **50** (3 low / 14 moderate / 28 high / 5 critical) and `electron@^43.3.0` → `43.3.0` matched **12** advisories (2 high below `43.4.1`, `GHSA-qmv3-fv6v-rmhq` below `43.5.0`, a certificate mitigation below `43.8.1`).
- Why it is not simply "devDependency, ignore": the packaged `.app` runs that exact Electron, so its advisories are runtime advisories in everything but `package.json` placement.
- Mitigation now in the gate: `npm run audit:runtime` (`scripts/audit-runtime.mjs`) runs inside `npm run desktop:release` — any **production** advisory aborts the release, any **Electron** advisory is printed as a tracked warning. The gate judges the report, not the exit code, because `npm audit` exits 1 whenever anything anywhere is reported.
- Upgrade completed: `electron` `43.3.0` → `43.8.10` (same major, the lowest version that clears every 43.x advisory). Verified by `./init.sh`, `test:extension`, three-engine e2e, `desktop:make`, and a packaged smoke on the new bundle (preload bridge + real `example.com` conversion) — see the 2026-11-16 round log. 45.x was deliberately not taken; it stays a separate future round.
- Still open (not silenced): the remaining 49 advisories live in build and test tooling only. Do not force-upgrade the toolchain to zero the report; production is the gate.
- Re-verify: `node scripts/audit-runtime.mjs` and `npm ls electron`.

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

Approved for personal testing. Not approved for frictionless public distribution, and QA-008 is accepted rather than being worked: the user decided on 2026-09-20 not to buy a Developer ID / notarize, so signing stays out of scope until that decision changes. The current released version is `0.3.11`; earlier per-version release records (`0.3.1`–`0.3.10`) live in `## Archived Round Log` and `docs/TESTING.md`.

## Archived Round Log

### 2026-11-26（第三十六轮）—— 入口卡标题顶端对齐（未发布）

- 用户报告 1 条：「主界面两个入口的标题没有顶端对齐，看起来左高右低」。根因：`.entryCard` 为 `justify-content: center`，两卡说明行数不同（左 2 行、右 1 行）⇒ 居中后左卡标题更靠上。
- TDD（含一次返工）：先按「顶端对齐」改 `justify-content: flex-start` + `min-height: 220px → 184px`，标题对齐但整块内容被顶到胶囊上方，用户否掉（「只把右侧标题上移一点点」）；最终还原 `center` + 220px，只给 `.entryNote` 加 `min-height: 2lh`。用例断言两卡标题 y 差 ≤1px 且每卡「标题上方留白 = 说明下方留白」（RED 首版实测差 10.84px；最终 66.77 / 66.77，四档宽度一致）。
- 门禁：`NODE_OPTIONS= ./init.sh` exit 0（96 files / 1301 passed）；三引擎 e2e **354 passed / 6 skipped / 0 failed** + tracked-file check。截图核对 1180 / 960 / 760（760 单列既有护栏不变）。
- 文档：CHANGELOG 双语 `[Unreleased]` 各一条；`docs/features/ui-fix/S3-polish-and-closeout.md` 的 T3.2 决策行 + Result 段加追记（推翻当时的「居中、220px」口径）。
- 未做：未提交、未发布、未装本机、未跑 `desktop:make`（仅 CSS + 测试 + 文档；版本面维持已 bump 的 `0.3.12`）。

### 2026-11-26（第三十五轮）—— feat-046 按需钥匙串 + 首次打开说明（未发布）

- 用户三条指令：① 文档要写「这类应用用 Control/右键 → 打开，双击多半失败」；② API Key 改懒加载，别「无缘无故」弹钥匙串，并写进文档；③ 无害残留要删。总目标＝别人下载后权限按需、逐步获取。
- RED：`electron/secrets.test.mjs` 新增「never touches the system keychain while nothing is stored」，对 `isEncryptionAvailable`/`encryptString`/`decryptString` 计数 ⇒ `expected 1 to be +0`（正是那次可用性探测）。GREEN：`exportPlaintext()` 在 `entries` 为空时直接 `return {}` ⇒ 12 passed。
- 文档双语：README 首次打开改「按住 Control 点按（或右键）→ 打开」+「运行时不需要额外授权，只有首次保存云端 Provider 密钥才访钥匙串，未存密钥启动不弹窗，换版会再问一次」；PRODUCT / ARCHITECTURE 补「空表直接返回、不调 `safeStorage`」；CHANGELOG `[Unreleased]`。
- 清理：`security delete-generic-password -s "Electron Safe Storage"`（开发/冒烟残留，无用户密钥）；复查 exit 44。
- 版本面 TDD bump `0.3.11` → `0.3.12`（先只改 `package.json` 逼出 `release-guards` RED，再补 lock 两处、`RELEASE_VERSION_ERROR`、`version !==` 判定、`feature_list.currentVersion`）⇒ 30 passed。
- 门禁：`NODE_OPTIONS= ./init.sh` **exit 0（96 files / 1301 passed）**；`desktop:make` exit 0，`MD-Convertor-darwin-arm64-0.3.12.zip` = 237,926,019 B，`Info.plist` 0.3.12，`app.asar` 内 `exportPlaintext()` 即新代码。
- 关键实测：新构建（新 cdhash、不在任何钥匙串 ACL 内）在 agent shell 里**不再挂住**，`/health` 200、`/md-convertor-extension.zip` 200（35,934 B），`log show --last 8m | grep -i "Safe Storage"` 零命中；同一实验在 0.3.11 上会静默卡在 `SecItemCopyMatching`（第三十二轮）。
- 环境坑：`ELECTRON_CACHE` 不能指向 `.desktop/electron`（`prepare-desktop.mjs` 先 `rm -rf` 它再拷缓存 zip，等于删源）；改用 `@electron/get` 重下 v43.8.10 到 `~/Library/Caches/electron`。
- 未做：未提交、未 push、未发布、未装本机、未跑三引擎 e2e（只动 `electron/` + 文档，留给发布门禁覆盖）。

### 2026-11-16（第三十四轮）—— `0.3.11` 提交、push 与发布

- 用户指令「提交并push，并且安装到本机」→「发布」。
- 提交：`ab3b7da`（18 files / +282 / −64，实现 + 台账）与 `78c474e`（簿记 3 files / +16 / −17），逐文件 `git add`；`origin/main` `fb63c06` → `78c474e`。
- 重装本机前必须重建：`out/` 那版 ZIP 早于引用转义修复，包内插件还是旧的 ⇒ `rm -rf out .desktop` + `desktop:make`（237,921,848 B，框架 `CFBundleVersion` 43.8.10，包内 `worker.js` 含 `encodeURIComponent` + `%28`）——**这一次重建即第三十三轮簿记行所记的那一次**，装机状态只记该机的 `.workbuddy/memory/DEVICES.md`。
- `git tag v0.3.11 78c474e` → push tag → `env -u *_proxy NO_PROXY=127.0.0.1,localhost NODE_OPTIONS= npm run desktop:release` **第二次 exit 0**：`init.sh` 96 / 1295 passed + 5 skipped → e2e 351 passed / 6 skipped + tracked-file check → live 2 → `desktop:make` → 产物校验。首跑红 1 条 firefox `paste.spec.ts:221`（`gotoHydrated` 等 `/api/settings` 30s），隔离 `--repeat-each=5` 5/5 绿。
- 产物 237,921,860 B / SHA-256 `a63e5192…0154d`；`gh release create`（骨架，notes 文件）+ `gh release upload`（10m01s）；校验非草稿非预发布、asset `uploaded`、服务端 digest 一致、`releases/latest` = `v0.3.11`。
- 文档收口：`docs/TESTING.md` 新增 `## Gated Artifact (0.3.11)` + 门禁段（0.3.10 转 Historical）；CHANGELOG 双语 `[Unreleased]` → `[0.3.11] - 2026-11-16`；README×2 版本句/产物表/门禁版本；AGENTS.md 三处版本句 + 审核 FSD 状态；ARCHITECTURE×2 当前版本句。

### 2026-11-16（第三十三轮）—— 台账漂移修复 + 三项待办整改（未发布）

- 用户指令「先修，全部修完了再统一提交」：上一轮报出的漂移——feat-044 已在 `0c64834` 提交（随后簿记 `4c81a99`），而四处文档仍写「未提交」。
- 只改现役口径（PROGRESS 6 处 / session-handoff 10 处 / 本文件 2 处 / `features/audit-p2-remediation/FSD.md` 1 处，共 19 处）；**历史轮次记录一律不动**——那些「未提交」在当轮为真，属存档。
- PROGRESS 的内部矛盾（Active feature 记「未提交」、Branch 段却写「已提交在 `0c64834`」）随之消除；两份文档的 HEAD / `origin/main` / Branch 口径统一到 `4c81a99` / `fb63c06`。
- 零代码、零版本面改动（仍 `0.3.11`），未 push、未发布。
- 同轮随后按用户「全部修完再统一提」授权做完三项待办（各自 TDD 留痕，详见 `feat-045.verification` 与 `feat-040.verification` 末两条）：
  - **插件写方 percent-encode**（B1 的写方半条）：`references.ts` 新增 `escapeDestination()`，只转义空白/括号/`%#?<>"\\`/DEL，按 UTF-8 字节出 `%XX`（提交门评审抓到首版按 UTF-16 码元编码：NBSP 出 `%A0`、全角空格出 `%3000`，读方 decode 会拿到另一个名字），CJK 与 URL 兜底保持原样；盘上文件名仍可读。RED 4 failed / 20 passed ⇒ GREEN 24 passed；桌面读方已有 `decodeURIComponent`，补两条「转义目标仍能嵌入」的契约用例（首跑即绿，`src/lib/local-docs/` 7 files / 105 passed）；端到端加 `/article-spaced` fixture（`X 上的 姚金刚 (@yaojingang)`）与一条断言「引用恰为 `…%28@yaojingang%29.images/001-photo-one.png` 且 `decodeURIComponent` 指向真实非空文件」⇒ `test:extension` 16 passed。
  - **Electron 43.3.0 → 43.8.10**：43.x 十二条公告全部在 `43.8.1` 及以前清掉，故取同 major 最小步；45.x 留作独立轮次。审计现为 prod 0 / electron 无公告 / 全树 49（3 low / 14 moderate / 27 high / 5 critical）。
  - **`next` 下界 `^16.3.5` → `^16.4.6`**：原区间根本产不出已在跑的 16.4.6 服务端。
- 门禁：`./init.sh` 96 files / **1300 passed**；`test:extension` 16；三引擎 e2e **351 passed / 6 skipped**；`desktop:make` 出 0.3.11 ZIP（**237,921,848 bytes** / SHA-256 `a464af5c…6921f2a8`，框架 43.8.10）。
- **打包冒烟（本轮唯一的环境坑，已定性）**：新构建的 keychain ACL 绑定代码签名，agent shell 里首次运行会静默挂在 `SecItemCopyMatching`（无弹窗、无输出、无 server 子进程）。对照实验：`/Applications` 里已授权过的 0.3.10（Electron 43.3.0）在**同一 shell** 里跑通同一冒烟 ⇒ 挂的是签名不是 43.8.10。故用 `--use-mock-keychain` 取证（preload 桥 + 真实转换均通过）；**带 `ELECTRON_SMOKE_TEST_SECRETS=1` 的规范一次仍需用户在 Terminal 批准弹窗后跑**。`desktop:release` 不跑冒烟，不受影响。

### 2026-11-14（第三十二轮）—— 外部审计 P2 四条整改 + 审计门禁（未发布，版本面 `0.3.11`）

- 用户指令「按照本项目 Harness 要求跑」：先把审计 6 条逐条回仓库复现（全部成立），再按 TDD 修其中 4 条代码 + 1 条门禁缺口；Electron 版本单列 `feat-045`。
- T1.1 同源静默覆盖：`localDocFilename` 只对「清洗改动过名字」的源追加 `-<8 位 FNV-1a>`（RED 5 条）；`ScannedLocalDoc`/`BatchRow` 新增 `outputName`，列表显示真实产物名（路由 RED「expected 1 to be 2」+ 一条三引擎 e2e）。
- T2.0 符号链接边界：`inlineLocalRef` 收 `rootReal`，改为 `realpath` 后比较（RED：目录外链接被嵌成 base64）⇒ 树外拒、树内仍内嵌。
- T3.0 插件 md 写盘：`run()` 复用 `waitForDownload` + `MD_TIMEOUT_MS = 10_000`，中断/超时 → `DOWNLOAD_FAILED`（RED 2 条都返回 `ok:true`）；测试侧 `waitForDownloadComplete()` 随之删除，`--repeat-each=3` 45 passed 证明生产侧真在等。
- T4.0 审计门禁：新增 `scripts/audit-runtime.mjs` + 9 条单测（判报告不判退出码），接线进 `desktop:release`（`init.sh` 之后、`test:e2e` 之前），`release-guards.test.mjs` 事件序同步；真跑 prod 0 / electron 12 条公告。QA-DEV 重写为活跃跟踪项。
- T5.0 版本面 `0.3.11`（TDD 先红后绿），`scripts/` 41 passed。门禁：lint/typecheck 干净、coverage 96 files / 1291 passed、三引擎 e2e 351 passed / 6 skipped / 0 failed、`test:extension` 15 passed。两次 e2e 抖动均判抖动未改代码：firefox 掉 hydration 等（单跑 5/5）与 firefox `NS_ERROR_PROXY_CONNECTION_REFUSED`（系统代理无 localhost 例外，单跑 5/5）。
- 提交门（3 路只读评审）修掉一处真错：面板 `title` 给的是「产物名」（单元格里已有），四处文档说的都是「原名」⇒ e2e 先加 `title` 断言（RED `received 产物名：a-05249472.md`）再改 `panel.tsx` 为 `原名：${row.name}`；另修 8 处台账/计数器陈旧（`waitForDownloadComplete` 现行口径 ×2、coverage 文件数 ×2、stash 假记载、重复的「发布前才 bump」、哈希输入含扩展名、`QA-DEV` 编号）与 CHANGELOG 角标文案。
- 未做：未升级 Electron、未改 `next` 下界、push、发布（提交在提交门之后完成：`0c64834` 实现 + `4c81a99` 簿记）。

### 2026-11-14（第三十一轮）—— 全项目审计 + 整改（未发布）

- 用户指令「找出所有坏掉的、不一致的、低效的、已经不需要的东西」→ 审计清单 →「修吧」。双路只读探查 + 逐条人工复核（探查报告 page.tsx 死变量三条为误报，已剔除；CSS 死类确认零）。
- A1 生产依赖漏洞清零：dompurify 3.4.17 / next 16.4.6 / sharp 0.35.5 / undici / source-map-js（仅 lock 变更 +167/−165）；QA-012 更新为「每次发布门禁重跑生产审计」。
- A2-A4 README×2 / PRODUCT×2 / ARCHITECTURE×2 同步 0.3.10（PRODUCT 补「本地文档处理」节、非目标矛盾修正）。B 清理：electron-cache 重复 zip 116MB、probe-local-cli.mjs、`.gitignore` 死规则。C：四份 PLAN/UI-REVIEW 归档眉批、session-handoff 尾部收口、AGENTS.md 文档登记补全、本文件 verdict 瘦身（超长段清零）。
- 验证：init.sh 95 files / 1274 passed / 0 skipped；e2e 348/6/0 + tracked-file check passed（首跑红系 next build 重写 AGENTS.md 自管块落在运行中，重跑即过）；audit 0。未 bump（无产品代码改动）、未 commit、未发布。

### 2026-10-01（第三十轮）—— feat-043 提交 + `0.3.10` 发布

- 用户真机确认通过（唯一反馈「特点行同行右对齐」已随第二十九轮追补落地）后授权「commit、push加release」。
- TDD bump 0.3.9 → 0.3.10：release-guards 期望先行 RED（1 failed）⇒ `release-desktop.mjs` + `package.json` + lock 两处 + `feature_list.json` → GREEN（30 passed）。
- 提交 `77703c3`（feat-043 S1–S3 + 真机反馈追补 + 版本面，32 files / +1660 / −247）→ push → tag `v0.3.10` 指向构建源码提交。
- 发布门禁 `desktop:release` **一次通过**（3m38s）：lint/typecheck/coverage 全绿、e2e 348/6/0、live 2/2、产物校验过、历史归档守卫退役通知符合预期。
- 产物 `MD-Convertor-darwin-arm64-0.3.10.zip` = 236,226,685 bytes / SHA-256 `f25e0ae9aea0a915748ee5f6790ffb9ae467e35ecdf59512f25749684fcc1945`；包内指纹（footerRow 同行布局、返回文案三件套、去设置、产品特点）全命中；ZIP 3,542 条目 / 566 M。
- GitHub Release `v0.3.10` 已发布（非草稿非预发布、`releases/latest` 已指向、服务端 digest 与本地一致）。**坑**：`gh release create` 带 236MB 资产一把梭 `unexpected EOF`（自动回滚无残留），拆「先建骨架 + `gh release upload`」两步后 53 秒传完（已记 session-handoff Environment Notes）。
- 版本面当时为已发布 `0.3.10`（tag `77703c3`）；该轮不做 bump（后随 feat-044 于 2026-11-14 bump 至 `0.3.11`）。六条未裁决 flake 零命中。

### 2026-10-01（第二十九轮）—— feat-043「UI 走查整改」实施（S1/S2/S3 全绿）

- 按 `docs/PLAN-ui-fix.md` 实施 11 条（9 P1 + P2-1 + P2-2），逐任务 TDD 断言先行；四条断言先行（settings「返回」文案映射、local-docs「返回文档处理」、settings:548 CLI 启停、settings:697 重复提示）4/4 先落 RED 再实现。
- S1 顶栏与栅格（CSS Grid 三列 + `.brand` 移出 `.backSlot`、`--col: 880px`、hintRow 同轴、entryCard 去 aspect-ratio）、S2 状态与反馈（placeholder `#6b7484`、禁用态换色不降透明度、CLI 状态点、去重复提示）、S3 观感收尾（去设置胶囊、aria-describedby 生命周期、条件 title）全部落地。
- 真机确认后追加一条用户反馈：特点行「无需登录/图片内嵌/随用随走」独占一行观感怪，改为与翻译勾选框**同行、右对齐**（RED→GREEN，取代 P1-6 左缘同轴口径；init 95/1274/0 + e2e 348/6/0 三引擎）。
- 三阶段独立 QA 验收均 PASS（T1.6/T2.5/T3.3），终验 11/11 销项；红线 `home.spec.ts:540-553` 原文 md5 `61d1d6bd` 全程未动；六条未裁决 flake 零命中。
- 门禁：T1.6 = init 95/1274/0 + e2e 330/6/0；T2.5 = 95/1274/0 + 342/6/0；T3.3 = 95/1274/0 + e2e 354 tests（Chromium 118/0/0、Firefox 115/3/0、WebKit 115/3/0）。
- 工程师申报 7 条不确定项：5 接受（胶囊文字色、`.modeTab:disabled` 最小化、`.action:disabled` 前瞻配方、settings 胶囊提前、`useSyncExternalStore`）、2 返工（translateToggle 禁用态 opacity→换色、两条 e2e 标题未同步）后全绿。
- D3 顶栏品牌对齐存在文档歧义（交接写「86px 配平列/品牌左对齐」vs 规格「`1fr auto 1fr` + `justify-self:center`」），按**规格口径**实施（brandCenter=viewportCenter=590 实测），待用户确认。
- 版本面保持已发布 `0.3.9`（实施期不 bump）；未提交、未发布（commit 等用户另行指示）。

### 2026-09-30（第二十八轮）—— UI/UX 走查 + feat-043 改修实施计划（纯文档，零代码）

- 用户指令三段：「给产品画面 UIUX 出优化建议（1 标题居中 2 返回/设置按钮与框体不对齐）+ 走查报告」→「给出改修的实施计划」→「按照plan动手」后改口「**开发用新会话开发**」。本轮只走查与规划，实现留给新会话。
- 证据：`dev:web` + Playwright 1180×820@2x 浏览器态 + 真实 Electron 窗口（`--no-sandbox` + CDP），共 9 张实拍。产出 `docs/UI-REVIEW-2026-09-30.md` + `outputs/UI-REVIEW-2026-09-30.html`（图文版）：19.5/25、无 P0、P1×7 + P2×6；根因＝`.backSlot` 86px 挤偏品牌、顶栏 1086px 与 820/960/860 三套内容宽度不对齐。
- 修正报告一处对比度错误：placeholder `#767f8f` 实为 4.04:1（报告写 ≈4.6:1），规格改定 `#6b7484`（4.71:1）。
- 规划：`docs/UI-FIX-DESIGN-SPEC-2026-09-30.md`（token/控件/禁用态规格 + **16 项 e2e 风险、4 条断言必须先行改**）→ `docs/PLAN-ui-fix.md`（feat-043：D1–D4 决策 + S1/S2/S3，逐任务带 RED 列）。锁死：`--col: 880px`（非 960）、`#6b7484`、顶栏左对齐配平、只做 11 条（9 P1 + P2-1 + P2-2），P2-3…P2-6 推迟。
- 基线曾红 1 条（`desktop-server-scope` 缺插件 zip）：`.desktop/server` 是 9-22 陈旧副本；`desktop:prepare` 又因 `~/Library/Caches/electron` 缺失 ENOENT ⇒ 既有 zip 挪进 `.desktop/electron-cache/` + `ELECTRON_CACHE` 重跑 ⇒ **exit 0，95 files / 1270 passed / 0 skipped**。recipe 入 `session-handoff.md` Environment Notes。
- 未做：生产代码零改动；`feature_list.json` 未登记 feat-043（留给 T1.0）；未 bump、未提交、未发布。

### 2026-09-30（第二十五轮发布）—— 提交门 + `0.3.9` 提交 / 发布

- 用户指令：「可以，commit、push、release」——授权完整发布流程（提交门结果只修台账与文档，生产代码一行未动）。
- 提交门 4 路只读评审：ponytail **无可删项**（零新增 CSS、复用既有 hero token、删掉变死的 `.title`），仅两条冗余断言与两处可选；code-review Standards 无 TDD 硬违规；Spec 一致；neat-freak 找出 3 处陈旧台账句（`AGENTS.md` 版本句、`PROGRESS.md` 的 `0.3.7` + 已删符号 `resolveScanDir`、`ARCHITECTURE.md`/`.zh.md` 的 `0.3.6` 版本句）与一段 CHANGELOG 英文歧义。
- 门禁前修：`e2e/local-docs.spec.ts` 的「卡片说明句」断言补 `{ exact: true }`（旧长句以该子串结尾，子串匹配在改动前后都绿 ⇒ 本来不具判别力），删掉重复的 h1 断言与冗余的 1280 溢出检查；台账三处 + CHANGELOG 措辞按评审修正；`session-handoff.md` 压到 147 行 / 25,019 B（为发布后簿记留出余量）。**`src/` 未再改，版本面仍是 `0.3.9`。**
- 提交：`9f3642e`（实现 + 版本面 + CHANGELOG + 台账，19 files / +168 / −74）→ push `origin/main` → 清 `out/` + `.desktop/` 跑 `NODE_OPTIONS= npm run desktop:release` **exit 0**（`./init.sh` **95 files / 1265 passed + 5 skipped** → e2e **315 passed / 6 skipped** → live **2 passed** → `desktop:make` → 产物校验 + 历史归档守卫退役通知符合预期）。
- 前两次门禁红：① firefox `e2e/home.spec.ts:568` 报 `NS_ERROR_PROXY_CONNECTION_REFUSED`（已登记的第 6 条未裁决 flake；隔离 `--repeat-each=5` **5/5 绿**，复跑全量 315 passed）；② `test:live` 的 WalkingLabs 用例 `expected 'direct' to be 'browser'`（上游/网络瞬态；隔离复跑 **2/2 绿**）。两次都与本轮改动无关（本轮只动本地文档页文案与版本面）。
- 发布：tag `v0.3.9` 指向构建所用源码 `9f3642e` → `gh release create v0.3.9 … --latest`：非草稿非预发布、asset `uploaded`、服务端 digest 与本地一致、`releases/latest` = `v0.3.9`。**未**把 ZIP 拷进 `~/Downloads/MD-Convertor-archive/releases/`（release guard 会拒绝未登记项）。
- 产物：**236,224,633 bytes**，SHA-256 `5e75709fc864a524661b0994bec0d87ff2eaa8d229f801416e9e34aa3239a9c9`（较 0.3.8 少 42 B）；`Info.plist` 0.3.9 / macOS 12.0、主可执行 arm64、`Resources/server` 顶层 = `.next / browser / node_modules / package.json / public / server.js`（零仓库产物）、ZIP 3,542 条目 / 展开 566 M。
- 未做：`/Applications` 仍是 `0.3.8`（本轮未重装）；`extension/` 写方 percent-encode、云端 Provider 实文实测仍待授权。
### 2026-09-30（第二十五轮）—— 本地文档页补页级标题（版本面 → `0.3.9`，未发布）

- 用户报告：「粘贴 URL 那个面板有大标题和副标题，但本地文档转换那页没有」⇒ 给诊断（截图实测：转换页 `h1` 42–64px + 副标题，本地文档页**整页无 `h1`**，唯一标题是卡内 18px `h2`）+ A/B/C 三案，用户选 **A**：加同级 hero，卡内不再重复标题。属「成熟产品加画面」⇒ 方向 = app 本身，复用 `.hero / .title / .subtitle / .accentText`，**零新增 CSS**。
- TDD：`e2e/local-docs.spec.ts` 先加「画面级大标题与副标题和转换页同级，卡片里不再重复一次标题」（唯一 `h1` 文案 + `heading level 2` 计数 0 + 两条新文案 + 溢出为空）⇒ RED（该页无 h1）⇒ `page.tsx` 的 local-docs 分支加 `<section className={styles.hero} aria-labelledby="page-title">` + `<h1 id="page-title">` + 副标题；`panel.tsx` 去掉卡内 `h2`/`aria-labelledby`；`panel.module.css` 删掉变死的 `.title` ⇒ GREEN（chromium 17 passed）。
- 溢出核对用 `getBoundingClientRect().right > innerWidth` 逐元素查（**不用** `scrollWidth === clientWidth`，会被 `overflow-x: clip` 骗过），**960 / 375** 两档视口=空；960 是窗口最小宽度（`electron/main.mjs` `minWidth: 960`），nowrap 最紧的一档。
- nowrap 陷阱：`page.module.css` 在 `≥761px` 对 `.title/.subtitle` 施加 `white-space: nowrap` ⇒ 副标题刻意写短（长文案会被裁掉，无省略号）；去改那条查询会同时改变转换页既有行为，未做；约束已写进 FSD §4.1。
- 版本面 `0.3.8` → `0.3.9`（TDD）：RED `expected 'Release version must be 0.3.8.' to contain '0.3.9'` ⇒ 改 `release-desktop.mjs`(2 处) / `package.json` / `package-lock.json`(2 处) / `feature_list.currentVersion` ⇒ 30 passed。当时未发布、未 commit、未装本机（发布与提交待授权）——**已由第二十六轮提交并随 `v0.3.9` 发布**。
- 门禁：`NODE_OPTIONS= ./init.sh` exit 0（95 files / 1270 tests；`src/app/**` 在 vitest 覆盖率 include 之外，计数与上轮相同）；`npm run test:e2e` **315 passed / 6 skipped / 0 failed**（+3 = 新用例 ×3 引擎）+ tracked-file check。
- 只报未改：① 375px 下文档表拥挤（既有基线，未碰表格 markup/CSS，产品最小窗宽 960 也到不了 375）；② `design_audit` 工具自身报错（相对路径报「目标下无前端文件」、绝对路径崩 `runNonTextContrastChecks is not defined`）⇒ 改用 `design_contrast` + 手工核对。

### 2026-09-30（第二十四轮）—— 提交门四条「只报未改」的处置（1 条修 / 3 条判不改）

- 用户问「只报不改这四条，影响大吗？要修正吗」，答复后指示「改吧」：只改第 2 条，其余三条**刻意不改**并在此留档，避免下轮评审重提。
- ① `withoutTrailingSlash` 丢 `|| "/"`：**误报，且照改会出错**。抽取前后逐字相同（旧 `client.ts` 就是 `replace(/\/+$/, "")`），全仓 `|| "/"` 零命中；实算六个调用点，加守卫会把 `processedOutputDir("/")` 变成 `"//processed"`、`joinDocPath("/","x.md")` 变成 `"//x.md"`。判：不改。
- ② `tests/desktop-server-scope.test.mjs` 的 `if (!prepared) return;`：**真问题，已修**。`desktop:release` 里 `init.sh` 跑在 `desktop:make` 之前，本轮又清过 `.desktop`，所以那 5 条「keeps …」什么都没查就报绿。RED：无 `.desktop` 时该文件 **17 passed / 1 skipped**；改为 `describe.skipIf(!prepared)` 后 → **13 passed / 5 skipped**（诚实），有真产物时 **18 passed**（真检查在跑）。两条「never allows」不是同义反复——裸 checkout 下它们是该文件唯一在跑的守卫——保留。
- ③ `tests/secrets-smoke-payload.test.ts` 的文本级 `indexOf`：不改。它守的是只在真机打包冒烟里走的路径（需 Electron + 钥匙串，`init.sh` 进不去），要变强须在生产 `electron/main.mjs` 抽纯函数；已知弱点只是「变量改名误红」与「文件里先前多一个 PUT 调用会指错」，不涉安全 / 数据丢失。
- ④ ponytail 3 处可删项：不改（`DESKTOP_SERVER_SCOPE`/`REQUIRED_FILES` 把契约放在清单旁边、删了只是搬家；`joinDocPath` 是有名字的意图；e2e 重复的 marker JSON 模板无行为影响）。
- 门禁：`NODE_OPTIONS= ./init.sh` exit 0（95 files / 1270 tests）。**纯测试改动，不 bump 版本、不发新版**（`src/` / `electron/` / 打包配置均未动）。

### 2026-09-30（第二十三轮）—— 提交门 + `0.3.8` 提交 / 发布

- 用户指令：「那就无所谓，commit、push 加提交 release 到 Github吧」——接受「下载后可能被 Gatekeeper 拦」的既有结论（QA-008），直接走提交门 + 发布。
- 提交门 4 路只读评审（ponytail / code-review 两轴 / neat-freak），**0 硬违规**；按第二十轮先例**只改台账与版本面，生产代码一行未动**，行为存疑项只报未改（`withoutTrailingSlash` 丢 `"/"`、`desktop-server-scope.test.mjs` 两条近同义反复断言 + 静默 return、`secrets-smoke-payload.test.ts` 的文本级 `indexOf` 守卫、ponytail 的 3 处装饰性可删项）。
- 版本面 `0.3.7` → `0.3.8`（TDD）：先改 `scripts/release-guards.test.mjs` 期望 ⇒ RED（`expected 'Release version must be 0.3.7.' to contain '0.3.8'`）⇒ 改 `package.json` / `package-lock.json`(2 处) / `feature_list.currentVersion` / `scripts/release-desktop.mjs`(2 处)。bump 暴出 `makeReleaseFixture` 默认版本写死（5 failed）⇒ **fixture 默认值改为从 `RELEASE_VERSION_ERROR` 派生**（`CURRENT_RELEASE_TARGET`），此后 bump 只需改一处 ⇒ **30 passed**。
- 文档：`CHANGELOG.md`/`.zh.md` 的 `[Unreleased]` → `[0.3.8] - 2026-09-30`（zh 的 `### Fixed` 一并正名为 `### 修复`）并补打包收窄条目；`docs/TESTING.md`（收窄口径 + 可移植性实测 + 计数 95/1270）；`AGENTS.md` 版本句；`PROGRESS.md` / `session-handoff.md`（压到 143 行 / 24,375 B）/ `feature_list.json`。
- 门禁：`NODE_OPTIONS= ./init.sh` exit 0（**95 files / 1270 tests**）⇒ `NODE_OPTIONS= npm run desktop:release` **exit 0**（清 `out/` + `.desktop/` 后跑：`./init.sh` → e2e **312 passed / 6 skipped / 0 failed** → live **2 passed** → `desktop:make` → 产物校验 + 历史归档守卫（0.1.0–0.2.1 与只读 0.1.3 副本报退役，符合预期））。
- 提交与发布：`6e00474`（实现 + 版本面 + CHANGELOG + 台账）→ push `origin/main`（`3a75cea` → `6e00474`）→ tag `v0.3.8` 指向 `6e00474` → `gh release create v0.3.8 … --latest`：非草稿非预发布、asset `uploaded`、服务端 digest 与本地一致、`releases/latest` 指向它。**未**把 ZIP 拷进 `~/Downloads/MD-Convertor-archive/releases/`（release guard 会拒绝未登记项）。
- 产物：**236,224,675 bytes**，SHA-256 `94624625fdb99b492f533b23d9ae63aa22faa5153b5bbea6bc8a02f12cdeb2ea`；解压核查 `Resources/server` 顶层 = `.next / browser / node_modules / package.json / public / server.js`（零仓库产物）、ZIP 3,542 条目 / 展开 547 M、asar 命中第二十一轮 `delete current.defaults`、`Info.plist` 0.3.8 / macOS 12.0、主可执行 arm64。
- 未做：`/Applications` 未重装（仍是第二十一轮构建）；`extension/` 写方 percent-encode、云端 Provider 实文实测仍待授权。

### 2026-09-30（第二十二轮）—— 打包镜像收窄为白名单 + 无仓库 / 无缓存可移植性实测

- 用户指令：开一轮做「收窄」，硬条件＝除签名与 arm64 外，别的电脑下载即可安装使用（不依赖开发机路径 / 仓库 / 缺失运行文件）。
- 改动（TDD）：`scripts/prepare-desktop.mjs` 的整目录 `cp` 换成按 `scripts/desktop-server-entries.mjs` 白名单逐项拷贝；新增 `tests/desktop-server-scope.test.mjs`（RED：旧 `.desktop/server` 1 failed，列出镜像混进的仓库条目 → GREEN 18/18）与 `scripts/prepare-desktop.test.mjs` 的 fixture 断言。
- 尺寸口径说准：镜像里那批仓库目录本身只有 ~8 MB ⇒ **省的是卫生与确定性，不是体积**。ZIP 236,232,689 B（旧 239,472,776 B，−3.24 MB / −1.35%）、条目 3,991 → 3,542（少 449 个文件）、`.app` 572 M → 565 M。
- 真正价值：本轮 build 时 `out/`（829 M）在场，`.next/standalone` 镜像到 1.17 GB（旧代码会整份拷进去，第二十一轮曾见 2.3 G 的 `.app`），白名单后 `.desktop/server` 稳定 288 MiB ⇒ **包的大小不再取决于工作树**。
- 可移植性实测（本机可做的全部）：新 ZIP 解到 `/tmp` 后，`HOME=/tmp/md-fresh-home`（无 `settings.json` / 无 keychain 项 / **无 `~/Library/Caches/ms-playwright`**）跑转换冒烟 → example.com `passed: browser`，JS 渲染页 `passed: browser, 11254 bytes, 1 embedded image`；**把仓库改名**后同冒烟仍通过（已 trap 还原）；`/health` 200、`/md-convertor-extension.zip` 200；0 孤儿进程。
- 未做/待用户：未 commit、未 push、未 bump、未跑 `desktop:release`、未重装 `/Applications`。门禁 `./init.sh` 95 files / 1270 tests 绿；e2e 未跑（未改 `src/`）。

### 2026-09-30（第二十一轮）—— 预发布评审「只报未改项」全部落地 + 带修复构建装入本机

- 用户三条指令：「1. 改」（把发布前评审里只报未改的项落地）、「2. 怎么收」（口述收窄打包镜像的办法，**只答不改**）、「3. 安装新包」。
- ① 表头「全选」只勾 `state !== "skip"` 的行且不设 `force`（逐行手勾仍是重做）—— RED：新用例「「全选」只勾未处理的文档」chromium 1 failed；GREEN：`e2e/local-docs.spec.ts` chromium **16 passed**。推翻「评审所说无法修」的默认假设：可以直接从语义上修（勾选＝默认不重做 vs 手勾＝重做）。
- ② `force` 保留「忽略 `skip` 也忽略哈希」（L4 逃生口要在源未变时有效，B1 那一轮正是如此）⇒ **改规格不改代码**：FSD §4.6 放宽并注明推翻原措辞，`process.test.ts` 加钉住用例（源未变：不带 `force` ⇒ `skipped`，带 `force` ⇒ 重算）。
- ③ 推翻评审的「`skipped` 分支 UI 不可达」：服务端来的跳过可达（新 e2e「内容没变只改了 mtime」⇒ `已处理，跳过`、汇总「跳过 1 篇」、`saved === []`），FSD §4.7 记为它唯一可见路径；客户端 `runBatch` 里那条真正的死分支（本地 skip 镜像）删除，`client.test.ts` 改钉「未勾选的已处理行不发请求」。
- ④ ponytail 三处可删项全部落地：删 `resolveScanDir` + 2 条自测；`withoutTrailingSlash` 提为导出、`joinDocPath` 复用（去重复正则）；`scan.ts`/`process.ts` 两份相同目录守卫合并为 `paths.requireSafeDirectoryPath`。
- ⑤ 本轮新发现并修的缺陷：打包冒烟 `ELECTRON_SMOKE_TEST_SECRETS=1` 在 0.3.7 上必红（GET `/api/settings` 的回包被整体回灌 PUT，而 0.3.7 起 GET 多带响应专用的 `defaults`，严格校验 ⇒ 400 `INVALID_SETTINGS`）；`electron/main.mjs` 回灌前 `delete current.defaults`，新增 `tests/secrets-smoke-payload.test.ts` 源码级守卫。**发布门禁不跑冒烟**，所以 0.3.7 带着它出过门。
- 门禁：`NODE_OPTIONS= ./init.sh` **exit 0**（**94 files / 1252 tests**，+1 文件；测试数抵消：+2 新钉住，-2 删 `resolveScanDir`）；`npm run test:e2e` **312 passed / 6 skipped / 0 failed**（三引擎 2.6m）+ tracked-file check。
- 装包（两次）：先按发布 ZIP 装入发布版 0.3.7（**554 M**，无 quarantine，旧 0.3.6 归档）；用户随后要「把修改后的给装上」⇒ 清 `out/` + `.desktop`（先备份发布 ZIP 到 `/tmp`，sha256 复核一致）→ `desktop:make` exit 0（`.app` 572 M）→ 用新产 ZIP 装入 `/Applications`，原发布版归档为 `MD-Convertor-0.3.7-release.app`。判别式指纹：`delete current.defaults` 仅新包命中（asar），`requireSafeDirectoryPath` 仅新包 `.next/server` 命中。
- 在新装包上实测打包冒烟（**直接证据**）：`Preload bridge smoke passed` + `Runtime secret smoke passed: TRANSLATE_NOT_CONFIGURED → TRANSLATE_PROVIDER_ERROR → TRANSLATE_NOT_CONFIGURED`（0.3.7 发布版上这里必红 400）；`/health` 200；`settings.json` / `secrets.json` 与备份逐字节相同、无 `smoke-runtime` 残留。
- 未做：未 bump 版本（0.3.7 已发布，下一版未获授权）、未跑 `desktop:release`（会以 0.3.7 之名重产产物）、未收窄打包镜像（方案已口述交用户）、未 commit / push。已知待办：下一轮发布第一步是把版本面 + `release-desktop.mjs` + guard fixture 一起推到 `0.3.8`，否则发布门禁会用 0.3.7 的名字打 0.3.7 之后的源码。

### 2026-09-30（第二十轮）— 提交门 + `0.3.7` 发布（生产代码零改动）

- 用户指令：先做选项 1（删掉 S4 第 8 条 / FSD §6 第 10 条里「行状态注明只翻译了非目标语言部分」这条陈旧期望，与 R7 口径统一），然后 commit、push、发布 release。
- 提交门四个并行只读评审：ponytail（3 处装饰性可删；无第二套编排 / 第二条写盘路径）；code-review · Spec（S4 第 8 条落差、`skip` 分支 UI 不可达 + 全选会重做已处理文档、`force` 跳过 sha256 短路）；code-review · Standards（无 TDD 硬违规，两层路径校验 / 浏览器模块无 `node:*` / 无密钥均通过）；neat-freak（`activeFeature` 未置 `null`、S4 三处「待签」、本文档判决句）。⇒ **只改台账与文档，生产代码未动**（已签字的构建不重做）；行为存疑项与 3 处删减只报未改，等用户裁决。
- 提交：`84ddf08`（实现）+ `9afbe36`（文档/台账，含 CHANGELOG `[Unreleased]` → `[0.3.7] - 2026-09-30`）；`origin/main` `3576c19` → `9afbe36`，另推 tag `v0.3.7`。
- 发布门：`npm run desktop:release` exit 0 —— `init.sh` 93 files / 1252 tests（96 / ≈87.8 / 98.2）→ e2e 306 passed / 6 skipped / 0 failed（2.5m）→ live 2/2 → `desktop:make` → 产物校验 + 历史归档守卫（缺失项报退役）。首跑红 1 条 firefox（`local-docs.spec.ts:404` 的 `/api/settings` 水合超时，隔离 5/5 绿），已记进 `docs/TESTING.md`。
- 产物：239,472,776 bytes / SHA-256 `6986356b0c5a80c1cffc46092eea305b59ad21563225de1844fac1aad171733c`；`gh release create v0.3.7 --latest` ⇒ asset `uploaded`、服务端 digest 一致、`releases/latest` 指向它。未把 ZIP 拷进 `~/Downloads/MD-Convertor-archive/releases/`。
- 未做：未 bump 版本、未把 0.3.7 装到本机 `/Applications`（仍是 0.3.6）；未改任何生产代码。

### 2026-09-30（第十九轮）— 行状态只报状态（R7）+ `feat-042` 关闭

- 用户要求：某篇文档转换后，行内只显示状态（例如「完成」），不要带内嵌/保留张数。
- 改：`src/app/local-docs/panel.tsx` 的 `statusLabel`，`done` 分支 → `"完成"`（一句）。数据层与汇总行未动，张数仍在汇总行 `内嵌图片 N 张 · 未内嵌 M 张`，失败行仍带原因。
- TDD：RED＝`e2e/local-docs.spec.ts` 两处断言改为 `{ name: "完成", exact: true }`（**必须 `exact`**，Playwright 的 name 默认子串匹配，旧文案下会误绿）→ chromium 1 failed；GREEN＝`e2e/local-docs.spec.ts` chromium **14 passed**。注意 `src/app/**` 不在 vitest 覆盖率 include 里，本轮证据是 e2e。
- 推翻了 FSD §4.7「每行状态」与 §4.4「已知命中」的原口径（原本要求行内写 N/M，防 ≥30 图用户以为丢图）；已同步 FSD 两处、S3 `## Result` 行、S4（§第六轮 + 两张验收表第 12 条）、CHANGELOG.md/`.zh.md`。
- 门禁：`NODE_OPTIONS= ./init.sh` exit 0；清代理后 `npm run test:e2e` **306 passed / 6 skipped / 0 failed**（三引擎 2.5m）+ tracked-file check；`feature_list.json` 38 条 / `in-progress`。
- 产物：清 `out/` + `.desktop` 后 `desktop:make` → `.app` **572 M**；chunk 指纹：`完成（内嵌` 已消失、`内嵌图片 ` 仍在。新构建已打开（PID 60736 / `127.0.0.1:49466`）供用户重测；未跑 `desktop:release`、未 push、未 commit。
- **关闭**：用户在该构建上跑完 **12 条人工验收**，回「真机测试OK」⇒ `feat-042` 置 **`done`**（verification 38 → 39 条，原「ALL 12 PENDING」句改写为已签字）。本步只动台账与文档，无代码变更。

### 2026-09-30（第十八轮）— 设置页长路径省略 + 验证范围收口

- **报告 1 条**：设置页「输入」卡片路径过长时把右侧按钮挤到下一行。**根因**：`.providerHead` 是 `flex-wrap: wrap`，折行看 max-content 宽度，而 `.path` 只有 `min-width:0` + 省略号、没有 flex basis ⇒ 超长路径先撑断行，按钮才下移。
- **修复**：`.providerHead .path { flex: 1 1 0 }`（输入 / 输出 / 本地代理三处共用；`.providerHead` 保留 `wrap`）。TDD：`e2e/settings.spec.ts` 新用例 RED（按钮与路径中心差 40px）→ GREEN（`settings.spec.ts` + `local-docs.spec.ts` chromium 47 passed）。
- **修掉上一轮钉住用例自身的缺陷**：`e2e/local-docs.spec.ts:125` 导航后即结束，桩 `route.fetch()` 被 dispose ⇒ `Response has been disposed`（两次全量跑各红 1 例）；现在等两次导航各自的设置请求落地（`--repeat-each=10` 10/10 绿）。
- **`test.exclude` 加 `.desktop/**` + `out/**`**：它们是 `.next/standalone` 仓库镜像的副本，少了会让 `desktop:make` 后的 `./init.sh` 收进 307 文件 / 51 failed。
- **新发现（只报未修）**：`next build` 把仓库根整个镜像进 `.next/standalone`（401 M，389 M 是正牌 `node_modules`）⇒ `.app` 的 `Resources/server` 带一份仓库副本（2.3 G → 清 `out/`/`.desktop` 后 571 M）；`/Applications` 的 0.3.6 无此副本，机制未查明；收窄需改 `prepare-desktop.mjs`，待用户定。
- **门禁**：`init.sh` exit 0；`test:e2e` **306 passed / 6 skipped / 0 failed**（三引擎 2.5m）。首跑两条 flake（webkit / firefox 各一：桩响应被 dispose、`NS_ERROR_PROXY_CONNECTION_REFUSED`），均在测试侧修掉或隔离复跑绿。
- **未做**：12 条人工验收待签；未跑 `desktop:release`、未 push、未动 tag/ZIP。

### 2026-09-30（第十七轮）— 真机第二轮 5 条：3 条布局落地，2 条不复现只钉住

- **分档**：可确认的 3 条按 TDD 修（RED：`e2e/local-docs.spec.ts` 3 failed → GREEN：该文件 14 passed）；无法复现的 2 条不猜改机制，只加「钉住行为」回归用例 + 如实汇报。
- **已修**：①删「先勾选要处理的文档。」这一支与常驻占位（`notice` 只在有真实信息时渲染、`.hint` 去 `min-height`）——推翻十六轮 L1 的「常驻占位」；②`.toolbar { justify-content: flex-end }`；③`summaryText` 拆出 `countsText`，结果区改 `.result`/`.resultText`（两行）`/`.actions`（按钮在右）。
- **R1/R5 未复现（证据）**：浏览器探针与**真实 Electron**（真实 preload + 真实 `settings.json`，`--user-data-dir` 隔离）都正确回到面板（URL 确为 `/settings?from=local-docs`）、两端都显示解析后的 `/Users/huanghaohai/Downloads`（仅 `/api/settings` 缺 `defaults` 时才会回落成那句文字，而 GET/PUT 都带）。`/Applications/MD-Convertor.app`、`out/`、`.desktop/server/server.js` 的 mtime 全是 **9-23**，早于面板落地 ⇒ 不是所跑的那个应用；已请用户确认运行方式。
- **新增钉住用例 2 条**（`e2e/local-docs.spec.ts`，真实路由；其中 parity 一条只跑 chromium——真实设置库跨 project 共享）：面板→设置→返回落回面板；设置页与面板显示同一解析路径。
- **文档**：`S4`（§第四轮 + 验收表第 3/6 条 + 推翻 L1 半条的注）、`FSD` §4.7 汇总排版、`S3` 追改段、`CHANGELOG(.zh)`、`feature_list.json`、`PROGRESS.md`、`session-handoff.md`、本文件。
- **门禁**：`NODE_OPTIONS= ./init.sh` **exit 0**；`npx vitest run` **93 files / 1252 tests**（coverage 96 / 87.78 / 98.2）；清代理后 `test:e2e` **303 passed / 6 skipped / 0 failed**（2.5m）；首跑 1 条 firefox flake（`settings.spec.ts:731` 桩路由未命中，隔离 3/3 绿），复跑即无，未修（范围外）。
- **未做**：12 条人工验收待签；未跑 `desktop:release`、未 push、未动 tag/ZIP。

### 2026-09-30（第十六轮）— 真机 16 条 + B1 全部落地（只修读方）

- **授权与范围**：用户 7 条决策（删 eyebrow / 窄屏退化 / 上下居中 / 好 / 不保留只改状态 / 参考面板路径样式 / 按建议用 URL 参数）+「其他按你的意见执行」⇒ U1–U6、L1–L7、B1–B3 全部实施；路径显示统一为面板样式（单行 + 省略号 + `title`）。
- **B1 定位与修复（TDD，只修读方）**：真机样例 `~/Downloads/X 上的 姚金刚 (@yaojingang).md`（11 图）→ `src/lib/local-docs/scan-refs.ts` 的 `INLINE_IMAGE` 用 `[^\s)]+` 取目标，路径含空格/半角括号时整条 link 不匹配、静默跳过。改为目标允许空格与配平括号、不跨行；RED 4+1 例 → 3 failed；GREEN `npx vitest run src/lib/local-docs/` = 7 files / 99 tests；真机探针 `{"embedded":11,"kept":0,"warnings":[]}`。写方（插件 percent-encode）未动。
- **U1–U6 / L1–L7 / B2–B3**：入口画面删标题/副标题/eyebrow、卡片正方形（<761px 退化 auto）、文案与插件副标题改写并居中、链接加下划线；面板三处提示改固定占位（列表不下沉）、工具栏顺序 翻译产物→重新扫描→一键转换、删每行「重新处理」、统一「一键转换」；设置页与面板共用 `inputDirLabel()` + `defaults.inputDir`、`?from=` 记住来源画面；品牌水平位置与长路径单行截断。
- **口径更正**：`docs/TESTING.md` 的「入口卡包含内层 tab」改为「卡片是 button、名字不再互为子串，但同屏可达的『富文本转换』仍要 exact」。文档收口：S4、FSD、PRD、S3、CHANGELOG(.zh)、`feature_list.json`（三批改「已实施」+ 新增本轮）、`PROGRESS.md`、`session-handoff.md`。
- **门禁**：`NODE_OPTIONS= ./init.sh` exit 0（Node 24.15.0；93 files / 1252 tests；覆盖率 96% / 分支 87.78% / 函数 98.2%）；`tsc --noEmit` 与 eslint 干净；清代理后 `npm run test:e2e` **296 passed / 4 skipped / 0 failed**（三引擎，2.5m，无 flake）。
- **未做**：12 条人工验收待签（第 9 条按修订版重跑）；未跑 `desktop:release`、未 push、未动 tag/ZIP。

### 2026-09-29（第十五轮）— 真机反馈落地的首页入口画面 + 修掉一条确定性 firefox 失败

- **裁定**：首页应为**入口画面**（两张入口卡 + 底部插件下载），二级画面能回入口；这是 FSD 第 51 行「一开始的选择画面」的本意，S3 的「顶部 tablist + 默认落转换画面」作废（非新增需求，不重做需求对齐）。
- **落地（有真 RED）**：`src/app/page.tsx` → `homeMode: "home" | "convert" | "local-docs"` 互斥早返回；入口两张 `role="button"` 卡片；二级画面页头「← 返回」（`aria-label="返回首页"`，避开结果页的「返回顶部」）；删掉外层 `tablist`/`aria-controls`/`handleHomeModeTabKeyDown`；CSS 新增 10 个类、删掉死掉的 `.homeNav`。RED：`e2e/home.spec.ts -g "首页入口画面"` **4 failed**；GREEN：chromium **48 passed**、三引擎 × `--repeat-each=3` **225 passed**。
- **修掉一条确定性 firefox 失败（`home.spec.ts:109`，不是 flake）**：本机 firefox 在视口底部窄带（该布局 y≈672＝按钮垂直中心）丢合成鼠标点击（各 x 全空；`y=661`/`y=690` 正常；`y=700` 的探针落到 `clientY=652`）。`elementFromPoint` 仍命中按钮、DOM `click()` 能切 tab ⇒ 输入派发问题。修法：点偏上位置（`click({ position: { x: 30, y: 6 } })`）；**`toPass` 重试包装 5/5 全红**。机制已写进 `docs/TESTING.md`。
- **测例侧**：新增 `e2e/entry.ts`（`gotoHydrated` 等 `/api/settings` GET）；13 处裸 `goto("/")` 改走它；`translate.spec.ts` 的 `page.reload()` 现在回入口画面 ⇒ 重载后补 `gotoConverter`。
- **门禁**：`NODE_OPTIONS= ./init.sh` **exit 0**（92 files / 1237 tests，与 S4 基线相同——`src/app/**` 不在覆盖率 include）；`tsc`/eslint 干净；`test:e2e` **278 passed / 4 skipped / 0 failed**；`e2e/debug.spec.ts` 与 `test-results/` 已删。
- **文档**：PRD R8/R9 + §3.1、FSD §4.1 整表 + §6 第 2/6 条、S3 `## Result` 追改段、S4 人工清单第 1 条与追改段、`TESTING.md`、`CHANGELOG`×2、`feature_list.json`、`PROGRESS.md`、`session-handoff.md`。
- **未验证/风险**：**12 条真机验收仍待签字**；`0.3.7` 未发布、未 push、S1–S4 改动均未提交；环节 4 的 `design_audit` 7 条 🔴 全为既有基线（focus-visible 计数误报、字体族数、`".downloads"` 误报），本轮未顺手修；三条 firefox load flake（`home.spec.ts:305`、`paste.spec.ts:212`、新增观察 `settings.spec.ts:544`）维持判定，改完 CSS 后全量 e2e **278 passed / 4 skipped / 0 failed**。

### 2026-09-29（第十四轮）— S4 插件 ZIP 与收口实施完成（T4.0–T4.1/T4.3 绿；12 条真机验收待签）

- **T4.1 ZIP**：既有 `scripts/build-extension.mjs` —— 三份产物 + `使用说明.md` → 暂存 `extension/dist-package/<pid>/md-convertor-extension/` → `ditto -c -k --norsrc --noextattr --keepParent` 到 `pack.zip` → `rename` 成 `public/md-convertor-extension.zip`（未新增脚本、未装 zip 库）；`package.json` 加 `"prebuild": "npm run build:extension"`，`.gitignore` 加 `public/*.zip` 与 `extension/dist-package/`。RED：`extension/tests/extension-package.test.mjs` 4 failed（ZIP 不存在）⇒ GREEN **4 passed**；接线实测 `rm -f` 后 `npm run build` 重建（两次串行均 **34692** bytes）。
- **三处实测坑**：① 不带 `--norsrc --noextattr` 时 `ditto` 带出 4 个 `._*` AppleDouble（ZIP 9 条）⇒ 加了才是 5 条；② `ditto` 不写 UTF-8 标志位，`unzip -Z1` 把 `使用说明.md` 显示成乱码（`ditto -x`/`unzip` 实际解压正确）⇒ 测试解压后读字节、不对条目名做字节比对；③ `eslint.config.mjs` 的 `globalIgnores` 加 `extension/dist-package/**`（否则暂存目录会被当源码扫出 `no-this-alias`）。
- **并发互踩（本轮门禁红的真因，已修）**：两个 vitest 文件都在 `beforeAll` 跑 `build:extension` 且默认并行 fork，共享暂存目录被一个进程 `rm -rf` 时另一个正在 `ditto`、共享输出路径被两进程同时写 ⇒ 并列跑 3 次 **2 次红**（`unzip -Z1` 在写一半的 ZIP 上非 0 退出），`--no-file-parallelism` 下 3/3 绿。修法＝每进程唯一暂存 + pack 到 `pack.zip` 再 `rename`（同卷原子），改后并列跑 **5/5 绿**。早先记的 `34346` bytes 出自这条被踩坏的路径，**不是**有效基线。
- **T4.0 使用说明**：`extension/使用说明.md` 7 节（加载步骤、点一次图标的行为、三项权限逐条用途 + 「不读 Cookie、不上传任何内容」、已知限制、与桌面端批量模式的分工、仓库链接）；保留中文文件名（未改 README.md）。
- **T4.2 机器侧**：`NODE_OPTIONS= ./init.sh` exit 0（Node 24.15.0，**92 files / 1237 tests**，较 S3 基线 91/1233 增 1 文件 4 例）；`tsc --noEmit` 与 eslint 干净；`test:e2e` **278 passed / 4 skipped / 0 failed**；`test:extension` **15 passed**。首次全量 e2e 有 1 条 firefox flake（`e2e/home.spec.ts:305`，隔离 `--repeat-each=5` 5/5 过），与既有 V3 同族（不同用例），**未修**。
- **T4.3 收口**：`AGENTS.md`（当前阶段段 + 在册 features + Verification 产出注）、`docs/TESTING.md`（本地文档处理指到 S4 §T4.2 的 12 条清单、`build:extension` 产出补 ZIP/暂存目录、Release Guard 的 `0.3.6` 版行更正为 `0.3.7`、覆盖计数改现测值）、`CHANGELOG`/`.zh.md`（各加一条插件下载 ZIP）、`docs/PLAN-browser-extension.md`（§2 两行状态与 A 现况段、§3 去重依据/桌面端输入两行回填实现口径）、`PROGRESS.md`、`session-handoff.md`、`feature_list.json`、S4 阶段文档。
- **未验证/风险**：**12 条真机人工验收全部待用户签字**（`feat-042` 保持 `in-progress`）；`0.3.7` 未发布未 push、S1–S4 改动均未提交；`home.spec.ts:305` 的 firefox flake 未修。

### 2026-09-29（第十三轮）— S3 首页模式 + 批量写盘实施完成（T3.0–T3.4，A 块首次真正写盘）

- **范围与写盘纪律**：首页加模式选择器（「转换既有文档」/「粘贴 · 链接转换」）与插件下载链接；新面板能把一个目录的 `.md` 列出来、逐条勾选、逐条写盘并给收尾汇总。**服务端 `/api/local-docs/*` 仍只读**，全功能唯一写盘出口是既有 `outputBridge().saveFile()`；新增的唯一 IPC 面是 `md-convertor:system:open-path`（`electron/system.mjs`，主进程 `shell.openPath`，主进程再验绝对路径）。
- **T3.2 规划层**：`src/lib/local-docs/batch.ts` **17 passed**（RED `Cannot find module './batch'`）——`planBatch` 返回 `{rows,refusal,suggestedOutputDir}`，拒绝态 `no-bridge`/`no-output`/`same-dir`；`isSameDirectory`/`processedOutputDir` 支撑「一键改用 `<输入>/processed`」；已处理行默认不勾选。**偏差**：`nextPending(rows)` 单参（`forced` 在行上，避免两个真相源）。
- **T3.3 编排与 IPC**：`src/app/local-docs/client.ts` **11 passed**（RED `Failed to load url ./client`）——`runBatch` 串行、每行过渡后经 `onRows` 发布、`saveFile` 返回 `{ok:false}` 或抛异常都转成可读行状态且继续下一行；未强制的 skip 行**不发请求**。`electron/system.mjs` **13 passed**（失败只回 `OPEN_PATH_FAILED`，原文进 `console.warn`，永不 reject）。preload 两侧同步（RED 11 failed + 1 contract 失败 ⇒ 四文件 **134 passed**）。
- **T3.0–T3.1 RED 用「摘掉 UI 再跑」取得**：`git stash push -u -- src/app/page.tsx src/app/page.module.css src/app/local-docs` → 重建 → `npx playwright test --project=chromium e2e/home.spec.ts e2e/local-docs.spec.ts` = **11 failed / 21 passed**（4 条模式用例 + 7 条面板用例全红；21 条既有断言仍绿）；恢复后同命令 **32 passed**。面板 7 条覆盖降级态、真实 `scan` 路由列目录、选择目录重扫并写 `input.defaultPath`、一键转化两篇落盘（源文件字节不变）、输出＝输入被拒并一键改目录、桥接抛异常与 `EACCES` 的可读报错；目录全为 `mkdtemp`，桩桥接的 `saveFile` 三态含**抛异常**。
- **发现并修掉的新失败**：firefox 上 4 条模式用例首轮红——点击落在尚未 hydrate 的 SSR 按钮上被丢弃；改为先等 `/api/settings` 的 GET 后 `--repeat-each=3` = **96 passed**。修的是测例，不是产品。
- **T3.4 门禁**：`NODE_OPTIONS= ./init.sh` exit 0（Node 24.15.0，**91 files / 1233 tests**，较 S2 基线 88/1180 增 3 文件 53 例）；`tsc --noEmit` 与 eslint 干净；`npm run test:e2e` = **278 passed / 4 skipped / 0 failed**（V3 那条 firefox 用例本轮自己过了——**它是 flake，不是确定失败**，未修）。CHANGELOG 中英各加两条用户可见条目。
- **超过任务表但已声明的五条**：外层 tab 去括注（移进面板副标题）；`paste.spec.ts:261` 补 `exact: true`（两层 tablist 名字互为子串）；`nextPending` 单参；探桥改用 `useSyncExternalStore`（`loading`→`ready`/`absent`，避开 `react-hooks/set-state-in-effect` 与首屏闪降级文案）；面板多一个「恢复默认」按钮（FSD 人工验收第 8 条要求）。
- **日期口径**：S1/S2 的阶段文档写 2026-09-24（规划轮日期），但 `package.json`（11:42）、`paths.ts`（11:44）、`process.ts`（12:08）的 mtime 与未被触碰文件的旧 mtime 对照后，S1/S2/S3 实际同在 **2026-09-29**；本轮按真实日期记。
- **未验证/风险**：`0.3.7` 未发布未 push，S1–S3 改动均未提交；**首页插件链接指向的 `public/md-convertor-extension.zip` 尚不存在（S4 交付物），现在是死链**（e2e 只断言 `href`/`download`）；S4 未动工；V1/V2 已做、V3 未修的裁决清单记在 `session-handoff.md`。
### 2026-09-24（第十二轮）— S2 文档管线实施完成（T2.0–T2.5，仍无写盘）

- **T2.0 图片内联能力提为导出（FSD §2 的 A1，按「可回滚、行为不变」先做）**：RED 是新增 `src/lib/images.exports.test.ts` 5 failed（导出不存在）→ GREEN 导出 `embedImageBuffer` / `mapWithConcurrency` / `MAX_IMAGES` / `MAX_SOURCE_IMAGE_BYTES` / `ProcessedImage`，既有 `images.test.ts` 47 passed，`git diff` 只有提取与导出。**与任务表的一处偏差**：只把 `prepareImage` 的远端分支改成调它，`prepareDataUriImage` 仍直调 `processImageBuffer` —— 改走新导出会把它的 `IMAGE_DATA_INVALID` 换成 `IMAGE_TYPE_UNSUPPORTED` 并改变占位符行为，与「行为不变」冲突；底层实现仍只有一份。
- **T2.1 引用扫描**：`src/lib/local-docs/scan-refs.ts` 13 passed（`Cannot find module` → 绿），返回 `ImageRef{start,end,targetStart,targetEnd,syntax,target,alt}`；围栏/行内代码掩码跳过，`data-src` 不误判，引用式语法不处理。RED→GREEN 途中修掉三个真实 bug（HTML `end` 没含 `>`、`alt` 从截断片段读、测试自身的 splice 不变量错）。
- **T2.2 内联管线**：`inline-images.ts` 13 passed。只改引用那一处字节；本地路径限源 md 目录树内（根外绝对路径 / `..` / 任何 `scheme:` / `//` 一律拒，根逃逸守卫做过变异检查）、扩展名先于读盘判类型、8 MiB 先 `stat` 后 `readFile`；远端走注入的 `fetchPublicResource`；两条路径共用 T2.0 的 `embedImageBuffer`（类型校验与 2048px 重编码不重写）；`data:` 不计读写，超 `MAX_IMAGES` 与超 20 MiB 均保留原引用 + warning；并发 4，中断向上传播。
- **T2.3 组合层**：`process.ts` 13 passed（去重判定在服务端重算、`check` 回退比 sha256 —— 变异检查删掉哈希比较即红；跳过分支 fake 计数证明零调用；翻译前先 `stripDocMarker`、翻译后写新标记；标记的 `size`/`mtimeMs`/`sha256` 描述源文件）。**全程不写盘**：三个新文件的 `grep -c 'writeFile|mkdir|appendFile|createWriteStream'` 均为 0。
- **T2.4 路由**：`POST /api/local-docs/process` 7 passed，走 `handleLocalApi`（与 scan 同一外壳，`validateConvertApiCaller` 不重复调用），body `{path, outputPath?, force?, translate?, targetLanguage?}`，`outputPath` 省略即回退设置的 `output.defaultPath`（仍缺则 400 给可读原因）；测试断言成功调用前后输出目录清单不变。
- **T2.5 门禁**：`NODE_OPTIONS= ./init.sh` exit 0（Node 24.15.0，**88 files / 1180 tests**，较 S1 基线 83/1129 增 5 文件 51 例）；`npx tsc --noEmit` 与 eslint 干净；`npm run test:e2e` = 244 passed / 1 failed / 4 skipped，与 S1 T1.7 逐条一致，唯一失败仍是既有 firefox `e2e/home.spec.ts:108`（T2.0 动了共用模块，这条对照必要）。不加 CHANGELOG（无用户可见变化），不动桌面版本面（仍 `0.3.7`）。
- **超过任务表但已声明的三条：** 本地扩展名→media type 映射写在 `inline-images.ts`（5 项，未导出 `SUPPORTED_TYPES`，语义不同）；`ImageRef` 多 `targetStart`/`targetEnd`（任务表要求原地替换）；翻译实现的 `warnings: string[]` 未并进结果的 `ConversionWarning[]`（无 code，硬塞会造假 code，S3 要显示需先定形状）。
- **未验证/风险**：`0.3.7` 未发布未 push，本轮改动同样未提交；S2 无写盘路径，产物落盘仍待 S3；输入目录 == 输出目录的拒绝归 S3（FSD §2 ⑥）；firefox 那条 e2e 仍红；FSD §7 的「本地图片根目录」行已定稿。

### 2026-09-24（第十一轮）— S1 目录与设置实施完成（T1.0–T1.7，桌面代码首次落地 + 一个既有门禁陷阱的修复）

- **T1.0 版本面 0.3.6 → 0.3.7（6 处）**：RED 先在**既有** `scripts/release-guards.test.mjs` 加「目标版本 = `package.json` + lockfile 两处 + `feature_list.currentVersion`」断言（目标版本用正则从 `RELEASE_VERSION_ERROR` 提取，后续 bump 自动跟随），只改 `package.json`/`package-lock.json` 时红（`expected '0.3.7' to be '0.3.6'`），同步其余面后 30 passed。同步面：`scripts/release-desktop.mjs` 两处、`release-guards.test.mjs` 8 处 fixture、`feature_list.json`、`AGENTS.md` Verification 版本句。
- **服务端与纯函数（T1.1–T1.5）**：`Settings.input.defaultPath` + 宽容读入从 `output` 扩到 `LENIENT_ROOT_KEYS = ["output", "input"]`（带反扩散断言）；`buildServerEnv()` 新增 `MD_CONVERTOR_DOWNLOADS_DIR`（主进程 `app.getPath("downloads")`，服务端空串回退 `~/Downloads`）；新增 `src/lib/local-docs/paths.ts`（服务端守卫与 preload 契约的两套独立实现用 8 条 parity 样例钉住，含 iCloud 路径）、`dedup.ts`（产物首行标记的构造/解析/剥离 + `decideLocalDoc` → `new|skip|check`）、`scan.ts` + `POST /api/local-docs/scan`（只读、一层、按名排序、上限 500、fs 码映射）。每条均先 RED（`Cannot find module './paths'` / `'./dedup'` / `'./route'`）后 GREEN；路由测试用真实 `mkdtemp` 目录、不 mock 扫描，并断言扫描前后目录清单不变。
- **界面（T1.6）**：设置页「输入」卡片复用「输出」卡样式（零 CSS 改动），选择目录写入 `input`、「恢复默认」写回 `null`、无桥接时两按钮禁用并给出原因；e2e `-g "输入目录"` 2 passed、`-g "输出"` 5 passed 回归。
- **门禁（T1.7）**：`NODE_OPTIONS= ./init.sh` exit 0（Node 24.15.0，**83 files / 1129 tests**，连续两次全绿）；`npm run test:e2e` = 244 passed / 1 failed / 4 skipped。
- **范围外已声明的三件（待用户裁决）**：**V1** `vitest.config.ts` 的 `test.exclude` 加 `.next/**` —— `next build`（`output: "standalone"`）把整个仓库镜像进 `.next/standalone`（含测试文件），而 `init.sh` 顺序是 lint → typecheck → test → build，所以任何跟在一次 build/e2e 之后的运行都会收进约 85 个重复套件并报红（实测 17 failed / 162 passed / 179 files，样本 `.next/standalone/src/lib/images.test.ts:573`）；排除构建产物是根因而非 `rm -rf .next` 绕过。**V2** `chooseOutputDirectory()` 补 1 个 `.catch()`（preload 校验是**抛异常**，不是 resolve `{ ok: false }`）。**V3** `e2e/home.spec.ts:108` 一条**既有** firefox 失败，**未修**（见下）。
- **V3 的证据与机制（新固化教训）**：干净 worktree HEAD `1a08440`（`git worktree add` + `cp -Rc node_modules`，**不要 symlink**）上 `--repeat-each=5` 5/5 复现 ⇒ 非本轮引入、非 flaky；`src/app` 与 `e2e/` 自 `v0.3.6` 起零改动。探针实测：按钮中心 y≈660 / 视口 720 处原始鼠标事件根本到不了文档（window 捕获监听为空、`elementFromPoint` 仍返回按钮本体），而 `el.click()` 与同法点击模式 tab 均正常；把按钮滚到 y≈646 后**同一发原始点击即生效** —— firefox 窗口 `outerHeight` 805 > 屏幕 `availHeight` 692 导致的环境敏感坐标裁剪，桌面端跑 Chromium，对用户无影响。
- **未验证/风险**：`0.3.7` 未发布、未 push（发布需用户单独授权）；S2 T2.2 的本地图片根目录口径仍未定稿；firefox 那条 e2e 仍红。

### 2026-09-24（第十轮）— A 桌面端「文档处理」（feat-042）规划定稿：PRD §3 六条裁定 + 两条新需求（纯文档，零代码）

- **对齐结果（用户逐条裁定）**：① 图片走 **base64 内嵌**（不产 `<标题>.images/`）；② 设置页新增「输入目录」设置项，**默认系统下载目录**，带「恢复默认」；③ 命中去重 **跳过并提示**；④ 反馈为 **逐条状态列表 + 收尾汇总**；⑤ **不自动打开**输出目录，展示路径 + 「打开目录」按钮；⑥ 源目录 = 输出目录时 **拒绝** 并一键改用 `<输入目录>/processed/`。
- **新增需求**：R8 首页顶部模式选择器（「转换既有文档」/「粘贴 · 链接转换」，前者自动扫默认目录、可多选/全选、一键转化、翻译开关沿用现有逻辑不新增设置项、可另选目录并自动重扫）；R9 选择器下方插件下载按钮（下载含使用说明的 ZIP）。
- **产出**：`docs/features/app-document-processing/`（`FSD.md` + `S1-directory-and-settings.md` / `S2-document-pipeline.md` / `S3-home-modes-and-batch.md` / `S4-extension-package-and-acceptance.md`）—— 阶段划分 S1→S4 串行、逐任务 RED 列、验收标准、7 条「替用户落的默认（可否决）」、2 条需点头的既有文件改动（A1 `images.ts` 提为导出、A2 `buildServerEnv` 传下载目录）。关键取舍：Markdown 级图片内联器（否掉 md→HTML→Turndown 回环，避免新依赖与全文重排）；去重标记 = 输出 md 首行 HTML 注释里的 JSON（不建索引文件）；插件 ZIP 由现有 `build:extension` 追加产出到 `public/`，加 `prebuild` 钩子。
- **同步**：`docs/PRD-app-document-processing.md`（§3 改裁定表 + 补 R1/R3/R5–R7 结论 + 新增 §3.1 R8/R9 + §4 三条非目标）；`docs/PLAN-browser-extension.md`（§2 两行状态、A 现况段、§3 加一条图片表示契约、§6.4）；`AGENTS.md`（当前阶段段 + features 在册列表）；`feature_list.json`（feat-042 置 `in-progress`、`activeFeature = "feat-042"`、scope/acceptance/verification 补本轮事实）。
- **范围与门禁**：零桌面代码改动、零版本变动（`currentVersion` 仍是 `0.3.6`；bump 是 S1 T1.0 的第一件事），未跑 `desktop:release`、未跑 `test:e2e`；`NODE_OPTIONS= ./init.sh` exit 0（79 files / 1067 tests）。全部改动提交为**一个本地提交**（12 files, +859/-114），**未 push**。
- **提交门（Ponytail / Code-review 两轴 / Neat-freak）三处修正**：S1 T1.0 的「共 8 处」改为准确的 **6 个文件**并核对与 0.3.6 bump 提交 `ac8f91a` 逐字一致、补一列「发布 0.3.7 时才同步」的字面量；T1.0 的 RED 由「新建 `scripts/version-consistency.test.mjs`」改为在既有 `scripts/release-guards.test.mjs` 加断言；FSD §0.3 的「三处硬编码」改为两处。
- **未验证/风险**：本地图片的根目录口径（相对路径以源 md 所在目录为根、根外绝对路径默认拒绝）留到 S2 T2.2 定稿；引用式图片语法 `![alt][id]` 不处理；`0.3.7` 的发布未获授权。

### 2026-09-24（第九轮）— T3.4 第 5 条通过，feat-040 关闭（文档收口，零代码改动）

- **用户回报第 5 条通过**：用本机 40 图页跑（`node /tmp/md-check5.mjs`，127.0.0.1 上临时起、从未进仓库——公开 fixture 站只有两张图），40 张全部落盘、无中断 ⇒ **T3.4 6 条全过**（1 载入、2 普通文章落盘、3 登录会话图、4 重复导出覆盖、5 40 图长文不中断、6「下载前询问保存位置」为关闭）。
- **结论**：MV3 服务工作线程休眠**没有**打断下载，FSD §6 预留的 20s 心跳保活**未落地**，`extension/src/worker-run.ts` 一行未动，并发上限仍是 4。
- **关闭动作**：`feature_list.json` 的 `feat-040` 置 `done`、`activeFeature` 置 `null`（已无 in-progress 项）；S3 阶段文档与 FSD 的 T3.4 行改为「6 条全部通过（2026-09-24）」。
- **补上第八轮推迟的两笔手**：`docs/PRODUCT.md` / `.zh.md`（支持范围各加一条插件说明，隐私段各加一句「只在点击图标时读当前标签页、不读取或存储 Cookie／登录态」）；`README.md` / `.zh.md`（主要能力各加一行）。
- **范围与门禁**：零桌面代码改动、零版本变动（桌面仍 `0.3.6`、插件仍 `0.1.0`），未跑 `desktop:release`、未跑 `test:e2e`、未 push；`NODE_OPTIONS= ./init.sh` exit 0。


### 2026-09-24（第八轮）— T3.4 人工验收部分通过（文档与证据更新，零代码改动）

- **用户回报（真机 Chrome 载入 `extension/dist`）**：第 1 条载入成功、第 2 条普通文章落盘（桌面端未运行也出现 `<标题>.md` + `<标题>.images/`）、第 3 条登录后才可见且图片带会话的文章、第 4 条同一篇连点两次覆盖且不出现 `(1)`（md 与图目录仍成对）均正常；第 6 条「下载前询问保存位置」为**关闭**（故不逐图弹框，符合预期；该项开启时每图一框亦属预期）。
- **仍未测**：仅第 5 条（**≥30 图长文会不会被 MV3 休眠打断下载**）—— 它是本阶段唯一未验证的风险，`feat-040` 因此保持 `in-progress`。
- **现场观察（按预期行为记录，不是缺陷）**：同一篇重复导出时 Chrome 下载列表每次多出一条记账，而下载目录里的文件数量不变 —— `conflictAction: "overwrite"` 的语义就是「替换文件、照记下载」。可读证据是工具栏角标（`✓ 已存出「<标题>.md」（含 N 张图）`）与文件 mtime；若将来要让「覆盖」更显眼，改角标文案即可。
- **落地**：`S3-e2e-and-acceptance.md` 新增「人工验收记录（T3.4，进行中）」表；FSD §6 新增该观察一行，并修正 §6 里把验收条目编号写成「第 7 条」的过期引用（实际是第 5 条）；`feature_list.json` 的 T3.4 证据改写为「部分通过 + 剩余两条」；`PROGRESS.md` / `session-handoff.md` / 本文件同步。
- **范围与门禁**：本轮零代码改动、零版本变动（桌面仍 `0.3.6`、插件 `extension/manifest.json` 仍 `0.1.0`），未跑 `desktop:release`、未跑 `test:e2e`、未 push；`NODE_OPTIONS= ./init.sh` 仍 exit 0。


### 2026-09-24（第七轮）— S3 端到端集成：fixture 站、真实扩展落盘、下载竞态、文档收口
- **T3.0 fixture 站（真 RED）**：`extension/tests/fixtures/server.ts` + `server.test.ts` 8 passed（首跑 `Cannot find module './server'`）。`node:http`、临时端口（不是计划里的固定 43117，避免并行撞端口）、把 `origin` 交回调用方；路由 `/article`（重复图 + 相对路径图）、`/article-cookie`（图需 `md-session` cookie，无 cookie 403）、`/article-missing`（404 图）、`/article-special`（标题含 `/` `:`）、`/no-article`、`/img/*`。fixture 写成 `.ts` 而非计划里的 `.mjs`（`.mjs` 导入在 TS program 里是 `TS7016`）。
- **T3.1–T3.3 真实扩展集成**：`extension/tests/integration.spec.ts` 5 条，断言读磁盘真实文件（不是 `downloads.search`）—— `示例文章标题.images/00{1,2}-photo-*.png` 各 70 B、`会话图片文章.images/001-secret.png` 70 B（cookie 真的跟着走了）、`缺图文章.images/` 空目录、md 里 3 处引用落到 2 个真实的文件（重复图去重）、`发布说明-第 1 期- 中文标题.md` 且 H1 保留原始标题、重复导出后仍只有一对文件且 md 除 `> 转换时间` 行外逐字节相同。`npm run test:extension` 15 passed。
- **RED 诚实记录**：T3.0 是真 RED；T3.1–T3.3 首跑三处红**全是测试自身的 bug**（源链接 `<url>` 被当成图片引用、404 标记断言写成 URL 包含、误以为 H1 也会被净化），扩展行为自 S2 起就是对的 —— 标为**补证**，不冒称「先写失败测试」。
- **下载完成竞态（读代码定位，已修）**：`writeMarkdown()` 的 `downloads.download()` 在下载**开始**时就 resolve，`run()` 不等写完，而测试只等文件名出现就读 ⇒ 约 1/10 概率读到空/截断（同一竞态早已在 S2 探针 2 记录，但当时只用在图片上）。修法：harness 新增 `waitForDownloadComplete()`（轮询 `search({})` 到 `state === "complete"`），integration/skeleton 改用它，无人调用的 `waitForFile` 删除。复验：可疑用例 `--repeat-each=20` 40/40 绿 + 5 轮全量 15 passed / 4.0–4.4s。
- **一处产品行为发现（不修，记录）**：整篇图片全失败会留下空 `<标题>.images/` 目录（Chrome 先建目录再发请求，中断只删半成品文件，`chrome.downloads` 删不了目录）。测试按「不存在或为空」断言，并写进 `docs/TESTING.md`；这是接受的已知行为，不调 `removeFile` 硬删。
- **文档收口**：`AGENTS.md`（阶段状态 + Verification 的 S3 事实与 `waitForDownloadComplete` 理由）、`docs/TESTING.md` + `docs/TESTING.zh.md`（成对新增「浏览器插件 / Browser Extension」一节：五层与哪两层进 `init.sh`、构建产物、「Playwright 自带 Chromium 不需要沙箱开关、需要的是打包 Electron」的实测口径、四个坑、fixture 路由、`activeTab` 缺口、6 条人工清单；顺手修正过期计数 64 files/866 tests → 79/1067）、`CHANGELOG.md` + `CHANGELOG.zh.md`（`[Unreleased]` 加插件首版）、`FSD.md`（状态、§4 阶段行、§5 前四条标已验、§6 加两条风险：编排返回时 md 未必写完 / 全失败留空目录）、`S3-*.md`（状态、逐任务 RED 结论、`## Result` 六条偏差、`## Handoff` 完成态）、`feature_list.json`（T3.0–T3.6 证据，T3.4 标 PENDING）。
- **门禁**：`NODE_OPTIONS= ./init.sh` exit 0（Node 24.15.0，**79 files / 1067 tests**，statements 95.71%，`extension/src` 100% / 分支 93.1%）；`npm run test:extension` **15 passed**（裸跑，无沙箱开关）。
- **未做 / 待办**：T3.4 真机人工验收（机器点不到工具栏，`activeTab` 授权只能来自真实点击）——`feat-040` 保持 `in-progress`；本轮**零桌面改动**（不碰 `src/`、`electron/`、`forge.config.cjs`、`playwright.config.ts`）、未 bump 版本、未跑 `desktop:release` 与 `test:e2e`；提交到本地、未 push。

### 2026-09-24（第三轮）— S1 转换核心落地（插件第一条真实代码）

- 交付 `extension/src/convert/{index,extract,markdown,images,naming,sanitize}.ts`：纯函数、输入是 DOM、无 Node 依赖；`buildArticle(document, sourceUrl, { sanitize, now })` 是唯一入口，返回 `{ title, markdown, images, sourceUrl } | null`。
- 构建与验证接线：`scripts/build-extension.mjs`（esbuild 精确锁 `0.28.1`，IIFE 全局 `mdConvertorCore` → `extension/dist-test/core.js` 50.0 KB，自检无 `require("node:`/jsdom/domino）+ `playwright.extension.config.ts` + 浏览器冒烟；`package.json` 加 `build:extension`/`test:extension`，`vitest.config.ts` 收进扩展单测并给四个核心文件加覆盖率阈值。
- TDD：每个任务留有 RED（缺模块 / 真断言失败），证据在 `feature_list.json` 的 `feat-040.verification`；T1.3 测试与实现同一次写入，RED 是「模块不存在」那次运行，已如实注明。
- 四处偏离已就地记录（`S1-convert-core.md` 的 Result + FSD §3.2）：`htmlToArticleMarkdown` 收 `HTMLElement` 而非字符串；惰性图在常规分支也先提升（Readability 丢 `data-*`）；常规分支也设 50 字符下限（导航栏会被当正文）；无法解析的 `href` 摘掉属性。
- 门禁：`NODE_OPTIONS= ./init.sh` exit 0（Node 24.15.0，**75 files / 1035 tests**，95.48%；上轮 68 / 999、95.28%）；`npm run test:extension` 1 passed（chromium；沙箱内加 `--no-sandbox,--disable-gpu`）。
- 未做：无 `manifest.json` / service worker / content script / 任何 `chrome.*` / `extension/dist/`（属 S2）；未 bump 版本（0.3.6 不动）、未跑 `desktop:release`、未跑 `test:e2e`。本轮按用户要求**提交到本地、未 push**（GitHub 等大阶段完成再推）。
- 提交门（本机 `subagent` 不可用，三道路由改为就地审）：ponytail 无可删项（只余 3 条判断题：单元素 `targets` 数组、`forbidden` 名单两处重复、惰性图属性名两处知晓）；code-review 两轴只出一条 spec 差距 —— T1.5 写了「固定快照」而测试只用 `toContain`，已改为逐字符锁头部 5 行；neat-freak 死引用、相对时间、尺寸、软链四项均过（AGENTS.md 121 行 / 12.7KB，handoff 126 行 / 22.0KB）。

### 2026-09-24（第六轮）— S2 收尾：写盘单测、角标反馈、失败矩阵、产物范围

- **T2.5 写盘单测（补证）**：`extension/src/write.test.ts` 4 passed —— `filename` 只能是相对路径（无前导 `/`、无盘符、无 `../`）；data URL 能被 `new URL()` 解析且 `decodeURIComponent` 后逐字节等于原文（中文/半全角括号/两种引号/emoji/空行）；`overwrite` + `saveAs:false` 未动；`markdownDataUrl` 把 `%` `#` `&` `,` 编码掉（`#` 不编码会截断 URL）。`write.ts` 是 T2.1 写的，**首跑即绿 = 补证**，已如实标注。
- **T2.6 角标反馈（真 RED）**：4 条全 failed（`(0 , runWithFeedback) is not a function`）→ 8 passed。`badgeFor` 三态（`✓` 含张数 / `!` N 张未下载 / `!` 转换失败：人话）+ `BADGE_CLEAR_MS = 4_000` 后清空并还原 `DEFAULT_TITLE`；失败原因过小映射表，英文原文只留 `RunResult.message`。
- **T2.7 失败路径矩阵（补证）**：`worker-run.test.ts` 12 passed —— 特权页 / 无正文 ⇒ 三个下载请求一个都不发；注入成功但无回应 ⇒ `vi.useFakeTimers()` 推进 10 秒真跑到 `TIMEOUT`（payload 等待用全局 `setTimeout`，注入时钟管不到）；md 写盘被拒 ⇒ `DOWNLOAD_FAILED` 且未写盘。覆盖率阈值入 `vitest.config.ts`：`worker-run.ts` 95/85/85/95、`references.ts` 100/90/100/100、`write.ts` 全 100，均取实测值之下一点。
- **T2.8 阶段收尾（补证）**：`extension-build.test.mjs` 4 passed —— `extension/dist/` **恰好**三份、无 Node 残留、manifest 只有三个权限且无 `host_permissions` / 无静态 `content_scripts`、`action.default_title` 与 `DEFAULT_TITLE` 逐字相等；`buildOnce()` 让四条读同一份产物。
- **门禁**：`NODE_OPTIONS= ./init.sh` exit 0（Node 24.15.0，**78 files / 1059 tests**，`extension/src` 语句 100% / 分支 93.1%）；`npm run test:extension` 10 passed / 10.0s。纯扩展轮：未动桌面代码、未 bump 版本、未跑 `desktop:release` / `test:e2e`，提交在本地未 push。
- **S2 完成态已交接**：`S2-extension-shell-and-writes.md` 的状态行改为已完成，`## Handoff` 重写成给 S3 的事实清单（消息契约、`run(tabId, deps)` 形状、角标语义、`overwrite` 理由、探针五条 + Playwright 下载装置修法）；FSD 状态行与两条风险行（无手势注入、扩展名补全）按探针结论更新。

### 2026-09-24（第五轮）— S2：内容脚本可读化 + 图片下载编排

- **T2.2 内容脚本可读化**：`extension/tests/content.spec.ts` 三条（`npm run test:extension -- content.spec.ts` → 3 passed）：`article.html` 的 payload 字段逐条核（含 `images` **深等价**：惰性图进下载计划、内联 `data:` 图留在 md 且不产生无谓下载）；`no-article` → `NO_ARTICLE`；`file://` 页 → `{ok:false, code:"INJECT_FAILED"}`（注入被拒不静默）。
- **T2.2 的 RED 只有第三条是真的**：`chrome.tabs.query()` 对无 host 权限的标签页返回 `url: undefined`，「按 URL 找 tab」查不到目标（我的用例自身缺陷）；前两条因 `content.ts` 在 T2.1 一次写完而首跑即绿，已如实写进阶段文档，标为**补证**而非先写的失败测试。
- **T2.3 下载编排**：`extension/src/worker-run.test.ts` 四条（手写 `fakeChrome()`，无 sinon，时钟注入）——7 图并发峰值 ≤ 4（在假对象里实测）、1 张 `download()` 抛错 + 1 张永不结束 ⇒ 其余完成且 **md 仍恰好写一次**、引用用浏览器**真实** basename（`001-1.jpg`）、落到别的目录 ⇒ 该图按失败处理。
- **T2.3 两处刻意偏离**：等结束**轮询 `search({id})` 而非监听 `onChanged`**（探针 2 证明下载可能在 `download()` resolve 前已结束，事后挂监听会漏事件，且轮询同一次调用就拿到真实路径）→ FSD「并发与等待」行与 S2 流程段已同步改口径；`run()` 成功臂多回 `images: ImageOutcome[]`，skeleton 断言由 `toEqual` 收窄为 `toMatchObject`。
- **收尾清理（ponytail）**：删掉自加的 `pollMs` 旋钮（假时钟下无意义，纯投机可配置性）与 `waitForImage` 里一个永不成立的分支。
- **本轮门禁**：`npm run test:extension` → **10 passed / 9.6s**（core-smoke 1 + probe 5 + content 3 + skeleton 1）；`NODE_OPTIONS= ./init.sh` exit 0（Node 24.15.0，**76 files / 1039 tests**，statements 95.27% —— 从 93.36% 回升，原因是 `worker-run.ts` 这轮有了单测）。未动桌面代码、未 bump 版本、未跑 `desktop:release` / `test:e2e`，提交在本地未 push。
- **T2.4 引用回写**（提交 `c0ce05f`）：`extension/src/references.ts` 的 `rewriteImageReferences(markdown, plans)` —— 成功 → `![alt](目录/真实文件名)`、失败 → 原 URL + 下一行 `<!-- 图片未下载：<url> -->`、未出现的占位符原样留；RED 首跑 5 条全 failed（模块不存在），第一版前瞻写反（`(?![^\p{L}\p{N}])`）拿到真断言失败后改正；接入 `run()` 时 `worker-run.test.ts` 2/4 failed（仍写占位符）→ 改后 9 passed。
- **仍未做（本表写下时）**：写盘单测（T2.5）、角标（T2.6）、失败路径矩阵与覆盖率阈值（T2.7）、阶段收尾（T2.8）—— 当天随后一轮已全部落地，见下表。`CHANGELOG.md` 不加条目（无用户可见变化）。

### 2026-09-24（第四轮）— PROGRESS 瘦身 + S2 外壳：事实探针与扩展骨架

- **Step 0 文档瘦身**（提交 `934e979`）：`PROGRESS.md` 四段「上一轮…已完成」历史压进本表，删前先补上同日「插件线方向定稿」那一条（下文）；`PROGRESS.md` −51/+3。
- **S2 / T2.0 事实探针**（提交 `4d0e96e`）：`extension/tests/probe.spec.ts` 5 条用例（`npm run test:extension -g probe` → 5 passed）；结论表已填进 `S2-extension-shell-and-writes.md`：「无手势注入不可用」「请求的 `filename` 无扩展名不补」「`search()` 返回含子目录的绝对路径」「`overwrite` 真覆盖」「绝对路径被拒」。
- **探针顺手挖出的装置坑（S3 必须照抄修法）**：Playwright 对 persistent context 强制 CDP `allowAndName`，下载被改名 `<guid>` 且丢掉请求子目录；修法 = profile 预写 `download.default_directory` + 启动后补发 `behavior:"default"`，`downloadsPath` 不可用。
- **又一条环境事实**：TS 6 不再自动收录 `node_modules/@types`，`@types/chrome` 需靠 `extension/src/chrome-types.d.ts`（一行 reference）显式引用。
- **S2 / T2.1 外壳骨架**：`extension/manifest.json`（0.1.0，权限恰为 `activeTab`+`scripting`+`downloads`、`host_permissions` 空、无静态 content_scripts）+ `src/messages.ts`/`content.ts`/`write.ts`/`worker-run.ts`/`worker.ts`；构建加两个入口并拷 manifest；`npm run test:extension` → 7 passed；骨架端到端把 `示例文章标题.md` 真写进下载目录。
- **落地偏差**：FSD 的 `ConvertRequest` 不实现（content 主动上报，SW 不请求）；`extension/src/content.ts` 与 `worker.ts` 作为浏览器专用入口不进 vitest 覆盖率；全局 statements 95.48% → 93.36%（三个新模块的单测在 T2.3–T2.7 补，不是既有代码劣化）。
- **纯扩展轮**：未动桌面代码、未 bump 版本、未跑 `desktop:release` / `test:e2e`；`NODE_OPTIONS= ./init.sh` exit 0（75 files / 1035 tests）。提交在本地未 push。

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

### 2026-09-22 — 浏览器插件线路：方向定稿 + 文档分层重整

- 三问定论：同仓库（为了共享「提取 + 转 md」以保证两端输出一致，不是为了共享整条管线）；密钥问题消失（插件不做翻译）；抽一段无 Node 依赖的共享模块。**后一条与「A 先 B 后」的顺序均于 2026-09-24 被推翻**（B 先做、A 另案；B 自带核心不共享代码）。
- 探针实测（Playwright 加载临时 MV3 扩展，产物只在 `/tmp`、未入库）：写盘机制 10 项、提取管线 8 项全部通过。关键事实：扩展**只能写下载目录下的相对路径**（绝对路径报 `Invalid filename`）；`chrome.downloads.download()` 对 HTTP(S) 会带上该 host 的 cookie，所以图片**不需要 fetch、不需要 `host_permissions`**；data URL 写盘 2 MiB 通过；Readability+Turndown+GFM+DOMPurify 打包仅 76 KB、domino/jsdom 残留 0。**结论全部保留，详见 `docs/PLAN-browser-extension.md` 附录 A。**
- 由此确认的简化：不需要常驻服务、不需要 offscreen document、不需要 `host_permissions`。
- 文档分层重整：原 `docs/features/browser-extension/FSD.md` 被删除（它装的是产品决策，该进 PRD 而不是技术方案）；改为 `docs/PLAN-browser-extension.md`（统领层，唯一写「两个产品怎么配合」的地方）+ `docs/PRD-app-document-processing.md`（A）+ `docs/PRD-browser-extension.md`（B），两份 PRD 不重复交接契约。
- 交付切分为两块、串行推进：A 桌面端「文档处理」（`feat-042`）、B 浏览器插件（`feat-040`）——串行是硬约束（单 `feature_list.json` + `init.sh` 只允许一个 `in-progress`）。
- `docs/PLAN-next-phase.md` 归档：它实际是 0.3.5 视觉刷新那一阶段的路线图（0.3.5 / 0.3.6 均已发布），整份过期，已标注「已完成、已归档」并把文档地图指到 `PLAN-browser-extension.md`。
- 本轮未写阶段文档、未动代码（`feat-042` 与 `feat-040` 当时均为 `planned`）；该线的阶段文档于 2026-09-24 补齐（见上文「第一轮」条）。提交 `24bf00f`。

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
