# Quality Audit

## Current Verdict

Version `0.2.1` passes the automated personal-release gate for Apple Silicon Macs. No open functional or security defect is known in the authorized scope. The only distribution blocker is the absence of Apple Developer ID signing and notarization.

## Verified Release

| Check | Result |
|---|---|
| Node.js | 24.14.1 |
| Baseline | lint, typecheck, coverage, production build passed |
| Tests | 28 files / 322 tests passed |
| Browser E2E | Chromium, Firefox, WebKit — 60/60 passed |
| Stable live gate | WalkingLabs link/paste — 2/2 passed |
| WeChat diagnostic | 12/12 code blocks and 279 lines matched in memory |
| Production dependency audit | 0 vulnerabilities |
| Full dependency tree audit | 1 critical / 28 high / 3 low in development/build tooling |
| Package | 0.2.1, arm64, macOS 12.0+ |
| ZIP bytes | 354,635,067 |
| ZIP SHA-256 | `32c1d96af58a7701e6d2fe0bf619be0f8f224803355c6ef63aad43c85569463e` |

## Security and Privacy Boundaries

- Link, redirect, browser-subresource, and image requests retain public-network validation, IP pinning, request/byte budgets, and cancellation.
- The local API retains loopback, origin, content-type, and per-launch token checks.
- Pasted HTML is semantically gated and sanitized; rendered Mermaid SVG is independently sanitized and rasterized before embedding.
- Logs and live comparisons do not save or print URLs, article bodies, clipboard HTML, or images.
- The application has no account, analytics, database, history, or cloud synchronization.

## Open Risks

### QA-008 — Unsigned and not notarized

- Severity: release constraint
- Status: open
- Impact: another Mac may show an unidentified-developer or damaged-app warning.
- Mitigation for personal testing: verify the published SHA-256, then use Finder Open/Privacy & Security or remove only `com.apple.quarantine`.
- Closure: sign with an Apple Developer ID and notarize the application.

### QA-LIVE — WeChat upstream variability

- Severity: non-blocking diagnostic risk
- Status: accepted
- Impact: verification or timeout responses may make the fixed WeChat sample intermittently unavailable.
- Mitigation: `npm run test:live` keeps stable release-blocking samples; `npm run test:live:wechat` preserves the full in-memory comparison as a separate diagnostic.

### QA-DEV — Development dependency advisories

- Severity: non-runtime maintenance risk
- Status: accepted for 0.2.1
- Evidence: `npm audit --omit=dev --json` reports zero production vulnerabilities; the full tree reports 1 critical, 28 high, and 3 low advisories in development/build tooling.
- Mitigation: packaged runtime dependencies are independently prepared and the release artifact passes the complete gate. Review compatible toolchain upgrades in a separately authorized iteration; do not use force upgrades that change the supported stack without regression evidence.

## Repository Hygiene

- Completed plans, task records, prior progress/audit snapshots, WorkBuddy files, and release ZIPs through 0.2.0 are archived under `~/Downloads/MD-Convertor-archive/`.
- The current repository tree contains only active source, current documentation, tests, and the latest ignored 0.2.1 build output.
- Historical Git commits and tags are intentionally retained; no history was rewritten.
- Release guards verify fixed historical ZIP hashes from the external archive before and after a release attempt.

## Release Decision

Approved for personal testing. Not approved for frictionless public distribution until QA-008 is closed.
