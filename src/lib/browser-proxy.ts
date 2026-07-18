import http, { type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from "node:http";
import https from "node:https";
import { connect as connectSocket, type TcpNetConnectOpts } from "node:net";
import { Transform, type Duplex } from "node:stream";
import { AppError } from "@/lib/errors";
import { createPinnedLookup } from "@/lib/fetcher";
import { resolvePublicTarget } from "@/lib/security/url";

const PROXY_HOST = "127.0.0.1";
const MEBIBYTE = 1024 * 1024;
export const BROWSER_PROXY_LIMITS = Object.freeze({
  maxRequests: 100,
  maxBytes: 50 * MEBIBYTE,
  maxTunnelBytes: 25 * MEBIBYTE,
});
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

export type BrowserProxyOptions = {
  resolver?: typeof resolvePublicTarget;
  maxRequests?: number;
  maxBytes?: number;
  maxTunnelBytes?: number;
};

type TunnelBudget = {
  transferredBytes: number;
};

class BrowserProxyBudget {
  private requestCount = 0;
  private transferredBytes = 0;

  constructor(
    private readonly maxRequests: number,
    private readonly maxBytes: number,
    private readonly maxTunnelBytes: number,
  ) {}

  claimRequest(): void {
    if (this.requestCount >= this.maxRequests) {
      throw new AppError(429, "BROWSER_REQUEST_LIMIT", "动态网页请求数量超过限制。");
    }
    this.requestCount += 1;
  }

  assertContentLength(contentLength: number): void {
    if (contentLength > this.maxBytes - this.transferredBytes) {
      throw new AppError(413, "BROWSER_TRANSFER_LIMIT", "动态网页网络传输超过限制。");
    }
  }

  consume(byteLength: number, tunnel?: TunnelBudget): void {
    if (byteLength <= 0) return;
    if (byteLength > this.maxBytes - this.transferredBytes) {
      throw new AppError(413, "BROWSER_TRANSFER_LIMIT", "动态网页网络传输超过限制。");
    }
    if (tunnel && byteLength > this.maxTunnelBytes - tunnel.transferredBytes) {
      throw new AppError(413, "BROWSER_TUNNEL_LIMIT", "动态网页单个连接传输超过限制。");
    }
    this.transferredBytes += byteLength;
    if (tunnel) tunnel.transferredBytes += byteLength;
  }
}

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

function normalizeLimit(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new AppError(500, "INVALID_PROXY_LIMIT", "安全代理预算配置无效。");
  }
  return value;
}

function createBudgetTransform(budget: BrowserProxyBudget, tunnel?: TunnelBudget): Transform {
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      try {
        budget.consume(chunk.byteLength, tunnel);
        callback(null, chunk);
      } catch (error) {
        callback(error as Error);
      }
    },
  });
}

function proxyErrorDetails(error: unknown): { status: number; message: string } {
  if (error instanceof AppError) {
    if (error.status === 403) return { status: 403, message: "Forbidden" };
    if (error.status === 413) return { status: 413, message: "Payload Too Large" };
    if (error.status === 429) return { status: 429, message: "Too Many Requests" };
    if (error.status === 400) return { status: 400, message: "Bad Request" };
  }
  return { status: 502, message: "Bad Gateway" };
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
  budget: BrowserProxyBudget,
): Promise<void> {
  budget.claimRequest();
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
      const contentLengthValue = upstreamResponse.headers["content-length"];
      const contentLength = typeof contentLengthValue === "string" ? Number(contentLengthValue) : Number.NaN;
      if (Number.isSafeInteger(contentLength) && contentLength >= 0) {
        try {
          budget.assertContentLength(contentLength);
        } catch (error) {
          upstreamResponse.destroy();
          reject(error);
          return;
        }
      }
      response.writeHead(
        upstreamResponse.statusCode ?? 502,
        upstreamResponse.statusMessage,
        filteredHeaders(upstreamResponse.headers),
      );
      const limiter = createBudgetTransform(budget);
      const fail = (error: unknown) => {
        upstreamResponse.destroy();
        response.destroy();
        reject(error);
      };
      upstreamResponse.once("error", fail);
      limiter.once("error", fail);
      response.once("finish", resolve);
      upstreamResponse.pipe(limiter).pipe(response);
    });

    const requestLimiter = createBudgetTransform(budget);
    requestLimiter.once("error", (error) => {
      upstream.destroy();
      reject(error);
    });
    upstream.once("error", reject);
    request.once("aborted", () => upstream.destroy());
    request.pipe(requestLimiter).pipe(upstream);
  });
}

function connectPinnedTunnel(
  request: IncomingMessage,
  clientSocket: Duplex,
  head: Buffer,
  signal: AbortSignal,
  sockets: Set<Duplex>,
  resolver: typeof resolvePublicTarget,
  budget: BrowserProxyBudget,
): void {
  clientSocket.on("error", () => undefined);
  try {
    budget.claimRequest();
  } catch (error) {
    const { status, message } = proxyErrorDetails(error);
    clientSocket.end(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
    return;
  }
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
        const tunnel = { transferredBytes: 0 };
        try {
          budget.consume(head.byteLength, tunnel);
        } catch {
          clientSocket.end("HTTP/1.1 413 Payload Too Large\r\nConnection: close\r\n\r\n");
          upstreamSocket.destroy();
          return;
        }
        clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length > 0) upstreamSocket.write(head);
        const toUpstream = createBudgetTransform(budget, tunnel);
        const toClient = createBudgetTransform(budget, tunnel);
        const closeTunnel = () => {
          clientSocket.destroy();
          upstreamSocket.destroy();
        };
        toUpstream.once("error", closeTunnel);
        toClient.once("error", closeTunnel);
        clientSocket.pipe(toUpstream).pipe(upstreamSocket);
        upstreamSocket.pipe(toClient).pipe(clientSocket);
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
  const budget = new BrowserProxyBudget(
    normalizeLimit(options.maxRequests, BROWSER_PROXY_LIMITS.maxRequests),
    normalizeLimit(options.maxBytes, BROWSER_PROXY_LIMITS.maxBytes),
    normalizeLimit(options.maxTunnelBytes, BROWSER_PROXY_LIMITS.maxTunnelBytes),
  );
  const sockets = new Set<Duplex>();
  const server = http.createServer((request, response) => {
    void forwardHttpRequest(request, response, signal, resolver, budget).catch((error: unknown) => {
      const { status, message } = proxyErrorDetails(error);
      proxyError(response, status, message);
    });
  });

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  server.on("connect", (request, socket, head) => {
    connectPinnedTunnel(request, socket, head, signal, sockets, resolver, budget);
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
