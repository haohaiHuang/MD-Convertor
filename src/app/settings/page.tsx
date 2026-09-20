"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PRESET_TARGET_LANGUAGES, languageLabel } from "@/lib/settings/languages";
import { providerFormError } from "@/lib/settings/provider-form";
import { isHttpUrl, type CloudProviderSettings, type LocalCliId, type LocalCliSettings, type Settings, type SettingsMode } from "@/types/settings";
import {
  codeMessage,
  fetchCliModels,
  fetchProviderModels,
  fetchSettings,
  putSettings,
  scanLocalClis,
  secretsBridge,
  type SecretsBridge,
} from "./client";
import styles from "./page.module.css";

type CloudDraft = {
  name: string;
  baseUrl: string;
  keyInput: string;
  selectedModel: string;
  /** Models pulled from the endpoint; they stay out of settings until the user saves. */
  models: string[];
};

const EMPTY_CLOUD_DRAFT: CloudDraft = { name: "", baseUrl: "", keyInput: "", selectedModel: "", models: [] };

/** One cloud configuration only: edit the provider that translation actually uses. */
function editingProvider(cloud: Settings["cloud"]): CloudProviderSettings | null {
  return cloud.providers.find((provider) => provider.id === cloud.activeProviderId) ?? cloud.providers[0] ?? null;
}

function cloudDraft(provider: CloudProviderSettings | null): CloudDraft {
  return {
    name: provider?.name ?? "",
    baseUrl: provider?.baseUrl ?? "",
    keyInput: "",
    selectedModel: provider?.selectedModel ?? "",
    models: [],
  };
}

const CLOUD_NOTE = "cloud";

type Note = { text: string; warn?: boolean };

function noteClass(note: Note) {
  return note.warn ? `${styles.status} ${styles.warning}` : styles.status;
}

function mergeModels(current: string[], incoming: string[]): string[] {
  const merged = [...current];
  for (const model of incoming) {
    const value = model.trim();
    if (value && !merged.includes(value)) merged.push(value);
  }
  return merged;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [cloudForm, setCloudForm] = useState<CloudDraft>(EMPTY_CLOUD_DRAFT);
  const [notes, setNotes] = useState<Record<string, Note>>({});
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [bridge, setBridge] = useState<SecretsBridge | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [reloadToken, setReloadToken] = useState(0);
  const router = useRouter();
  const pendingSave = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const loaded = await fetchSettings();
        if (cancelled) return;
        setBridge(secretsBridge());
        setSettings(loaded);
        setCloudForm(cloudDraft(editingProvider(loaded.cloud)));
        setNotes({});
        setMessage("");
        setLoadState("ready");
      } catch (error) {
        if (cancelled) return;
        setMessage(error instanceof Error ? error.message : "设置读取失败，请稍后重试。");
        setLoadState("error");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  /** `warn` paints the note in the warning colour; progress and success stay muted. */
  function setNote(key: string, text: string, warn = false) {
    setNotes((current) => ({ ...current, [key]: { text, warn } }));
  }

  function patchCloudForm(patch: Partial<CloudDraft>) {
    setCloudForm((current) => ({ ...current, ...patch }));
  }

  /** Optimistic save: the UI keeps the new value only when the server confirms it. */
  async function save(next: Settings, note?: { key: string; text: string; warn?: boolean }): Promise<boolean> {
    if (!settings) return false;
    const previous = settings;
    setSaving(true);
    setSettings(next);
    setMessage("");
    setSaveStatus("saving");
    const task = (async () => {
      try {
        setSettings(await putSettings(next));
        if (note) setNote(note.key, note.text, note.warn);
        setSaveStatus("saved");
        return true;
      } catch (error) {
        setSettings(previous);
        setMessage(error instanceof Error ? error.message : "设置保存失败，请稍后重试。");
        setSaveStatus("error");
        return false;
      } finally {
        setSaving(false);
      }
    })();
    pendingSave.current = task;
    void task.finally(() => {
      if (pendingSave.current === task) pendingSave.current = null;
    });
    return task;
  }

  /** Leaving waits for an in-flight save so nobody walks away from a silent failure. */
  async function leaveSettings() {
    const pending = pendingSave.current;
    if (pending && !(await pending)) return;
    router.push("/");
  }

  function patchCli(next: Settings, id: LocalCliId, patch: Partial<LocalCliSettings>): Settings {
    return {
      ...next,
      local: {
        ...next.local,
        clis: next.local.clis.map((cli) => (cli.id === id ? { ...cli, ...patch } : cli)),
      },
    };
  }

  /** The single Save button of the cloud card: all four fields, or nothing. */
  async function saveCloudProvider(): Promise<boolean> {
    if (!settings) return false;
    const provider = editingProvider(settings.cloud);
    const name = cloudForm.name.trim();
    const baseUrl = cloudForm.baseUrl.trim();
    const value = cloudForm.keyInput.trim();
    const selectedModel = cloudForm.selectedModel.trim();
    const incomplete = providerFormError({
      name,
      baseUrl,
      keyStored: provider?.keyStored ?? false,
      keyInput: value,
      selectedModel,
    });
    if (incomplete) {
      setNote(CLOUD_NOTE, incomplete, true);
      return false;
    }
    const id = provider?.id ?? crypto.randomUUID();
    let keyStored = provider?.keyStored ?? false;
    if (value) {
      if (!bridge) {
        setNote(CLOUD_NOTE, "密钥只能通过桌面应用保存到系统密钥库。", true);
        return false;
      }
      const result = await bridge.set(id, value);
      if (!result.ok) {
        setNote(CLOUD_NOTE, codeMessage(result.code, "密钥保存失败。"), true);
        return false;
      }
      keyStored = true;
    }
    const next: CloudProviderSettings = {
      id,
      name,
      baseUrl,
      keyStored,
      models: mergeModels(mergeModels(provider?.models ?? [], cloudForm.models), [selectedModel]),
      selectedModel,
    };
    // One provider only, and it is always the one in use.
    const saved = await save({ ...settings, cloud: { providers: [next], activeProviderId: id } }, { key: CLOUD_NOTE, text: "已保存。" });
    if (saved) patchCloudForm({ keyInput: "" });
    return saved;
  }

  /** Reads the model list from the form; pulling never writes settings. */
  async function pullCloudModels() {
    if (!settings) return;
    const provider = editingProvider(settings.cloud);
    const baseUrl = cloudForm.baseUrl.trim();
    const apiKey = cloudForm.keyInput.trim();
    if (!isHttpUrl(baseUrl)) {
      setNote(CLOUD_NOTE, "请填写完整的 http(s) 接口地址。", true);
      return;
    }
    if (!apiKey && !provider) {
      setNote(CLOUD_NOTE, "请先填写 API 密钥。", true);
      return;
    }
    setNote(CLOUD_NOTE, "正在获取模型…");
    try {
      // The form address is used for the probe only; an untyped key falls back to the keychain.
      const models = await fetchProviderModels({ providerId: provider?.id, baseUrl, apiKey });
      patchCloudForm({ models: mergeModels(cloudForm.models, models) });
      setNote(CLOUD_NOTE, models.length ? `已获取 ${models.length} 个模型，请选择其中一个。` : "端点没有返回模型。", models.length === 0);
    } catch (error) {
      setNote(CLOUD_NOTE, error instanceof Error ? error.message : "模型获取失败，请稍后重试。", true);
    }
  }

  async function clearCloudKey() {
    if (!settings || !bridge) return;
    const provider = editingProvider(settings.cloud);
    if (!provider) return;
    const result = await bridge.clear(provider.id);
    if (!result.ok) {
      setNote(CLOUD_NOTE, codeMessage(result.code, "密钥清除失败。"), true);
      return;
    }
    patchCloudForm({ keyInput: "" });
    await save(
      { ...settings, cloud: { providers: [{ ...provider, keyStored: false }], activeProviderId: provider.id } },
      { key: CLOUD_NOTE, text: "已清除该 Provider 的密钥。" },
    );
  }


  async function rescanClis() {
    if (!settings) return;
    try {
      const found = await scanLocalClis();
      let next = settings;
      for (const cli of settings.local.clis) {
        const hit = found.find((entry) => entry.id === cli.id);
        next = patchCli(next, cli.id, { detectedPath: hit?.installed ? hit.path : null });
      }
      await save(next);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "扫描失败，请稍后重试。");
    }
  }

  async function pullCliModels(cli: LocalCliSettings) {
    if (!settings) return;
    const key = `cli:${cli.id}`;
    setNote(key, "正在获取模型…");
    try {
      const models = await fetchCliModels(cli.id);
      await save(
        patchCli(settings, cli.id, { models: mergeModels(cli.models, models) }),
        { key, text: models.length ? `已获取 ${models.length} 个模型。` : "该 CLI 没有返回模型列表。" },
      );
    } catch (error) {
      setNote(key, error instanceof Error ? error.message : "模型获取失败，请稍后重试。", true);
    }
  }

  const cloudProvider = settings ? editingProvider(settings.cloud) : null;
  const cloudModels = mergeModels(cloudProvider?.models ?? [], cloudForm.models);
  const languageOptions = settings
    ? [...PRESET_TARGET_LANGUAGES.map((language) => language.tag), ...settings.languages.custom].filter(
        (tag, index, all) => all.indexOf(tag) === index,
      )
    : [];

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brand} aria-label="MD-Convertor">
            <span className={styles.brandMark} aria-hidden="true">MD</span>
            <span>MD-Convertor</span>
          </div>
          <div className={styles.headerActions}>
            {saveStatus === "saving" ? <span className={styles.saveStatus} role="status">保存中…</span> : null}
            {saveStatus === "saved" ? <span className={styles.saveStatus} role="status">已保存</span> : null}
            {saveStatus === "error" ? <span className={styles.saveStatusError} role="alert">未保存</span> : null}
            <button className={styles.backLink} type="button" onClick={() => void leaveSettings()}>返回转换</button>
          </div>
        </header>

        <h1 className={styles.title}>设置</h1>
        <p className={styles.subtitle}>
          设置保存在本机设置目录的 <code>settings.json</code>；密钥单独保存在系统密钥库，不会写入设置文件。
        </p>

        {loadState === "loading" ? <p className={styles.status}>正在读取设置…</p> : null}
        {loadState === "error" ? (
          <div className={styles.error} role="alert">
            <p>{message}</p>
            <button
              className={styles.button}
              type="button"
              onClick={() => {
                setLoadState("loading");
                setReloadToken((token) => token + 1);
              }}
            >重试</button>
          </div>
        ) : null}
        {loadState === "ready" && message ? <p className={styles.status} role="status">{message}</p> : null}

        {settings ? (
          <section className={styles.card} aria-labelledby="provider-mode-title">
            <h2 id="provider-mode-title" className={styles.cardTitle}>翻译服务提供方</h2>
            <p className={styles.cardNote}>转换后翻译正文时使用的服务：云端走 Provider 接口，本地走已启用的 CLI。</p>
            <div className={styles.modeBar} role="radiogroup" aria-label="翻译服务提供方">
              {([["cloud", "云端 Provider"], ["local", "本地 CLI"]] as [SettingsMode, string][]).map(([value, label]) => (
                <label key={value} className={styles.modeOption}>
                  <input
                    type="radio"
                    name="mode"
                    value={value}
                    checked={settings.mode === value}
                    disabled={saving}
                    onChange={() => void save({ ...settings, mode: value })}
                  />
                  <span className={styles.modeLabel}>{label}</span>
                </label>
              ))}
            </div>
          </section>
        ) : null}

        <section className={styles.card} aria-labelledby="cloud-title">
          <h2 id="cloud-title" className={styles.cardTitle}>云端 Provider</h2>
          <p className={styles.cardNote}>
            只保存一条云端配置。OpenAI 兼容端点；本地自建网关（Ollama、LM Studio 等）也可以用这里的「云端」档配置。
          </p>

          {settings ? (
            <article className={styles.provider} aria-label="云端 Provider">
              <div className={styles.providerHead}>
                <span className={styles.badge}>{cloudProvider?.keyStored ? "已配置" : "未配置"}</span>
                <div className={styles.actions}>
                  <button
                    className={styles.button}
                    type="button"
                    disabled={saving || loadState !== "ready"}
                    onClick={() => void saveCloudProvider()}
                  >
                    保存
                  </button>
                </div>
              </div>

              <div className={styles.grid}>
                <label className={styles.field}>
                  <span>名称</span>
                  <input
                    className={styles.input}
                    aria-label="Provider 名称"
                    value={cloudForm.name}
                    disabled={saving || loadState !== "ready"}
                    onChange={(event) => patchCloudForm({ name: event.target.value })}
                  />
                </label>
                <label className={styles.field}>
                  <span>Base URL</span>
                  <span className={styles.urlRow}>
                    <input
                      className={styles.input}
                      aria-label="Provider Base URL"
                      value={cloudForm.baseUrl}
                      disabled={saving || loadState !== "ready"}
                      onChange={(event) => patchCloudForm({ baseUrl: event.target.value })}
                    />
                    <button
                      className={styles.button}
                      type="button"
                      disabled={saving || loadState !== "ready"}
                      onClick={() => void pullCloudModels()}
                    >
                      拉取模型
                    </button>
                  </span>
                </label>
              </div>

              <div className={styles.modelRow}>
                <label className={styles.field}>
                  <span>模型</span>
                  <input
                    className={styles.input}
                    aria-label="Provider 模型"
                    list="cloud-models"
                    placeholder={cloudModels.length ? "从下拉选择或直接填写模型名" : "先拉取模型，或直接填写模型名"}
                    value={cloudForm.selectedModel}
                    disabled={saving || loadState !== "ready"}
                    onChange={(event) => patchCloudForm({ selectedModel: event.target.value })}
                  />
                  <datalist id="cloud-models">
                    {cloudModels.map((model) => (
                      <option key={model} value={model} />
                    ))}
                  </datalist>
                </label>
              </div>

              {bridge ? (
                <div className={styles.modelRow}>
                  <label className={styles.field}>
                    <span>API 密钥</span>
                    <input
                      className={styles.input}
                      type="password"
                      aria-label="Provider 密钥"
                      placeholder={cloudProvider?.keyStored ? "••••••••（已保存，先清除密钥再更换）" : "请输入 API 密钥"}
                      value={cloudForm.keyInput}
                      disabled={saving || loadState !== "ready"}
                      readOnly={Boolean(cloudProvider?.keyStored)}
                      onChange={(event) => patchCloudForm({ keyInput: event.target.value })}
                    />
                  </label>
                  {cloudProvider ? (
                    <button
                      className={styles.button}
                      type="button"
                      disabled={saving || loadState !== "ready"}
                      onClick={() => void clearCloudKey()}
                    >
                      清除密钥
                    </button>
                  ) : null}
                </div>
              ) : null}

              {notes[CLOUD_NOTE] ? (
                <p className={noteClass(notes[CLOUD_NOTE])} role="status">
                  {notes[CLOUD_NOTE].text}
                </p>
              ) : null}
            </article>
          ) : null}

          {loadState === "ready" && settings && !bridge ? (
            <p className={styles.cardNote}>密钥只能通过桌面应用保存到系统密钥库；当前页面没有桌面桥接，因此不显示密钥输入。</p>
          ) : null}

        </section>

        <section className={styles.card} aria-labelledby="local-title">
          <h2 id="local-title" className={styles.cardTitle}>本地代理</h2>
          <p className={styles.cardNote}>按 PATH 探测本机已安装的 CLI，沿用它的登录态与默认端点。</p>

          <div className={styles.actions}>
            <button className={styles.button} type="button" disabled={saving || loadState !== "ready"} onClick={() => void rescanClis()}>
              重新扫描
            </button>
          </div>

          {settings?.local.clis.map((cli) => {
            const note = notes[`cli:${cli.id}`];
            return (
              <article key={cli.id} className={styles.provider}>
                <div className={styles.providerHead}>
                  <label className={styles.radioRow}>
                    <input
                      type="radio"
                      name="active-cli"
                      aria-label="设为当前 CLI"
                      checked={settings.local.activeCliId === cli.id}
                      disabled={saving}
                      onChange={() => void save({ ...settings, local: { ...settings.local, activeCliId: cli.id } })}
                    />
                    <span>{cli.name}</span>
                  </label>
                  <code className={styles.path}>{cli.detectedPath ?? "未检测到"}</code>
                  <label className={styles.switchRow}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      aria-label={`启用 ${cli.id}`}
                      checked={cli.enabled}
                      disabled={saving}
                      onChange={(event) => void save(patchCli(settings, cli.id, { enabled: event.target.checked }))}
                    />
                    <span>启用</span>
                  </label>
                </div>

                <div className={styles.modelRow}>
                  <label className={styles.field}>
                    <span>模型</span>
                    <select
                      className={styles.input}
                      aria-label={`${cli.id} 的模型`}
                      value={cli.selectedModel ?? ""}
                      disabled={saving}
                      onChange={(event) => void save(patchCli(settings, cli.id, { selectedModel: event.target.value || null }))}
                    >
                      <option value="">使用 CLI 默认模型</option>
                      {cli.models.map((model) => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    className={styles.button}
                    type="button"
                    disabled={saving}
                    onClick={() => void pullCliModels(cli)}
                  >拉取 {cli.id} 的模型</button>
                </div>

                {note ? <p className={noteClass(note)} role="status">{note.text}</p> : null}
              </article>
            );
          })}
        </section>

        <section className={styles.card} aria-labelledby="languages-title">
          <h2 id="languages-title" className={styles.cardTitle}>语言</h2>
          <p className={styles.cardNote}>源语言：自动识别（由模型判定）</p>

          {settings ? (
            <>
              <label className={styles.field}>
                <span>目标语言</span>
                <select
                  className={styles.input}
                  aria-label="目标语言"
                  value={settings.languages.target}
                  disabled={saving}
                  onChange={(event) => void save({ ...settings, languages: { ...settings.languages, target: event.target.value } })}
                >
                  {languageOptions.map((tag) => (
                    <option key={tag} value={tag}>{languageLabel(tag)}</option>
                  ))}
                </select>
              </label>

            </>
          ) : null}
        </section>

        <section className={styles.card} aria-labelledby="translation-title">
          <h2 id="translation-title" className={styles.cardTitle}>翻译</h2>
          <label className={styles.switchRow}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={settings?.translation.defaultEnabled ?? false}
              disabled={loadState !== "ready" || saving}
              onChange={(event) => {
                if (!settings) return;
                void save({ ...settings, translation: { ...settings.translation, defaultEnabled: event.target.checked } });
              }}
            />
            <span>转换时默认翻译正文</span>
          </label>
          <p className={styles.cardNote}>
            默认关闭。勾选后每次转换都会把正文发送到你所配置的端点；关闭时正文不出本机。
          </p>
        </section>
      </div>
    </main>
  );
}
