import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractReadable } from "./extract";
import { fetchPublicResource } from "./fetcher";
import { embedImages } from "./images";
import { htmlToMarkdown } from "./markdown";

vi.mock("./fetcher", () => ({
  fetchPublicResource: vi.fn(),
}));

const sourceUrl = "https://mp.weixin.qq.com/s/golden-fixture";
const convertedAt = "2026-07-18T00:00:00.000Z";
const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nKAAAAAASUVORK5CYII=",
  "base64",
);

describe("webpage to Markdown golden fixture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchPublicResource).mockImplementation(async (url) => ({
      buffer: onePixelPng,
      contentType: "image/png",
      finalUrl: typeof url === "string" ? new URL(url) : url,
    }));
  });

  it("matches the reviewed Markdown exactly", async () => {
    const [html, expectedMarkdown] = await Promise.all([
      readFile(new URL("./fixtures/golden-article.html", import.meta.url), "utf8"),
      readFile(new URL("./fixtures/golden-article.md", import.meta.url), "utf8"),
    ]);
    const extracted = extractReadable(html, sourceUrl);
    expect(extracted).not.toBeNull();

    const embedded = await embedImages(
      extracted!.html,
      sourceUrl,
      new AbortController().signal,
      1024 * 1024,
      {
        mode: "link",
        sourcePriority: "src-first",
        allowDataUri: false,
      },
    );
    const markdown = htmlToMarkdown(embedded.html, extracted!.title, sourceUrl, convertedAt);

    expect(extracted!.title).toBe("金标准网页");
    expect(embedded.stats).toEqual({ sourceImageCount: 2, embeddedImageCount: 2, omittedImageCount: 0 });
    expect(markdown).toBe(expectedMarkdown);
  });
});
