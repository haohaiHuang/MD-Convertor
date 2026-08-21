# MD-Convertor

**English** | [简体中文](README.zh.md)

MD-Convertor is a local webpage-to-Markdown app for Apple Silicon Macs. Convert a public webpage link, or paste rich content you already copied, then preview, copy, or download one self-contained Markdown file.

## Highlights

- Runs locally with no account, server, AI API, API key, or subscription
- Supports explicit Link Conversion and Rich Text Conversion workflows
- Extracts static pages and uses bundled Chromium when JavaScript rendering is needed
- Preserves headings, paragraphs, links, lists, tables, fenced code blocks, and GFM
- Preserves Mermaid source as a fenced `mermaid` block; safe rendered Mermaid can be embedded as PNG
- Preserves WeChat-style code blocks that split one block across multiple `<code>` nodes
- Embeds JPEG, PNG, WebP, GIF, and AVIF images as Data URIs
- Keeps body text first under a 20 MiB output limit; unsupported or over-budget images fall back to alt text with warnings
- Supports stopping a conversion, clearing either input mode, copying, downloading, result statistics, and quick return to the input area

The app does not bypass login pages, paywalls, CAPTCHAs, or access restrictions. Rich Text Conversion processes only clipboard content explicitly supplied by the user. Images that require cookies, authenticated sessions, temporary signatures, or `blob:` URLs may not be retrievable.

## Requirements

- Apple Silicon Mac (arm64); Intel Mac, Windows, and Linux are not supported
- macOS 12.0 or later
- Internet access for linked webpages and remote images; plain text and embedded `data:` images can be converted offline
- No Node.js, browser, Playwright, or development environment is required to run the packaged app

The current build is unsigned and not notarized. After verifying the checksum, extract the ZIP, move `MD-Convertor.app` to Applications, and try Finder → Open or Privacy & Security first. If macOS still reports that the trusted ZIP is damaged, remove only its quarantine attribute:

```bash
xattr -dr com.apple.quarantine "/Applications/MD-Convertor.app"
```

Do not run this command for an app whose source or checksum you do not trust.

## Current Release

- Version: `0.2.1`
- Platform: Apple Silicon Mac, macOS 12.0+
- ZIP: `MD-Convertor-darwin-arm64-0.2.1.zip`
- Size: `354,635,067` bytes
- SHA-256: `32c1d96af58a7701e6d2fe0bf619be0f8f224803355c6ef63aad43c85569463e`

Download the ZIP from the [GitHub Releases](https://github.com/haohaiHuang/MD-Convertor/releases) page.

## Local Development

Development requires an Apple Silicon Mac, Node.js 24.x, and npm:

```bash
npm ci
npx playwright install chromium firefox webkit
npm run dev:desktop
```

Core verification:

```bash
./init.sh
npm run test:e2e
npm run test:live
```

`npm run test:live` runs the stable release-blocking WalkingLabs comparisons. `npm run test:live:wechat` is a separate non-blocking diagnostic because WeChat verification and timeout behavior varies. A complete Apple Silicon release uses:

```bash
npm run desktop:release
```

The release workflow requires version `0.2.1`, protects the immutable historical artifact manifest stored outside the repository, rejects stale output, and validates the packaged version, arm64 architecture, bundle structure, size, and SHA-256.

See [Product](docs/PRODUCT.md), [Architecture](docs/ARCHITECTURE.md), [Testing](docs/TESTING.md), [Quality Audit](docs/QUALITY-AUDIT.md), and [Changelog](CHANGELOG.md).
