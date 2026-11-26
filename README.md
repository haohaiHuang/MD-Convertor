# MD-Convertor

**English** | [简体中文](README.zh.md)

MD-Convertor is a local webpage-to-Markdown app for Apple Silicon Macs. Convert a public webpage link, paste rich content you already copied, or batch-process a folder of existing Markdown documents — then preview, copy, or download self-contained Markdown files.

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
- Can save Markdown straight into a default folder you choose once in Settings, so the save dialog stops appearing on every download; a refused write names the reason and falls back to the normal download
- Batch-processes local Markdown folders: pick a directory, its `.md` files are listed with size, modification time, and processed state; tick the ones you want and one click inlines the images each document references (optional translation included) into the output folder, with per-document outcomes and no writes back into the source folder — documents saved by the browser extension feed the same pipeline
- Ships a separate Chromium extension for working in the browser itself: one toolbar click on the page you are reading saves it as `<title>.md` plus a `<title>.images/`, with no desktop app and no server running (load unpacked from `extension/dist`)

- Translation uses a model you configure yourself: an agent CLI already installed on the Mac (`pi` or `claude`), or one OpenAI-compatible cloud provider you configure in Settings. Nothing is translated until you check the translation box, and no MD-Convertor key or account exists.

The app does not bypass login pages, paywalls, CAPTCHAs, or access restrictions. Rich Text Conversion processes only clipboard content explicitly supplied by the user. Images that require cookies, authenticated sessions, temporary signatures, or `blob:` URLs may not be retrievable. With the translation box checked, the converted article text is sent to the endpoint you configured — that transfer is the only time document content leaves the machine, and MD-Convertor keeps no history or cache of it.

## Requirements

- Apple Silicon Mac (arm64); Intel Mac, Windows, and Linux are not supported
- macOS 12.0 or later
- Internet access for linked webpages and remote images; plain text and embedded `data:` images can be converted offline
- No Node.js, browser, Playwright, or development environment is required to run the packaged app

The current build is unsigned and not notarized. After verifying the checksum, extract the ZIP and move `MD-Convertor.app` to Applications. For the first launch, **Control**-click (or right-click) the icon and choose Open, then confirm Open in the dialog — a plain double-click is usually stopped by Gatekeeper. Allowing it in Privacy & Security works too. If macOS still reports that the trusted ZIP is damaged, remove only its quarantine attribute:

```bash
xattr -dr com.apple.quarantine "/Applications/MD-Convertor.app"
```

Do not run this command for an app whose source or checksum you do not trust.

That step is only about opening the app; running it asks for nothing else. Converting pages, converting local documents, and translating through a local agent CLI never touch the keychain. macOS asks for access to your login keychain **only** when a cloud provider key is saved or read back — that is, the first time you save one, and the first launch after a new version starts decrypting a key you already stored: enter your login password, choose Always Allow, and that build stops asking. A launch with no stored key raises no prompt at all. Because the build has no Developer ID signature, that approval is bound to this one binary, so a new version asks once more.

## Current Release

- Current version: `0.3.12` — on-demand keychain access at startup, aligned start-screen entry cards, and seven UI-audit fixes (single-line status, short Chinese timestamps, truncation warning, larger checkbox target, partial select-all, consistent focus rings); published 2026-11-26 (Apple Silicon Mac, macOS 12.0+).
- Latest published release: [`v0.3.12`](https://github.com/haohaiHuang/MD-Convertor/releases/tag/v0.3.12).
- No build is Developer ID signed or notarized, so every artifact is suitable for personal testing only.

Current gated and published artifact (`0.3.12`):

- ZIP: `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.12.zip`
- Size: `237,922,561` bytes
- SHA-256: `b02254b96f7e67ec2807085082ca77bad2215571bd712ce67e6334f4463c6b7b`

Previous published artifacts: `0.3.11` = `237,921,860` bytes, SHA-256 `a63e5192…0154d`; `0.3.10` = `236,226,685` bytes, SHA-256 `f25e0ae9…c1945`; `0.3.9` = `236,224,633` bytes, SHA-256 `5e75709f…a9c9`; `0.3.8` = `236,224,675` bytes, SHA-256 `94624625…b2ea`; `0.3.5` = `237,335,837` bytes, SHA-256 `313bbbc341c94da0a5ca92f668f2df06cea9f734e47d7af65880500aa192d45f`. Full per-version records live in [Testing](docs/TESTING.md).

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

The release workflow requires version `0.3.12`, hash-checks every historical artifact that still exists outside the repository (missing entries are reported as retired instead of blocking), rejects stale output, and validates the packaged version, arm64 architecture, bundle structure, size, and SHA-256.

See [Product](docs/PRODUCT.md), [Architecture](docs/ARCHITECTURE.md), [Testing](docs/TESTING.md), [Quality Audit](docs/QUALITY-AUDIT.md), and [Changelog](CHANGELOG.md).
