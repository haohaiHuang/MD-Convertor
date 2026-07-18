import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  close: vi.fn(),
  agentOptions: vi.fn(),
  resolve: vi.fn(),
}));

vi.mock("undici", () => ({
  Agent: class MockAgent {
    constructor(options: unknown) { mocks.agentOptions(options); }
    close = mocks.close;
  },
  fetch: mocks.fetch,
}));
vi.mock("@/lib/security/url", () => ({
  resolvePublicTarget: mocks.resolve,
}));

import { fetchHtml, fetchPublicResource } from "./fetcher";

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.close.mockResolvedValue(undefined);
  mocks.resolve.mockImplementation(async (input: string | URL) => ({
    url: new URL(input.toString()),
    address: "1.1.1.1",
    family: 4 as const,
  }));
});

describe("pinned public resource fetching", () => {
  it("revalidates and pins every redirect hop", async () => {
    mocks.fetch
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: { location: "/final" },
      }))
      .mockResolvedValueOnce(new Response("<article>done</article>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      }));

    const result = await fetchPublicResource("https://example.com/start", {
      signal: new AbortController().signal,
      maxBytes: 1024,
      accept: "text/html",
    });

    expect(result.finalUrl.toString()).toBe("https://example.com/final");
    expect(result.buffer.toString()).toContain("done");
    expect(mocks.resolve.mock.calls.map(([url]) => url.toString())).toEqual([
      "https://example.com/start",
      "https://example.com/final",
    ]);
    expect(mocks.close).toHaveBeenCalledTimes(2);
  });

  it("rejects a declared response larger than the configured limit", async () => {
    mocks.fetch.mockResolvedValue(new Response("ignored", {
      status: 200,
      headers: { "content-length": "2048", "content-type": "text/html" },
    }));
    await expect(fetchPublicResource("https://example.com", {
      signal: new AbortController().signal,
      maxBytes: 1024,
      accept: "text/html",
    })).rejects.toMatchObject({ status: 413, code: "SOURCE_TOO_LARGE" });
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it("rejects non-HTML responses at the HTML boundary", async () => {
    mocks.fetch.mockResolvedValue(new Response("plain", {
      status: 200,
      headers: { "content-type": "text/plain" },
    }));
    await expect(fetchHtml(
      "https://example.com/file.txt",
      new AbortController().signal,
    )).rejects.toMatchObject({ status: 422, code: "NON_HTML" });
  });

  it("maps an upstream HTTP failure without returning its body", async () => {
    mocks.fetch.mockResolvedValue(new Response("secret body", { status: 503 }));
    await expect(fetchPublicResource("https://example.com", {
      signal: new AbortController().signal,
      maxBytes: 1024,
      accept: "text/html",
    })).rejects.toMatchObject({ status: 502, code: "UPSTREAM_STATUS" });
  });
});
