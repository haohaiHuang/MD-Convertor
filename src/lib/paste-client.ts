import { MAX_PASTE_REQUEST_BYTES as MAX_PASTE_REQUEST_LIMIT } from "@/lib/paste-contract";
import type { PastedConvertRequest } from "@/types/conversion";

export type PastedClipboardSnapshot = {
  html: string;
  text: string;
};

export type PastedDraft = {
  html?: string;
  text: string;
  sourceUrl?: string;
  contentState: PasteContentState;
};

export type PasteContentState = "empty" | "rich" | "plain" | "edited";

export type PastedPayload = Omit<PastedConvertRequest, "text"> & { text: string };

export type PasteMode = "link" | "paste";

export type PasteRequestState = "idle" | "loading" | "success" | "error" | "cancelled";

export type PasteOutputState<Result = unknown> = {
  requestState: PasteRequestState;
  result: Result | null;
  error: string;
  copied: boolean;
  showCopyFallback: boolean;
};

export type PasteClientState<Result = unknown> = {
  mode: PasteMode;
  linkInput: string;
  pasteInput: PastedDraft;
  output: PasteOutputState<Result>;
};

export const MAX_PASTE_PAYLOAD_BYTES = MAX_PASTE_REQUEST_LIMIT;

export function jsonByteLength(value: unknown): number {
  const serialized = JSON.stringify(value);
  return serialized === undefined ? 0 : new TextEncoder().encode(serialized).byteLength;
}

export function isPastedPayloadWithinLimit(
  payload: PastedPayload,
  maxBytes = MAX_PASTE_PAYLOAD_BYTES,
): boolean {
  return jsonByteLength(payload) <= maxBytes;
}

function emptyPasteOutput<Result>(): PasteOutputState<Result> {
  return {
    requestState: "idle",
    result: null,
    error: "",
    copied: false,
    showCopyFallback: false,
  };
}

export function createPasteClientState<Result = unknown>(): PasteClientState<Result> {
  return {
    mode: "link",
    linkInput: "",
    pasteInput: { text: "", contentState: "empty" },
    output: emptyPasteOutput<Result>(),
  };
}

export function switchPasteMode<Result>(
  state: PasteClientState<Result>,
  mode: PasteMode,
): PasteClientState<Result> {
  if (state.mode === mode || state.output.requestState === "loading") return state;
  return { ...state, mode, output: emptyPasteOutput<Result>() };
}

export function clearPastedContent<Result>(
  state: PasteClientState<Result>,
): PasteClientState<Result> {
  if (state.output.requestState === "loading") return state;
  return {
    ...state,
    pasteInput: { text: "", contentState: "empty" },
    output: emptyPasteOutput<Result>(),
  };
}

export function clearLinkInput<Result>(
  state: PasteClientState<Result>,
): PasteClientState<Result> {
  if (state.output.requestState === "loading") return state;
  return {
    ...state,
    linkInput: "",
    output: emptyPasteOutput<Result>(),
  };
}

export function replacePastedClipboard(
  previous: PastedDraft | undefined,
  snapshot: PastedClipboardSnapshot,
): PastedDraft {
  const hasHtml = snapshot.html.trim().length > 0;
  const next: PastedDraft = {
    text: snapshot.text,
    contentState: hasHtml ? "rich" : snapshot.text.trim() ? "plain" : "empty",
  };
  if (hasHtml) next.html = snapshot.html;
  if (previous?.sourceUrl !== undefined) next.sourceUrl = previous.sourceUrl;
  return next;
}

export function editPastedText(previous: PastedDraft, text: string): PastedDraft {
  const next: PastedDraft = { text, contentState: "edited" };
  if (previous.sourceUrl !== undefined) next.sourceUrl = previous.sourceUrl;
  return next;
}

export function buildPastedPayload(draft: PastedDraft): PastedPayload {
  const payload: PastedPayload = { text: draft.text };
  if (draft.html?.trim()) payload.html = draft.html;
  const sourceUrl = draft.sourceUrl?.trim();
  if (sourceUrl) payload.sourceUrl = sourceUrl;
  return payload;
}
