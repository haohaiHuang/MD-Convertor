import http from "node:http";
import net, { type Socket } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPinnedBrowserProxy, resolvePinnedTunnelTarget, type BrowserProxy } from "./browser-proxy";
import type { ResolvedTarget } from "./security/url";

const closeCallbacks: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.allSettled(closeCallbacks.splice(0).map((close) => close()));
});

async function listen(server: http.Server | net.Server): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("测试服务未返回端口。");
  closeCallbacks.push(() => new Promise<void>((resolve) => server.close(() => resolve())));
  return address.port;
}

function localResolver(input: string | URL): Promise<ResolvedTarget> {
  return Promise.resolve({
    url: new URL(input.toString()),
    address: "127.0.0.1",
    family: 4,
  });
}

async function createTestProxy(options: {
  maxRequests?: number;
  maxBytes?: number;
  maxTunnelBytes?: number;
} = {}): Promise<BrowserProxy> {
  const proxy = await createPinnedBrowserProxy(new AbortController().signal, {
    resolver: localResolver,
    ...options,
  });
  closeCallbacks.push(proxy.close);
  return proxy;
}

async function proxyRequest(
  proxy: BrowserProxy,
  targetUrl: string,
  options: { method?: string; body?: string } = {},
): Promise<{ status: number; body: string }> {
  const proxyUrl = new URL(proxy.serverUrl);
  const body = options.body ?? "";
  return await new Promise((resolve, reject) => {
    const request = http.request({
      host: proxyUrl.hostname,
      port: proxyUrl.port,
      method: options.method ?? "GET",
      path: targetUrl,
      headers: body ? { "content-length": Buffer.byteLength(body) } : undefined,
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.once("end", () => resolve({
        status: response.statusCode ?? 0,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
      response.once("aborted", () => reject(new Error("代理响应因预算限制中止。")));
      response.once("error", reject);
    });
    request.once("error", reject);
    request.end(body);
  });
}

function proxyGet(proxy: BrowserProxy, targetUrl: string): Promise<{ status: number; body: string }> {
  return proxyRequest(proxy, targetUrl);
}

async function openTunnel(proxy: BrowserProxy, authority: string): Promise<Socket> {
  const proxyUrl = new URL(proxy.serverUrl);
  return await new Promise((resolve, reject) => {
    const socket = net.connect(Number(proxyUrl.port), proxyUrl.hostname);
    const chunks: Buffer[] = [];
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("等待 CONNECT 响应超时。"));
    }, 2_000);
    socket.once("error", reject);
    socket.on("data", function onData(chunk: Buffer) {
      chunks.push(chunk);
      const response = Buffer.concat(chunks);
      const boundary = response.indexOf("\r\n\r\n");
      if (boundary === -1) return;
      clearTimeout(timeout);
      socket.off("data", onData);
      expect(response.subarray(0, boundary).toString("utf8")).toContain("200 Connection Established");
      const remainder = response.subarray(boundary + 4);
      if (remainder.length > 0) socket.unshift(remainder);
      resolve(socket);
    });
    socket.once("connect", () => {
      socket.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`);
    });
  });
}

describe("browser proxy DNS pinning", () => {
  it("connects to the validated address instead of resolving the hostname again", async () => {
    let reboundAddress = "93.184.216.34";
    const resolver = vi.fn(async (input: string | URL): Promise<ResolvedTarget> => {
      const url = new URL(input.toString());
      const result = { url, address: reboundAddress, family: 4 as const };
      reboundAddress = "127.0.0.1";
      return result;
    });

    const target = await resolvePinnedTunnelTarget("attacker.example:443", resolver);

    expect(resolver).toHaveBeenCalledOnce();
    expect(target.options).toMatchObject({
      host: "93.184.216.34",
      port: 443,
      family: 4,
    });
    expect(target.options.host).not.toBe(reboundAddress);
  });

  it("rejects an invalid tunnel port before connecting", async () => {
    const resolver = vi.fn();
    await expect(resolvePinnedTunnelTarget("example.com:99999", resolver)).rejects.toMatchObject({
      status: 400,
    });
    expect(resolver).not.toHaveBeenCalled();
  });
});

describe("browser proxy I/O budgets", () => {
  it("forwards a real HTTP response and rejects requests beyond the shared count budget", async () => {
    const upstream = http.createServer((_request, response) => response.end("fixture-ok"));
    const port = await listen(upstream);
    const proxy = await createTestProxy({ maxRequests: 1 });

    await expect(proxyGet(proxy, `http://fixture.test:${port}/article`)).resolves.toEqual({
      status: 200,
      body: "fixture-ok",
    });
    await expect(proxyGet(proxy, `http://fixture.test:${port}/second`)).resolves.toEqual({
      status: 429,
      body: "Too Many Requests",
    });
  });

  it("rejects a declared HTTP response that exceeds the cumulative byte budget", async () => {
    const upstream = http.createServer((_request, response) => {
      response.writeHead(200, { "content-length": "32" });
      response.end("x".repeat(32));
    });
    const port = await listen(upstream);
    const proxy = await createTestProxy({ maxBytes: 16 });

    await expect(proxyGet(proxy, `http://fixture.test:${port}/large`)).resolves.toEqual({
      status: 413,
      body: "Payload Too Large",
    });
  });

  it("shares the request budget across concurrent HTTP subresources", async () => {
    const upstream = http.createServer((_request, response) => {
      setTimeout(() => response.end("ok"), 10);
    });
    const port = await listen(upstream);
    const proxy = await createTestProxy({ maxRequests: 2 });

    const results = await Promise.all([
      proxyGet(proxy, `http://fixture.test:${port}/one`),
      proxyGet(proxy, `http://fixture.test:${port}/two`),
      proxyGet(proxy, `http://fixture.test:${port}/three`),
    ]);

    expect(results.map(({ status }) => status).sort()).toEqual([200, 200, 429]);
  });

  it("closes a chunked HTTP response as soon as the byte budget is exceeded", async () => {
    const upstream = http.createServer((_request, response) => {
      response.write("x".repeat(8));
      response.end("y".repeat(8));
    });
    const port = await listen(upstream);
    const proxy = await createTestProxy({ maxBytes: 10 });

    await expect(proxyGet(proxy, `http://fixture.test:${port}/chunked`)).rejects.toThrow(
      "代理响应因预算限制中止",
    );
  });

  it("counts an HTTP request body against the same cumulative byte budget", async () => {
    const upstream = http.createServer((_request, response) => response.end("unexpected"));
    const port = await listen(upstream);
    const proxy = await createTestProxy({ maxBytes: 8 });

    await expect(proxyRequest(proxy, `http://fixture.test:${port}/upload`, {
      method: "POST",
      body: "x".repeat(16),
    })).resolves.toEqual({
      status: 413,
      body: "Payload Too Large",
    });
  });

  it("forwards a real CONNECT tunnel and closes it when its byte budget is exceeded", async () => {
    const upstream = net.createServer((socket) => socket.pipe(socket));
    const port = await listen(upstream);
    const proxy = await createTestProxy({ maxBytes: 64, maxTunnelBytes: 8 });
    const tunnel = await openTunnel(proxy, `fixture.test:${port}`);

    const closed = new Promise<void>((resolve) => tunnel.once("close", () => resolve()));
    tunnel.write("12345");
    await expect(closed).resolves.toBeUndefined();
  });

  it("closes active tunnels when conversion is aborted and tolerates repeated close calls", async () => {
    const upstream = net.createServer(() => undefined);
    const port = await listen(upstream);
    const controller = new AbortController();
    const proxy = await createPinnedBrowserProxy(controller.signal, { resolver: localResolver });
    closeCallbacks.push(proxy.close);
    const tunnel = await openTunnel(proxy, `fixture.test:${port}`);
    const closed = new Promise<void>((resolve) => tunnel.once("close", () => resolve()));

    controller.abort();

    await expect(closed).resolves.toBeUndefined();
    await expect(proxy.close()).resolves.toBeUndefined();
  });

  it("rejects WebSocket upgrades instead of bypassing request validation", async () => {
    const proxy = await createTestProxy();
    const proxyUrl = new URL(proxy.serverUrl);
    const socket = net.connect(Number(proxyUrl.port), proxyUrl.hostname);
    const closed = new Promise<void>((resolve, reject) => {
      socket.once("close", () => resolve());
      socket.once("error", reject);
    });
    socket.once("connect", () => {
      socket.write("GET http://fixture.test/socket HTTP/1.1\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n");
    });

    await expect(closed).resolves.toBeUndefined();
  });
});
