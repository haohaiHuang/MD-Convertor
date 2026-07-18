import http, { type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from "node:http";
import https from "node:https";
import { connect as connectSocket, type TcpNetConnectOpts } from "node:net";
import type { Duplex } from "node:stream";
import { AppError } from "@/lib/errors";
import { createPinnedLookup } from "@/lib/fetcher";
import { resolvePublicTarget } from "@/lib/security/url";

const PROXY_HOST = "127.0.0.1";
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

export type BrowserProxy = {
  serverUrl: string;
  close: () => Promise<void>;
};

type BrowserProxyOptions = {
  resolver?: typeof resolvePublicTarget;
};

export type PinnedTunnelTarget = {
  options: TcpNetConnectOpts;
  validatedUrl: URL;
};

function filteredHeaders(headers: IncomingHttpHeaders): IncomingHttpHeaders {
  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => !HOP_BY_HOP_HEADERS.has(name.toLowerCase())),
  );
}

function proxyError(response: ServerResponse, status: number, message: string): void {
  if (response.headersSent) {
    response.destroy();
    return;
  }
  response.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
    connection: "close",
  });
  response.end(message);
}

function parseProxyRequestUrl(request: IncomingMessage): URL {
  if (!request.url) throw new AppError(400, "INVALID_PROXY_URL", "代理请求缺少目标地址。");
  try {
    return new URL(request.url);
  } catch {
    throw new AppError(400, "INVALID_PROXY_URL", "代理请求的目标地址无效。");
  }
}

export async function resolvePinnedTunnelTarget(
  authority: string,
  resolver: typeof resolvePublicTarget = resolvePublicTarget,
): Promise<PinnedTunnelTarget> {
  let url: URL;
  try {
    url = new URL(`https://${authority}`);
  } catch {
    throw new AppError(400, "INVALID_PROXY_TARGET", "代理隧道目标无效。");
  }

  const target = await resolver(url);
  const port = url.port ? Number(url.port) : 443;
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new AppError(400, "INVALID_PROXY_PORT", "代理隧道端口无效。");
  }

  return {
    validatedUrl: target.url,
    options: {
      host: target.address,
      port,
      family: target.family,
    },
  };
}

async function forwardHttpRequest(
  request: IncomingMessage,
  response: ServerResponse,
  signal: AbortSignal,
  resolver: typeof resolvePublicTarget,
): Promise<void> {
  const targetUrl = parseProxyRequestUrl(request);
  const target = await resolver(targetUrl);
  const requestImpl = target.url.protocol === "https:" ? https.request : http.request;
  const headers = filteredHeaders(request.headers);
  headers.host = target.url.host;

  await new Promise<void>((resolve, reject) => {
    const upstream = requestImpl(target.url, {
      method: request.method,
      headers,
      lookup: createPinnedLookup(target.address, target.family),
      signal,
    }, (upstreamResponse) => {
      response.writeHead(
        upstreamResponse.statusCode ?? 502,
        upstreamResponse.statusMessage,
        filteredHeaders(upstreamResponse.headers),
      );
      upstreamResponse.once("error", reject);
      upstreamResponse.once("end", resolve);
      upstreamResponse.pipe(response);
    });

    upstream.once("error", reject);
    request.once("aborted", () => upstream.destroy());
    request.pipe(upstream);
  });
}

function connectPinnedTunnel(
  request: IncomingMessage,
  clientSocket: Duplex,
  head: Buffer,
  signal: AbortSignal,
  sockets: Set<Duplex>,
  resolver: typeof resolvePublicTarget,
): void {
  clientSocket.on("error", () => undefined);
  void resolvePinnedTunnelTarget(request.url ?? "", resolver)
    .then(({ options }) => {
      if (signal.aborted || clientSocket.destroyed) return;
      const upstreamSocket = connectSocket(options);
      sockets.add(upstreamSocket);
      upstreamSocket.once("connect", () => {
        if (signal.aborted || clientSocket.destroyed || !clientSocket.writable) {
          upstreamSocket.destroy();
          return;
        }
        clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length > 0) upstreamSocket.write(head);
        clientSocket.pipe(upstreamSocket);
        upstreamSocket.pipe(clientSocket);
      });
      upstreamSocket.once("error", () => clientSocket.destroy());
      upstreamSocket.once("close", () => {
        sockets.delete(upstreamSocket);
        clientSocket.destroy();
      });
      clientSocket.once("close", () => upstreamSocket.destroy());
    })
    .catch(() => {
      if (!clientSocket.destroyed) {
        clientSocket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      }
    });
}

export async function createPinnedBrowserProxy(
  signal: AbortSignal,
  options: BrowserProxyOptions = {},
): Promise<BrowserProxy> {
  const resolver = options.resolver ?? resolvePublicTarget;
  const sockets = new Set<Duplex>();
  const server = http.createServer((request, response) => {
    void forwardHttpRequest(request, response, signal, resolver).catch((error: unknown) => {
      const status = error instanceof AppError && error.status === 403 ? 403 : 502;
      proxyError(response, status, status === 403 ? "Forbidden" : "Bad Gateway");
    });
  });

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  server.on("connect", (request, socket, head) => {
    connectPinnedTunnel(request, socket, head, signal, sockets, resolver);
  });
  server.on("upgrade", (_request, socket) => socket.destroy());

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, PROXY_HOST, resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw new AppError(502, "PROXY_START_FAILED", "无法启动安全浏览器代理。");
  }

  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };
  signal.addEventListener("abort", () => void close(), { once: true });

  return {
    serverUrl: `http://${PROXY_HOST}:${address.port}`,
    close,
  };
}
