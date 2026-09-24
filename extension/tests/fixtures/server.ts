import { createServer, type IncomingMessage } from "node:http";

// A throwaway site for the S3 integration spec, built on `node:http` so it has no dependency of
// its own. Two things here cannot be faked from a static file: an image path that only answers
// when the browser presents the session cookie (the "image behind a login" case), and an image
// path that is permanently 404 (the "keep the original URL and warn" case).
//
// The 1x1 PNG keeps the fixture tiny; every image route serves it.

const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export const SESSION_COOKIE = { name: "md-session", value: "open-sesame" };
export const PROTECTED_IMAGE = "/protected/secret.png";
export const MISSING_IMAGE = "/img/missing.png";
export const ARTICLE_IMAGES = ["/img/photo-one.png", "/img/photo-two.png"];

const PARAGRAPHS = [
  "这是第一段正文，需要写得足够长，好让 Readability 把这一块当作文章正文而不是页面噪声，因此这里多写一些说明性的文字。",
  "第二段正文继续补充内容，确保整体文本量稳稳超过五十个字符的门槛，并且句子之间保持自然的节奏。",
  "结尾段落同样写得长一些，方便断言提取结果里确实包含这一段文字，也顺手给正文一个完整的收尾。",
];

export type FixtureServer = {
  origin: string;
  close: () => Promise<void>;
};

function articlePage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
</head>
<body>
  <header><nav><a href="/">首页</a><a href="/about">关于本站</a></nav></header>
  <aside class="sidebar">侧栏广告：这里不该进入正文</aside>
  <main>
    <article>
      <h1>${title}</h1>
      ${body}
    </article>
  </main>
  <footer>版权所有 2026</footer>
</body>
</html>
`;
}

function text() {
  return PARAGRAPHS.map((paragraph) => `      <p>${paragraph}</p>`).join("\n");
}

function image(src: string, alt = ""): string {
  return `      <figure><img src="${src}" alt="${alt}"></figure>`;
}

const ROUTES: Record<string, () => string> = {
  "/article": () =>
    articlePage(
      "示例文章标题",
      [text(), image(ARTICLE_IMAGES[0], "第一张"), image(ARTICLE_IMAGES[1], "第二张"), image(ARTICLE_IMAGES[0], "重复图")].join(
        "\n",
      ),
    ),
  "/article-cookie": () =>
    articlePage("会话图片文章", [text(), image(PROTECTED_IMAGE, "会话图")].join("\n")),
  "/article-missing": () => articlePage("缺图文章", [text(), image(MISSING_IMAGE, "坏图")].join("\n")),
  "/article-special": () => articlePage("发布说明/第 1 期: 中文标题", [text()].join("\n")),
  "/no-article": () =>
    `<!DOCTYPE html>
<html lang="zh"><head><meta charset="utf-8"><title>无正文页</title></head>
<body><nav><a href="/">首页</a><a href="/about">关于</a><a href="/login">登录</a></nav><div id="app-root"></div></body></html>
`,
};

function isProtectedImage(pathname: string): boolean {
  return pathname === PROTECTED_IMAGE;
}

function hasSessionCookie(request: IncomingMessage): boolean {
  const cookies = request.headers.cookie ?? "";
  return cookies
    .split(";")
    .map((part) => part.trim())
    .includes(`${SESSION_COOKIE.name}=${SESSION_COOKIE.value}`);
}

function createFixtureServer() {
  return createServer((request, response) => {
    const { pathname } = new URL(request.url ?? "/", "http://127.0.0.1");

    if (Object.hasOwn(ROUTES, pathname)) {
      const headers: Record<string, string> = { "content-type": "text/html; charset=utf-8" };
      if (pathname === "/article-cookie") {
        // The cookie is what makes the protected image reachable for the rest of this session.
        headers["set-cookie"] = `${SESSION_COOKIE.name}=${SESSION_COOKIE.value}; Path=/`;
      }
      response.writeHead(200, headers).end(ROUTES[pathname]());
      return;
    }

    if (isProtectedImage(pathname)) {
      if (!hasSessionCookie(request)) {
        response.writeHead(403).end();
        return;
      }
      response.writeHead(200, { "content-type": "image/png" }).end(Buffer.from(PNG_1X1, "base64"));
      return;
    }

    if (ARTICLE_IMAGES.includes(pathname)) {
      response.writeHead(200, { "content-type": "image/png" }).end(Buffer.from(PNG_1X1, "base64"));
      return;
    }

    response.writeHead(404).end();
  });
}

// Ephemeral port on purpose: parallel runs and a busy machine should not fight over a number.
export function startFixtureServer(): Promise<FixtureServer> {
  const server = createFixtureServer();
  return new Promise<FixtureServer>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("fixture server has no port"));
        return;
      }
      resolve({
        origin: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}
