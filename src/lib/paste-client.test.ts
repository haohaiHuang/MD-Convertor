import { describe, expect, it } from "vitest";
import {
  buildPastedPayload,
  clearPastedContent,
  editPastedText,
  isPastedPayloadWithinLimit,
  jsonByteLength,
  MAX_PASTE_PAYLOAD_BYTES,
  replacePastedClipboard,
  createPasteClientState,
  switchPasteMode,
} from "./paste-client";

describe("paste client clipboard state", () => {
  it("clears pasted HTML, text, source URL, and shared output in one action", () => {
    const state = {
      ...createPasteClientState<{ markdown: string }>(),
      mode: "paste" as const,
      linkInput: "https://example.com/kept",
      pasteInput: {
        html: "<p>旧内容</p>",
        text: "旧内容",
        sourceUrl: "https://example.com/source",
        contentState: "rich" as const,
      },
      output: {
        requestState: "success" as const,
        result: { markdown: "# 旧结果" },
        error: "旧错误",
        copied: true,
        showCopyFallback: true,
      },
    };

    expect(clearPastedContent(state)).toEqual({
      ...state,
      pasteInput: { text: "", contentState: "empty" },
      output: {
        requestState: "idle",
        result: null,
        error: "",
        copied: false,
        showCopyFallback: false,
      },
    });
  });

  it("does not clear pasted content while conversion is loading", () => {
    const state = {
      ...createPasteClientState(),
      mode: "paste" as const,
      pasteInput: { text: "转换中", contentState: "plain" as const },
      output: {
        ...createPasteClientState().output,
        requestState: "loading" as const,
      },
    };

    expect(clearPastedContent(state)).toBe(state);
  });
  it("captures clipboard HTML and plain text together", () => {
    expect(replacePastedClipboard(undefined, {
      html: "<p>富文本</p>",
      text: "富文本",
    })).toEqual({
      html: "<p>富文本</p>",
      text: "富文本",
      contentState: "rich",
    });
  });

  it("records a rich content state when clipboard HTML is nonblank", () => {
    expect(replacePastedClipboard(undefined, {
      html: "<p>富文本</p>",
      text: "富文本",
    })).toMatchObject({ contentState: "rich" });
  });

  it("replaces the previous clipboard snapshot instead of merging fragments", () => {
    expect(replacePastedClipboard({
      html: "<p>旧内容</p>",
      text: "旧内容",
      contentState: "rich",
    }, {
      html: "<h1>新内容</h1>",
      text: "新内容",
    })).toEqual({
      html: "<h1>新内容</h1>",
      text: "新内容",
      contentState: "rich",
    });
  });

  it("keeps the independently entered source URL when replacing clipboard content", () => {
    expect(replacePastedClipboard({
      html: "<p>旧内容</p>",
      text: "旧内容",
      contentState: "rich",
      sourceUrl: "https://example.com/article",
    }, {
      html: "<p>新内容</p>",
      text: "新内容",
    })).toEqual({
      html: "<p>新内容</p>",
      text: "新内容",
      sourceUrl: "https://example.com/article",
      contentState: "rich",
    });
  });

  it("treats whitespace-only clipboard HTML as absent", () => {
    expect(replacePastedClipboard(undefined, {
      html: " \n\t ",
      text: "纯文本",
    })).toEqual({ text: "纯文本", contentState: "plain" });
  });

  it("records an empty content state when clipboard HTML and text are blank", () => {
    expect(replacePastedClipboard(undefined, {
      html: " \n\t ",
      text: "  \n ",
    })).toEqual({ text: "  \n ", contentState: "empty" });
  });

  it("drops captured HTML on manual textarea edits while retaining the edited text", () => {
    expect(editPastedText({
      html: "<p>捕获内容</p>",
      text: "捕获内容",
      contentState: "rich",
      sourceUrl: "https://example.com/article",
    }, "  手工内容  \n下一行  ")).toEqual({
      text: "  手工内容  \n下一行  ",
      sourceUrl: "https://example.com/article",
      contentState: "edited",
    });
  });

  it("builds the request payload without blank HTML and trims only the source URL", () => {
    expect(buildPastedPayload({
      html: "  \n  ",
      text: "  正文\n",
      contentState: "plain",
      sourceUrl: "  https://example.com/article  ",
    })).toEqual({
      text: "  正文\n",
      sourceUrl: "https://example.com/article",
    });
  });

  it("omits an empty source URL while preserving nonblank HTML", () => {
    expect(buildPastedPayload({
      html: "<p>富文本</p>",
      text: "富文本",
      contentState: "rich",
      sourceUrl: " \n\t ",
    })).toEqual({
      html: "<p>富文本</p>",
      text: "富文本",
    });
  });

  it("counts UTF-8 JSON bytes including JSON punctuation for multibyte text", () => {
    expect(jsonByteLength({ text: "中" })).toBe(14);
  });

  it("accepts a JSON payload exactly at 5 MiB and rejects one byte over", () => {
    const atLimit = { text: "x".repeat(MAX_PASTE_PAYLOAD_BYTES - 11) };
    const overLimit = { text: `${atLimit.text}x` };

    expect(jsonByteLength(atLimit)).toBe(MAX_PASTE_PAYLOAD_BYTES);
    expect(isPastedPayloadWithinLimit(atLimit)).toBe(true);
    expect(jsonByteLength(overLimit)).toBe(MAX_PASTE_PAYLOAD_BYTES + 1);
    expect(isPastedPayloadWithinLimit(overLimit)).toBe(false);
  });

  it("handles the exact 5 MiB boundary for three-byte Chinese characters", () => {
    const chineseCount = (MAX_PASTE_PAYLOAD_BYTES - 11) / 3;
    const atLimit = { text: "中".repeat(chineseCount) };
    const overLimit = { text: `${atLimit.text}中` };

    expect(jsonByteLength(atLimit)).toBe(MAX_PASTE_PAYLOAD_BYTES);
    expect(isPastedPayloadWithinLimit(atLimit)).toBe(true);
    expect(jsonByteLength(overLimit)).toBe(MAX_PASTE_PAYLOAD_BYTES + 3);
    expect(isPastedPayloadWithinLimit(overLimit)).toBe(false);
  });

  it("does not mutate the previous clipboard draft when replacing it", () => {
    const previous = {
      html: "<p>旧内容</p>",
      text: "旧内容",
      sourceUrl: "https://example.com/article",
      contentState: "rich" as const,
    };

    const next = replacePastedClipboard(previous, {
      html: "<p>新内容</p>",
      text: "新内容",
    });

    expect(previous).toEqual({
      html: "<p>旧内容</p>",
      text: "旧内容",
      sourceUrl: "https://example.com/article",
      contentState: "rich",
    });
    expect(next).not.toBe(previous);
  });

  it("preserves per-mode inputs while clearing shared output on mode switch", () => {
    const state = createPasteClientState<{ markdown: string }>();
    const switched = switchPasteMode({
      ...state,
      linkInput: "https://example.com/article",
      pasteInput: {
        html: "<p>富文本</p>",
        text: "富文本",
        contentState: "rich",
        sourceUrl: "https://example.com/article",
      },
      output: {
        requestState: "success",
        result: { markdown: "# 已完成" },
        error: "旧错误",
        copied: true,
        showCopyFallback: true,
      },
    }, "paste");

    expect(switched.mode).toBe("paste");
    expect(switched.linkInput).toBe("https://example.com/article");
    expect(switched.pasteInput).toEqual({
      html: "<p>富文本</p>",
      text: "富文本",
      contentState: "rich",
      sourceUrl: "https://example.com/article",
    });
    expect(switched.output).toEqual({
      requestState: "idle",
      result: null,
      error: "",
      copied: false,
      showCopyFallback: false,
    });
  });

  it("does not switch modes while a conversion is loading", () => {
    const state = createPasteClientState<{ markdown: string }>();
    const loadingState = {
      ...state,
      output: {
        ...state.output,
        requestState: "loading" as const,
      },
    };

    expect(switchPasteMode(loadingState, "paste")).toBe(loadingState);
  });

  it("switches from paste to link without mutating the original state", () => {
    const state = {
      ...createPasteClientState<{ markdown: string }>(),
      mode: "paste" as const,
      linkInput: "https://example.com/article",
      pasteInput: {
        html: "<p>富文本</p>",
        text: "富文本",
        contentState: "rich" as const,
      },
      output: {
        requestState: "success" as const,
        result: { markdown: "# 完成" },
        error: "",
        copied: true,
        showCopyFallback: false,
      },
    };

    const switched = switchPasteMode(state, "link");

    expect(switched.mode).toBe("link");
    expect(switched.linkInput).toBe(state.linkInput);
    expect(switched.pasteInput).toEqual(state.pasteInput);
    expect(switched.output.requestState).toBe("idle");
    expect(switched.output.result).toBeNull();
    expect(state.mode).toBe("paste");
    expect(state.output.requestState).toBe("success");
    expect(state.output.result).toEqual({ markdown: "# 完成" });
  });

  it("returns the same state when selecting the already active mode", () => {
    const state = createPasteClientState();

    expect(switchPasteMode(state, "link")).toBe(state);
  });
});
