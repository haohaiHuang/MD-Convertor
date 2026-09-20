# Changelog

**English** | [简体中文](CHANGELOG.zh.md)

This project follows the principles of [Keep a Changelog](https://keepachangelog.com/). User-facing changes that have not yet been released belong under `Unreleased`.

## [0.3.2] - 2026-09-20

### Fixed

- The Dock no longer shows a second, endlessly bouncing tile with the generic black `exec` icon while the app runs. The local server process was spawned from the application's own executable, which macOS reads as a second launch of MD-Convertor and which can never finish checking in as an app. It now runs from the bundled `MD-Convertor Helper` bundle (declared `LSUIElement`), so it keeps out of the Dock while still running the same Node runtime.

## [0.3.1] - 2026-09-20

### Changed

- Cloud configuration is now a single card for a single provider: one 保存 button writes the four fields (name, Base URL, API key, model), and a missing field is reported in place in the warning colour without writing anything. The provider list, the「添加 Provider」button, the always-blank「新建 Provider」card, the「设为当前 Provider」radio, the「当前使用」badge and the 删除 button are gone; the「环境变量名」field, and the separate「保存 Provider」/「保存密钥」buttons were already removed. Editing an old file that still holds several providers edits the active one and collapses the list to it on save.
- 拉取模型 reads the endpoint's model list straight from the typed address and key, and only reads it — pulling never writes settings. The model field is a free-text input with the pulled names as suggestions, so a provider can still be configured by hand when its endpoint is unreachable.
- A saved key is no longer shown in its input box. The field displays eight black dots as a placeholder plus「已保存，先清除密钥再更换」and is read-only while a key is stored (a placeholder is not selectable, copyable, or submittable, and the keychain is still never read back into the page);「清除密钥」is the only way to change it.
- Settings page UI: the working-mode picker is now a titled card instead of a legend that rode over the row, and switching modes no longer shows a「当前生效」badge (it pushed the two options sideways while it moved). The custom-language-tag entry is hidden (tags saved earlier still show up in the target language picker). "返回转换" is now a button with a save-status badge that waits for an in-flight save and refuses to leave when saving failed.
- Home header: the「本机处理 · 不保存内容」hint and the ⚙ glyph were removed, leaving a plain 设置 button.
- Both panels now label the convert button「转换」(it was「转换为 MD」), and in the rich-text panel it sits on the same row as the optional 来源 URL box, whose right edge lines up with the paste box above it.
- Home and settings headers: the green「MD」square is gone, leaving the plain text wordmark, and「MD-Convertor」is now set in Michroma. The font file is kept in the repository (`public/fonts/Michroma-Regular.woff2`, licence next to it) and loaded with `next/font/local`, so the build needs no network at all and the packaged app serves the exact file it was built with from its own `/_next/static/media`, with no request to Google.

### Fixed

- Deleting a provider no longer exists as an action; a key is removed with「清除密钥」. Provider keys can no longer come from an environment variable, so saving a key is the only way to configure a provider.
- Fixed long-article translation being cut off at a fixed 120-second task deadline. The whole-task budget is now sized from the real batch count (60s per batch plus a 30s margin, never below 120s); the 200,000-character ceiling and cancellation are unchanged.
- Fixed cloud translation failing with「Provider … 返回了无法识别的回答」. Two things were wrong: the per-call ceiling of 60s was too short for a cloud reasoning model (measured 38-60s of reasoning tokens for one small batch), and an abort that landed while the response body was being read was reported as an unreadable answer instead of a timeout. The per-call ceiling is now 180s and the whole-task budget follows it (180s per batch plus a 30s margin); such an abort now reports a timeout (or a cancellation) like every other abort.

### Security

- Raised Next.js to 16.3.5 and sharp to 0.35.4, which clears the published advisories in both (an unauthenticated RCE affecting Windows-hosted Next.js servers, and libheif issues in sharp). `npm audit --omit=dev` now reports no production vulnerabilities.

## [0.3.0] - 2026-09-18

### Added

- Added a Settings page, reachable from the 设置 button in the page header, that stores preferences in the local `settings.json` and reads them back through `GET/PUT /api/settings`. It covers the working mode (cloud provider or local CLI), target language, and the "translate the article by default when converting" switch.
- Added cloud provider management: add, rename, re-point, select, and delete providers, fetch the model list of an OpenAI-compatible endpoint, pick a model, or type a model name by hand. Deleting a provider asks for confirmation.
- Added local CLI detection: the settings page scans the current `PATH`, shows where `pi` and `claude` were found, and can list the models a CLI reports, enable or disable each agent, and choose a model per agent.
- Added a target language picker with eleven presets plus custom BCP-47 tags, and a read-only note that the source language is detected by the model.
- Added document translation: the link panel and the rich-text paste panel share one "translate into <target language>" checkbox whose initial value comes from the settings default. With it checked, a successful conversion is translated automatically. The result area now has 原文 / 译文 tabs (keyboard operable), copy and download act on the active tab, and the translated download is named `<original>-<language>.md` (for example `article-en.md`).
- Translation shows progress and can be cancelled; on failure the translated tab shows the reason plus a retry button that reuses the completed language analysis. When no model is configured, no tabs appear and the page points to Settings instead.
- Added a language check before translating: when the article is already mostly in the target language, the page asks first. Above 97% it only shows one line and skips translation; between 70% and 97% a confirmation dialog offers "只翻译非目标语言部分" (translate everything except the parts already in the target language) or "不翻译"; below 70% the document is translated directly without a prompt. Parts kept in the original language are preserved byte for byte.
- Added a desktop-only secrets panel that keeps provider API keys in the macOS keychain through Electron `safeStorage`. Keys never reach `settings.json`, the local server, or logs, and the panel is hidden when the page runs outside the packaged app. Saving or removing a key now takes effect in the running app immediately, without a restart; after removal the provider falls back to its configured environment variable or `.env` entry.

### Changed

- The settings page sections for cloud providers, local CLIs, and languages are no longer placeholders. Translation itself is now available: article text only leaves the machine when the translation checkbox is on and a conversion finishes, and it goes only to the local CLI or cloud provider you configured yourself. MD-Convertor still uploads nothing on its own, keeps no history, and stores no article text.

### Notes

- The `0.3.0` build is not Developer ID signed or notarized, so it is suitable for personal testing only.
- The release gate no longer blocks when a historical release ZIP is absent from this Mac. The 0.1.0–0.2.0 archives and the 0.1.3 read-only copy were lost and cannot be restored; every archive that still exists is still hash-checked, and the retired entries are printed as a notice on each release.

### Fixed

- Fixed WeChat-style code blocks where one `<pre>` contains multiple sibling `<code>` nodes; all source lines, blank lines, `<br>` breaks, indentation, entities, and nested text are now preserved in the generated fenced Markdown block.

### Testing

- Added TDD regression coverage for multi-node code blocks in link and pasted-HTML rendering, plus an in-memory per-block comparison for the supplied WeChat article that retains code punctuation, operators, and string symbols.
- Passed 322 automated tests, 60/60 Chromium/Firefox/WebKit E2E checks, 2/2 stable live comparisons, and fresh Apple Silicon package verification.

### Maintenance

- Archived completed plans, task records, prior state snapshots, WorkBuddy data, and release ZIPs through 0.2.0 outside the repository workspace.
- Updated release guards to verify immutable historical ZIP hashes from the external archive while keeping only the latest build output in the working folder.

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
