import { expect, test, type Page } from "@playwright/test";

type StoredSettings = {
  version: number;
  mode: string;
  cloud: { providers: Record<string, unknown>[]; activeProviderId: string | null };
  local: { clis: Record<string, unknown>[]; activeCliId: string | null };
  languages: { target: string; custom: string[] };
  translation: { defaultEnabled: boolean };
  output?: { defaultPath: string | null; useDefaultPath: boolean };
};

const storedSettings: StoredSettings = {
  version: 1,
  mode: "cloud",
  cloud: { providers: [], activeProviderId: null },
  local: {
    clis: [
      { id: "pi", name: "pi", enabled: true, detectedPath: null, models: [], selectedModel: null },
      { id: "claude", name: "claude", enabled: true, detectedPath: null, models: [], selectedModel: null },
    ],
    activeCliId: null,
  },
  languages: { target: "zh-Hans", custom: [] },
  translation: { defaultEnabled: false },
  // The real API always returns output (lenient read fills it server-side);
  // the mock must match that contract or the output card would crash the page.
  output: { defaultPath: null, useDefaultPath: false },
};

const providerSettings: StoredSettings = {
  ...storedSettings,
  cloud: {
    providers: [{
      id: "ollama",
      name: "Ollama",
      baseUrl: "http://127.0.0.1:11434/v1",
      keyStored: false,
      models: ["qwen3:8b"],
      selectedModel: null,
    }],
    activeProviderId: "ollama",
  },
};

/** Stateful mock so a reload proves the PUT was persisted by the API contract. */
async function mockSettingsApi(page: Page, initial: StoredSettings) {
  let current = structuredClone(initial);
  const putBodies: Record<string, unknown>[] = [];
  await page.route("**/api/settings", async (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      putBodies.push(body);
      current = { ...current, ...body };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(current) });
  });
  return putBodies;
}

async function mockModelApis(
  page: Page,
  options: { providerModels?: () => { status: number; body: unknown }; cliModels?: unknown } = {},
) {
  const calls: string[] = [];
  await page.route("**/api/provider/models", async (route) => {
    calls.push(route.request().postDataJSON()?.providerId);
    const result = options.providerModels?.() ?? { status: 200, body: { models: ["qwen3:8b", "llama3.2"] } };
    await route.fulfill({ status: result.status, contentType: "application/json", body: JSON.stringify(result.body) });
  });
  await page.route("**/api/local-clis/scan", async (route) => {
    calls.push("scan");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        clis: [
          { id: "pi", name: "pi", path: "/usr/local/bin/pi", installed: true },
          { id: "claude", name: "claude", path: null, installed: false },
        ],
      }),
    });
  });
  await page.route("**/api/local-clis/models", async (route) => {
    calls.push(`cli:${route.request().postDataJSON()?.cliId}`);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(options.cliModels ?? { models: ["agnes-2.5-flash"] }),
    });
  });
  return calls;
}

async function installBridge(page: Page, overrides: { set?: "ok" | "failed" } = {}) {
  await page.addInitScript((mode) => {
    const calls: unknown[][] = [];
    (window as unknown as { secretCalls: unknown[][] }).secretCalls = calls;
    (window as unknown as { mdConvertor: unknown }).mdConvertor = {
      secrets: {
        set: async (providerId: string, value: string) => {
          calls.push(["set", providerId, value]);
          return mode === "failed"
            ? { ok: false, code: "SECRETS_UNAVAILABLE" }
            : { ok: true, keyStored: true };
        },
        clear: async (providerId: string) => {
          calls.push(["clear", providerId]);
          return { ok: true, keyStored: false };
        },
        status: async () => {
          calls.push(["status"]);
          return { ok: true, encryptionAvailable: true };
        },
      },
    };
  }, overrides.set ?? "ok");
}

function secretCalls(page: Page) {
  return page.evaluate(() => (window as unknown as { secretCalls: unknown[][] }).secretCalls);
}

test.describe("设置页", () => {
  test("页头 gear 打开 /settings", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "设置" }).click();

    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("heading", { level: 1, name: "设置" })).toBeVisible();
  });

  test("设置页品牌与首页一致（无方块，用 Michroma）", async ({ page }) => {
    await page.goto("/settings");

    const brand = page.locator('[aria-label="MD-Convertor"]');
    await expect(brand).toHaveText("MD-Convertor");
    await expect(brand.locator("span").filter({ hasText: /^MD$/ })).toHaveCount(0);

    await page.evaluate(() => document.fonts.ready);
    // next/font/local names the family after the binding in layout.tsx, hence the loose match.
    expect(await brand.evaluate((node) => getComputedStyle(node).fontFamily)).toMatch(/michroma/i);
  });

  test("真实 API 往返：默认设置 → 保存 → 重载保持", async ({ page, browserName, request }) => {
    // Every project shares one temporary user data directory, so the only real write runs once.
    test.skip(browserName !== "chromium", "real settings store is shared across projects");
    await page.goto("/settings");

    try {
      for (const section of ["翻译服务提供方", "云端 Provider", "本地代理", "语言", "翻译"]) {
        await expect(page.getByRole("heading", { name: section, exact: true })).toBeVisible();
      }
      await expect(page.getByLabel("目标语言")).toHaveValue("zh-Hans");
      const toggle = page.getByRole("checkbox", { name: "转换时默认翻译正文" });
      await expect(toggle).toBeEnabled();
      await expect(toggle).not.toBeChecked();

      await toggle.check();
      await expect(page.getByText("已保存", { exact: true })).toBeVisible();

      await page.reload();
      await expect(toggle).toBeChecked();
    } finally {
      // The store is shared by every project and every later spec, so hand it back in its
      // default state: a persisted defaultEnabled: true would make later conversions translate.
      const restored = await request.put("/api/settings", { data: storedSettings });
      expect(restored.ok()).toBe(true);
    }
  });

  test("GET/PUT 往返生效", async ({ page }) => {
    const putBodies = await mockSettingsApi(page, storedSettings);
    await page.goto("/settings");

    await page.getByRole("checkbox", { name: "转换时默认翻译正文" }).check();
    await expect(page.getByText("已保存", { exact: true })).toBeVisible();
    expect(putBodies).toHaveLength(1);
    expect(putBodies[0]).toMatchObject({ version: 1, translation: { defaultEnabled: true } });

    await page.reload();
    await expect(page.getByRole("checkbox", { name: "转换时默认翻译正文" })).toBeChecked();
  });

  test("保存失败时回退开关状态", async ({ page }) => {
    await page.route("**/api/settings", async (route) => {
      if (route.request().method() === "PUT") {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "INVALID_SETTINGS", message: "设置数据无效，请检查后重试。" } }),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(storedSettings) });
    });
    await page.goto("/settings");

    // A failed save intentionally reverts the toggle, so click and assert instead of check().
    await page.getByRole("checkbox", { name: "转换时默认翻译正文" }).click();

    await expect(page.getByText("设置数据无效，请检查后重试。")).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "转换时默认翻译正文" })).not.toBeChecked();
  });

  test("没有 preload 时只提示密钥只能在桌面应用中保存", async ({ page }) => {
    await mockSettingsApi(page, providerSettings);
    await page.goto("/settings");

    await expect(page.getByLabel("Provider 密钥")).toHaveCount(0);
    await expect(page.getByLabel("新建 Provider 密钥")).toHaveCount(0);
    await expect(page.getByText(/密钥只能通过桌面应用保存到系统密钥库/)).toBeVisible();
    await expect(page.getByText("未配置")).toBeVisible();
  });
});

const CLOUD_CARD = 'article[aria-label="云端 Provider"]';

// A provider that already has a key, so a save does not need the key box filled again.
const readyProviderSettings: StoredSettings = {
  ...providerSettings,
  cloud: {
    providers: [{ ...providerSettings.cloud.providers[0], keyStored: true, selectedModel: "qwen3:8b" }],
    activeProviderId: "ollama",
  },
};

test.describe("云端 Provider", () => {
  test("只有一张云端配置卡片，填齐四项保存后成为唯一的 Provider", async ({ page }) => {
    const putBodies = await mockSettingsApi(page, storedSettings);
    await installBridge(page);
    await page.goto("/settings");

    await expect(page.getByRole("button", { name: "添加 Provider" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "删除" })).toHaveCount(0);
    await expect(page.getByText("当前使用")).toHaveCount(0);
    await expect(page.getByLabel("设为当前 Provider")).toHaveCount(0);
    await expect(page.getByLabel("手填模型")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "添加模型" })).toHaveCount(0);
    await expect(page.getByText("环境变量名")).toHaveCount(0);
    await expect(page.getByText("尚未添加 Provider。")).toHaveCount(0);

    const card = page.locator(CLOUD_CARD);
    await expect(card.getByText("未配置")).toBeVisible();
    await card.getByLabel("Provider 名称").fill("Mimo");
    await card.getByLabel("Provider Base URL").fill("https://api.xiaomimimo.com/v1");
    await card.getByLabel("Provider 密钥").fill("sk-live-1234");
    await card.getByLabel("Provider 模型").fill("mimo-v2.5-pro");
    await card.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByText("已保存", { exact: true })).toBeVisible();

    const cloud = putBodies.at(-1)?.cloud as { providers: Record<string, unknown>[]; activeProviderId: string | null };
    expect(cloud.providers).toHaveLength(1);
    expect(cloud.providers[0]).toMatchObject({
      name: "Mimo",
      baseUrl: "https://api.xiaomimimo.com/v1",
      keyStored: true,
      models: ["mimo-v2.5-pro"],
      selectedModel: "mimo-v2.5-pro",
    });
    expect(cloud.providers[0]).not.toHaveProperty("apiKeyEnv");
    expect(cloud.activeProviderId).toBe(cloud.providers[0].id);
    expect(await secretCalls(page)).toContainEqual(["set", cloud.providers[0].id, "sk-live-1234"]);

    // Saving stored the key: the box goes back to empty and shows the placeholder dots.
    await expect(card.getByText("已配置")).toBeVisible();
    await expect(card.getByLabel("Provider 密钥")).toHaveValue("");
    await expect(card.getByLabel("Provider 密钥")).toHaveAttribute("placeholder", /••••••••/);
    await expect(page.locator('article[aria-label^="Provider "]')).toHaveCount(0);
  });

  test("清除与保存并列在卡片头部", async ({ page }) => {
    await mockSettingsApi(page, providerSettings);
    await installBridge(page);
    await page.goto("/settings");

    const card = page.locator(CLOUD_CARD);
    const saveBox = await card.getByRole("button", { name: "保存", exact: true }).boundingBox();
    const clearBox = await card.getByRole("button", { name: "清除", exact: true }).boundingBox();
    const nameBox = await card.getByLabel("Provider 名称").boundingBox();
    const cardBox = await card.boundingBox();
    if (!saveBox || !clearBox || !nameBox || !cardBox) throw new Error("missing layout box");
    expect(saveBox.y).toBeLessThan(nameBox.y);
    expect(saveBox.x).toBeGreaterThan(cardBox.x + cardBox.width / 2);
    // 清除与保存并列在卡片头部。
    expect(clearBox.y).toBeLessThan(nameBox.y);
    expect(clearBox.x).toBeGreaterThan(cardBox.x + cardBox.width / 2);
    expect(clearBox.x).toBeLessThan(saveBox.x);
  });

  test("保存要求四项齐全，缺一项就提示且不写盘", async ({ page }) => {
    const putBodies = await mockSettingsApi(page, storedSettings);
    await installBridge(page);
    await page.goto("/settings");

    const card = page.locator(CLOUD_CARD);
    const save = card.getByRole("button", { name: "保存", exact: true });

    await save.click();
    await expect(card.getByText("请填写 Provider 名称。")).toBeVisible();

    await card.getByLabel("Provider 名称").fill("Mimo");
    await save.click();
    await expect(card.getByText("请填写完整的 http(s) 接口地址。")).toBeVisible();

    await card.getByLabel("Provider Base URL").fill("api.xiaomimimo.com/v1");
    await save.click();
    await expect(card.getByText("请填写完整的 http(s) 接口地址。")).toBeVisible();

    await card.getByLabel("Provider Base URL").fill("https://api.xiaomimimo.com/v1");
    await save.click();
    await expect(card.getByText("请先填写 API 密钥。")).toBeVisible();

    await card.getByLabel("Provider 密钥").fill("sk-live-1234");
    await save.click();
    const missingModel = card.getByText("请先拉取或选择模型。");
    await expect(missingModel).toBeVisible();
    // Missing-field notes must read as warnings, not as plain muted text.
    await expect(missingModel).toHaveCSS("color", "rgb(138, 90, 18)");

    // Nothing was written while the form was incomplete.
    expect(putBodies).toHaveLength(0);
    expect(await secretCalls(page)).toHaveLength(0);
  });

  test("先拉取模型只读取端点，保存后才写盘", async ({ page }) => {
    const putBodies = await mockSettingsApi(page, storedSettings);
    const calls = await mockModelApis(page);
    await installBridge(page);
    await page.goto("/settings");

    const card = page.locator(CLOUD_CARD);
    await card.getByLabel("Provider 名称").fill("Mimo");
    await card.getByLabel("Provider Base URL").fill("https://api.xiaomimimo.com/v1");
    await card.getByLabel("Provider 密钥").fill("sk-live-1234");
    await card.getByRole("button", { name: "拉取模型" }).click();

    await expect(card.getByText("已获取 2 个模型，请选择其中一个。")).toBeVisible();
    expect(calls).toEqual([undefined]);
    expect(putBodies).toHaveLength(0);
    await expect(card.locator("#cloud-models option")).toHaveCount(2);

    await card.getByLabel("Provider 模型").fill("llama3.2");
    await card.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByText("已保存", { exact: true })).toBeVisible();

    const providers = (putBodies.at(-1)?.cloud as { providers: { models: string[]; selectedModel: string }[] }).providers;
    expect(providers[0]).toMatchObject({ models: ["qwen3:8b", "llama3.2"], selectedModel: "llama3.2" });
  });

  test("已保存的密钥以黑点占位显示，不回填明文", async ({ page }) => {
    await mockSettingsApi(page, readyProviderSettings);
    await installBridge(page);
    await page.goto("/settings");

    const input = page.locator(CLOUD_CARD).getByLabel("Provider 密钥");
    await expect(input).toHaveValue("");
    await expect(input).toHaveAttribute("placeholder", /••••••••/);
    // 已保存的密钥只能清除后重新录入，不能直接改写。
    await expect(input).not.toBeEditable();
  });

  test("清除会删掉密钥与整条云端配置，回到未配置状态", async ({ page }) => {
    const putBodies = await mockSettingsApi(page, readyProviderSettings);
    await installBridge(page);
    await page.goto("/settings");

    const card = page.locator(CLOUD_CARD);
    await expect(card.getByText("已配置")).toBeVisible();
    await card.getByRole("button", { name: "清除", exact: true }).click();
    await expect(card.getByText("已清除云端配置。", { exact: true })).toBeVisible();

    // 密钥行里的「清除密钥」已经被头部这一个动作取代。
    await expect(card.getByRole("button", { name: "清除密钥", exact: true })).toHaveCount(0);
    await expect(card.getByText("未配置")).toBeVisible();
    // 清除后开放重新录入，四个字段都回到空。
    await expect(card.getByLabel("Provider 密钥")).toBeEditable();
    for (const label of ["Provider 名称", "Provider Base URL", "Provider 模型", "Provider 密钥"]) {
      await expect(card.getByLabel(label)).toHaveValue("");
    }
    expect(await secretCalls(page)).toContainEqual(["clear", "ollama"]);
    const cloud = putBodies.at(-1)?.cloud as { providers: Record<string, unknown>[]; activeProviderId: string | null };
    expect(cloud.providers).toEqual([]);
    expect(cloud.activeProviderId).toBeNull();
  });

  test("拉取模型只读取端点，按钮位于 Base URL 右侧", async ({ page }) => {
    const putBodies = await mockSettingsApi(page, readyProviderSettings);
    const calls = await mockModelApis(page);
    await page.goto("/settings");

    const card = page.locator(CLOUD_CARD);
    // The saved provider already has a model, so the box must not claim 先拉取模型….
    await expect(card.getByLabel("Provider 模型")).toHaveAttribute("placeholder", "从下拉选择或直接填写模型名");
    await card.getByLabel("Provider Base URL").fill("https://api.xiaomimimo.com/v1");

    const urlBox = await card.getByLabel("Provider Base URL").boundingBox();
    const pullBox = await card.getByRole("button", { name: "拉取模型" }).boundingBox();
    expect(urlBox).not.toBeNull();
    expect(pullBox).not.toBeNull();
    expect(pullBox!.x).toBeGreaterThan(urlBox!.x);
    expect(Math.abs(pullBox!.y - urlBox!.y)).toBeLessThan(urlBox!.height);

    await card.getByRole("button", { name: "拉取模型" }).click();
    await expect(card.getByText("已获取 2 个模型，请选择其中一个。")).toBeVisible();

    // Pulling probes the draft address but writes nothing: the draft URL is still unsaved.
    expect(calls).toEqual(["ollama"]);
    expect(putBodies).toHaveLength(0);
    await expect(card.locator("#cloud-models option")).toHaveCount(2);
  });

  test("模型既能填拉取到的名字，也能手填", async ({ page }) => {
    const putBodies = await mockSettingsApi(page, readyProviderSettings);
    await mockModelApis(page);
    await installBridge(page);
    await page.goto("/settings");

    const card = page.locator(CLOUD_CARD);
    await card.getByRole("button", { name: "拉取模型" }).click();
    await expect(card.getByText("已获取 2 个模型，请选择其中一个。")).toBeVisible();

    await card.getByLabel("Provider 模型").fill("llama3.2");
    await card.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByText("已保存", { exact: true })).toBeVisible();
    const picked = (putBodies.at(-1)?.cloud as { providers: { models: string[]; selectedModel: string }[] }).providers[0];
    expect(picked).toMatchObject({ models: ["qwen3:8b", "llama3.2"], selectedModel: "llama3.2" });

    await card.getByLabel("Provider 模型").fill("mistral-nemo");
    await card.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByText("已保存", { exact: true })).toBeVisible();
    const typed = (putBodies.at(-1)?.cloud as { providers: { models: string[]; selectedModel: string }[] }).providers[0];
    expect(typed).toMatchObject({ models: ["qwen3:8b", "llama3.2", "mistral-nemo"], selectedModel: "mistral-nemo" });
  });

  test("拉取失败时说明原因且不影响手填", async ({ page }) => {
    const putBodies = await mockSettingsApi(page, readyProviderSettings);
    await mockModelApis(page, {
      providerModels: () => ({ status: 502, body: { error: { code: "TRANSLATE_PROVIDER_ERROR", message: "无法连接 Provider 端点。" } } }),
    });
    await installBridge(page);
    await page.goto("/settings");

    const card = page.locator(CLOUD_CARD);
    await card.getByRole("button", { name: "拉取模型" }).click();
    await expect(card.getByText("无法连接 Provider 端点。")).toBeVisible();

    await card.getByLabel("Provider 模型").fill("mistral-nemo");
    await card.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByText("已保存", { exact: true })).toBeVisible();
    const saved = (putBodies.at(-1)?.cloud as { providers: { selectedModel: string }[] }).providers[0];
    expect(saved.selectedModel).toBe("mistral-nemo");
  });

  test("旧文件里有多条 Provider 时，只编辑当前使用的那一条", async ({ page }) => {
    const putBodies = await mockSettingsApi(page, {
      ...readyProviderSettings,
      cloud: {
        providers: [
          { id: "first", name: "First", baseUrl: "http://127.0.0.1:11434/v1", keyStored: true, models: ["a"], selectedModel: "a" },
          { id: "second", name: "Second", baseUrl: "http://127.0.0.1:11435/v1", keyStored: true, models: ["b"], selectedModel: "b" },
        ],
        activeProviderId: "second",
      },
    });
    await installBridge(page);
    await page.goto("/settings");

    const card = page.locator(CLOUD_CARD);
    await expect(card.getByLabel("Provider 名称")).toHaveValue("Second");
    await expect(page.locator('article[aria-label="Provider First"]')).toHaveCount(0);

    await card.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByText("已保存", { exact: true })).toBeVisible();
    const cloud = putBodies.at(-1)?.cloud as { providers: Record<string, unknown>[]; activeProviderId: string | null };
    expect(cloud.providers).toHaveLength(1);
    expect(cloud.providers[0]).toMatchObject({ id: "second", name: "Second" });
    expect(cloud.activeProviderId).toBe("second");
  });
});

test.describe("本地代理与模式", () => {
  test("扫描结果、启停与模型选择都能持久化", async ({ page }) => {
    const putBodies = await mockSettingsApi(page, storedSettings);
    const calls = await mockModelApis(page);
    await page.goto("/settings");

    await page.getByRole("button", { name: "重新扫描" }).click();
    await expect(page.getByText("/usr/local/bin/pi")).toBeVisible();
    expect(calls).toEqual(["scan"]);
    const scanned = (putBodies.at(-1)?.local as { clis: Record<string, unknown>[] }).clis;
    expect(scanned[0]).toMatchObject({ id: "pi", detectedPath: "/usr/local/bin/pi" });
    expect(scanned[1]).toMatchObject({ id: "claude", detectedPath: null });

    await page.getByRole("checkbox", { name: "启用 claude" }).uncheck();
    await expect(page.getByText("已保存", { exact: true })).toBeVisible();
    expect((putBodies.at(-1)?.local as { clis: { enabled: boolean }[] }).clis[1].enabled).toBe(false);

    await page.getByRole("button", { name: "拉取 pi 的模型" }).click();
    await expect(page.getByText("已获取 1 个模型。")).toBeVisible();
    expect(calls).toEqual(["scan", "cli:pi"]);

    await page.getByLabel("pi 的模型").selectOption("agnes-2.5-flash");
    await expect(page.getByText("已保存", { exact: true })).toBeVisible();
    expect((putBodies.at(-1)?.local as { clis: { selectedModel: string }[] }).clis[0].selectedModel).toBe("agnes-2.5-flash");

    await page.getByRole("article").filter({ hasText: "pi" }).getByRole("radio", { name: "设为当前 CLI" }).check();
    await expect(page.getByText("已保存", { exact: true })).toBeVisible();
    expect((putBodies.at(-1)?.local as { activeCliId: string }).activeCliId).toBe("pi");
  });

  test("模式切换持久化并在重载后保持", async ({ page }) => {
    const putBodies = await mockSettingsApi(page, storedSettings);
    await page.goto("/settings");

    await page.getByRole("radio", { name: "本地 CLI" }).check();
    await expect(page.getByText("已保存", { exact: true })).toBeVisible();
    expect(putBodies.at(-1)?.mode).toBe("local");

    await page.reload();
    await expect(page.getByRole("radio", { name: "本地 CLI" })).toBeChecked();
  });
});

test.describe("模式卡片", () => {
  test("翻译服务提供方卡片切换时不再渲染「当前生效」标签", async ({ page }) => {
    const putBodies = await mockSettingsApi(page, storedSettings);
    await page.goto("/settings");

    await expect(page.getByRole("heading", { name: "翻译服务提供方" })).toBeVisible();
    await expect(page.getByText("当前生效")).toHaveCount(0);

    await page.getByRole("radio", { name: "本地 CLI" }).check();

    await expect(page.getByRole("radio", { name: "本地 CLI" })).toBeChecked();
    await expect(page.getByText("当前生效")).toHaveCount(0);
    expect(putBodies.at(-1)?.mode).toBe("local");
  });
});

test.describe("保存反馈", () => {
  test("返回转换等待在途保存后再离开", async ({ page }) => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/api/settings", async (route) => {
      if (route.request().method() === "PUT") await gate;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(storedSettings) });
    });
    await page.goto("/settings");

    const back = page.getByRole("button", { name: "返回转换" });
    await expect(back).toBeVisible();

    await page.getByRole("radio", { name: "本地 CLI" }).check();
    await expect(page.getByText("保存中…")).toBeVisible();

    await back.click();
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/settings$/);

    release();
    await expect(page).toHaveURL(/\/$/);
  });

  test("保存成功后状态胶囊显示已保存", async ({ page }) => {
    await mockSettingsApi(page, storedSettings);
    await page.goto("/settings");

    await page.getByRole("radio", { name: "本地 CLI" }).check();

    await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  });
});

test.describe("语言与默认开关", () => {
  test("切换目标语言", async ({ page }) => {
    const putBodies = await mockSettingsApi(page, storedSettings);
    await page.goto("/settings");

    await page.getByLabel("目标语言").selectOption("ja");
    await expect(page.getByText("已保存", { exact: true })).toBeVisible();
    expect(putBodies.at(-1)?.languages).toEqual({ target: "ja", custom: [] });

    await expect(page.getByText("自动识别（由模型判定）")).toBeVisible();
  });

  test("已保存的自定义标签仍可选中，入口不再渲染", async ({ page }) => {
    const putBodies = await mockSettingsApi(page, {
      ...storedSettings,
      languages: { target: "pt-BR", custom: ["pt-BR"] },
    });
    await page.goto("/settings");

    await expect(page.getByLabel("自定义语言标签")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "添加语言" })).toHaveCount(0);
    await expect(page.getByLabel("目标语言")).toHaveValue("pt-BR");
    expect(putBodies).toHaveLength(0);
  });
});

test.describe("密钥", () => {
  test("密钥库不可用时提示失败而不是显示已配置", async ({ page }) => {
    const putBodies = await mockSettingsApi(page, {
      ...providerSettings,
      cloud: {
        providers: [{ ...providerSettings.cloud.providers[0], selectedModel: "qwen3:8b" }],
        activeProviderId: "ollama",
      },
    });
    await installBridge(page, { set: "failed" });
    await page.goto("/settings");

    const card = page.locator(CLOUD_CARD);
    await card.getByLabel("Provider 密钥").fill("sk-e2e-placeholder");
    await card.getByRole("button", { name: "保存", exact: true }).click();

    await expect(page.getByText("系统密钥库不可用，无法安全保存密钥。")).toBeVisible();
    await expect(page.getByText("未配置")).toBeVisible();
    expect(putBodies).toHaveLength(0);
  });
});

test.describe("输出", () => {
  const outputSettings: StoredSettings = {
    ...storedSettings,
    output: { defaultPath: null, useDefaultPath: false },
  };

  const savedOutputSettings: StoredSettings = {
    ...storedSettings,
    output: { defaultPath: "/Users/someone/Documents/notes", useDefaultPath: true },
  };

  async function installOutputBridge(page: Page) {
    await page.addInitScript(() => {
      const calls: unknown[][] = [];
      (window as unknown as { outputCalls: unknown[][] }).outputCalls = calls;
      const existing = (window as unknown as { mdConvertor?: Record<string, unknown> }).mdConvertor ?? {};
      (window as unknown as { mdConvertor: unknown }).mdConvertor = {
        ...existing,
        output: {
          selectDirectory: async () => {
            calls.push(["selectDirectory"]);
            return { ok: true, path: "/Users/someone/Documents/notes" };
          },
          saveFile: async (dirPath: string, filename: string, content: string) => {
            calls.push(["saveFile", dirPath, filename, content]);
            return { ok: true, path: `${dirPath}/${filename}` };
          },
        },
      };
    });
  }

  function outputCalls(page: Page) {
    return page.evaluate(() => (window as unknown as { outputCalls: unknown[][] }).outputCalls ?? []);
  }

  test("卡片渲染：未设置路径、开关关闭、桥接缺失时按钮禁用", async ({ page }) => {
    await mockSettingsApi(page, outputSettings);
    await page.goto("/settings");

    const card = page.locator('section[aria-labelledby="output-title"]');
    await expect(card.getByRole("heading", { name: "输出" })).toBeVisible();
    await expect(card.getByText("未设置")).toBeVisible();
    await expect(card.getByRole("checkbox", { name: "使用默认目录" })).not.toBeChecked();
    // No preload in the browser: choosing a directory is impossible, so the button is off.
    await expect(card.getByRole("button", { name: "选择目录" })).toBeDisabled();
    await expect(card.getByText("目录选择只能在桌面应用中使用")).toBeVisible();
  });

  test("桥接下选择目录后路径回显并写入 output", async ({ page }) => {
    const putBodies = await mockSettingsApi(page, outputSettings);
    await installOutputBridge(page);
    await page.goto("/settings");

    const card = page.locator('section[aria-labelledby="output-title"]');
    await card.getByRole("button", { name: "选择目录" }).click();

    await expect(card.getByText("/Users/someone/Documents/notes")).toBeVisible();
    await expect(page.getByText("已保存", { exact: true })).toBeVisible();
    const body = putBodies.at(-1) as { output?: { defaultPath?: string; useDefaultPath?: boolean } } | undefined;
    expect(body?.output).toEqual({ defaultPath: "/Users/someone/Documents/notes", useDefaultPath: false });
    expect(await outputCalls(page)).toEqual([["selectDirectory"]]);
  });

  test("开关开启且已有目录时保存 useDefaultPath=true", async ({ page }) => {
    const putBodies = await mockSettingsApi(page, {
      ...outputSettings,
      output: { defaultPath: "/Users/someone/Documents/notes", useDefaultPath: false },
    });
    await installOutputBridge(page);
    await page.goto("/settings");

    const card = page.locator('section[aria-labelledby="output-title"]');
    await card.getByRole("checkbox", { name: "使用默认目录" }).check();

    await expect(page.getByText("已保存", { exact: true })).toBeVisible();
    const body = putBodies.at(-1) as { output?: { defaultPath?: string; useDefaultPath?: boolean } } | undefined;
    expect(body?.output).toEqual({ defaultPath: "/Users/someone/Documents/notes", useDefaultPath: true });
  });

  test("开关开启但未设置目录时警告且不落盘", async ({ page }) => {
    const putBodies = await mockSettingsApi(page, outputSettings);
    await installOutputBridge(page);
    await page.goto("/settings");

    const card = page.locator('section[aria-labelledby="output-title"]');
    // click(), not check(): the switch deliberately refuses to change state.
    await card.getByRole("checkbox", { name: "使用默认目录" }).click();

    await expect(card.getByText("请先选择目录")).toBeVisible();
    await expect(card.getByRole("checkbox", { name: "使用默认目录" })).not.toBeChecked();
    expect(putBodies).toHaveLength(0);
  });

  test("已开启的开关关闭后写回 useDefaultPath=false", async ({ page }) => {
    const putBodies = await mockSettingsApi(page, savedOutputSettings);
    await installOutputBridge(page);
    await page.goto("/settings");

    const card = page.locator('section[aria-labelledby="output-title"]');
    await expect(card.getByText("/Users/someone/Documents/notes")).toBeVisible();
    await card.getByRole("checkbox", { name: "使用默认目录" }).uncheck();

    await expect(page.getByText("已保存", { exact: true })).toBeVisible();
    const body = putBodies.at(-1) as { output?: { defaultPath?: string; useDefaultPath?: boolean } } | undefined;
    expect(body?.output).toEqual({ defaultPath: "/Users/someone/Documents/notes", useDefaultPath: false });
  });
});
