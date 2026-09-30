"use client";

/**
 * The local-document batch panel (S3). Mounted on the homepage when the mode selector is
 * on 「转换既有文档」; every bridge call is wrapped, because the preload validators throw
 * instead of resolving `{ ok: false }` — an unguarded `void bridge.x()` fails silently.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  applyRowStatus,
  planBatch,
  summarize,
  type BatchRefusal,
  type BatchRow,
  type BatchSummary,
} from "@/lib/local-docs/batch";
import type { LocalDocsScanResult } from "@/lib/local-docs/scan";
import type { Settings } from "@/types/settings";

import {
  inputDirLabel,
  outputBridge,
  outputCodeMessage,
  putSettings,
  systemBridge,
  type SettingsPayload,
} from "../settings/client";
import { errorText, processDocument, runBatch, scanDirectory } from "./client";
import styles from "./panel.module.css";

export type LocalDocsPanelProps = {
  /** null while the page is still fetching them. */
  settings: SettingsPayload | null;
  translateEnabled: boolean;
  onTranslateEnabledChange(enabled: boolean): void;
  onSettingsChange(settings: Settings): void;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(mtimeMs: number): string {
  return new Date(mtimeMs).toLocaleString();
}

function stateLabel(state: BatchRow["state"]): string {
  if (state === "skip") return "已处理";
  if (state === "check") return "已改变";
  return "新";
}

function statusLabel(row: BatchRow): string {
  switch (row.status.phase) {
    case "running":
      return "处理中…";
    case "done":
      return "完成";
    case "skipped":
      return "已处理，跳过";
    case "failed":
      return `处理失败（${row.status.message}）`;
    default:
      return stateLabel(row.state);
  }
}

const NOOP_UNSUBSCRIBE = (): void => {};

function countsText(summary: BatchSummary): string {
  const parts = [
    `成功 ${summary.done} 篇`,
    `跳过 ${summary.skipped} 篇`,
    `失败 ${summary.failed} 篇`,
    `内嵌图片 ${summary.embeddedImages} 张`,
    `未内嵌 ${summary.keptImages} 张`,
  ];
  return parts.join(" · ");
}

export function LocalDocsPanel({
  settings,
  translateEnabled,
  onTranslateEnabledChange,
  onSettingsChange,
}: LocalDocsPanelProps) {
  const [scan, setScan] = useState<LocalDocsScanResult | null>(null);
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [refusal, setRefusal] = useState<BatchRefusal | null>(null);
  const [suggestedOutputDir, setSuggestedOutputDir] = useState<string | null>(null);
  const [busy, setBusy] = useState<"scanning" | "running" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<BatchSummary | null>(null);
  const [writtenTo, setWrittenTo] = useState<string | null>(null);
  const [openMessage, setOpenMessage] = useState<string | null>(null);
  const scannedFor = useRef<string | null>(null);

  // The preload object does not exist while the page is server-rendered, so it is read as an
  // external store: the server says "loading", the hydrated client tells the truth, and the
  // panel renders nothing until then instead of flashing the degraded copy on every load.
  const bridgeState = useSyncExternalStore<"loading" | "ready" | "absent">(
    () => NOOP_UNSUBSCRIBE,
    () => (outputBridge() ? "ready" : "absent"),
    () => "loading",
  );
  const hasBridge = bridgeState === "ready";

  const outputDir = settings?.output.defaultPath ?? null;

  const load = useCallback(async (current: Settings): Promise<void> => {
    if (!outputBridge()) return;
    setBusy("scanning");
    setMessage(null);
    setSummary(null);
    setWrittenTo(null);
    try {
      const result = await scanDirectory({
        dirPath: current.input.defaultPath,
        outputDir: current.output.defaultPath,
      });
      const plan = planBatch(result.files, {
        inputDir: result.dirPath,
        outputDir: current.output.defaultPath,
        hasBridge: true,
      });
      setScan(result);
      setRows(plan.rows);
      setRefusal(plan.refusal);
      setSuggestedOutputDir(plan.suggestedOutputDir);
    } catch (error) {
      // fs codes arrive as the route's own message (ENOENT = 目录不存在。), never as raw errno.
      setMessage(errorText(error, "扫描目录失败。"));
    } finally {
      setBusy(null);
    }
  }, []);

  // Scan once per (input, output) pair — first for the settings that finally load, and
  // again when this panel changes one of the two directories.
  useEffect(() => {
    if (!settings || !hasBridge) return;
    const key = `${settings.input.defaultPath ?? ""}|${settings.output.defaultPath ?? ""}`;
    if (scannedFor.current === key) return;
    scannedFor.current = key;
    void load(settings);
  }, [settings, hasBridge, load]);

  async function saveSettings(next: Settings, failure: string): Promise<void> {
    try {
      const saved = await putSettings(next);
      onSettingsChange(saved);
      await load(saved);
    } catch (error) {
      setMessage(errorText(error, failure));
    }
  }

  async function chooseInputDirectory(): Promise<void> {
    const output = outputBridge();
    if (!output || !settings) return;
    try {
      const picked = await output.selectDirectory();
      if (!picked.ok || !picked.path) {
        if (picked.code && picked.code !== "CANCELLED") {
          setMessage(outputCodeMessage(picked.code, "无法选择目录。"));
        }
        return;
      }
      await saveSettings({ ...settings, input: { ...settings.input, defaultPath: picked.path } }, "目录设置保存失败。");
    } catch (error) {
      setMessage(errorText(error, "目录选择失败。"));
    }
  }

  async function resetInputDirectory(): Promise<void> {
    if (!settings) return;
    await saveSettings({ ...settings, input: { ...settings.input, defaultPath: null } }, "目录设置保存失败。");
  }

  /** Writes `<输入目录>/processed` to the output setting — the same setting the settings page edits. */
  async function applySuggestedOutput(): Promise<void> {
    if (!settings || !suggestedOutputDir) return;
    await saveSettings(
      { ...settings, output: { ...settings.output, defaultPath: suggestedOutputDir } },
      "输出目录保存失败。",
    );
  }

  async function execute(toRun: readonly BatchRow[]): Promise<void> {
    const output = outputBridge();
    const inputDir = scan?.dirPath ?? null;
    if (!output || !inputDir || !outputDir) return;
    setBusy("running");
    setMessage(null);
    setSummary(null);
    setOpenMessage(null);
    setWrittenTo(outputDir);
    try {
      const finalRows = await runBatch(toRun, {
        inputDir,
        outputDir,
        translate: translateEnabled,
        targetLanguage: settings?.languages.target ?? "zh",
        processDoc: processDocument,
        saveFile: (dirPath, filename, content) => output.saveFile(dirPath, filename, content),
        onRows: setRows,
      });
      setRows(finalRows);
      setSummary(summarize(finalRows));
    } catch (error) {
      setMessage(errorText(error, "批量处理失败。"));
    } finally {
      setBusy(null);
    }
  }

  async function openOutputDirectory(): Promise<void> {
    const system = systemBridge();
    if (!system || !writtenTo) return;
    try {
      const result = await system.openPath(writtenTo);
      setOpenMessage(result.ok ? null : outputCodeMessage(result.code, "无法打开目录。"));
    } catch (error) {
      setOpenMessage(errorText(error, "无法打开目录。"));
    }
  }

  if (bridgeState === "loading") return null;

  if (!hasBridge) {
    return <p className={styles.degraded}>本地文档处理只能在桌面应用中使用。</p>;
  }

  const checkedCount = rows.filter((row) => row.checked).length;
  const processedCount = rows.filter((row) => row.state !== "new").length;
  const allChecked = rows.length > 0 && checkedCount === rows.length;

  let disabledReason: string | null = null;
  if (busy === "running") disabledReason = "正在处理，请等待这一批结束。";
  else if (refusal === "same-dir") disabledReason = "输出目录不能和输入目录相同。";
  else if (refusal === "no-output") disabledReason = "还没有设置输出目录，先到设置里选一个。";

  // Only real warnings get a row: the "先勾选要处理的文档" prompt used to hold a reserved 36px
  // slot open above the list, which pushed the table away from the toolbar for nothing.
  const notice =
    refusal === "same-dir"
      ? "输出目录和输入目录是同一个目录，产物会覆盖源文件，所以这一批被拒绝。"
      : disabledReason ?? (scan && rows.length === 0 ? "这个目录里没有 md 文件。" : null);

  return (
    <section className={styles.panel} aria-labelledby="local-docs-title">
      <div className={styles.head}>
        <div>
          <h2 id="local-docs-title" className={styles.title}>本地文档</h2>
          <p className={styles.subtitle}>
            批量处理本地 md：内嵌图片、可选翻译，产物写到设置里的输出目录，源文件不会被改动。
          </p>
        </div>
        <p className={styles.pill}>共 {rows.length} 篇 · 已处理 {processedCount} 篇</p>
      </div>

      <div className={styles.dirRow}>
        <code className={styles.path} title={inputDirLabel(settings)}>
          {inputDirLabel(settings)}
        </code>
        <div className={styles.actions}>
          <button className={styles.button} type="button" disabled={busy !== null} onClick={() => void chooseInputDirectory()}>
            选择目录
          </button>
          <button
            className={styles.button}
            type="button"
            disabled={busy !== null || !settings?.input.defaultPath}
            onClick={() => void resetInputDirectory()}
          >
            恢复默认
          </button>
        </div>
      </div>

      <div className={styles.toolbar}>
        <label className={styles.switchRow}>
          <input
            className={styles.checkbox}
            type="checkbox"
            aria-label="翻译产物"
            checked={translateEnabled}
            disabled={busy !== null}
            onChange={(event) => onTranslateEnabledChange(event.target.checked)}
          />
          <span>翻译产物</span>
        </label>
        <div className={styles.actions}>
          <button
            className={styles.button}
            type="button"
            disabled={busy !== null || !settings}
            onClick={() => void (settings && load(settings))}
          >
            重新扫描
          </button>
          <button
            className={styles.primary}
            type="button"
            disabled={busy !== null || refusal !== null || checkedCount === 0 || !scan}
            onClick={() => void execute(rows)}
          >
            一键转换
          </button>
        </div>
      </div>

      {notice ? (
        <p className={refusal === "same-dir" ? `${styles.hint} ${styles.hintWarning}` : styles.hint} role="status">
          {notice}
          {refusal === "same-dir" && suggestedOutputDir ? (
            <button className={styles.button} type="button" disabled={busy !== null} onClick={() => void applySuggestedOutput()}>
              改用 {suggestedOutputDir}
            </button>
          ) : null}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>
                <input
                  className={styles.checkbox}
                  type="checkbox"
                  aria-label="全选"
                  checked={allChecked}
                  disabled={busy !== null}
                  onChange={(event) => {
                    const next = event.target.checked;
                    setRows((current) => current.map((row) => ({ ...row, checked: next, forced: next })));
                  }}
                />
              </th>
              <th>文件名</th>
              <th>大小</th>
              <th>修改时间</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    className={styles.checkbox}
                    type="checkbox"
                    aria-label={`选择 ${row.name}`}
                    checked={row.checked}
                    disabled={busy !== null}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      // Ticking a row means "process it": that is what lets an already-processed
                      // document be redone, now that the per-row 重新处理 button is gone (L4).
                      setRows((current) => applyRowStatus(current, row.id, { checked, forced: checked }));
                    }}
                  />
                </td>
                <td className={styles.name}>{row.name}</td>
                <td className={styles.size}>{formatSize(row.size)}</td>
                <td className={styles.time}>{formatTime(row.mtimeMs)}</td>
                <td className={row.status.phase === "failed" ? styles.failed : styles.badge}>{statusLabel(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {summary && writtenTo ? (
        <div className={styles.result}>
          <div className={styles.resultText}>
            <p className={styles.summary} aria-live="polite">{countsText(summary)}</p>
            <code className={styles.path} title={writtenTo}>{writtenTo}</code>
          </div>
          <div className={styles.actions}>
            <button className={styles.button} type="button" onClick={() => void openOutputDirectory()}>
              打开目录
            </button>
          </div>
        </div>
      ) : null}
      {openMessage ? <p className={styles.error} role="status">{openMessage}</p> : null}
      {message ? <p className={styles.error} role="status">{message}</p> : null}
    </section>
  );
}

export default LocalDocsPanel;
