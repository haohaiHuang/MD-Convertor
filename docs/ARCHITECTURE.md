# Architecture

**English** | [简体中文](ARCHITECTURE.zh.md)

## Runtime model

The first release is an Apple Silicon Mac desktop application. Electron provides the native window and starts a local Next.js service bound only to `127.0.0.1` on an OS-assigned random port. The UI, `POST /api/convert`, and `POST /api/convert-paste` communicate only on the local machine. No public server, domain, or Docker deployment is required.

The Electron renderer uses sandboxing and context isolation with Node.js integration disabled. Every launch creates a random 256-bit session token that the Electron network layer attaches to local requests without exposing it to page scripts. In-app navigation is restricted to the local application origin; HTTP/HTTPS links in converted content open in the system browser.

## Local API contract

The UI sends `{ "url": string }` to same-origin `POST /api/convert`, or `{ "html"?: string, "text"?: string, "sourceUrl"?: string }` to same-origin `POST /api/convert-paste`. Paste requests must contain at least one non-empty `html` or `text` field. The raw JSON body, including serialization overhead, is limited to 5 MiB and measured as UTF-8 bytes on both client and server. `sourceUrl` is optional; a non-empty value must be a credential-free HTTP/HTTPS URL and is used only for source metadata and relative link/image resolution. It never triggers a fetch of the source page.

These APIs are internal to the local application and its tests, not public integration endpoints. Production requests require `application/json`, a loopback Host, same-origin Origin / `Sec-Fetch-Site`, and the current launch token. Missing or invalid tokens are rejected. `src/types/conversion.ts` is the TypeScript source of truth for successful responses:

- `title`, `filename`, `markdown`, and `warnings`.
- `meta.sourceUrl`, `convertedAt`, `extractionMode`, and `outputBytes`. Paste mode may return an empty `sourceUrl` and uses `paste` as its extraction mode.
- `meta.textChars`, `sourceImageCount`, `embeddedImageCount`, and `omittedImageCount`.

Error responses use `400`, `403`, `413`, `422`, `429`, `502`, or `504` with Simplified Chinese user-facing messages. Explicit client cancellation is logged internally as `499 CLIENT_ABORTED`, while the UI reports that conversion stopped. The server deadline maps to `504 CONVERSION_TIMEOUT`. Extraction modes remain available for diagnostics but are not shown in the ordinary result UI.

## Conversion pipelines

Link mode:

1. Validate the URL, scheme, credentials, DNS result, and public IP.
2. Fetch HTML by connecting to the validated IP. Revalidate every redirect hop.
3. Use JSDOM, Mozilla Readability, and DOMPurify to extract and sanitize content. WeChat articles prefer `#js_content`, and lazy `data-src` images are normalized before sanitization.
4. If direct extraction yields fewer than 300 characters, or the HTML signals an empty Mermaid placeholder/rendered-only diagram, render the page in Playwright Chromium and extract again. Visible Mermaid diagrams are captured as PNG and replaced with unpredictable, request-local trusted placeholder URLs. Browser output is accepted only when body coverage is sufficient.
5. Detect WeChat verification, deleted-article, and other access-block pages before content extraction so that notices are not mistaken for article text.
6. If no main content remains, convert the sanitized `body`; fewer than 50 usable characters returns an error.

Rich text paste mode:

1. Accept an explicit clipboard snapshot containing `text/html` and `text/plain`. Extract the title from the complete HTML before sanitizing the body.
2. Use semantic gating to select sanitized HTML or authoritative plain text. Strong structure, valid rich-text signals, or at least two body paragraphs select HTML. Edited content is submitted as plain text only.
3. Apply a paste-specific DOMPurify policy that removes scripts, styles, embeds, forms, navigation, and event handlers while retaining only `data-src`, `data-lazy-src`, `src`, and `alt` needed for images.
4. Process images in `data-src` → `data-lazy-src` → `src` order. Remote HTTP(S) images reuse the SSRF-safe fetch path. Valid `data:` images are decoded, validated with Sharp, and optimized. Paste mode does not refetch the source webpage.
5. Normalize Mermaid source to `code.language-mermaid` before general sanitization. For rendered-only Mermaid SVG, never execute the pasted content. Remove scripts, events, external resources, `<style>`, inline `style`, and dangerous attributes; reduce `foreignObject` content to SVG text; apply a fixed light palette; then rasterize locally with Sharp to a PNG no larger than 2048px on the longest edge. SVG over 1 MiB, missing valid dimensions/visible shapes, diagrams beyond the 30-image limit, Canvas-only content, or conversion failures fall back to placeholders and warnings and count as omitted.

Both modes then share the following stages:

1. Download, validate, and optimize at most four images concurrently. Supported formats are JPEG, PNG, WebP, GIF, and AVIF. Oversized images are converted to WebP. Browser-generated Mermaid PNGs enter the image pipeline only through the current request's in-memory trusted map. Paste-generated Mermaid PNGs re-enter as strictly validated Data URIs. Arbitrary webpage Data URIs remain forbidden in link mode.
2. Generate Markdown with Turndown/GFM; Mermaid source becomes a fenced `mermaid` block. If the result exceeds 20 MiB, replace embedded images from the end until the budget is met. Return `413 OUTPUT_TOO_LARGE` only when text alone is still too large.
3. Return output bytes, body text characters, source/embedded/omitted image counts, and the diagnostic extraction mode.

## Local security boundary

- The local service binds only to `127.0.0.1` and a random OS-assigned port; it never listens on LAN or public interfaces.
- Only HTTP/HTTPS is accepted. URL credentials, loopback, private, link-local, reserved, and cloud metadata addresses are rejected.
- Pages, redirect hops, browser subresources, and images use the same validation. Chromium HTTP/HTTPS traffic goes through a one-use loopback proxy. Every HTTP request and HTTPS CONNECT tunnel revalidates the target and connects directly to the validated IP so Chromium cannot perform a second DNS resolution after validation.
- Decompressed HTML and serialized rendered DOM are each limited to 5 MiB. This is separate from the browser network budget. Each image is limited to 8 MiB, each conversion to 30 images and 45 seconds.
- Each browser fallback is limited to 100 HTTP/CONNECT requests, 50 MiB total proxy traffic, and 25 MiB per CONNECT tunnel. Declared oversized HTTP responses are rejected before forwarding; unknown-length streams and encrypted tunnels are closed when the shared budget is exhausted.
- Browser contexts and security proxies are created and destroyed per request. Downloads, media, fonts, Google Fonts stylesheets, and WebSocket upgrades are blocked; page-owned CSS remains available for diagram layout.
- Direct and browser fetches use the same desktop Chrome User-Agent.
- Pasted HTML is untrusted input. Mermaid SVG first passes through a dedicated allowlist and local rasterization. General sanitization still forbids `script/style/iframe/object/embed/form/svg/math`, event attributes, `style`, `srcdoc`, and arbitrary `data-*`. Image URLs using `file:`, `javascript:`, or `blob:` are never requested.
- Paste body limits check both declared `Content-Length` and streamed bytes. Authentication and limits run before conversion. Paste conversion has a 45-second server deadline; client cancellation records `499 CLIENT_ABORTED`.
- Images requiring authentication, cookies, temporary signatures, or `blob:` URLs may fail and fall back to alt text with a warning. The app does not read cookies or attempt to bypass access controls.
- Markdown preview does not parse raw HTML. It allows only application-generated raster Data URIs. Fenced Mermaid is displayed as code and is not executed in the app.
- Before Turndown, the shared Markdown stage normalizes only `pre` elements with multiple direct `code` children into one complete code block; ordinary code blocks and Mermaid markers remain unchanged.
- Client cancellation aborts the same-origin request and propagates through direct fetches, browser rendering, and image requests so local resources are released promptly.

## Data and logs

The application code uses no database, object storage, cookies, LocalStorage, or conversion history. Clipboard HTML/plain text, source URLs, and results exist only for the current local request. Structured diagnostic logs exclude URLs, page bodies, pasted HTML, and images. Electron and Chromium create local caches, preferences, and temporary browser data as part of normal runtime behavior, but the app does not use them to restore or synchronize conversion content. User-saved `.md` files are not application persistence.

## Build and distribution

- Electron Forge creates `darwin/arm64` application bundles and ZIP files.
- `npm run dev:desktop` starts local development.
- `npm run desktop:package` creates an unpacked app; `npm run desktop:make` creates the distributable ZIP.
- The daily baseline includes exact synthetic webpage-to-Markdown golden tests. `npm run test:live` uses stable WalkingLabs fixtures as the release-blocking link/paste Mermaid gate. `npm run test:live:wechat` retains the real WeChat comparison as a non-blocking diagnostic because upstream verification and timeouts vary.
- `./init.sh` and release scripts require Node.js 24.x. The release script requires version `0.2.1` and verifies the immutable historical ZIP manifest in `~/Downloads/MD-Convertor-archive/releases/` before running baseline, E2E, live, or Forge commands. Historical artifacts are checked again after success or failure. `npm run desktop:release` then verifies that the new ZIP belongs to the current run, contains the current version and an arm64 executable, has a complete package structure, and prints its size and SHA-256.
- E2E runs against the production standalone service and fails if tracked files change.
- See [`TESTING.md`](TESTING.md) for commands, environment variables, smoke tests, and manual acceptance.
- The current artifact is unsigned and intended for personal testing. Developer ID signing and notarization are required for broad external distribution.
- v0.2.1 is the current release. Historical tags and the external 0.1.0–0.2.0 ZIP archive remain immutable regression references.
- A second-Mac acceptance test confirmed that Gatekeeper may report an unsigned app as damaged. Personal testers should verify the ZIP SHA-256 before removing only `com.apple.quarantine`. This is not a substitute for signing or notarization.
- Desktop preparation packages the Apple Silicon Chromium Headless Shell matching the current Playwright version and launches it through an explicit executable path, avoiding reliance on browser caches installed on the target Mac.
