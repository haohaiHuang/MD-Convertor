import { imageDirName, imageFileName, mdFileName } from "./convert/naming";
import { rewriteImageReferences, type ImageOutcome } from "./references";
import { isConvertFailure, isConvertPayload, type ArticleImage, type ConvertPayload } from "./messages";
import { writeMarkdown, type DownloadedItem, type DownloadsApi } from "./write";

export type ChromeDeps = {
  action: {
    setBadgeText(options: { text: string }): Promise<void>;
    setTitle(options: { title: string }): Promise<void>;
  };
  scripting: {
    executeScript(injection: { target: { tabId: number }; files: string[] }): Promise<unknown>;
  };
  downloads: DownloadsApi;
  runtime: {
    onMessage: {
      addListener(listener: MessageListener): void;
      removeListener(listener: MessageListener): void;
    };
  };
};

type MessageListener = (message: unknown, sender: { tab?: { id?: number } }) => void;

// The clock is injected because both of the interesting branches (a download that never finishes,
// the badge clearing itself) are waits, and a test should not spend them.
export type Timers = {
  now(): number;
  sleep(ms: number): Promise<void>;
};

export type RunOptions = {
  timers?: Timers;
  imageTimeoutMs?: number;
};

export type RunResult =
  | { ok: true; mdName: string; saved: number; failed: number; images: ImageOutcome[] }
  | { ok: false; code: string; message: string };

export const CONTENT_SCRIPT = "content.js";
export const PAYLOAD_TIMEOUT_MS = 10_000;
export const IMAGE_CONCURRENCY = 4;
export const IMAGE_TIMEOUT_MS = 60_000;
export const POLL_MS = 100;
export const BADGE_CLEAR_MS = 4_000;
export const DEFAULT_TITLE = "把当前页转成 Markdown";

const realTimers: Timers = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function inbox(tabId: number, deps: ChromeDeps) {
  type Inbound = ConvertPayload | { code: string; message: string };
  let settle: ((value: Inbound | null) => void) | null = null;
  const received = new Promise<Inbound | null>((resolve) => {
    settle = resolve;
  });

  const listener: MessageListener = (message, sender) => {
    if (sender.tab?.id !== tabId || !settle) return;
    if (isConvertPayload(message)) return settle(message);
    if (isConvertFailure(message)) return settle({ code: message.code, message: message.message });
  };
  // Registered before injection: the content script's `sendMessage` can land while
  // `executeScript` is still resolving.
  deps.runtime.onMessage.addListener(listener);

  return {
    received,
    close() {
      settle = null;
      deps.runtime.onMessage.removeListener(listener);
    },
  };
}

// The placeholder carries its own number, so the file name stays stable even if the content side
// ever reorders the list.
function placeholderIndex(placeholder: string, fallback: number): number {
  const match = /(\d+)$/.exec(placeholder);
  return match ? Number(match[1]) : fallback;
}

async function mapWithLimit<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (let index = next++; index < items.length; index = next++) {
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

// Polls `search` instead of listening on `onChanged`: the item can already be finished by the time
// `download()` resolves, and the poll returns the real path in the same call.
async function waitForImage(
  downloads: DownloadsApi,
  id: number,
  timers: Timers,
  deadline: number,
): Promise<DownloadedItem | null> {
  let item: DownloadedItem | undefined;
  while (timers.now() < deadline) {
    [item] = await downloads.search({ id });
    if (item?.state === "complete" || item?.state === "interrupted") return item;
    await timers.sleep(POLL_MS);
  }
  // Out of time: whatever the last poll saw was still running.
  return null;
}

// The probe measured that Chromium reports the real absolute path, subdirectory included, and that
// it does not append an extension we did not ask for. Both are re-checked here rather than assumed:
// a file that landed outside `<原文标题>.images/` would make the markdown point at nothing.
function resolvedPath(item: DownloadedItem, dirName: string): string | null {
  const segments = item.filename.split(/[\\/]/).filter(Boolean);
  const name = segments.pop();
  if (!name || segments.pop() !== dirName) return null;
  return `${dirName}/${name}`;
}

async function downloadImage(
  image: ArticleImage,
  index: number,
  dirName: string,
  downloads: DownloadsApi,
  timers: Timers,
  imageTimeoutMs: number,
): Promise<ImageOutcome> {
  const fail = (): ImageOutcome => ({ placeholder: image.placeholder, url: image.url });
  const requested = `${dirName}/${imageFileName(index, image.url)}`;
  let id: number;
  try {
    id = await downloads.download({
      url: image.url,
      filename: requested,
      conflictAction: "overwrite",
      saveAs: false,
    });
  } catch {
    return fail();
  }

  const item = await waitForImage(downloads, id, timers, timers.now() + imageTimeoutMs);
  if (!item || item.state !== "complete") return fail();
  const path = resolvedPath(item, dirName);
  return path === null ? fail() : { placeholder: image.placeholder, path };
}

// The single orchestration entry point. Everything it needs from Chrome arrives as `deps`, so the
// whole flow is testable with a hand-written fake (see `worker-run.test.ts`).
export async function run(tabId: number, deps: ChromeDeps, options: RunOptions = {}): Promise<RunResult> {
  const timers = options.timers ?? realTimers;
  const imageTimeoutMs = options.imageTimeoutMs ?? IMAGE_TIMEOUT_MS;

  const box = inbox(tabId, deps);
  try {
    await deps.scripting.executeScript({ target: { tabId }, files: [CONTENT_SCRIPT] });
  } catch (error) {
    return { ok: false, code: "INJECT_FAILED", message: errorText(error) };
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), PAYLOAD_TIMEOUT_MS);
  });
  let message: ConvertPayload | { code: string; message: string } | null;
  try {
    message = await Promise.race([box.received, timeout]);
  } finally {
    clearTimeout(timer);
    box.close();
  }

  if (message === null) {
    return { ok: false, code: "TIMEOUT", message: `内容脚本 ${PAYLOAD_TIMEOUT_MS / 1000}s 内没有回应` };
  }
  if (!isConvertPayload(message)) {
    return { ok: false, code: message.code, message: message.message };
  }

  const dirName = imageDirName(message.title);
  const images = await mapWithLimit(message.images, IMAGE_CONCURRENCY, (image, index) =>
    downloadImage(image, placeholderIndex(image.placeholder, index + 1), dirName, deps.downloads, timers, imageTimeoutMs),
  );

  const mdName = mdFileName(message.title);
  try {
    await writeMarkdown(deps.downloads, mdName, rewriteImageReferences(message.markdown, images));
  } catch (error) {
    return { ok: false, code: "DOWNLOAD_FAILED", message: errorText(error) };
  }

  const failed = images.filter((image) => "url" in image).length;
  return { ok: true, mdName, saved: images.length - failed, failed, images };
}

// The browser's own error text is English and mentions manifests; the user gets the short version
// (the content script's own messages are already written for humans and pass through unchanged).
const FAILURE_REASONS: Record<string, string> = {
  INJECT_FAILED: "这个页面不允许扩展读取",
  TIMEOUT: "页面在 10 秒内没有回应",
  DOWNLOAD_FAILED: "无法写入下载目录",
};

// The badge is the only feedback the user gets — there is no popup and no notification.
export function badgeFor(result: RunResult): { text: string; title: string } {
  if (!result.ok) return { text: "!", title: `转换失败：${FAILURE_REASONS[result.code] ?? result.message}` };
  if (result.failed > 0) return { text: "!", title: `已存出「${result.mdName}」，${result.failed} 张图未下载` };
  return { text: "✓", title: `已存出「${result.mdName}」（含 ${result.saved} 张图）` };
}

export async function runWithFeedback(
  tabId: number,
  deps: ChromeDeps,
  options: RunOptions = {},
): Promise<RunResult> {
  const result = await run(tabId, deps, options);
  const badge = badgeFor(result);
  await deps.action.setBadgeText({ text: badge.text });
  await deps.action.setTitle({ title: badge.title });
  return result;
}

// Fired without `await` by the worker: the badge must not keep the click pending.
export async function clearBadgeLater(deps: ChromeDeps, timers: Timers = realTimers): Promise<void> {
  await timers.sleep(BADGE_CLEAR_MS);
  await deps.action.setBadgeText({ text: "" });
  await deps.action.setTitle({ title: DEFAULT_TITLE });
}
