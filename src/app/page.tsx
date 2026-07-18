"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./page.module.css";
import type { ConvertResponse } from "@/types/conversion";

type RequestState = "idle" | "loading" | "success" | "error" | "cancelled";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<RequestState>("idle");
  const [result, setResult] = useState<ConvertResponse | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showCopyFallback, setShowCopyFallback] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLElement | null>(null);
  const normalizedUrl = url.trim();
  const hasInput = normalizedUrl.length > 0;
  const hasValidUrl = isHttpUrl(normalizedUrl);

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function convert(value = url) {
    const normalized = value.trim();
    if (!isHttpUrl(normalized)) {
      setState("error");
      setError("请输入完整的 HTTP 或 HTTPS 网页链接。");
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState("loading");
    setError("");
    setResult(null);
    setCopied(false);
    setShowCopyFallback(false);

    try {
      const response = await fetch("/api/convert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: normalized }),
        signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || "转换失败，请稍后重试。");
      if (controller.signal.aborted || controllerRef.current !== controller) return;
      setResult(payload as ConvertResponse);
      setState("success");
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (requestError) {
      if (controller.signal.aborted) return;
      setState("error");
      setError(requestError instanceof Error ? requestError.message : "转换失败，请稍后重试。");
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void convert();
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text");
    event.preventDefault();
    setUrl(pasted);
    if (state === "cancelled" || state === "error") {
      setState("idle");
      setError("");
    }
  }

  function stopConversion() {
    const controller = controllerRef.current;
    controllerRef.current = null;
    setResult(null);
    setError("");
    setState("cancelled");
    controller?.abort();
  }

  async function copyMarkdown() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.markdown);
      setCopied(true);
      setShowCopyFallback(false);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setShowCopyFallback(true);
    }
  }

  function downloadMarkdown() {
    if (!result) return;
    const blob = new Blob([result.markdown], { type: "text/markdown;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = result.filename;
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
            粘贴网页链接，在本机提取正文和图片，生成 Markdown 文件。
          </p>

          <form className={styles.form} onSubmit={submit} aria-label="网页转换表单">
            <input
              className={styles.input}
              type="url"
              inputMode="url"
              autoComplete="url"
              aria-label="网页链接"
              placeholder="粘贴网页链接，例如 https://example.com/article"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                if (state === "cancelled" || state === "error") {
                  setState("idle");
                  setError("");
                }
              }}
              onPaste={handlePaste}
              readOnly={state === "loading"}
              aria-invalid={hasInput && !hasValidUrl}
            />
            {state === "loading" ? (
              <button key="stop" className={`${styles.submit} ${styles.stop}`} type="button" onClick={stopConversion}>
                停止转换
              </button>
            ) : (
              <button key="submit" className={styles.submit} type="submit" disabled={!hasValidUrl}>
                转换为 MD
              </button>
            )}
          </form>

          {hasInput && !hasValidUrl && state !== "loading" && (
            <p className={styles.validation} role="alert">请输入完整的 HTTP 或 HTTPS 网页链接。</p>
          )}

          <div className={styles.hintRow} aria-label="产品特点">
            <span>无需登录</span>
            <span>图片内嵌</span>
            <span>随用随走</span>
          </div>

          {state === "loading" && (
            <div className={styles.statusCard} role="status" aria-live="polite">
              <span className={styles.spinner} aria-hidden="true" />
              正在读取网页、整理正文并处理图片，复杂页面可能需要几十秒。
            </div>
          )}
          {state === "error" && (
            <div className={styles.errorCard} role="alert">{error}</div>
          )}
          {state === "cancelled" && (
            <div className={styles.cancelledCard} role="status">
              已停止转换，可修改链接后重新开始。
            </div>
          )}
        </section>

        {state === "success" && result && (
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
