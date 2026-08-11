# MD-Convertor

**English** | [简体中文](README.zh.md)

MD-Convertor is a local webpage-to-Markdown app for Apple Silicon Macs. Paste a public webpage URL, or paste rich web content that you have already copied, review the input, and start the conversion. You can then preview, copy, or save a `.md` file with embedded images—all on your Mac.

## First-stage capabilities

- No account or external server required; URLs and conversion results are processed locally
- A random session token protects the local conversion API on every launch, preventing external webpages from calling it directly
- No AI API, API key, model usage, or model-related cost
- Extracts content from static webpages and falls back to an embedded browser for JavaScript-rendered pages
- Validates every dynamic browser request and pins it to a public IP, preventing target webpages from using the app to access the host or private networks
- Limits each browser fallback to 100 requests, 50 MiB of cumulative network traffic, and 25 MiB per connection; related requests stop when a limit is exceeded
- Supports publicly accessible WeChat Official Account articles and detects verification or deleted-article pages
- Provides two modes: Link Conversion and Rich Text Conversion; rich text mode reads both clipboard HTML and plain text
- Applies semantic gating and independent sanitization to pasted HTML; manual edits automatically fall back to plain text, while a new paste replaces the entire previous input
- Limits rich text request bodies to 5 MiB based on actual UTF-8 JSON bytes; the optional source URL is used only for source metadata and resolving relative resources
- Processes pasted images with lazy-load sources first, strictly validates `data:` images, and retains the existing limits of 30 images, 8 MiB per source image, and 20 MiB per final file
- Link mode automatically preserves the title, source, and conversion time; rich text mode preserves a source only when an optional source URL is provided
- Embeds JPEG, PNG, WebP, GIF, and AVIF images as Data URIs in Markdown
- Converts Mermaid source to fenced `mermaid` code blocks; when a linked page or pasted content contains only a safe rendered diagram, it converts the diagram to an embedded PNG
- Limits the final file to 20 MiB; when over budget, it keeps the text first and omits embedded images starting from the last one
- Lets you stop an in-progress conversion; completed results show file size, text character count, and extracted image count
- Lets you clear the URL and previous result in link mode with one action; long result pages provide a quick way back to the top
- Ships as an Apple Silicon (arm64) Mac desktop app

The app does not bypass login pages, paywalls, CAPTCHAs, or other access restrictions. Rich text mode processes only clipboard content that the user explicitly copies. Images that require an authenticated session, temporary signatures, `blob:` URLs, or cookies may not be retrievable; the app keeps their alt text and displays a warning. PDFs, batch conversion, history, and cross-device synchronization are outside the first-stage scope.

## Two conversion modes

### Link Conversion

Paste an HTTP/HTTPS webpage URL into the Link Conversion tab, then click “转换为 MD” (Convert to MD). The app securely fetches the page, extracts its main content, and processes its images locally. “清空链接” (Clear Link) removes the URL, validation message, and previous result together; it is disabled during conversion. Dynamic pages can use the embedded Chromium fallback. URLs, webpages, and images are never uploaded to an MD-Convertor service.

When a result is long, a “返回顶部” (Back to Top) button appears in the lower-right corner after you scroll. It only scrolls smoothly back to the input area and does not clear the URL, rich text, or conversion result.

### Rich Text Conversion

Paste content copied from a browser directly into the Rich Text Conversion tab. The app reads both `text/html` and `text/plain`, while the input box displays the plain-text representation:

1. When semantic structure is detected, the app uses sanitized HTML, Turndown/GFM, and the lazy-first image pipeline.
2. When no usable semantic HTML exists, it uses the clipboard plain text and clearly indicates that path.
3. Manual edits immediately discard the previous HTML and switch the conversion to plain text; pasting again replaces all existing content.
4. You may provide a source URL. A credential-free HTTP/HTTPS URL adds source metadata and helps resolve relative links and images; leaving it blank omits the source line.
5. “清空” (Clear) removes the current content, source URL, and previous result in one action; it is disabled during conversion.

Paste mode does not refetch the source webpage, read browser cookies, or restore an authenticated session. If a lazy-loaded image has no real URL, or an image depends on authentication, temporary signatures, or a `blob:` URL, the app keeps its alt text and displays a warning.

Mermaid source is preserved as a fenced `mermaid` code block. The built-in preview displays it as code, while Markdown readers with Mermaid support can render it themselves. If a linked page contains only a client-rendered diagram, the app captures it as a PNG in controlled Chromium. If pasted rich text contains only Mermaid SVG, the app removes scripts, external resources, and dangerous attributes before converting it to PNG locally. If safe conversion is impossible, or only a Canvas rendering is available, it keeps placeholder text and displays a warning. PNGs from both paths share the existing image-count and file-size budgets, and raw SVG never enters the Markdown output.

## Using the app on another computer

Both 0.1.3 and the currently verified v0.2 (`0.2.0`) ZIP are self-contained Apple Silicon Mac applications. The target Mac does not need Node.js, npm, Chrome, Playwright, an AI API, or any other development environment.

- Requires an Apple Silicon Mac with an M1, M2, M3, M4, or later arm64 chip; Intel Macs, Windows, and Linux are not supported.
- Requires macOS 12.0 or later. Link conversion and re-embedding remote HTTP(S) images in rich text mode require an internet connection; plain text and `data:` images can be converted offline.
- After extracting the ZIP, move `MD-Convertor.app` to Applications. The current build is not signed or notarized, so the first launch may require right-clicking the app in Finder and choosing Open, or allowing it under Privacy & Security. Some Macs may instead report that the app is damaged.
- Conversion history and results do not sync between computers. Download each `.md` file on the Mac where you create it.

The current 0.2.0 ZIP includes `feat-015`, the complete link/paste Mermaid fixes from `feat-013`, and the clear-link/back-to-top interactions from `feat-016`. It passed the complete release gate. The file is `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.2.0.zip`, its size is `354,636,241` bytes, and its SHA-256 is `5becae36a53e91129a0dbcb93c3f7f5f3197326b2c83df6f10cb8494d8116485`.

Version 0.1.3 was installed and tested on a second Apple Silicon Mac. On first launch, that Mac displayed an “app is damaged” message. After verifying that the ZIP SHA-256 matched the value documented here, removing the quarantine attribute allowed the app to launch:

```bash
xattr -dr com.apple.quarantine "/Applications/MD-Convertor.app"
```

If macOS reports insufficient permissions, prepend `sudo`. The acceptance test also succeeded with `xattr -cr`, but that command recursively removes all extended attributes from the app. The installation instructions therefore recommend the more precise quarantine-only command above. Never run it on an app whose source or checksum you do not trust.

## Local development

Local development requires an Apple Silicon Mac, Node.js 24.x, and npm. The verification script rejects other Node.js major versions, including 23 and 25.

```bash
npm install
npx playwright install chromium
npm run dev:desktop
```

The first build needs internet access to download Electron and Chromium. Later desktop builds reuse the local cache.

## Verification

Before the first full cross-browser run, install all three browser engines:

```bash
npx playwright install chromium firefox webkit
```

```bash
./init.sh
npm run test:e2e
npm run test:live
npm run test:live:wechat
npm run desktop:package
```

`npm run test:live` runs the release-blocking online checks for WalkingLabs link and pasted Mermaid conversion. `npm run test:live:wechat` retains the real WeChat comparison as a non-blocking diagnostic because WeChat verification and timeout behavior can vary. The Apple Silicon release workflow uses `npm run desktop:release` to run the baseline, three-browser E2E tests, stable live-page comparisons, and ZIP packaging. The script rejects stale ZIPs, verifies the version, arm64 architecture, and package structure, and prints the new artifact size and SHA-256. See [`docs/TESTING.md`](docs/TESTING.md) for command tiers, environment variables, smoke tests, and the manual acceptance checklist.

The v0.2 `desktop:release` workflow is restricted to T10. It requires version `0.2.0` and protects `main`/`v0.1.3`, the external read-only archive, and all historical 0.1.0–0.1.3 ZIPs before running any validation or packaging command. The T9A guards, live checks, 0.2.0 packaging, and packaged-window acceptance have all passed.

## Building the Apple Silicon app

```bash
npm run desktop:make
```

Unsigned test artifacts are generated under `out/`. macOS may display a security warning on first launch. Developer ID signing and notarization are required before formal distribution.

The 0.1.3 personal-test ZIP is stored at the following path, and v0.2 does not overwrite it:

```text
out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.1.3.zip
```

Its SHA-256 is `66909aa8759ec41fdde875204773958d32b33a2c903e7b4eb0858a50fb1bdf89`.

After extracting the ZIP, move `MD-Convertor.app` to Applications. If right-clicking and choosing Open in Finder still reports that the app is damaged, verify the ZIP SHA-256 first, then remove the quarantine attribute using the command under “Using the app on another computer.”

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for architecture and security boundaries, and [`docs/PRODUCT.md`](docs/PRODUCT.md) for the product scope.
