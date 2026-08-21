# Session Handoff

## Resume Here

- Current release: `0.2.1`
- Active feature: none
- Branch: `main`; release PR #3 is merged
- Product scope: local Apple Silicon Mac app with Link Conversion and Rich Text Conversion
- Full historical project records: `~/Downloads/MD-Convertor-archive/docs/pre-v0.2.1/`
- Historical release ZIPs: `~/Downloads/MD-Convertor-archive/releases/`

## Latest Change

`feat-017` fixes multi-node code blocks used by the supplied WeChat article. Before Turndown runs, only a `<pre>` with two or more direct `<code>` children is normalized into one fenced block. Ordinary code blocks, language identifiers, and Mermaid behavior are unchanged.

## Release Evidence

- Node.js 24.14.1 `npm run desktop:release`: passed
- Unit/security/integration tests: 322/322
- E2E: 60/60 across Chromium, Firefox, and WebKit
- Stable live comparisons: 2/2
- WeChat diagnostic: 12/12 code blocks and 279 lines matched in memory
- ZIP: `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.2.1.zip`
- Bytes: `354,635,067`
- SHA-256: `32c1d96af58a7701e6d2fe0bf619be0f8f224803355c6ef63aad43c85569463e`
- GitHub Release: https://github.com/haohaiHuang/MD-Convertor/releases/tag/v0.2.1

## Important Boundaries

- Node.js 24, Next.js 16, Electron, npm, TypeScript strict.
- TDD is mandatory for every code change.
- Only `darwin/arm64` is supported.
- `v0.1.3` remains an immutable historical tag at `ce041c9`.
- Old builds are not kept in the current repository workspace; release guards read their fixed hashes from the external archive.
- The app is unsigned and not notarized, so it is a personal-test build rather than a frictionless public distribution.
- Never store or print webpage bodies, clipboard content, cookies, tokens, or private URLs in tests or logs.

## Recommended Next Action

There is no queued feature. For future work, create one scoped feature entry and its RED test before implementation.
