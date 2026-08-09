"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  buildPastedPayload,
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
import type { ConvertResponse } from "@/types/conversion";

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

export default function Home() {
  const [clientState, setClientState] = useState<PasteClientState<ConvertResponse>>(
    () => createPasteClientState<ConvertResponse>(),
  );
  const controllerRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLElement | null>(null);
  const { mode, linkInput, pasteInput, output } = clientState;
  const { requestState, result, error, copied, showCopyFallback } = output;
  const normalizedUrl = linkInput.trim();
  const hasLinkInput = normalizedUrl.length > 0;
  const hasValidUrl = isHttpUrl(normalizedUrl);
  const normalizedSourceUrl = pasteInput.sourceUrl?.trim() || "";
  const hasValidSourceUrl = normalizedSourceUrl.length === 0 || isSafeSourceUrl(normalizedSourceUrl);
  const hasPasteContent = Boolean(pasteInput.text.trim() || pasteInput.html?.trim());
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

  useEffect(() => () => controllerRef.current?.abort(), []);

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

  async function runConversion(conversionMode: PasteMode, body: { url: string } | PastedPayload): Promise<void> {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
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
      setClientState((previous) => ({
        ...previous,
        output: {
          ...previous.output,
          requestState: "success",
          result: payload as ConvertResponse,
          error: "",
        },
      }));
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

  async function copyMarkdown(): Promise<void> {
    const currentResult = clientState.output.result;
    if (!currentResult) return;
    try {
      await navigator.clipboard.writeText(currentResult.markdown);
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
    const blob = new Blob([currentResult.markdown], { type: "text/markdown;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = currentResult.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brand} aria-label="MD-Convertor">
            <span className={styles.brandMark} aria-hidden="true">MD</span>
            <span>MD-Convertor</span>
          </div>
          <div className={styles.privacy}>
            <span className={styles.privacyDot} aria-hidden="true" />
            本机处理 · 不保存内容
          </div>
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
                {isLoading ? (
                  <button key="stop" className={`${styles.submit} ${styles.stop}`} type="button" onClick={stopConversion}>
                    停止转换
                  </button>
                ) : (
                  <button key="submit" className={styles.submit} type="submit" disabled={!hasValidUrl}>
                    转换为 MD
                  </button>
                )}
              </form>
              {hasLinkInput && !hasValidUrl && (
                <p id="link-url-error" className={styles.validation} role="alert">请输入完整的 HTTP 或 HTTPS 网页链接。</p>
              )}
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
                </div>
                {normalizedSourceUrl && !hasValidSourceUrl && (
                  <p id="source-url-error" className={styles.validation} role="alert">来源 URL 仅支持无凭据的 HTTP 或 HTTPS 地址。</p>
                )}
                {hasPasteContent && !pastePayloadWithinLimit && (
                  <p id="paste-size-error" className={styles.validation} role="alert">粘贴内容超过 5 MiB，请减少内容后重试。</p>
                )}
                <div className={styles.pasteActions}>
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
                      转换为 MD
                    </button>
                  )}
                </div>
              </form>
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

            {showCopyFallback && (
              <div className={styles.fallbackBox}>
                <p>浏览器未允许自动复制，请在下方按 Ctrl/Cmd + A 后复制。</p>
                <textarea readOnly value={result.markdown} onFocus={(event) => event.currentTarget.select()} />
              </div>
            )}

            <article className={styles.preview} aria-label="Markdown 预览">
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
                {result.markdown}
              </ReactMarkdown>
            </article>
            <p className={styles.footnote}>图片已写入文件。Base64 图片可能无法在少数 Markdown 阅读器中显示。</p>
          </section>
        )}
      </div>
    </main>
  );
}
