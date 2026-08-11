# Changelog

**English** | [简体中文](CHANGELOG.zh.md)

This project follows the principles of [Keep a Changelog](https://keepachangelog.com/). User-facing changes that have not yet been released belong under `Unreleased`.

## [Unreleased]

No unreleased changes.

## [0.2.0] - 2026-08-11

### Added

- Added independent Link Conversion and Rich Text Conversion modes. Paste mode accepts explicit clipboard `text/html` and `text/plain`, supports semantic HTML, plain-text fallback, edited-content fallback, replacement paste, and an optional source URL.
- Added the local `/api/convert-paste` endpoint with a 5 MiB UTF-8 request limit, sanitization, image handling, output statistics, warnings, cancellation, and timeout behavior.
- Added one-click clearing for rich text content, source URL, and previous results.
- Added Mermaid preservation: source becomes fenced `mermaid` code; client-rendered link diagrams are captured as safe PNGs; pasted Mermaid SVG is independently sanitized and rasterized locally; unsupported Canvas or unsafe content falls back to a warning and placeholder.
- Added Clear Link and Back to Top interactions for repeated and long conversions.

### Changed

- v0.2 is now the current release on `main`; `v0.1.3` remains an immutable historical tag and artifact baseline.
- Default public documentation and GitHub metadata are English. Chinese versions are retained in `.zh.md` files.
- WeChat live comparison is now an explicit non-blocking diagnostic because upstream verification and timeout behavior vary. Stable WalkingLabs link/paste Mermaid checks remain release-blocking.

### Security

- Paste HTML uses an independent DOMPurify policy, never reads cookies or authenticated browser state, and reuses SSRF protection for remote images. `data:` images are decoded and format-validated before embedding.
- Mermaid handling never executes pasted SVG. It removes scripts, events, external resources, styles, and unsafe attributes before local rasterization. Browser screenshots enter the image pipeline only through request-local trusted mappings.
- Release guards preserve the immutable `v0.1.3` source tag, the external read-only 0.1.3 archive, and a fixed 0.1.0–0.1.3 ZIP manifest before and after the release workflow.
- Upgraded Next.js to 16.3.0, Undici to 8.10.0, DOMPurify to 3.4.13, Electron to 43.3.0, and compatible locked transitive packages. Production dependency audit is clear; remaining development/build-only advisories are not packaged in the app.

### Fixed

- Mermaid PNGs now use an opaque white background and a fixed readable light palette after removing source CSS and inline styles, preventing unreadable black diagrams.
- Dynamic Mermaid replacement processes nodes safely without skipping later diagrams; source-only Mermaid containers are no longer mistaken for screenshot failures.
- Mermaid diagrams beyond the 30-image limit now produce explicit warnings and correct omitted-image statistics.
- Small application-generated Mermaid PNGs no longer trigger the generic placeholder heuristic; strict PNG validation still applies.
- Google Fonts stylesheets that can stall controlled navigation are blocked while page-owned CSS remains available.
- Electron 43 runtime preparation explicitly invokes the official installer before packaging.
- Remote image MIME declarations are checked against the actual Sharp-detected format, so disguised SVG or mismatched content falls back to alt text.
- Release validation extracts the ZIP and verifies the packaged application version and arm64 executable instead of trusting only the adjacent Forge output directory.

### Verification

- Node.js 24.14.1 baseline passed 27 test files / 317 tests, coverage thresholds, and production build.
- Chromium, Firefox, and WebKit E2E passed 60/60.
- WalkingLabs link and pasted Mermaid live checks passed 2/2.
- The complete desktop release gate passed Forge, fresh ZIP checks, packaged version, arm64 architecture, and package structure.
- The final Apple Silicon ZIP is `354,636,241` bytes with SHA-256 `5becae36a53e91129a0dbcb93c3f7f5f3197326b2c83df6f10cb8494d8116485`.
- Real Electron-window acceptance passed for rich text conversion, clearing, Mermaid rendering, clear-link, and back-to-top interactions.

## [0.1.3] - 2026-07-21

### Changed

- Shortened result actions to Copy and Download while retaining the copied confirmation.
- Fixed the project runtime to Node.js 24.x and moved E2E to the production standalone server with tracked-file side-effect detection.

### Security and reliability

- Routed all dynamic browser HTTP/HTTPS traffic through a loopback proxy that revalidates and pins public IPs, closing DNS-rebinding gaps.
- Added a random per-launch Electron session token and local API checks for loopback Host, same-origin requests, JSON content, and the token.
- Added browser budgets of 100 requests, 50 MiB total traffic, and 25 MiB per CONNECT tunnel.
- Correctly mapped server timeouts and explicit client cancellation.
- Packaged Sharp/libvips arm64 dependencies explicitly and made smoke-test failures return a non-zero exit code.
- Added API, rate-limit, browser, redirect, DNS-pinning, orchestration, real proxy I/O, cancellation, and WebSocket tests with security-critical coverage thresholds.
- Added fresh ZIP, version, arm64, package structure, size, and SHA-256 release checks.

### Documentation

- Documented Apple Silicon/macOS 12+ requirements, self-contained installation, unsigned-app first launch, testing/release commands, and second-Mac acceptance.
- Cancelled unimplemented Windows, multi-platform migration, and the earlier plain-content paste proposal. Rich text paste was later reauthorized for v0.2 under a narrower clipboard-only scope.

## [0.1.2] - 2026-07-18

### Added

- Added conversion cancellation with URL preservation.
- Added file-size, character, source-image, embedded-image, and omitted-image statistics.
- Added exact synthetic webpage-to-Markdown golden tests and a privacy-preserving live release gate.
- Added `npm run test:live` and `npm run desktop:release`.

### Changed

- Pasting a URL no longer starts conversion automatically; click Convert to MD or press Enter.
- Results emphasize completion status instead of repeating the article title or technical extraction mode.
- Output over 20 MiB preserves text and omits embedded images from the end.
- Desktop headings remain on one line when space permits.

### Fixed

- Added a dedicated `IMAGE_TOO_LARGE` warning for source images over 8 MiB.
- Fixed stop/submit button DOM reuse that could invalidate trusted click behavior.
- Resolved relative body links against the source page URL.

## [0.1.1] - 2026-07-18

### Added

- Added the project Harness, state tracking, verification entry point, and session handoff.
- Added the Apple Silicon Mac desktop app with URL conversion, preview, copy, and Markdown download.
- Added safe public-URL fetching, content extraction, JavaScript-page browser fallback, image optimization, Base64 embedding, and a 20 MiB output limit.
- Added Chromium, Firefox, and WebKit UI acceptance plus conversion and security tests.
- Added Electron packaging for `darwin/arm64` with a bundled Chromium Headless Shell.

### Fixed

- Restored hidden WeChat `#js_content`, lazy `data-src` images, and correct handling of verification/deleted pages.
- Switched to a desktop browser User-Agent and fixed multi-address DNS image downloads.
