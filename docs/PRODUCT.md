# Product Specification

**English** | [简体中文](PRODUCT.zh.md)

## Users and goals

MD-Convertor is designed for individuals who want to archive web content. The first release is a standalone Apple Silicon Mac app with two independent entry points: paste a public webpage URL, or paste rich web content that the user has already copied. Both paths create a local, single-file Markdown document that can be previewed, copied, and downloaded.

## Core flows

1. Choose Link Conversion or Rich Text Conversion.
2. Link mode accepts an HTTP/HTTPS URL, validates it, and waits for explicit submission. Click Convert to MD or press Enter to start. An in-progress conversion can be stopped without losing the URL. Clear Link removes the URL, validation message, and previous result; it is disabled while converting.
3. Rich text mode processes only an explicit clipboard snapshot. It reads both `text/html` and `text/plain`, while the text area displays plain text. Semantically structured content uses sanitized HTML; otherwise clipboard plain text is authoritative.
4. Editing pasted content immediately discards the captured HTML and switches to plain text. A new paste replaces the entire previous input rather than merging fragments. The optional source URL affects only source metadata and relative link/image resolution. Clear removes HTML, plain text, the source URL, and the previous result; it is disabled while converting.
5. Link mode can use the embedded browser for dynamic pages. Rich text mode never refetches the source webpage. Both modes show file size, text character count, image statistics, warnings, and a Markdown preview.
6. Copy writes the original Markdown to the clipboard. Download saves the `.md` file locally. A successful copy briefly displays a confirmation. After the page is scrolled by roughly 500px, Back to Top returns to the input area without clearing any input or result.

## Output rules

- Documents contain an H1 title, UTC conversion time, and body. Link mode includes the original source URL; rich text mode includes a source line only when a valid `sourceUrl` is provided.
- JPEG, PNG, WebP, GIF, and AVIF images are embedded as Base64 Data URIs with no asset directory. SVG, BMP, TIFF, and other unsupported formats fall back to alt text.
- Mermaid source becomes a fenced `mermaid` block. When only a rendered Mermaid result is available, the appropriate security boundary rasterizes it to PNG under the existing image and output budgets. The built-in preview does not execute Mermaid source.
- Standard fenced code blocks are preserved. When one webpage code block is represented by multiple sibling `code` nodes inside a single `pre`, their lines, breaks, indentation, entities, nested text, and punctuation are normalized into one complete fenced block.
- Filenames are macOS-compatible, limited to 80 characters, and retain cross-platform safety rules for files copied to other computers.
- At most 30 images are processed. Each source image is limited to 8 MiB. Images over 2 MiB or 2048px on the longest edge are converted to WebP at quality 82. Animated images that require compression keep only the first frame.
- The final file has a hard 20 MiB limit. When over budget, embedded images are replaced with alt text starting from the last image so that all body text is preserved. An error is returned only when text alone still exceeds the limit.
- Text character count is measured after extraction and before Markdown generation. Image statistics include source, embedded, and omitted counts.

## Rich text paste rules

- HTML passes through DOM semantic gating and an independent sanitizer. Title fallback order is `title`, `og:title`, first `h1`, and the first plain-text line; the final fallback is “Pasted Content.”
- Only conversion-relevant semantics and the image attributes `data-src` and `data-lazy-src` are retained. Arbitrary `data-*`, scripts, styles, navigation, buttons, and active content never enter the output.
- Mermaid source can be retained as code. If pasted content contains only rendered Mermaid SVG, the app does not execute active content: it removes scripts, events, and external resources, then converts the sanitized diagram to PNG locally. Unsafe or Canvas-only diagrams fall back to placeholder text with a warning.
- Pasted images use `data-src` → `data-lazy-src` → `src` priority. Remote images still use public-target validation and SSRF defenses. Valid `data:` images are decoded, format-checked, and optimized before embedding rather than passed through unchanged.
- The rich text JSON request body, including JSON overhead, is limited to 5 MiB. The frontend checks UTF-8 bytes before submission, and the server checks both the declared length and the actual streamed body.

## Supported first-release scope

- Apple Silicon (arm64) Macs.
- Best-effort conversion of public HTTP/HTTPS HTML pages.
- Static HTML and JavaScript-rendered pages that do not require authentication.
- Public WeChat Official Account articles that require neither login nor manual verification. Verification and deleted-article pages return explicit errors instead of false content.
- HTML/plain text explicitly copied by a user from content they are authorized to access. Paste mode does not read authenticated browser state or bypass login pages, paywalls, or CAPTCHAs.
- No account is required. Link conversion and remote HTTP(S) images require internet access; plain text and `data:` images can be converted offline.
- No OpenAI or other AI API, API key, model usage, or model-related cost.

## Non-goals

- No Intel Mac, Windows, or Linux packages in the first release.
- No hosted service, cross-device synchronization, account, history, or automatic updates.
- No bypassing authentication, paywalls, CAPTCHAs, or website access restrictions. Paste mode processes only clipboard content explicitly supplied by the user.
- No automatic import of arbitrary files or webpage bodies, non-HTML resources such as PDFs, or batch input. Extraction quality is not guaranteed to be identical across all websites.
- No guarantee that images requiring authentication, cookies, temporary signatures, or `blob:` URLs can be fetched. Such images retain alt text and produce a warning.
- No reverse engineering of Mermaid source from JavaScript bundles and no raw SVG/Canvas in Markdown. Link mode accepts only validated raster screenshots produced by the controlled Chromium session; paste mode accepts only Mermaid PNGs generated locally from independently sanitized SVG.

## Privacy

URLs, clipboard HTML/plain text, webpages, images, and conversion results are not uploaded to an MD-Convertor service. The application code creates no conversion history, database, or analytics record. Pasted content exists only for the current local request, and diagnostic logs do not record body text, HTML, or source URLs. The app does not read browser cookies or authenticated state. Electron and the embedded browser create local runtime caches and browser profiles, but the app does not use them to synchronize or restore conversion content. Closing the app clears the current result except for `.md` files explicitly saved by the user.
