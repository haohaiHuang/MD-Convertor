# Project Progress

## Current State

- Last updated: 2026-08-22
- Current release: `0.2.1`
- Active feature: none
- Branch: `main` is the published source of truth; release PR [#3](https://github.com/haohaiHuang/MD-Convertor/pull/3) is merged
- Scope: unsigned Apple Silicon Mac personal-test application; macOS 12.0+

## Completed in 0.2.1

- Fixed WeChat-style code blocks in which one `<pre>` contains multiple sibling `<code>` nodes. All lines, blank lines, `<br>` breaks, indentation, entities, nested text, and code punctuation are preserved.
- Added redacted unit regressions and an in-memory per-code-block comparison for the user-supplied WeChat article. No webpage body is saved or printed.
- Moved completed plans, task records, prior state snapshots, WorkBuddy data, and release ZIPs through 0.2.0 to `~/Downloads/MD-Convertor-archive/`.
- Changed release guards to verify the immutable historical ZIP manifest from the external archive instead of retaining old builds in the repository workspace.
- Removed completed PLAN/TASK documents from the current working tree; Git history remains intact.

## Verification Evidence

- `npm run desktop:release` passed with Node.js 24.14.1.
- Baseline: lint, typecheck, coverage, production build, 28 test files / 322 tests.
- E2E: Chromium, Firefox, and WebKit, 60/60 checks.
- Stable live gate: WalkingLabs link/paste comparisons, 2/2.
- WeChat diagnostic: supplied article, 12/12 code blocks and 279 source lines matched in memory.
- Artifact: `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.2.1.zip`
- Size: `354,635,067` bytes
- SHA-256: `32c1d96af58a7701e6d2fe0bf619be0f8f224803355c6ef63aad43c85569463e`
- Package: version `0.2.1`, `arm64`, macOS 12.0+
- GitHub Release: https://github.com/haohaiHuang/MD-Convertor/releases/tag/v0.2.1

## Open Constraints

- The app is not Developer ID signed or notarized. Gatekeeper may require an explicit Open action or removal of the quarantine attribute after the checksum is verified.
- `npm run test:live:wechat` remains diagnostic rather than release-blocking because WeChat verification and timeout behavior varies.
- No Windows, Intel Mac, hosted service, account, history, or cross-device synchronization is planned.

## Next Step

No active product work. Start a new feature only after adding one scoped `in-progress` item to `feature_list.json` and, when needed, a matching task document.
