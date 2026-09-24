import { describe, expect, it } from "vitest";
import { markdownDataUrl, writeMarkdown, type DownloadRequest, type DownloadsApi } from "./write";

// T2.5: the write path itself. `write.ts` landed with the skeleton in T2.1, so these cases are
// retro-proof rather than a written-first RED — recorded as such in the S2 document.
function fakeDownloads() {
  const requests: DownloadRequest[] = [];
  const downloads: DownloadsApi = {
    download: async (request) => {
      requests.push(request);
      return requests.length;
    },
    search: async () => [],
  };
  return { requests, downloads };
}

const ARTICLE = [
  "# 标题",
  "",
  "正文里带中文、括号（半角 ( ) 与全角）、引号 ' \" 与 emoji 🎉。",
  "",
  "![](示例文章标题.images/001-lazy.png)",
  "",
].join("\n");

describe("writeMarkdown", () => {
  it("only ever asks for a relative filename", async () => {
    const { requests, downloads } = fakeDownloads();

    await writeMarkdown(downloads, "示例文章标题.md", ARTICLE);

    expect(requests[0].filename).toBe("示例文章标题.md");
    expect(requests[0].filename.startsWith("/")).toBe(false);
    // A Windows-style absolute path would be rejected too, and a `..` would escape the folder.
    expect(/^[a-zA-Z]:|\\\\|\.\.\//.test(requests[0].filename)).toBe(false);
  });

  it("sends a parseable data URL that decodes back to the same bytes", async () => {
    const { requests, downloads } = fakeDownloads();

    await writeMarkdown(downloads, "示例文章标题.md", ARTICLE);

    const url = new URL(requests[0].url);
    expect(url.protocol).toBe("data:");
    expect(requests[0].url.startsWith("data:text/markdown;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(requests[0].url.slice(requests[0].url.indexOf(",") + 1))).toBe(ARTICLE);
  });

  it("overwrites the previous export instead of prompting", async () => {
    const { requests, downloads } = fakeDownloads();

    await writeMarkdown(downloads, "示例文章标题.md", ARTICLE);

    expect(requests[0].conflictAction).toBe("overwrite");
    expect(requests[0].saveAs).toBe(false);
  });

  it("encodes characters that would otherwise break the data URL", () => {
    const url = markdownDataUrl("100% #tag ?query &more, comma");

    expect(url).not.toContain("#");
    expect(decodeURIComponent(url.slice(url.indexOf(",") + 1))).toBe("100% #tag ?query &more, comma");
  });
});
