import { mdFileName } from "./convert/naming";
import { isConvertFailure, isConvertPayload, type ConvertPayload } from "./messages";
import { writeMarkdown, type DownloadsApi } from "./write";

export type ChromeDeps = {
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

export type RunResult =
  | { ok: true; mdName: string }
  | { ok: false; code: string; message: string };

export const CONTENT_SCRIPT = "content.js";
export const PAYLOAD_TIMEOUT_MS = 10_000;

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

// The single orchestration entry point. Everything it needs from Chrome arrives as `deps`, so the
// whole flow is testable with a hand-written fake (see `worker-run.test.ts`).
export async function run(tabId: number, deps: ChromeDeps): Promise<RunResult> {
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
  let message: ConvertPayload | { code: string; message: string } | null;  try {
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

  const mdName = mdFileName(message.title);
  try {
    await writeMarkdown(deps.downloads, mdName, message.markdown);
  } catch (error) {
    return { ok: false, code: "DOWNLOAD_FAILED", message: errorText(error) };
  }
  return { ok: true, mdName };
}
