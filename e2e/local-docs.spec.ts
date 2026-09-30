import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

import { openLocalDocs } from "./entry";
import { rectsInOneFrame } from "./geometry";

/**
 * Homepage 本地文档面板 (S3): stub bridge + temporary directories.
 *
 * The real preload only exists inside the packaged app, and the real Downloads directory must
 * stay out of every assertion (S1's route unit tests cover its resolution). So each case passes
 * explicit `input`/`output` settings pointing at `mkdtemp` directories.
 */

type StubSaveFile = "ok" | "throw" | "denied";

type SavedCall = { dirPath: string; filename: string; content: string };

type StubWindow = typeof window & {
  mdConvertor?: Record<string, unknown>;
  saved?: SavedCall[];
  opened?: string[];
};

/**
 * Installs a stand-in for the desktop preload bridge. `saveFile` can also *throw*, because the
 * real preload asserts its arguments and rejects — a stand-in that only ever resolves would
 * leave the "swallowed by `void`" failure mode untested.
 *
 * `addInitScript` only applies to documents created after it, so callers navigate afterwards.
 */
async function installBridge(
  page: Page,
  options: { saveFile?: StubSaveFile; selectDir?: string | null } = {},
): Promise<void> {
  await page.addInitScript((config) => {
    const target = window as unknown as StubWindow;
    target.saved = [];
    target.opened = [];
    target.mdConvertor = {
      ...(target.mdConvertor ?? {}),
      output: {
        selectDirectory: async () => (
          config.selectDir ? { ok: true, path: config.selectDir } : { ok: false, code: "CANCELLED" }
        ),
        saveFile: async (dirPath: string, filename: string, content: string) => {
          if (config.saveFile === "throw") {
            throw new TypeError("dirPath must be an absolute path without traversal segments.");
          }
          if (config.saveFile === "denied") return { ok: false, code: "EACCES" };
          target.saved!.push({ dirPath, filename, content });
          return { ok: true, path: `${dirPath}/${filename}` };
        },
      },
      system: {
        openPath: async (dirPath: string) => {
          target.opened!.push(dirPath);
          return { ok: true, path: dirPath };
        },
      },
    };
  }, { saveFile: options.saveFile ?? "ok", selectDir: options.selectDir ?? null });
}

type SettingsPatch = {
  input: { defaultPath: string | null };
  output: { defaultPath: string | null; useDefaultPath: boolean };
};

/**
 * Rewrites only `input`/`output` of the real settings response, and fulfils PUTs locally: the
 * e2e server shares one settings store across the whole run, so writing through PUT would leak
 * into the other engines and other specs. The PUT bodies are collected for assertions instead.
 */
async function routeSettings(
  page: Page,
  patch: SettingsPatch,
  putBodies: Record<string, unknown>[],
): Promise<void> {
  await page.route("**/api/settings", async (route) => {
    if (route.request().method() === "PUT") {
      const sent = route.request().postDataJSON() as Record<string, unknown>;
      putBodies.push(sent);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(sent) });
      return;
    }
    const fetched = await route.fetch();
    const body = (await fetched.json()) as Record<string, unknown>;
    await route.fulfill({ response: fetched, json: { ...body, ...patch } });
  });
}

/** Navigates and waits for the settings fetch: it proves React is attached, so later clicks land. */
function defaultPatch(inputDir: string, outputDir: string): SettingsPatch {
  return {
    input: { defaultPath: inputDir },
    output: { defaultPath: outputDir, useDefaultPath: false },
  };
}

let root: string;
let inputDir: string;
let outputDir: string;
let secondDir: string;

test.beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "md-convertor-local-docs-"));
  inputDir = path.join(root, "input");
  outputDir = path.join(root, "output");
  secondDir = path.join(root, "second");
  await mkdir(inputDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(inputDir, "第一篇.md"), "# 第一篇\n\n正文。\n", "utf8");
  await writeFile(path.join(inputDir, "第二篇.md"), "# 第二篇\n\n正文。\n", "utf8");
  await writeFile(path.join(inputDir, "笔记.txt"), "not markdown", "utf8");
});

test.afterEach(async () => {
  await rm(root, { force: true, recursive: true });
});

test.describe("本地文档面板", () => {
  test("从面板进设置，返回转换回到面板而不是入口画面", async ({ page }) => {
    await installBridge(page);
    await routeSettings(page, defaultPatch(inputDir, outputDir), []);
    await openLocalDocs(page);
    await expect(page.getByRole("heading", { level: 2, name: "本地文档" })).toBeVisible();

    // Both navigations must wait for the settings fetch they trigger: clicking before hydration
    // is lost, and ending the test with a stubbed fetch still in flight makes the route handler
    // call `.json()` on a disposed response.
    const settingsPageLoaded = page.waitForResponse((response) => (
      response.url().includes("/api/settings") && response.request().method() === "GET"
    ));
    await page.getByRole("link", { name: "设置" }).click();
    await expect(page).toHaveURL(/\/settings\?from=local-docs$/);
    await settingsPageLoaded;
    await page.getByRole("button", { name: "返回转换" }).click();

    await expect(page.getByRole("heading", { level: 2, name: "本地文档" })).toBeVisible();
    await expect(page.locator(`code[title="${inputDir}"]`)).toBeVisible();
    await expect(page.getByRole("button", { name: "一键转换" })).toBeVisible();
  });

  test("设置页与面板显示同一个解析后的输入目录，不回落到「系统下载目录」", async ({ page, browserName }) => {
    // Deliberately no settings stub: the server-resolved default is the whole point.
    test.skip(browserName !== "chromium", "real settings store is shared across projects");
    await installBridge(page);
    await page.goto("/settings");

    const settingsPath = page.locator('code[title^="/"]');
    await expect(settingsPath).toHaveCount(1);
    const resolved = await settingsPath.innerText();
    expect(resolved).not.toBe("系统下载目录");

    await openLocalDocs(page);
    await expect(page.getByRole("heading", { level: 2, name: "本地文档" })).toBeVisible();
    await expect(page.locator('code[title^="/"]')).toHaveText(resolved);
  });

  test("没有桥接时降级成说明文案，且不提供一键转换", async ({ page }) => {
    await openLocalDocs(page);

    await expect(page.getByText("本地文档处理只能在桌面应用中使用。")).toBeVisible();
    await expect(page.getByRole("button", { name: "一键转换" })).toHaveCount(0);
  });

  test("有桥接时列出真实扫描到的 md，勾选与翻译开关可用", async ({ page }) => {
    await installBridge(page);
    await routeSettings(page, defaultPatch(inputDir, outputDir), []);
    await openLocalDocs(page);

    await expect(page.getByText("共 2 篇 · 已处理 0 篇")).toBeVisible();
    await expect(page.getByRole("cell", { name: "第一篇.md", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "第二篇.md", exact: true })).toBeVisible();
    // A non-markdown file in the same directory must not show up.
    await expect(page.getByRole("cell", { name: "笔记.txt", exact: true })).toHaveCount(0);

    // Unprocessed documents start checked; 全选 drives the 一键转换 button.
    const first = page.getByLabel("选择 第一篇.md");
    await expect(first).toBeChecked();
    await page.getByLabel("全选").uncheck();
    await expect(first).not.toBeChecked();
    await expect(page.getByRole("button", { name: "一键转换" })).toBeDisabled();
    await page.getByLabel("全选").check();
    await expect(page.getByRole("button", { name: "一键转换" })).toBeEnabled();

    await expect(page.getByLabel("翻译产物")).toBeVisible();
    await expect(page.getByLabel("翻译产物")).not.toBeChecked();
  });

  test("「选择目录」换目录后自动重新扫描，并把新目录写进输入设置", async ({ page }) => {
    const putBodies: Record<string, unknown>[] = [];
    await mkdir(secondDir, { recursive: true });
    await writeFile(path.join(secondDir, "第三篇.md"), "# 第三篇\n", "utf8");
    await installBridge(page, { selectDir: secondDir });
    await routeSettings(page, defaultPatch(inputDir, outputDir), putBodies);
    await openLocalDocs(page);

    await expect(page.getByRole("cell", { name: "第一篇.md", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "选择目录" }).click();

    await expect(page.getByRole("cell", { name: "第三篇.md", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "第一篇.md", exact: true })).toHaveCount(0);
    expect((putBodies.at(-1)?.input as { defaultPath: string }).defaultPath).toBe(secondDir);
  });

  test("一键转换逐条写入并汇总，源文件保持不变", async ({ page }) => {
    await installBridge(page);
    await routeSettings(page, defaultPatch(inputDir, outputDir), []);
    await openLocalDocs(page);

    const runButton = page.getByRole("button", { name: "一键转换" });
    await expect(runButton).toBeEnabled();
    await runButton.click();

    await expect(page.getByText(/成功 2 篇 · 跳过 0 篇 · 失败 0 篇/)).toBeVisible();
    await expect(page.getByRole("cell", { name: "完成", exact: true })).toHaveCount(2);

    const saved = await page.evaluate(() => (window as unknown as StubWindow).saved ?? []);
    expect(saved.map((call) => call.filename).sort()).toEqual(["第一篇.md", "第二篇.md"]);
    expect(saved.every((call) => call.dirPath === outputDir)).toBe(true);
    expect(saved.every((call) => call.content.includes("md-convertor:"))).toBe(true);

    // Read-only source side: no marker was written back into the input directory.
    await expect(readFile(path.join(inputDir, "第一篇.md"), "utf8")).resolves.toBe("# 第一篇\n\n正文。\n");

    await page.getByRole("button", { name: "打开目录" }).click();
    await expect.poll(async () => page.evaluate(() => (window as unknown as StubWindow).opened ?? [])).toEqual([outputDir]);
  });

  test("未勾选时不再有提示行，表格紧贴操作区", async ({ page }) => {
    await installBridge(page);
    await routeSettings(page, defaultPatch(inputDir, outputDir), []);
    await openLocalDocs(page);

    // Nothing is checked and yet no hint is shown: the empty prompt only pushed the list away.
    await expect(page.getByText("先勾选要处理的文档。")).toHaveCount(0);

    const boxes = await rectsInOneFrame(page, {
      run: page.getByRole("button", { name: "一键转换" }),
      table: page.locator("table"),
    });
    // The list starts right under the toolbar instead of after a reserved 36px hint row.
    expect(boxes.table.y - (boxes.run.y + boxes.run.height)).toBeLessThan(24);
  });

  test("重新扫描与翻译产物同排，目录行只留选择目录与恢复默认", async ({ page }) => {
    await installBridge(page);
    await routeSettings(page, defaultPatch(inputDir, outputDir), []);
    await openLocalDocs(page);

    const boxes = await rectsInOneFrame(page, {
      translate: page.getByLabel("翻译产物"),
      toggle: page.locator("label", { has: page.getByLabel("翻译产物") }),
      rescan: page.getByRole("button", { name: "重新扫描" }),
      run: page.getByRole("button", { name: "一键转换" }),
      choose: page.getByRole("button", { name: "选择目录" }),
    });

    // Same row means the vertical centres line up; the boxes themselves are different heights.
    const center = (box: { y: number; height: number }) => box.y + box.height / 2;
    expect(center(boxes.rescan)).toBeCloseTo(center(boxes.run), 0);
    expect(center(boxes.translate)).toBeCloseTo(center(boxes.run), 0);
    // And the whole toggle sits immediately left of 重新扫描, not stranded at the far left.
    expect(boxes.rescan.x - (boxes.toggle.x + boxes.toggle.width)).toBeLessThan(40);
    // 重新扫描 left the directory row's actions, so the two rows no longer share a centre line.
    expect(Math.abs(center(boxes.choose) - center(boxes.rescan))).toBeGreaterThan(10);
  });

  test("目录长路径单行省略，完整值挂在 title，按钮仍与它同排", async ({ page }) => {
    const longDir = path.join(root, "长".repeat(80));
    await mkdir(longDir, { recursive: true });
    await writeFile(path.join(longDir, "长.md"), "# 长\n", "utf8");
    await installBridge(page);
    await routeSettings(page, defaultPatch(longDir, outputDir), []);
    await openLocalDocs(page);

    const pathCode = page.locator("code").filter({ hasText: longDir });
    await expect(pathCode).toHaveAttribute("title", longDir);

    const style = await pathCode.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        whiteSpace: computed.whiteSpace,
        textOverflow: computed.textOverflow,
        truncated: element.scrollWidth > element.clientWidth,
        height: Math.round(element.getBoundingClientRect().height),
      };
    });
    expect(style.whiteSpace).toBe("nowrap");
    expect(style.textOverflow).toBe("ellipsis");
    expect(style.truncated).toBe(true);
    // One 12.5px line: a wrapped path would be several lines tall and push the buttons down.
    expect(style.height).toBeLessThan(24);

    const boxes = await rectsInOneFrame(page, {
      path: pathCode,
      choose: page.getByRole("button", { name: "选择目录" }),
    });
    const center = (box: { y: number; height: number }) => box.y + box.height / 2;
    expect(center(boxes.choose)).toBeCloseTo(center(boxes.path), 0);
  });

  test("已处理的文档默认不勾选，勾选它就等于重做（不再有单独的重新处理按钮）", async ({ page }) => {
    // Only the processed document, so the run button's state reflects this row alone.
    await rm(path.join(inputDir, "第二篇.md"), { force: true });
    const source = path.join(inputDir, "第一篇.md");
    const outputPath = path.join(outputDir, "第一篇.md");
    const stats = await stat(source);
    // The marker line alone decides the row's state, so a hand-written one is a real "已处理".
    await writeFile(
      outputPath,
      `<!-- md-convertor: ${JSON.stringify({
        source,
        size: stats.size,
        mtimeMs: stats.mtimeMs,
        sha256: "0".repeat(64),
        outputPath,
        processedAt: "2026-09-29T00:00:00.000Z",
      })} -->\n\n# 第一篇\n\n正文。\n`,
      "utf8",
    );

    await installBridge(page);
    await routeSettings(page, defaultPatch(inputDir, outputDir), []);
    await openLocalDocs(page);

    const runButton = page.getByRole("button", { name: "一键转换" });
    await expect(page.getByText("共 1 篇 · 已处理 1 篇")).toBeVisible();
    await expect(page.getByRole("cell", { name: "已处理", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "重新处理" })).toHaveCount(0);
    await expect(page.getByLabel("选择 第一篇.md")).not.toBeChecked();
    await expect(runButton).toBeDisabled();

    await page.getByLabel("选择 第一篇.md").check();
    await expect(runButton).toBeEnabled();
    await runButton.click();

    await expect(page.getByText(/成功 1 篇 · 跳过 0 篇 · 失败 0 篇/)).toBeVisible();
    await expect(page.getByRole("cell", { name: "完成", exact: true })).toBeVisible();
    const saved = await page.evaluate(() => (window as unknown as StubWindow).saved ?? []);
    expect(saved.map((call) => call.filename)).toEqual(["第一篇.md"]);
  });

  test("转换结果：数量一行、输出目录一行、打开目录在右侧", async ({ page }) => {
    await installBridge(page);
    await routeSettings(page, defaultPatch(inputDir, outputDir), []);
    await openLocalDocs(page);

    await page.getByRole("button", { name: "一键转换" }).click();
    await expect(page.getByText(/成功 2 篇 · 跳过 0 篇 · 失败 0 篇/)).toBeVisible();

    const boxes = await rectsInOneFrame(page, {
      counts: page.getByText(/成功 2 篇 · 跳过 0 篇 · 失败 0 篇/),
      dir: page.locator("code").filter({ hasText: outputDir }),
      open: page.getByRole("button", { name: "打开目录" }),
    });
    // The counts no longer carry the directory: it has its own line underneath.
    expect(boxes.dir.y).toBeGreaterThan(boxes.counts.y + boxes.counts.height - 2);
    // The button sits to the right of the two lines, not under them.
    expect(boxes.open.x).toBeGreaterThan(boxes.dir.x + boxes.dir.width);
    const center = (box: { y: number; height: number }) => box.y + box.height / 2;
    expect(center(boxes.open)).toBeGreaterThan(boxes.counts.y);
    expect(center(boxes.open)).toBeLessThan(boxes.dir.y + boxes.dir.height);
  });

  test("输出目录与输入目录相同时被拒绝，建议按钮改的是输出设置", async ({ page }) => {
    const putBodies: Record<string, unknown>[] = [];
    await installBridge(page);
    await routeSettings(
      page,
      { input: { defaultPath: inputDir }, output: { defaultPath: inputDir, useDefaultPath: false } },
      putBodies,
    );
    await openLocalDocs(page);

    await expect(page.getByText(/输出目录和输入目录是同一个目录/)).toBeVisible();
    await expect(page.getByRole("button", { name: "一键转换" })).toBeDisabled();

    await page.getByRole("button", { name: `改用 ${inputDir}/processed` }).click();

    await expect(page.getByText(/输出目录和输入目录是同一个目录/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "一键转换" })).toBeEnabled();
    expect((putBodies.at(-1)?.output as { defaultPath: string }).defaultPath).toBe(`${inputDir}/processed`);
  });

  test("桥接抛异常时逐行给出可读报错，不静默", async ({ page }) => {
    await installBridge(page, { saveFile: "throw" });
    await routeSettings(page, defaultPatch(inputDir, outputDir), []);
    await openLocalDocs(page);

    await page.getByRole("button", { name: "一键转换" }).click();

    await expect(page.getByText(/失败 2 篇/)).toBeVisible();
    await expect(
      page.getByRole("cell", { name: /处理失败（dirPath must be an absolute path without traversal segments./ }),
    ).toHaveCount(2);
  });

  test("写盘失败时显示 fs 码的中文文案，不显示原始 errno", async ({ page }) => {
    await installBridge(page, { saveFile: "denied" });
    await routeSettings(page, defaultPatch(inputDir, outputDir), []);
    await openLocalDocs(page);

    await page.getByRole("button", { name: "一键转换" }).click();

    await expect(page.getByRole("cell", { name: "处理失败（没有写入权限。）" })).toHaveCount(2);
    await expect(page.getByText("EACCES")).toHaveCount(0);
  });
});
