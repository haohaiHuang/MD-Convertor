# MD-Convertor

**English** | [简体中文](README.zh.md)

MD-Convertor is a local webpage-to-Markdown app for Apple Silicon Macs. Convert a public webpage link, or paste rich content you already copied, then preview, copy, or download one self-contained Markdown file.

## Highlights

- Runs locally with no account, no MD-Convertor server, and no subscription; no model of its own is bundled or billed
- Supports explicit Link Conversion and Rich Text Conversion workflows
- Optionally translates the converted article into eleven preset target languages (Simplified Chinese, English, Japanese, Korean, French, German, Spanish, Portuguese, Italian, Russian, Arabic) plus custom BCP-47 tags, using a local agent CLI or a cloud provider you configure
- Extracts static pages and uses bundled Chromium when JavaScript rendering is needed
- Preserves headings, paragraphs, links, lists, tables, fenced code blocks, and GFM
- Preserves Mermaid source as a fenced `mermaid` block; safe rendered Mermaid can be embedded as PNG
- Preserves WeChat-style code blocks that split one block across multiple `<code>` nodes
- Embeds JPEG, PNG, WebP, GIF, and AVIF images as Data URIs
- Keeps body text first under a 20 MiB output limit; unsupported or over-budget images fall back to alt text with warnings
- Supports stopping a conversion, clearing either input mode, copying, downloading, result statistics, and quick return to the input area

- Translation uses a model you configure yourself: an agent CLI already installed on the Mac (`pi` or `claude`), or one OpenAI-compatible cloud provider you configure in Settings. Nothing is translated until you check the translation box, and no MD-Convertor key or account exists.

The app does not bypass login pages, paywalls, CAPTCHAs, or access restrictions. Rich Text Conversion processes only clipboard content explicitly supplied by the user. Images that require cookies, authenticated sessions, temporary signatures, or `blob:` URLs may not be retrievable. With the translation box checked, the converted article text is sent to the endpoint you configured — that transfer is the only time document content leaves the machine, and MD-Convertor keeps no history or cache of it.

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

- Current version: `0.3.3` — document translation (Apple Silicon Mac, macOS 12.0+). The `0.3.3` gate passed on 2026-09-20 and the build is installed locally.
- Latest published release: [`v0.3.2`](https://github.com/haohaiHuang/MD-Convertor/releases/tag/v0.3.2).
- No build is Developer ID signed or notarized, so every artifact is suitable for personal testing only.

Current gated artifact (`0.3.3`):

- ZIP: `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.3.zip`
- Size: `232,947,408` bytes
- SHA-256: `1bf807dfe294860c24345efe5caf2b0fcbd54f88476df7085c9bd03b47b37a72`

Previous published artifact (`0.3.2`): `358,726,788` bytes, SHA-256 `8fb7a93f33a07bb03b0b8558df4ff0c2abe40a14eee13fd9dc0348fedcc7f1ba`.

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

The release workflow requires version `0.3.3`, hash-checks every historical artifact that still exists outside the repository (missing entries are reported as retired instead of blocking), rejects stale output, and validates the packaged version, arm64 architecture, bundle structure, size, and SHA-256.

See [Product](docs/PRODUCT.md), [Architecture](docs/ARCHITECTURE.md), [Testing](docs/TESTING.md), [Quality Audit](docs/QUALITY-AUDIT.md), and [Changelog](CHANGELOG.md).
