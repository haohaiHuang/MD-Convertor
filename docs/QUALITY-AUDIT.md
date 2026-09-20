# Quality Audit

## Current Verdict

Version `0.3.2` passed its own release gate on 2026-09-20 - baseline, three-browser E2E, live, packaging, and artifact verification all passed - producing `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.2.zip`. `0.3.1` passed the same gate earlier the same day and was published as GitHub Release `v0.3.1` (tag `af7f6db`); it stays as history. The `0.3.0` gate ran end to end on 2026-09-18 and that artifact predates `feat-024` onward; it is kept as history. The historical-archive precondition was retired for the 0.1.0–0.2.0 ZIPs and the 0.1.3 read-only copy, which were lost from this Mac and cannot be restored; every archive that still exists is hash-checked exactly as before, and `0.2.1` was re-downloaded from its GitHub release and matched its recorded SHA-256 byte for byte. The `v0.1.3` source tag remains a hard precondition. QA-012 (the advisory set found in `next` and `sharp`) is resolved: as of 2026-09-20 `next` is 16.3.5 and `sharp` is 0.35.4, and `npm audit --omit=dev` reports no production advisories. The remaining release constraint is the absence of Developer ID signing and notarization, which the user decided on 2026-09-20 not to pursue: every artifact stays personal-testing only, and the `v0.3.1` release notes say so plainly.

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

## Post-0.3.0 Rounds (feat-024 - feat-033, 2026-09-18 to 2026-09-20)

Everything from `feat-024` through `feat-033` shares one build, and all of it shipped in the gated `0.3.1` and `0.3.2` artifacts. It is unit-tested, baseline-verified, three-engine E2E verified, and (for the translation and UI rounds) exercised on the packaged app by the user.

| Round | Change | Evidence |
|---|---|---|
| feat-024 | translation task budget scales with the real batch count | `src/lib/translate/limits.test.ts`, `run.test.ts`; real article re-translated |
| feat-025 / feat-026 | settings-page UI fixes, per-provider cards, draft model pull | settings E2E rewritten + real-machine screenshots |
| feat-027 / feat-028 | per-call ceiling 60s -> 180s, aborted body read reported as a timeout, 「当前生效」badge removed | unit tests + a 121-block real-machine document returning 200 |
| feat-029 / feat-030 | four mandatory provider fields, read-only saved-key box, single cloud card | `provider-form.test.ts`, provider/models route tests, settings E2E |
| feat-031 | version 0.3.1, `next` 16.3.5 + `sharp` 0.35.4, header/button layout, read-only key box | release-guard tests 29 passed, `npm audit --omit=dev` clean, home E2E layout assertions |
| feat-032 | green「MD」square dropped, wordmark set in Michroma, font + OFL licence vendored under `public/fonts/` and loaded with `next/font/local` | `tests/brand-font.test.ts`, E2E brand case comparing the served woff2 with the repository file by SHA-256, build re-run with all network denied |
| feat-033 | the local server runs from the bundled `MD-Convertor Helper` instead of the app executable, so the Dock no longer shows a second bouncing `exec` tile | `electron/server-binary.test.mjs` (3 cases), `lsappinfo` shows the child as `type="UIElement"` on the Helper bundle, before/after Dock screenshots |
| Gate | `0.3.1` gated on 2026-09-20 (exit 0) and published as GitHub Release `v0.3.1`; `0.3.2` gated on 2026-09-20 (exit 0) | `npm run desktop:release`, ZIP size and SHA-256 recorded in `docs/TESTING.md` |

## Verified Release (0.3.2)

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
- The current repository tree contains only active source, current documentation, tests, and the ignored `out/` build output (a pre-fix 0.3.0 ZIP plus the unsigned 0.3.1 and 0.3.2 packaged apps).
- Historical Git commits and tags are intentionally retained; no history was rewritten.
- Release guards verify fixed historical ZIP hashes from the external archive before and after a release attempt; an absent entry is reported as retired and any present entry is still hash-checked.

## Re-verification Checklist for 0.3.2

- `./init.sh` green on Node.js 24.x: lint, `tsc --noEmit`, coverage with every per-file threshold, production build. Last green: 62 files / 858 tests, 95.28% statements (2026-09-20).
- `npm run test:e2e` green across Chromium, Firefox, and WebKit. Last green: 178 passed / 2 skipped.
- `npm run test:live` result recorded, even when it is skipped or fails because the network is unavailable. Last green: 2/2 (after one transient DNS failure).
- `npm run desktop:release` passed with version `0.3.2` on 2026-09-20 (and with `0.3.1` earlier the same day): historical ZIP snapshot unchanged before and after, fresh ZIP, packaged version, arm64 executable, bundle structure, size, and SHA-256.
- Packaged smoke test with `ELECTRON_SMOKE_TEST=1` and `ELECTRON_SMOKE_TEST_SECRETS=1` prints the preload bridge and runtime secret results.
- No key, article body, or CLI output appears in logs, error messages, test output, or the repository.
- The historical `v0.1.3` tag is intact, no historical ZIP that still exists changed its hash, and every retired entry is reported by the gate.

## Release Decision

Approved for personal testing. Not approved for frictionless public distribution, and QA-008 is accepted rather than being worked: the user decided on 2026-09-20 not to buy a Developer ID / notarize, so signing stays out of scope until that decision changes. QA-012 no longer applies: `next` is 16.3.5 and `sharp` is 0.35.4 as of 2026-09-20 and `npm audit --omit=dev` reports no production advisories. `0.3.2` passed its gate on 2026-09-20; `0.3.1` passed its gate and was published as GitHub Release `v0.3.1` earlier the same day. The release notes state that the build is unsigned and intended for personal testing.
