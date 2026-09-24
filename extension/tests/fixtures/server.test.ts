import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ARTICLE_IMAGES,
  MISSING_IMAGE,
  PROTECTED_IMAGE,
  SESSION_COOKIE,
  startFixtureServer,
  type FixtureServer,
} from "./server";

// The fixture site is the one thing S3's integration spec cannot fake: a page whose image only
// answers when the browser sends the session cookie, and a page whose image is a hard 404. Both
// are measured here in plain node before any browser is involved, so a failure in the integration
// spec can be blamed on the extension rather than on the fixture.

let server: FixtureServer;

beforeAll(async () => {
  server = await startFixtureServer();
});

afterAll(async () => {
  await server?.close();
});

describe("fixture site routing", () => {
  it("refuses the protected image without the session cookie", async () => {
    const response = await fetch(`${server.origin}${PROTECTED_IMAGE}`);
    expect(response.status).toBe(403);
  });

  it("serves the protected image once the session cookie is presented", async () => {
    const response = await fetch(`${server.origin}${PROTECTED_IMAGE}`, {
      headers: { cookie: `${SESSION_COOKIE.name}=${SESSION_COOKIE.value}` },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it("has a permanently missing image", async () => {
    const response = await fetch(`${server.origin}${MISSING_IMAGE}`);
    expect(response.status).toBe(404);
  });

  it("hands the session cookie to whoever visits the cookie article", async () => {
    const response = await fetch(`${server.origin}/article-cookie`);
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(`${SESSION_COOKIE.name}=${SESSION_COOKIE.value}`);
    expect(await response.text()).toContain(PROTECTED_IMAGE);
  });

  it("serves the plain article with its images, one of them twice, and nothing else", async () => {
    const html = await (await fetch(`${server.origin}/article`)).text();
    expect(html).toContain("<title>示例文章标题</title>");
    expect(html.split(ARTICLE_IMAGES[0])).toHaveLength(3); // duplicated on purpose: one download, two refs
    expect(html).toContain(ARTICLE_IMAGES[1]);
  });

  it("serves the article whose title carries a slash and a colon", async () => {
    const html = await (await fetch(`${server.origin}/article-special`)).text();
    expect(html).toContain("<title>发布说明/第 1 期: 中文标题</title>");
  });

  it("serves a page that has no article at all", async () => {
    expect((await fetch(`${server.origin}/no-article`)).status).toBe(200);
  });

  it("answers anything else with 404", async () => {
    expect((await fetch(`${server.origin}/definitely-not-here`)).status).toBe(404);
  });
});
