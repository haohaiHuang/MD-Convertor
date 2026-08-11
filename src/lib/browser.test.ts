import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  launch: vi.fn(),
  createProxy: vi.fn(),
  proxyClose: vi.fn(),
}));

vi.mock("playwright", () => ({ chromium: { launch: mocks.launch } }));
vi.mock("@/lib/browser-proxy", () => ({ createPinnedBrowserProxy: mocks.createProxy }));

import { renderDynamicPage } from "./browser";

function browserHarness(
  gotoResult: unknown = { ok: true },
  resourceType = "document",
  requestUrl = "https://example.com",
) {
  let routeHandler: ((route: {
    request: () => { resourceType: () => string; url: () => string };
    abort: (reason: string) => Promise<void>;
    continue: () => Promise<void>;
  }) => Promise<void>) | undefined;
  let renderedHtml = "<html><body>rendered</body></html>";
  const routeAbort = vi.fn(async () => undefined);
  const routeContinue = vi.fn(async () => undefined);
  const emptyLocator = {
    count: vi.fn(async () => 0),
    nth: vi.fn(),
  };
  const page = {
    route: vi.fn(async (_pattern: string, handler: typeof routeHandler) => { routeHandler = handler; }),
    goto: vi.fn(async () => {
      await routeHandler?.({
        request: () => ({ resourceType: () => resourceType, url: () => requestUrl }),
        abort: routeAbort,
        continue: routeContinue,
      });
      return gotoResult;
    }),
    waitForLoadState: vi.fn(async () => undefined),
    locator: vi.fn(() => emptyLocator),
    content: vi.fn(async () => renderedHtml),
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
  return {
    page,
    context,
    browser,
    routeAbort,
    routeContinue,
    setRenderedHtml: (html: string) => { renderedHtml = html; },
  };
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

    expect(result.html).toContain("rendered");
    expect(result.generatedImages).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(mocks.launch).toHaveBeenCalledWith(expect.objectContaining({
      proxy: { server: "http://127.0.0.1:43210" },
    }));
    expect(harness.page.waitForLoadState).toHaveBeenCalledWith("networkidle", { timeout: 4_000 });
    expect(harness.context.close).toHaveBeenCalledOnce();
    expect(harness.browser.close).toHaveBeenCalledOnce();
    expect(mocks.proxyClose).toHaveBeenCalledOnce();
  });

  it("blocks font resources before continuing page rendering", async () => {
    const harness = browserHarness({ ok: true }, "font");

    await renderDynamicPage("https://example.com", new AbortController().signal);

    expect(harness.routeAbort).toHaveBeenCalledWith("blockedbyclient");
    expect(harness.routeContinue).not.toHaveBeenCalled();
  });

  it("blocks Google Fonts stylesheets without blocking page stylesheets", async () => {
    const fontStylesheet = browserHarness(
      { ok: true },
      "stylesheet",
      "https://fonts.googleapis.com/css2?family=Inter",
    );

    await renderDynamicPage("https://example.com", new AbortController().signal);

    expect(fontStylesheet.routeAbort).toHaveBeenCalledWith("blockedbyclient");
    expect(fontStylesheet.routeContinue).not.toHaveBeenCalled();
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

  it("replaces a rendered Mermaid container with a trusted PNG placeholder", async () => {
    const harness = browserHarness();
    const screenshot = Buffer.from("rendered mermaid png");
    const diagram = {
      locator: vi.fn(() => ({ count: vi.fn(async () => 1) })),
      boundingBox: vi.fn(async () => ({ x: 0, y: 0, width: 1200, height: 300 })),
      screenshot: vi.fn(async () => screenshot),
      evaluate: vi.fn(async (_callback: unknown, replacement: { placeholderUrl: string }) => {
        harness.setRenderedHtml(`<html><body><img src="${replacement.placeholderUrl}" alt="Mermaid 图表"></body></html>`);
      }),
    };
    harness.page.locator.mockReturnValue({
      count: vi.fn(async () => 1),
      nth: vi.fn(() => diagram),
    });

    const result = await renderDynamicPage("https://example.com", new AbortController().signal);

    expect(diagram.screenshot).toHaveBeenCalledWith(expect.objectContaining({ type: "png" }));
    expect(result.html).not.toContain("<svg");
    expect(result.html).toContain(result.generatedImages[0].placeholderUrl);
    expect(result.generatedImages).toEqual([{
      placeholderUrl: expect.stringMatching(/^\/\.md-convertor\/mermaid\/[a-f0-9-]+\.png$/),
      dataUri: `data:image/png;base64,${screenshot.toString("base64")}`,
    }]);
    expect(result.warnings).toEqual([]);
  });

  it("captures every Mermaid diagram when replacements mutate the live locator collection", async () => {
    const harness = browserHarness();
    const remaining: Array<{
      locator: ReturnType<typeof vi.fn>;
      boundingBox: ReturnType<typeof vi.fn>;
      screenshot: ReturnType<typeof vi.fn>;
      evaluate: ReturnType<typeof vi.fn>;
    }> = [];
    const makeDiagram = (name: string) => {
      const diagram = {
        locator: vi.fn(() => ({ count: vi.fn(async () => 1) })),
        boundingBox: vi.fn(async () => ({ x: 0, y: 0, width: 300, height: 120 })),
        screenshot: vi.fn(async () => Buffer.from(`${name} png`)),
        evaluate: vi.fn(async (_callback: unknown, replacement: { placeholderUrl: string }) => {
          remaining.splice(remaining.indexOf(diagram), 1);
          harness.setRenderedHtml(`<html><body><img src="${replacement.placeholderUrl}"></body></html>`);
        }),
      };
      return diagram;
    };
    remaining.push(makeDiagram("first"), makeDiagram("second"));
    harness.page.locator.mockReturnValue({
      count: vi.fn(async () => remaining.length),
      nth: vi.fn((index: number) => remaining[index]),
    });

    const result = await renderDynamicPage("https://example.com", new AbortController().signal);

    expect(result.generatedImages).toHaveLength(2);
    expect(result.warnings).toEqual([]);
    expect(remaining).toHaveLength(0);
  });

  it("selects only rendered Mermaid containers so source containers remain available for extraction", async () => {
    const harness = browserHarness();

    await renderDynamicPage("https://example.com", new AbortController().signal);

    expect(harness.page.locator).toHaveBeenCalledWith(
      expect.stringContaining(".mermaid:has(svg, canvas)"),
    );
  });

  it("limits Mermaid screenshots to thirty diagrams", async () => {
    const harness = browserHarness();
    const diagrams = Array.from({ length: 31 }, () => ({
      locator: vi.fn(() => ({ count: vi.fn(async () => 1) })),
      boundingBox: vi.fn(async () => ({ x: 0, y: 0, width: 300, height: 120 })),
      screenshot: vi.fn(async () => Buffer.from("png")),
      evaluate: vi.fn(async () => undefined),
    }));
    harness.page.locator.mockReturnValue({
      count: vi.fn(async () => diagrams.length),
      nth: vi.fn((index: number) => diagrams[index]),
    });

    const result = await renderDynamicPage("https://example.com", new AbortController().signal);

    expect(result.generatedImages).toHaveLength(30);
    expect(diagrams[29].screenshot).toHaveBeenCalledOnce();
    expect(diagrams[30].screenshot).not.toHaveBeenCalled();
    expect(diagrams[30].evaluate).toHaveBeenCalledOnce();
    expect(result.warnings).toContainEqual({
      code: "MERMAID_COUNT_LIMIT",
      message: "网页包含超过 30 张 Mermaid 图表，额外图表已保留占位文本。",
    });
  });

  it("degrades an oversized Mermaid diagram without taking a screenshot", async () => {
    const harness = browserHarness();
    const diagram = {
      locator: vi.fn(() => ({ count: vi.fn(async () => 1) })),
      boundingBox: vi.fn(async () => ({ x: 0, y: 0, width: 5000, height: 300 })),
      screenshot: vi.fn(),
      evaluate: vi.fn(async () => undefined),
    };
    harness.page.locator.mockReturnValue({
      count: vi.fn(async () => 1),
      nth: vi.fn(() => diagram),
    });

    const result = await renderDynamicPage("https://example.com", new AbortController().signal);

    expect(diagram.screenshot).not.toHaveBeenCalled();
    expect(result.generatedImages).toEqual([]);
    expect(result.warnings.map((warning) => warning.code)).toContain("MERMAID_RENDER_FAILED");
  });

  it("degrades a Mermaid screenshot larger than eight MiB", async () => {
    const harness = browserHarness();
    const diagram = {
      locator: vi.fn(() => ({ count: vi.fn(async () => 1) })),
      boundingBox: vi.fn(async () => ({ x: 0, y: 0, width: 300, height: 120 })),
      screenshot: vi.fn(async () => Buffer.alloc(8 * 1024 * 1024 + 1)),
      evaluate: vi.fn(async () => undefined),
    };
    harness.page.locator.mockReturnValue({
      count: vi.fn(async () => 1),
      nth: vi.fn(() => diagram),
    });

    const result = await renderDynamicPage("https://example.com", new AbortController().signal);

    expect(result.generatedImages).toEqual([]);
    expect(result.warnings.map((warning) => warning.code)).toContain("MERMAID_RENDER_FAILED");
  });

  it("propagates cancellation during a Mermaid screenshot and closes all resources", async () => {
    const harness = browserHarness();
    const controller = new AbortController();
    const diagram = {
      locator: vi.fn(() => ({ count: vi.fn(async () => 1) })),
      boundingBox: vi.fn(async () => ({ x: 0, y: 0, width: 300, height: 120 })),
      screenshot: vi.fn(async () => {
        controller.abort();
        throw new Error("page closed");
      }),
      evaluate: vi.fn(),
    };
    harness.page.locator.mockReturnValue({
      count: vi.fn(async () => 1),
      nth: vi.fn(() => diagram),
    });

    await expect(renderDynamicPage("https://example.com", controller.signal))
      .rejects.toMatchObject({ name: "AbortError" });
    expect(harness.context.close).toHaveBeenCalledOnce();
    expect(harness.browser.close).toHaveBeenCalledOnce();
    expect(mocks.proxyClose).toHaveBeenCalledOnce();
  });

  it("does not treat an empty Mermaid container as a successful raster", async () => {
    const harness = browserHarness();
    const diagram = {
      locator: vi.fn(() => ({ count: vi.fn(async () => 0) })),
      boundingBox: vi.fn(async () => ({ x: 0, y: 0, width: 300, height: 120 })),
      screenshot: vi.fn(),
      evaluate: vi.fn(async () => undefined),
    };
    harness.page.locator.mockReturnValue({
      count: vi.fn(async () => 1),
      nth: vi.fn(() => diagram),
    });

    const result = await renderDynamicPage("https://example.com", new AbortController().signal);

    expect(diagram.screenshot).not.toHaveBeenCalled();
    expect(result.generatedImages).toEqual([]);
    expect(result.warnings.map((warning) => warning.code)).toContain("MERMAID_RENDER_FAILED");
  });

  it("captures a standalone rendered Mermaid SVG without selecting nested SVG twice", async () => {
    const harness = browserHarness();
    const diagram = {
      locator: vi.fn(() => ({ count: vi.fn(async () => 0) })),
      boundingBox: vi.fn(async () => ({ x: 0, y: 0, width: 640, height: 240 })),
      screenshot: vi.fn(async () => Buffer.from("standalone png")),
      evaluate: vi.fn(async (_callback: unknown, replacement?: { placeholderUrl: string }) =>
        replacement ? undefined : true),
    };
    harness.page.locator.mockReturnValue({
      count: vi.fn(async () => 1),
      nth: vi.fn(() => diagram),
    });

    const result = await renderDynamicPage("https://example.com", new AbortController().signal);

    expect(harness.page.locator).toHaveBeenCalledWith(expect.stringContaining('svg[id^="mermaid-"]'));
    expect(diagram.screenshot).toHaveBeenCalledOnce();
    expect(result.generatedImages).toHaveLength(1);
  });
});
