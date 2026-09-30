import { createServer, type Server } from "node:http";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { MAX_IMAGES, MAX_SOURCE_IMAGE_BYTES } from "@/lib/images";
import { inlineLocalDocImages, type FetchResource, type InlineImageDeps } from "./inline-images";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nKAAAAAASUVORK5CYII=",
  "base64",
);

/** Talks to the fixture server over real HTTP; the inliner's default is the SSRF-checked fetcher. */
const fixtureFetch: FetchResource = async (url, { signal }) => {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new AppError(502, "UPSTREAM_STATUS", `图片返回了 ${response.status}。`);
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? "",
    finalUrl: new URL(url.toString()),
  };
};

let server: Server;
let origin: string;
let root: string;

beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "md-convertor-inline-"));
  await writeFile(path.join(root, "photo.png"), onePixelPng);
  await mkdir(path.join(root, "images"), { recursive: true });
  await writeFile(path.join(root, "images", "nested.png"), onePixelPng);
  await writeFile(path.join(path.dirname(root), "outside.png"), onePixelPng);

  server = createServer((request, response) => {
    if (request.url === "/ok.png") {
      response.writeHead(200, { "content-type": "image/png" });
      response.end(onePixelPng);
      return;
    }
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("not found");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  origin = typeof address === "object" && address ? `http://127.0.0.1:${address.port}` : "";
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

function inline(markdownText: string, deps: InlineImageDeps = { fetchResource: fixtureFetch }) {
  return inlineLocalDocImages(markdownText, { sourceDir: root, signal: new AbortController().signal, deps });
}

describe("inlineLocalDocImages — local images", () => {
  it("inlines a relative image and leaves every other byte alone", async () => {
    const markdown = "# 标题\n\n正文一段。\n\n![示例](photo.png)\n\n尾段。\n";
    const result = await inline(markdown);

    const match = /data:image\/png;base64,[A-Za-z0-9+/=]+/.exec(result.markdown);
    const dataUri = match?.[0] ?? "";
    expect(dataUri).toBe(`data:image/png;base64,${onePixelPng.toString("base64")}`);
    expect(result.markdown.replace(dataUri, "TARGET"))
      .toBe(markdown.replace("photo.png", "TARGET"));
    expect(result.stats).toEqual({ embedded: 1, kept: 0 });
    expect(result.warnings).toEqual([]);
  });

  it("resolves a nested relative path, including a percent-encoded one", async () => {
    const markdown = "![a](images/nested.png)\n\n![b](images%2Fnested.png)\n";
    const result = await inline(markdown);

    expect(result.stats).toEqual({ embedded: 2, kept: 0 });
    expect(result.markdown).not.toContain("nested.png");
  });

  it("keeps the original reference for an absolute path outside the root", async () => {
    const outside = path.join(path.dirname(root), "outside.png");
    const markdown = `![abs](${outside})\n\n![esc](..%2Foutside.png)\n\n![esc2](../outside.png)\n`;
    const result = await inline(markdown);

    expect(result.markdown).toBe(markdown);
    expect(result.stats).toEqual({ embedded: 0, kept: 3 });
    expect(result.warnings.map((warning) => warning.code))
      .toEqual(["IMAGE_SOURCE_INVALID", "IMAGE_SOURCE_INVALID", "IMAGE_SOURCE_INVALID"]);
  });

  it("keeps the original reference for a missing file and for an unsupported extension", async () => {
    await writeFile(path.join(root, "note.svg"), "<svg/>");
    const markdown = "![missing](gone.png)\n\n![svg](note.svg)\n";
    const result = await inline(markdown);

    expect(result.markdown).toBe(markdown);
    expect(result.stats).toEqual({ embedded: 0, kept: 2 });
    expect(result.warnings.map((warning) => warning.code))
      .toEqual(["IMAGE_FETCH_FAILED", "IMAGE_TYPE_UNSUPPORTED"]);
  });

  it("keeps the original reference when the bytes are not the declared type", async () => {
    await writeFile(path.join(root, "liar.png"), "definitely not a png");
    const result = await inline("![liar](liar.png)\n");

    expect(result.stats).toEqual({ embedded: 0, kept: 1 });
    expect(result.warnings.map((warning) => warning.code)).toEqual(["IMAGE_TYPE_UNSUPPORTED"]);
  });
});

describe("inlineLocalDocImages — http images", () => {
  it("inlines an http image through the injected fetcher", async () => {
    const markdown = `![远端](${origin}/ok.png)\n`;
    const result = await inline(markdown);

    expect(result.stats).toEqual({ embedded: 1, kept: 0 });
    expect(result.markdown).toContain(`data:image/png;base64,${onePixelPng.toString("base64")}`);
  });

  it("keeps the original reference when the server answers 404", async () => {
    const markdown = `![远端](${origin}/missing.png)\n`;
    const result = await inline(markdown);

    expect(result.markdown).toBe(markdown);
    expect(result.stats).toEqual({ embedded: 0, kept: 1 });
    expect(result.warnings.map((warning) => warning.code)).toEqual(["IMAGE_FETCH_FAILED"]);
  });

  it("reports an oversized image as too large instead of a generic failure", async () => {
    const deps: InlineImageDeps = {
      fetchResource: async () => {
        throw new AppError(413, "SOURCE_TOO_LARGE", "图片超过允许的大小。");
      },
    };
    const result = await inline(`![大图](https://cdn.example.com/a.png)\n`, deps);

    expect(result.stats).toEqual({ embedded: 0, kept: 1 });
    expect(result.warnings.map((warning) => warning.code)).toEqual(["IMAGE_TOO_LARGE"]);
  });
});

describe("inlineLocalDocImages — limits and stats", () => {
  it("inlines at most MAX_IMAGES images and keeps the rest", async () => {
    const markdown = `${Array.from({ length: MAX_IMAGES + 1 }, (_, index) => `![${index}](photo.png)`).join("\n\n")}\n`;
    const result = await inline(markdown);

    expect(result.stats).toEqual({ embedded: MAX_IMAGES, kept: 1 });
    expect(result.warnings.map((warning) => warning.code)).toEqual(["IMAGE_COUNT_LIMIT"]);
    expect(result.markdown.match(/data:image\/png/g)).toHaveLength(MAX_IMAGES);
  });

  it("leaves data: URIs untouched and out of the stats", async () => {
    const inlineData = "data:image/png;base64,NOT-A-REAL-IMAGE";
    const markdown = `![内嵌](${inlineData})\n\n![本地](photo.png)\n`;
    const result = await inline(markdown);

    expect(result.stats).toEqual({ embedded: 1, kept: 0 });
    expect(result.markdown).toContain(`![内嵌](${inlineData})`);
  });

  it("keeps an image that would push the document past MAX_MARKDOWN_BYTES", async () => {
    const huge = `data:image/png;base64,${"A".repeat(11 * 1024 * 1024)}`;
    const deps: InlineImageDeps = {
      fetchResource: fixtureFetch,
      embed: async () => ({ dataUri: huge }),
    };
    const markdown = `![一](${origin}/ok.png)\n\n![二](${origin}/ok.png)\n`;
    const result = await inline(markdown, deps);

    expect(result.stats).toEqual({ embedded: 1, kept: 1 });
    expect(result.warnings.map((warning) => warning.code)).toEqual(["IMAGE_BUDGET_EXCEEDED"]);
    expect(result.markdown.match(/data:image\/png/g)).toHaveLength(1);
  });

  it("counts an aborted run as an error rather than a kept image", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      inlineLocalDocImages("![a](photo.png)\n", { sourceDir: root, signal: controller.signal }),
    ).rejects.toThrow();
  });
});

describe("inlineLocalDocImages — fixtures stay honest", () => {
  it("keeps the fixture image byte-identical to what the tests embed", async () => {
    expect(await readFile(path.join(root, "photo.png"))).toEqual(onePixelPng);
    expect(MAX_SOURCE_IMAGE_BYTES).toBe(8 * 1024 * 1024);
  });
});
