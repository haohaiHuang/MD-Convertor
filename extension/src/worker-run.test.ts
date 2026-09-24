import { describe, expect, it } from "vitest";
import type { DownloadedItem, DownloadRequest } from "./write";
import type { ConvertPayload } from "./messages";
import { ARTICLE_MESSAGE } from "./messages";
import { clearBadgeLater, run, runWithFeedback, type ChromeDeps } from "./worker-run";

// T2.3: the download orchestration, driven by a hand-written fake `chrome` (no sinon). Every
// branch that matters is a timing branch, so the tests own the clock instead of waiting on it.
const DOWNLOAD_DIR = "/Users/someone/Downloads";
const DIR_NAME = "示例文章标题.images";
const MD_NAME = "示例文章标题.md";

function payloadFor(count: number): ConvertPayload {
  return {
    type: ARTICLE_MESSAGE,
    title: "示例文章标题",
    markdown: `正文\n\n![图](md-convertor-image-1)\n\n补图 ![](md-convertor-image-2)\n\n> 来源：https://example.com/a\n`,
    images: Array.from({ length: count }, (_, index) => ({
      placeholder: `md-convertor-image-${index + 1}`,
      url: `https://example.com/images/${index + 1}.png`,
    })),
    sourceUrl: "https://example.com/a",
    convertedAt: "2026-09-24T00:00:00.000Z",
  };
}

type Fake = {
  deps: ChromeDeps;
  requests: DownloadRequest[];
  stats: { peakConcurrency: number };
  markdownWrites: () => string[];
  badgeTexts: string[];
  badgeTitles: string[];
};

// `finish` decides what the browser reports for a given download id: `null` means "still running",
// which is how the timeout branch gets exercised without a real 60s wait.
function fakeChrome(
  tabId: number,
  payload: ConvertPayload,
  finish: (id: number, request: DownloadRequest) => DownloadedItem | null = (id, request) => ({
    state: "complete",
    filename: `${DOWNLOAD_DIR}/${request.filename}`,
  }),
  fail: (request: DownloadRequest) => boolean = () => false,
): Fake {
  const requests: DownloadRequest[] = [];
  const markdownWrites: string[] = [];
  const listeners: ((message: unknown, sender: { tab?: { id?: number } }) => void)[] = [];
  const badgeTexts: string[] = [];
  const badgeTitles: string[] = [];
  const items = new Map<number, { request: DownloadRequest }>();
  const stats = { peakConcurrency: 0 };
  let nextId = 1;
  let active = 0;

  const deps: ChromeDeps = {
    scripting: {
      executeScript: async () => {
        // The content script speaks first: it can land while `executeScript` is still resolving.
        for (const listener of [...listeners]) listener(payload, { tab: { id: tabId } });
      },
    },
    downloads: {
      download: async (request) => {
        if (fail(request)) throw new Error("SERVER_ERROR");
        requests.push(request);
        const id = nextId++;
        // A data URL is the markdown write, anything else is an image download.
        if (request.url.startsWith("data:")) {
          markdownWrites.push(decodeURIComponent(request.url.slice(request.url.indexOf(",") + 1)));
          return id;
        }
        active += 1;
        stats.peakConcurrency = Math.max(stats.peakConcurrency, active);
        await new Promise((resolve) => setTimeout(resolve, 0));
        active -= 1;
        items.set(id, { request });
        return id;
      },
      search: async ({ id }) => {
        const item = items.get(id);
        if (!item) return [];
        return [finish(id, item.request)].filter((value): value is DownloadedItem => value !== null);
      },
    },
    action: {
      setBadgeText: async ({ text }) => void badgeTexts.push(text),
      setTitle: async ({ title }) => void badgeTitles.push(title),
    },
    runtime: {
      onMessage: {
        addListener: (listener) => listeners.push(listener),
        removeListener: (listener) => {
          const index = listeners.indexOf(listener);
          if (index >= 0) listeners.splice(index, 1);
        },
      },
    },
  };

  return { deps, requests, stats, markdownWrites: () => markdownWrites, badgeTexts, badgeTitles };
}

// The orchestration takes its clock from `run`, so a stuck download ends at the deadline instead
// of after a real minute.
const instantTimers = { now: () => time, sleep: async (ms: number) => void (time += ms) };
let time = 0;

describe("run — image downloads", () => {
  it("downloads every image with at most four in flight", async () => {
    const fake = fakeChrome(7, payloadFor(7));
    const result = await run(7, fake.deps, { timers: instantTimers, imageTimeoutMs: 1000 });

    expect(result).toMatchObject({ ok: true, mdName: MD_NAME, saved: 7, failed: 0 });
    expect(fake.stats.peakConcurrency).toBeLessThanOrEqual(4);
    expect(fake.requests.filter((request) => !request.url.startsWith("data:"))).toHaveLength(7);
    // The written markdown points at the downloaded files and keeps no placeholder behind.
    const markdown = fake.markdownWrites()[0];
    expect(markdown).toContain(`(${DIR_NAME}/001-1.png)`);
    expect(markdown).not.toContain("md-convertor-image-");
  });

  it("keeps the remaining images when one download fails and one never finishes", async () => {
    time = 0;
    const fake = fakeChrome(
      5,
      payloadFor(5),
      (id, request) => (id === 3 ? null : { state: "complete", filename: `${DOWNLOAD_DIR}/${request.filename}` }),
      (request) => request.filename.endsWith("002-2.png"),
    );
    const result = await run(5, fake.deps, { timers: instantTimers, imageTimeoutMs: 50 });

    expect(result).toMatchObject({ ok: true, saved: 3, failed: 2 });
    // The markdown is written even when images fail — it just keeps the original URLs.
    expect(fake.markdownWrites()).toHaveLength(1);
    const markdown = fake.markdownWrites()[0];
    expect(markdown).toContain(`(${DIR_NAME}/001-1.png)`);
    expect(markdown).toContain("<!-- 图片未下载：https://example.com/images/2.png -->");
  });

  it("uses the basename the browser actually reports, extension included", async () => {
    const fake = fakeChrome(1, payloadFor(1), () => ({
      state: "complete",
      filename: `${DOWNLOAD_DIR}/${DIR_NAME}/001-1.jpg`,
    }));
    const result = await run(1, fake.deps, { timers: instantTimers });

    expect(result).toMatchObject({ ok: true, saved: 1, failed: 0 });
    expect(result.ok && result.images).toEqual([
      { placeholder: "md-convertor-image-1", path: `${DIR_NAME}/001-1.jpg` },
    ]);
  });

  it("treats a file that landed outside the requested directory as a failure", async () => {
    const fake = fakeChrome(1, payloadFor(1), (id, request) => ({
      state: "complete",
      filename: `${DOWNLOAD_DIR}/somewhere-else/${request.filename.split("/")[1]}`,
    }));
    const result = await run(1, fake.deps, { timers: instantTimers });

    expect(result).toMatchObject({ ok: true, saved: 0, failed: 1 });
    expect(result.ok && result.images[0]).toMatchObject({ url: "https://example.com/images/1.png" });
  });
});

describe("run — badge feedback", () => {
  it("shows a check and the image count on success", async () => {
    const fake = fakeChrome(7, payloadFor(3));

    await runWithFeedback(7, fake.deps, { timers: instantTimers, imageTimeoutMs: 1000 });

    expect(fake.badgeTexts).toEqual(["✓"]);
    expect(fake.badgeTitles[0]).toContain(MD_NAME);
    expect(fake.badgeTitles[0]).toContain("3 张图");
  });

  it("warns and counts the images that did not download", async () => {
    time = 0;
    const fake = fakeChrome(
      5,
      payloadFor(5),
      (id) => (id === 3 ? null : { state: "complete", filename: `${DOWNLOAD_DIR}/${DIR_NAME}/00${id}-x.png` }),
    );

    await runWithFeedback(5, fake.deps, { timers: instantTimers, imageTimeoutMs: 50 });

    expect(fake.badgeTexts).toEqual(["!"]);
    expect(fake.badgeTitles[0]).toContain(MD_NAME);
    expect(fake.badgeTitles[0]).toContain("1 张图未下载");
  });

  it("explains a failed run in the tooltip instead of staying silent", async () => {
    const fake = fakeChrome(1, payloadFor(1));
    const blocked: ChromeDeps = {
      ...fake.deps,
      scripting: {
        executeScript: async () => {
          throw new Error("Cannot access contents of the page");
        },
      },
    };

    const result = await runWithFeedback(1, blocked, { timers: instantTimers });

    expect(result).toMatchObject({ ok: false, code: "INJECT_FAILED" });
    expect(fake.badgeTexts).toEqual(["!"]);
    // FSD R7/promise: a page the extension may not read gets a plain-language reason, not the
    // browser's English error text.
    expect(fake.badgeTitles[0]).toContain("这个页面不允许扩展读取");
  });

  it("clears the badge and restores the title after four seconds", async () => {
    time = 0;
    const fake = fakeChrome(1, payloadFor(1));

    await runWithFeedback(1, fake.deps, { timers: instantTimers, imageTimeoutMs: 1000 });
    await clearBadgeLater(fake.deps, instantTimers);

    expect(fake.badgeTexts).toEqual(["✓", ""]);
    expect(fake.badgeTitles).toHaveLength(2);
    expect(fake.badgeTitles[1]).toBe("把当前页转成 Markdown");
  });
});
