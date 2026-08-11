import { describe, expect, it } from "vitest";
import { pasteRequestHasContent, readPastedRequestBody } from "./paste-request";

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function streamWithNeverSettlingCancel(): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode("too large"));
    },
    cancel() {
      return new Promise<void>(() => undefined);
    },
  });
}

function streamWithRejectingCancel(): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode("too large"));
    },
    cancel() {
      throw new Error("cancel failed");
    },
  });
}

function streamThatWaitsForAbort(onCancel: () => void): ReadableStream<Uint8Array> {
  return new ReadableStream({
    pull() {
      return undefined;
    },
    cancel() {
      onCancel();
    },
  });
}

describe("paste request body limits", () => {
  it("reads a UTF-8 body at or below the configured limit", async () => {
    const body = await readPastedRequestBody(streamFromChunks(["中", "文"]), 6);

    expect(body).toBe("中文");
  });

  it("rejects a body that exceeds the limit while streaming", async () => {
    await expect(readPastedRequestBody(streamFromChunks(["1234", "56"]), 5)).rejects.toMatchObject({
      status: 413,
      code: "REQUEST_TOO_LARGE",
    });
  });

  it("returns 413 without waiting for a never-settling reader cancel", async () => {
    const outcome = await Promise.race([
      readPastedRequestBody(streamWithNeverSettlingCancel(), 1)
        .then(() => "resolved", (error: unknown) => error),
      new Promise<"timed-out">((resolve) => setTimeout(() => resolve("timed-out"), 50)),
    ]);

    expect(outcome).toMatchObject({ status: 413, code: "REQUEST_TOO_LARGE" });
  });

  it("still returns 413 when reader cancel rejects", async () => {
    await expect(readPastedRequestBody(streamWithRejectingCancel(), 1)).rejects.toMatchObject({
      status: 413,
      code: "REQUEST_TOO_LARGE",
    });
  });

  it.each([
    [{ text: "正文" }, true],
    [{ html: "<p>正文</p>" }, true],
    [{ html: "", text: "  " }, false],
    [{ html: 42 }, false],
    [{ text: "正文", sourceUrl: 42 }, false],
    [null, false],
  ])("validates pasted request fields: %j", (value, expected) => {
    expect(pasteRequestHasContent(value)).toBe(expected);
  });

  it("honors an already-aborted signal before reading", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(readPastedRequestBody(streamFromChunks(["正文"]), 20, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("cancels a pending reader when the signal aborts while reading", async () => {
    const controller = new AbortController();
    let cancelled = false;
    const promise = readPastedRequestBody(streamThatWaitsForAbort(() => {
      cancelled = true;
    }), 20, controller.signal);

    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(cancelled).toBe(true);
  });

  it("maps non-abort reader failures to INVALID_REQUEST and releases the reader lock", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error("broken stream"));
      },
    });

    await expect(readPastedRequestBody(body)).rejects.toMatchObject({
      status: 400,
      code: "INVALID_REQUEST",
    });
    expect(body.locked).toBe(false);
  });
});
