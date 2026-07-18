import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  launch: vi.fn(),
  createProxy: vi.fn(),
  proxyClose: vi.fn(),
}));

vi.mock("playwright", () => ({ chromium: { launch: mocks.launch } }));
vi.mock("@/lib/browser-proxy", () => ({ createPinnedBrowserProxy: mocks.createProxy }));

import { renderDynamicPage } from "./browser";

function browserHarness(gotoResult: unknown = { ok: true }) {
  let routeHandler: ((route: {
    request: () => { resourceType: () => string };
    abort: (reason: string) => Promise<void>;
    continue: () => Promise<void>;
  }) => Promise<void>) | undefined;
  const page = {
    route: vi.fn(async (_pattern: string, handler: typeof routeHandler) => { routeHandler = handler; }),
    goto: vi.fn(async () => {
      await routeHandler?.({
        request: () => ({ resourceType: () => "document" }),
        abort: vi.fn(),
        continue: vi.fn(async () => undefined),
      });
      return gotoResult;
    }),
    waitForLoadState: vi.fn(async () => undefined),
    content: vi.fn(async () => "<html><body>rendered</body></html>"),
    close: vi.fn(async () => undefined),
  };
  const context = {
    newPage: vi.fn(async () => page),
    close: vi.fn(async () => undefined),
  };
  const browser = {
    newContext: vi.fn(async () => context),
    close: vi.fn(async () => undefined),
  };
  mocks.launch.mockResolvedValue(browser);
  return { page, context, browser };
}

beforeEach(() => {
  mocks.launch.mockReset();
  mocks.createProxy.mockReset();
  mocks.proxyClose.mockReset();
  mocks.createProxy.mockResolvedValue({
    serverUrl: "http://127.0.0.1:43210",
    close: mocks.proxyClose,
  });
});

describe("dynamic browser rendering", () => {
  it("uses the pinned proxy and returns rendered HTML", async () => {
    const harness = browserHarness();
    const result = await renderDynamicPage("https://example.com", new AbortController().signal);

    expect(result).toContain("rendered");
    expect(mocks.launch).toHaveBeenCalledWith(expect.objectContaining({
      proxy: { server: "http://127.0.0.1:43210" },
    }));
    expect(harness.page.waitForLoadState).toHaveBeenCalledWith("networkidle", { timeout: 4_000 });
    expect(harness.context.close).toHaveBeenCalledOnce();
    expect(harness.browser.close).toHaveBeenCalledOnce();
    expect(mocks.proxyClose).toHaveBeenCalledOnce();
  });

  it("closes all resources when navigation has no response", async () => {
    const harness = browserHarness(null);
    await expect(renderDynamicPage(
      "https://example.com",
      new AbortController().signal,
    )).rejects.toMatchObject({ code: "BROWSER_NAVIGATION" });
    expect(harness.context.close).toHaveBeenCalledOnce();
    expect(harness.browser.close).toHaveBeenCalledOnce();
    expect(mocks.proxyClose).toHaveBeenCalledOnce();
  });

  it("closes the proxy if Chromium cannot start", async () => {
    mocks.launch.mockRejectedValue(new Error("launch failed"));
    await expect(renderDynamicPage(
      "https://example.com",
      new AbortController().signal,
    )).rejects.toThrow("launch failed");
    expect(mocks.proxyClose).toHaveBeenCalledOnce();
  });
});
