"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  buildPastedPayload,
  clearLinkInput,
  clearPastedContent,
  createPasteClientState,
  editPastedText,
  isPastedPayloadWithinLimit,
  replacePastedClipboard,
  switchPasteMode,
  type PasteClientState,
  type PasteContentState,
  type PasteMode,
  type PasteOutputState,
  type PastedPayload,
} from "@/lib/paste-client";
import styles from "./page.module.css";
import { fetchSettings } from "./settings/client";
import { languageLabel } from "@/lib/settings/languages";
import { TranslationError, analyzeDocument, isCancelled, translateDocument } from "@/lib/translate/client";
import { decideTranslation } from "@/lib/translate/decision";
import { translatedFilename } from "@/lib/translate/filename";
import type { ConvertResponse } from "@/types/conversion";
import type { TranslationAnalysis, TranslationScope } from "@/types/translation";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function parseHttpUrl(value: string): URL | null {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : null;
  } catch {
    return null;
  }
}

function isHttpUrl(value: string): boolean {
  return parseHttpUrl(value) !== null;
}

function isSafeSourceUrl(value: string): boolean {
  const parsed = parseHttpUrl(value);
  return parsed !== null && !parsed.username && !parsed.password;
}

function pasteContentHint(contentState: PasteContentState, text: string): string {
  switch (contentState) {
    case "rich":
      return `已识别富文本内容（约 ${text.length} 字符），将转换为 Markdown`;
    case "plain":
      return "未检测到富文本格式，将按纯文本转换";
    case "edited":
      return "内容已修改，将按纯文本转换";
    default:
      return "";
  }
}

function clearTransientOutput<Result>(state: PasteClientState<Result>): PasteClientState<Result> {
  if (state.output.requestState !== "error" && state.output.requestState !== "cancelled") return state;
  return {
    ...state,
    output: {
      ...state.output,
      requestState: "idle",
      error: "",
    },
  };
}

type ResultTab = "original" | "translated";

type SkippedReason = "target-language" | "empty" | "declined";

type TranslationState =
  | { status: "idle" }
  | { status: "unconfigured" }
  | { status: "analyzing" }
  | { status: "translating" }
  | { status: "confirming"; analysis: TranslationAnalysis; percent: number }
  | { status: "skipped"; reason: SkippedReason }
  | { status: "done"; markdown: string; warnings: string[] }
  | { status: "cancelled" }
  | { status: "failed"; message: string };

const TRANSLATION_FAILED_MESSAGE = "翻译失败，请稍后重试。";

const SKIPPED_NOTICE = {
  "target-language": "",
  empty: "正文没有可翻译的段落，无需翻译。",
  declined: "已选择不翻译，结果保留原文。",
} as const;

function skippedNotice(reason: SkippedReason, targetLanguage: string | null): string {
  if (reason === "target-language") {
    return `正文已是${languageLabel(targetLanguage ?? "") || "目标语言"}，无需翻译`;
  }
  return SKIPPED_NOTICE[reason];
}

function MarkdownPreview({ markdown, label }: { markdown: string; label: string }) {
  return (
    <article className={styles.preview} aria-label={label}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(value, key) => {
          if (key === "src" && /^data:image\/(?:png|jpeg|webp|gif|avif);base64,/i.test(value)) return value;
          return defaultUrlTransform(value);
        }}
        components={{
          a: ({ children, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>,
          // eslint-disable-next-line @next/next/no-img-element
          img: (props) => <img {...props} alt={props.alt || "网页图片"} loading="lazy" />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </article>
  );
}

export default function Home() {
  const [clientState, setClientState] = useState<PasteClientState<ConvertResponse>>(
    () => createPasteClientState<ConvertResponse>(),
  );
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [translateEnabled, setTranslateEnabled] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState<string | null>(null);
  const [translation, setTranslation] = useState<TranslationState>({ status: "idle" });
  const [resultTab, setResultTab] = useState<ResultTab>("original");
  const controllerRef = useRef<AbortController | null>(null);
  const translationControllerRef = useRef<AbortController | null>(null);
  const analysisRef = useRef<TranslationAnalysis | null>(null);
  const translationScopeRef = useRef<TranslationScope>("all");
  const confirmDialogRef = useRef<HTMLDialogElement | null>(null);
  const resultRef = useRef<HTMLElement | null>(null);
  const { mode, linkInput, pasteInput, output } = clientState;
  const { requestState, result, error, copied, showCopyFallback } = output;
  const normalizedUrl = linkInput.trim();
  const hasLinkInput = normalizedUrl.length > 0;
  const hasValidUrl = isHttpUrl(normalizedUrl);
  const normalizedSourceUrl = pasteInput.sourceUrl?.trim() || "";
  const hasValidSourceUrl = normalizedSourceUrl.length === 0 || isSafeSourceUrl(normalizedSourceUrl);
  const hasPasteContent = Boolean(pasteInput.text.trim() || pasteInput.html?.trim());
  const hasPasteState = hasPasteContent || Boolean(normalizedSourceUrl) || result !== null;
  const pastePayload: PastedPayload = useMemo(() => buildPastedPayload(pasteInput), [pasteInput]);
  const pastePayloadWithinLimit = useMemo(
    () => isPastedPayloadWithinLimit(pastePayload),
    [pastePayload],
  );
  const pasteHint = pasteContentHint(pasteInput.contentState, pasteInput.text);
  const pasteContentDescribedBy = [
    pasteHint ? "paste-content-hint" : "",
    hasPasteContent && !pastePayloadWithinLimit ? "paste-size-error" : "",
  ].filter(Boolean).join(" ") || undefined;
  const isLoading = requestState === "loading";
  const isTranslating = translation.status === "analyzing" || translation.status === "translating";
  const showResultTabs = translation.status !== "idle"
    && translation.status !== "unconfigured"
    && translation.status !== "skipped"
    && translation.status !== "confirming";
  const translatedMarkdown = translation.status === "done" ? translation.markdown : "";
  const isTranslatedTab = resultTab === "translated" && translatedMarkdown.length > 0;
  const activeMarkdown = isTranslatedTab ? translatedMarkdown : result?.markdown ?? "";

  useEffect(() => () => {
    controllerRef.current?.abort();
    translationControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const settings = await fetchSettings();
        if (cancelled) return;
        setTranslateEnabled(settings.translation.defaultEnabled);
        setTargetLanguage(settings.languages.target);
      } catch {
        // Settings unreadable: keep the toggle hidden instead of offering a translation that cannot run.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const dialog = confirmDialogRef.current;
    if (!dialog) return;
    if (translation.status === "confirming") {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [translation.status]);

  useEffect(() => {
    const updateBackToTopVisibility = () => {
      const nextVisibility = window.scrollY >= 500;
      setShowBackToTop((previous) => (
        previous === nextVisibility ? previous : nextVisibility
      ));
    };

    updateBackToTopVisibility();
    window.addEventListener("scroll", updateBackToTopVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateBackToTopVisibility);
  }, []);

  function setOutput(patch: Partial<PasteOutputState<ConvertResponse>>): void {
    setClientState((previous) => ({
      ...previous,
      output: { ...previous.output, ...patch },
    }));
  }

  function handleModeTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, currentMode: PasteMode): void {
    const modes: PasteMode[] = ["link", "paste"];
    const currentIndex = modes.indexOf(currentMode);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % modes.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex + modes.length - 1) % modes.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = modes.length - 1;
    else return;

    event.preventDefault();
    const nextMode = modes[nextIndex];
    setClientState((previous) => switchPasteMode(previous, nextMode));
    document.getElementById(`${nextMode}-tab`)?.focus();
  }

  function handleResultTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, current: ResultTab): void {
    const tabs: ResultTab[] = ["original", "translated"];
    const currentIndex = tabs.indexOf(current);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    else return;

    event.preventDefault();
    const next = tabs[nextIndex];
    setResultTab(next);
    document.getElementById(`${next}-result-tab`)?.focus();
  }

  async function runConversion(conversionMode: PasteMode, body: { url: string } | PastedPayload): Promise<void> {
    controllerRef.current?.abort();
    translationControllerRef.current?.abort();
    translationControllerRef.current = null;
    analysisRef.current = null;
    translationScopeRef.current = "all";
    const controller = new AbortController();
    controllerRef.current = controller;
    setTranslation({ status: "idle" });
    setResultTab("original");
    setClientState((previous) => ({
      ...previous,
      output: {
        ...previous.output,
        requestState: "loading",
        result: null,
        error: "",
        copied: false,
        showCopyFallback: false,
      },
    }));

    try {
      const response = await fetch(conversionMode === "link" ? "/api/convert" : "/api/convert-paste", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || "转换失败，请稍后重试。");
      if (controller.signal.aborted || controllerRef.current !== controller) return;
      const converted = payload as ConvertResponse;
      setClientState((previous) => ({
        ...previous,
        output: {
          ...previous.output,
          requestState: "success",
          result: converted,
          error: "",
        },
      }));
      if (translateEnabled) void runTranslation(converted.markdown, null);
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (requestError) {
      if (controller.signal.aborted) return;
      const message = requestError instanceof Error ? requestError.message : "转换失败，请稍后重试。";
      if (controllerRef.current !== controller) return;
      setClientState((previous) => ({
        ...previous,
        output: {
          ...previous.output,
          requestState: "error",
          result: null,
          error: message,
          copied: false,
          showCopyFallback: false,
        },
      }));
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }

  /**
   * One translation task: analyze when no usable analysis is at hand, then run.
   * `existingAnalysis` is kept on failure so a retry reuses it and never asks twice (PRD §4.7).
   */
  async function runTranslation(markdown: string, existingAnalysis: TranslationAnalysis | null): Promise<void> {
    if (!targetLanguage) return;
    translationControllerRef.current?.abort();
    const controller = new AbortController();
    translationControllerRef.current = controller;
    const { signal } = controller;
    // 用户主动要求翻译，所以直接切到译文 Tab，进度与错误都在那里可见。
    setResultTab("translated");

    try {
      let analysis = existingAnalysis;
      if (!analysis) {
        setTranslation({ status: "analyzing" });
        const analyzed = await analyzeDocument(markdown, targetLanguage, signal);
        if (signal.aborted) return;
        analysis = analyzed.analysis;
        analysisRef.current = analysis;
      }

      // PRD §4.2：大部分正文已是目标语言时先问再翻；重试沿用上次选择，不再弹窗。
      const decision = decideTranslation(analysis);
      if (decision.action === "skip") {
        setTranslation({ status: "skipped", reason: decision.reason });
        return;
      }
      if (decision.action === "confirm" && existingAnalysis === null) {
        setTranslation({ status: "confirming", analysis, percent: decision.percent });
        return;
      }

      setTranslation({ status: "translating" });
      const result = await translateDocument(markdown, targetLanguage, analysis, translationScopeRef.current, signal);
      if (signal.aborted) return;
      setTranslation({ status: "done", markdown: result.markdown, warnings: result.warnings });
    } catch (error) {
      if (signal.aborted) return;
      if (isCancelled(error)) {
        setTranslation({ status: "cancelled" });
        return;
      }
      if (error instanceof TranslationError && error.code === "TRANSLATE_NOT_CONFIGURED") {
        setTranslation({ status: "unconfigured" });
        return;
      }
      setTranslation({
        status: "failed",
        message: error instanceof TranslationError ? error.message : TRANSLATION_FAILED_MESSAGE,
      });
    } finally {
      if (translationControllerRef.current === controller) translationControllerRef.current = null;
    }
  }

  function cancelTranslation(): void {
    const controller = translationControllerRef.current;
    translationControllerRef.current = null;
    controller?.abort();
    setTranslation({ status: "cancelled" });
  }

  function retryTranslation(): void {
    const currentResult = clientState.output.result;
    if (!currentResult) return;
    void runTranslation(currentResult.markdown, analysisRef.current);
  }

  /** The user answered the ratio confirmation: continue with the chosen scope. */
  function confirmTranslationScope(scope: TranslationScope): void {
    if (translation.status !== "confirming") return;
    const currentResult = clientState.output.result;
    if (!currentResult) return;
    translationScopeRef.current = scope;
    void runTranslation(currentResult.markdown, translation.analysis);
  }

  /** The user declined: keep the original, keep the toggle on, never ask again for this document. */
  function declineTranslation(): void {
    if (translation.status !== "confirming") return;
    setTranslation({ status: "skipped", reason: "declined" });
  }

  async function convertLink(value = linkInput): Promise<void> {
    const normalized = value.trim();
    if (!isHttpUrl(normalized)) {
      setOutput({ requestState: "error", result: null, error: "请输入完整的 HTTP 或 HTTPS 网页链接。" });
      return;
    }
    await runConversion("link", { url: normalized });
  }

  async function convertPaste(draft = pasteInput): Promise<void> {
    const payload = buildPastedPayload(draft);
    const hasContent = Boolean(draft.text.trim() || draft.html?.trim());
    const sourceUrl = draft.sourceUrl?.trim() || "";
    if (!hasContent) {
      setOutput({ requestState: "error", result: null, error: "请先粘贴正文或富文本内容。" });
      return;
    }
    if (sourceUrl && !isSafeSourceUrl(sourceUrl)) {
      setOutput({ requestState: "error", result: null, error: "来源 URL 仅支持无凭据的 HTTP 或 HTTPS 地址。" });
      return;
    }
    if (!isPastedPayloadWithinLimit(payload)) {
      setOutput({
        requestState: "error",
        result: null,
        error: "粘贴内容超过 5 MiB，请减少内容后重试。",
      });
      return;
    }
    await runConversion("paste", payload);
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (mode === "link") void convertLink();
    else void convertPaste();
  }

  function handleLinkPaste(event: React.ClipboardEvent<HTMLInputElement>): void {
    const pasted = event.clipboardData.getData("text");
    event.preventDefault();
    setClientState((previous) => ({
      ...clearTransientOutput(previous),
      linkInput: pasted,
    }));
  }

  function handleRichPaste(event: React.ClipboardEvent<HTMLTextAreaElement>): void {
    event.preventDefault();
    const snapshot = {
      html: event.clipboardData.getData("text/html"),
      text: event.clipboardData.getData("text/plain"),
    };
    setClientState((previous) => ({
      ...clearTransientOutput(previous),
      pasteInput: replacePastedClipboard(previous.pasteInput, snapshot),
    }));
  }

  function handleRichEdit(value: string): void {
    setClientState((previous) => ({
      ...clearTransientOutput(previous),
      pasteInput: editPastedText(previous.pasteInput, value),
    }));
  }

  function stopConversion(): void {
    const controller = controllerRef.current;
    controllerRef.current = null;
    setClientState((previous) => ({
      ...previous,
      output: {
        ...previous.output,
        requestState: "cancelled",
        result: null,
        error: "",
        copied: false,
        showCopyFallback: false,
      },
    }));
    controller?.abort();
  }

  function returnToTop(): void {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  async function copyMarkdown(): Promise<void> {
    const currentResult = clientState.output.result;
    if (!currentResult) return;
    try {
      await navigator.clipboard.writeText(activeMarkdown);
      setClientState((previous) => {
        if (previous.output.result !== currentResult) return previous;
        return {
          ...previous,
          output: { ...previous.output, copied: true, showCopyFallback: false },
        };
      });
      window.setTimeout(() => {
        setClientState((previous) => (
          previous.output.result === currentResult
            ? { ...previous, output: { ...previous.output, copied: false } }
            : previous
        ));
      }, 1800);
    } catch {
      setClientState((previous) => (
        previous.output.result === currentResult
          ? { ...previous, output: { ...previous.output, showCopyFallback: true } }
          : previous
      ));
    }
  }

  function downloadMarkdown(): void {
    const currentResult = clientState.output.result;
    if (!currentResult) return;
    const filename = isTranslatedTab && targetLanguage
      ? translatedFilename(currentResult.filename, targetLanguage)
      : currentResult.filename;
    const blob = new Blob([activeMarkdown], { type: "text/markdown;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  const translateToggle = targetLanguage ? (
    <label className={styles.translateToggle}>
      <input
        type="checkbox"
        checked={translateEnabled}
        disabled={isLoading}
        onChange={(event) => setTranslateEnabled(event.target.checked)}
      />
      <span>翻译为{languageLabel(targetLanguage)}</span>
    </label>
  ) : null;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brand} aria-label="MD-Convertor">
            <span>MD-Convertor</span>
          </div>
          <Link href="/settings" className={styles.settingsLink} aria-label="设置" title="设置">
            设置
          </Link>
        </header>

        <section className={styles.hero} aria-labelledby="page-title">
          <p className={styles.eyebrow}>Web to Markdown</p>
          <h1 id="page-title" className={styles.title}>
            把网页，变成一份<span className={styles.accentText}>干净的文档</span>
          </h1>
          <p className={styles.subtitle}>
            {mode === "link"
              ? "粘贴网页链接，在本机提取正文和图片，生成 Markdown 文件。"
              : "粘贴网页正文，在本机整理内容和图片，生成 Markdown 文件。"}
          </p>

          <div className={styles.modeTabs} role="tablist" aria-label="转换模式">
            <button
              id="link-tab"
              className={styles.modeTab}
              type="button"
              role="tab"
              aria-selected={mode === "link"}
              aria-controls="link-panel"
              tabIndex={mode === "link" ? 0 : -1}
              disabled={isLoading}
              onKeyDown={(event) => handleModeTabKeyDown(event, "link")}
              onClick={() => setClientState((previous) => switchPasteMode(previous, "link"))}
            >
              链接转换
            </button>
            <button
              id="paste-tab"
              className={styles.modeTab}
              type="button"
              role="tab"
              aria-selected={mode === "paste"}
              aria-controls="paste-panel"
              tabIndex={mode === "paste" ? 0 : -1}
              disabled={isLoading}
              onKeyDown={(event) => handleModeTabKeyDown(event, "paste")}
              onClick={() => setClientState((previous) => switchPasteMode(previous, "paste"))}
            >
              富文本转换
            </button>
          </div>

          {mode === "link" ? (
            <section id="link-panel" role="tabpanel" aria-labelledby="link-tab" className={styles.modePanel}>
              <form className={styles.form} onSubmit={submit} aria-label="网页转换表单">
                <label className={styles.srOnly} htmlFor="link-input">网页链接</label>
                <input
                  id="link-input"
                  className={styles.input}
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  aria-label="网页链接"
                  placeholder="粘贴网页链接，例如 https://example.com/article"
                  value={linkInput}
                  onChange={(event) => {
                    const value = event.target.value;
                    setClientState((previous) => ({
                      ...clearTransientOutput(previous),
                      linkInput: value,
                    }));
                  }}
                  onPaste={handleLinkPaste}
                  readOnly={isLoading}
                  aria-invalid={hasLinkInput && !hasValidUrl}
                  aria-describedby={hasLinkInput && !hasValidUrl ? "link-url-error" : undefined}
                />
                {hasLinkInput && (
                  <button
                    className={styles.clearAction}
                    type="button"
                    disabled={isLoading}
                    onClick={() => setClientState((previous) => clearLinkInput(previous))}
                  >
                    清空链接
                  </button>
                )}
                {isLoading ? (
                  <button key="stop" className={`${styles.submit} ${styles.stop}`} type="button" onClick={stopConversion}>
                    停止转换
                  </button>
                ) : (
                  <button key="submit" className={styles.submit} type="submit" disabled={!hasValidUrl}>
                    转换
                  </button>
                )}
              </form>
              {hasLinkInput && !hasValidUrl && (
                <p id="link-url-error" className={styles.validation} role="alert">请输入完整的 HTTP 或 HTTPS 网页链接。</p>
              )}
              {translateToggle}
            </section>
          ) : (
            <section id="paste-panel" role="tabpanel" aria-labelledby="paste-tab" className={styles.modePanel}>
              <form className={`${styles.form} ${styles.pasteForm}`} onSubmit={submit} aria-label="富文本转换表单">
                <label className={styles.srOnly} htmlFor="paste-input">粘贴的正文内容</label>
                <textarea
                  id="paste-input"
                  className={styles.textarea}
                  aria-label="粘贴的正文内容"
                  placeholder="在这里粘贴网页正文或富文本内容"
                  value={pasteInput.text}
                  onChange={(event) => handleRichEdit(event.target.value)}
                  onPaste={handleRichPaste}
                  readOnly={isLoading}
                  aria-invalid={hasPasteContent && !pastePayloadWithinLimit}
                  aria-describedby={pasteContentDescribedBy}
                />
                {pasteHint && <p id="paste-content-hint" className={styles.contentHint} aria-live="polite">{pasteHint}</p>}
                <div className={styles.sourceRow}>
                  <label htmlFor="paste-source">来源 URL <span>可选</span></label>
                  <input
                    id="paste-source"
                    className={styles.sourceInput}
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    placeholder="https://example.com/article"
                    aria-label="来源 URL（可选）"
                    value={pasteInput.sourceUrl ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      setClientState((previous) => ({
                        ...clearTransientOutput(previous),
                        pasteInput: { ...previous.pasteInput, sourceUrl: value },
                      }));
                    }}
                    readOnly={isLoading}
                    aria-invalid={Boolean(normalizedSourceUrl) && !hasValidSourceUrl}
                    aria-describedby={Boolean(normalizedSourceUrl) && !hasValidSourceUrl ? "source-url-error" : undefined}
                  />
                  {isLoading ? (
                    <button key="stop" className={`${styles.submit} ${styles.stop}`} type="button" onClick={stopConversion}>
                      停止转换
                    </button>
                  ) : (
                    <button
                      key="submit"
                      className={styles.submit}
                      type="submit"
                      disabled={!hasPasteContent || !hasValidSourceUrl || !pastePayloadWithinLimit}
                    >
                      转换
                    </button>
                  )}
                </div>
                {normalizedSourceUrl && !hasValidSourceUrl && (
                  <p id="source-url-error" className={styles.validation} role="alert">来源 URL 仅支持无凭据的 HTTP 或 HTTPS 地址。</p>
                )}
                {hasPasteContent && !pastePayloadWithinLimit && (
                  <p id="paste-size-error" className={styles.validation} role="alert">粘贴内容超过 5 MiB，请减少内容后重试。</p>
                )}
                <div className={styles.pasteActions}>
                  {hasPasteState && (
                    <button
                      className={styles.clearAction}
                      type="button"
                      disabled={isLoading}
                      onClick={() => setClientState((previous) => clearPastedContent(previous))}
                    >
                      清空
                    </button>
                  )}
                </div>
              </form>
              {translateToggle}
            </section>
          )}

          <div className={styles.hintRow} aria-label="产品特点">
            <span>无需登录</span>
            <span>图片内嵌</span>
            <span>随用随走</span>
          </div>

          {isLoading && (
            <div className={styles.statusCard} role="status" aria-live="polite">
              <span className={styles.spinner} aria-hidden="true" />
              {mode === "paste"
                ? "正在整理粘贴内容、处理图片并生成 Markdown，复杂内容可能需要几十秒。"
                : "正在读取网页、整理正文并处理图片，复杂页面可能需要几十秒。"}
            </div>
          )}
          {requestState === "error" && (
            <div className={styles.errorCard} role="alert">{error}</div>
          )}
          {requestState === "cancelled" && (
            <div className={styles.cancelledCard} role="status">
              {mode === "paste" ? "已停止转换，粘贴内容已保留，可修改后重新开始。" : "已停止转换，可修改链接后重新开始。"}
            </div>
          )}
        </section>

        {requestState === "success" && result && (
          <section className={styles.result} ref={resultRef} aria-labelledby="result-title">
            <div className={styles.resultHeader}>
              <div>
                <p className={styles.resultLabel}>Markdown 已准备好</p>
                <h2 id="result-title" className={styles.resultTitle}>转换完成</h2>
              </div>
              <div className={styles.actions}>
                <button className={styles.action} type="button" onClick={() => void copyMarkdown()}>
                  {copied ? "已复制" : "复制"}
                </button>
                <button className={`${styles.action} ${styles.actionPrimary}`} type="button" onClick={downloadMarkdown}>
                  下载
                </button>
              </div>
            </div>

            <dl className={styles.stats} aria-label="转换结果统计">
              <div>
                <dt>文件大小</dt>
                <dd>{formatBytes(result.meta.outputBytes)}</dd>
              </div>
              <div>
                <dt>正文字数</dt>
                <dd>{result.meta.textChars.toLocaleString("zh-CN")}</dd>
              </div>
              <div>
                <dt>图片数量</dt>
                <dd>
                  {result.meta.omittedImageCount > 0
                    ? `${result.meta.embeddedImageCount} / ${result.meta.sourceImageCount} 张`
                    : `${result.meta.embeddedImageCount} 张`}
                </dd>
              </div>
            </dl>

            {result.warnings.length > 0 && (
              <ul className={styles.warnings} aria-label="转换提示">
                {result.warnings.map((warning) => (
                  <li className={styles.warning} key={warning.code}>{warning.message}</li>
                ))}
              </ul>
            )}

            {showResultTabs && (
              <div className={`${styles.modeTabs} ${styles.resultTabs}`} role="tablist" aria-label="转换结果">
                <button
                  id="original-result-tab"
                  className={styles.modeTab}
                  type="button"
                  role="tab"
                  aria-selected={resultTab === "original"}
                  aria-controls="original-result-panel"
                  tabIndex={resultTab === "original" ? 0 : -1}
                  onKeyDown={(event) => handleResultTabKeyDown(event, "original")}
                  onClick={() => setResultTab("original")}
                >
                  原文
                </button>
                <button
                  id="translated-result-tab"
                  className={styles.modeTab}
                  type="button"
                  role="tab"
                  aria-selected={resultTab === "translated"}
                  aria-controls="translated-result-panel"
                  tabIndex={resultTab === "translated" ? 0 : -1}
                  onKeyDown={(event) => handleResultTabKeyDown(event, "translated")}
                  onClick={() => setResultTab("translated")}
                >
                  译文
                </button>
              </div>
            )}

            {translation.status === "unconfigured" && (
              <p className={styles.translationNotice} role="status">
                尚未配置可用的翻译模型，请先到
                <Link href="/settings">设置</Link>
                页配置后再翻译。
              </p>
            )}

            {translation.status === "skipped" && (
              <p className={styles.translationNotice} role="status">
                {skippedNotice(translation.reason, targetLanguage)}
              </p>
            )}

            <dialog
              ref={confirmDialogRef}
              className={styles.confirmDialog}
              aria-labelledby="translate-confirm-text"
              onCancel={declineTranslation}
            >
              {translation.status === "confirming" && (
                <>
                  <p className={styles.confirmText} id="translate-confirm-text">
                    检测到正文约 {translation.percent}% 已是{languageLabel(targetLanguage ?? "")}，是否只翻译其余部分？
                  </p>
                  <div className={styles.confirmActions}>
                    <button
                      className={styles.clearAction}
                      type="button"
                      onClick={declineTranslation}
                    >
                      不翻译
                    </button>
                    <button
                      className={`${styles.action} ${styles.actionPrimary}`}
                      type="button"
                      onClick={() => confirmTranslationScope("non-target")}
                    >
                      只翻译非目标语言部分
                    </button>
                  </div>
                </>
              )}
            </dialog>

            {showCopyFallback && (
              <div className={styles.fallbackBox}>
                <p>浏览器未允许自动复制，请在下方按 Ctrl/Cmd + A 后复制。</p>
                <textarea readOnly value={activeMarkdown} onFocus={(event) => event.currentTarget.select()} />
              </div>
            )}

            {showResultTabs ? (
              <>
                <div
                  id="original-result-panel"
                  role="tabpanel"
                  aria-labelledby="original-result-tab"
                  hidden={resultTab !== "original"}
                >
                  <MarkdownPreview markdown={result.markdown} label="Markdown 预览" />
                </div>

                <div
                  id="translated-result-panel"
                  role="tabpanel"
                  aria-labelledby="translated-result-tab"
                  hidden={resultTab !== "translated"}
                >
                  {isTranslating ? (
                    <div className={styles.statusCard} role="status" aria-live="polite">
                      <span className={styles.spinner} aria-hidden="true" />
                      <span>
                        {translation.status === "analyzing"
                          ? "正在判定正文语言…"
                          : "正在翻译正文，复杂内容可能需要一会儿。"}
                      </span>
                      <button className={styles.clearAction} type="button" onClick={cancelTranslation}>
                        取消
                      </button>
                    </div>
                  ) : translation.status === "failed" ? (
                    <div className={styles.errorCard} role="alert">
                      <span>{translation.message}</span>
                      <button className={styles.clearAction} type="button" onClick={retryTranslation}>
                        重试
                      </button>
                    </div>
                  ) : translation.status === "cancelled" ? (
                    <div className={styles.cancelledCard} role="status">
                      <span>已取消翻译。</span>
                      <button className={styles.clearAction} type="button" onClick={retryTranslation}>
                        重试
                      </button>
                    </div>
                  ) : (
                    <>
                      {translatedMarkdown && <MarkdownPreview markdown={translatedMarkdown} label="译文预览" />}
                      {translation.status === "done" && translation.warnings.length > 0 && (
                        <ul className={styles.warnings} aria-label="翻译提示">
                          {translation.warnings.map((warning) => (
                            <li className={styles.warning} key={warning}>{warning}</li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              </>
            ) : (
              <MarkdownPreview markdown={result.markdown} label="Markdown 预览" />
            )}
            <p className={styles.footnote}>图片已写入文件。Base64 图片可能无法在少数 Markdown 阅读器中显示。</p>
          </section>
        )}
      </div>
      {showBackToTop && (
        <button
          className={styles.backToTop}
          type="button"
          aria-label="返回顶部"
          onClick={returnToTop}
        >
          <span aria-hidden="true">↑</span>
          返回顶部
        </button>
      )}
    </main>
  );
}
