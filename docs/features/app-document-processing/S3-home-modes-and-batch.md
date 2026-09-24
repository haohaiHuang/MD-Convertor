# S3 — 首页模式选择器与批量编排（Spec / Plan / Tasks）

- 上游：`docs/features/app-document-processing/FSD.md`（§4.1 模式选择、§4.5 翻译、§4.6 写盘与去重、§4.7 反馈）
- 前置：**S1 + S2 已完成**（设置与扫描路由、`processLocalDoc` 的返回形状）
- 状态：**未开始**
- feature_list id：`feat-042`
- 本阶段是本块的「用户看得见」部分：首页多一个模式选择器与插件下载按钮，多一个本地文档面板，多一条批量处理路径。**现有单篇流程的行为与布局一行不改**。

---

## Spec

**目标**：用户在首页顶部二选一；选「转换既有文档」→ 自动按设置里的输入目录扫出 `.md` 列表 → 勾选 → 「一键转化」→ 每行推进状态 → 收尾汇总（成功/跳过/失败 + 输出路径 + 打开目录）。

**关键决定**：

1. **默认模式仍是现在的「粘贴 · 链接转换」**（FSD V1）：`mode` 初值 `"convert"`；`e2e/home.spec.ts` 的像素锁与 `rectsInOneFrame` 断言必须保持绿（切换前 DOM 与现在一致）。
2. 选择器放 `src/app/page.tsx` 顶部（复用现有 `modeTabs` 的样式与 `role="tablist"` 键盘模型）；内层「链接 / 富文本」两个 tab 只在 `convert` 模式下显示。
3. **面板不在 `page.tsx` 里写**（该文件已 1040 行）：新组件 `src/app/local-docs/panel.tsx` + `panel.module.css` + `client.ts`；`page.tsx` 只多「模式状态 + 条件渲染」约 20 行。
4. 可测逻辑（批次状态机、一批的计划与拒绝条件、fs 码文案）放 `src/app/local-docs/client.ts` 与 `src/lib/local-docs/batch.ts` 的纯函数里，**不放组件**（口径同扩展的 `worker-run.ts`）。
5. 选目录 = 写**同一个** `Settings.input.defaultPath`（与设置页是同一个值，不是第二个目录）；选完自动重新扫描。
6. 输出目录 = 设置里**已有的** `output.defaultPath`；为 `null` 时「一键转化」禁用并说明原因。
7. **源 = 输出 ⇒ 拒绝**，给一键按钮写 `<输入目录>/processed` 到输出设置，然后重新扫描（⑥）。
8. 跳过：`state === "skip"` 的行不发起处理请求，直接给「已处理，跳过」；每行一个「重新处理」（`force`）逃生口。
9. 串行：一次处理一条（先写完再下一条）；单条失败只标记该行，不中断后续。
10. 写盘：逐条 `outputBridge().saveFile(outputDir, filename, markdown)`，**每个 `await bridge.*` 都要 `.catch()`**（preload 的校验函数是抛异常，不是 resolve `{ok:false}`）——否则表现为「点了没反应」。
11. 「打开目录」需要一个新的 IPC 通道：新增 `electron/system.mjs` 的 `md-convertor:system:open-path`（主进程 `shell.openPath`，同样校验绝对路径 + 拒绝 `..` 段，`shell.openPath` 的失败值要回给渲染层）；沿用 `.catch()` 纪律。这是本块**唯一新增**的 IPC 面（系统下载目录不走这里，见 FSD V6）。
12. 无桥接（浏览器里打开）⇒ 面板整体降级成说明文案 + 禁用，与设置页「输出」卡片同款口径；插件下载按钮仍可用（静态资源）。
13. e2e **不得读真实下载目录**：默认目录的解析由 S1 的路由单测（注入环境变量）验证；e2e 一律显式传 `dirPath`，用 `mkdtemp` 出来的临时目录。桥接桩要能**抛**（feat-041 的教训：桩不抛就抓不到被 `void` 吞掉的异常）。

---

## Plan

### T3.0 首页模式选择器 + 插件下载按钮

`src/app/page.tsx`：

```
[ 转换既有文档（本地 md 批量） | 粘贴 · 链接转换 ]   ← 新增，默认选右边
        ↓ 选择器下方一行
[ ⤓ 下载浏览器插件 ]                                 ← 新增
```

- 选择器：`role="tablist"` + 两个 `role="tab"` 按钮（`aria-selected`、左右方向键），复用 `modeTabs` 类名；
- 插件按钮：`<a href="/md-convertor-extension.zip" download>`（静态资源；ZIP 由 S4 产出，本阶段先按「存在与否都要能点」写，e2e 只在 S4 之后断言文件本身）；
- `mode === "local-docs"` 时渲染 `<LocalDocsPanel/>`，否则渲染现有全部内容（一字不改）。

**RED**：`e2e/home.spec.ts` 追加：① 默认选中「粘贴 · 链接转换」且 URL 输入框可见；② 点「转换既有文档」后出现本地文档面板、URL 输入框不再可见；③ 切回后像素锁那三条断言仍绿；④ 插件按钮 `href` 与 `download` 属性正确 ⇒ failed。

**完成条件**：新用例绿 + **既有像素锁用例一字未改且绿**。

### T3.1 本地文档面板（无桥接降级 + 目录行 + 列表 + 勾选 + 翻译开关）

`src/app/local-docs/panel.tsx`：

- 顶部目录行：当前目录（`input.defaultPath ?? 扫描返回的 downloadsDir`）、「选择目录」、「重新扫描」、状态胶囊（文件数 / 已处理数）；
- 列表：文件名 + 大小 + 修改时间 + 状态（`新` / `已处理` / `已改变`）+ 勾选框；**已处理的默认不勾选**；表头「全选 / 全不选」；
- 内联翻译开关：复用首页现有的 `translateEnabled` 状态（同一个 state、同一个初值来源），**不新增设置项**；
- 「一键转化」按钮 + 禁用原因；错误（fs 码）用 `OUTPUT_CODE_MESSAGES` 文案显示，不显示原始 errno 文本；
- 无桥接：整块替换为「本地文档处理只能在桌面应用中使用」+ 禁用（与设置页一致）。

**RED**：`e2e/local-docs.spec.ts` 两条：无预加载 ⇒ 降级文案 + 按钮 disabled；有桥接桩（`addInitScript` 注入 `selectDirectory`/`saveFile`）⇒ 面板显示扫描结果（用临时目录里的 2 个 `.md` + 1 个 `.txt`，`.txt` 不在列表里）、勾选/全选可用、翻译开关存在 ⇒ failed。

**完成条件**：两条绿；列表内容来自**真实的** `/api/local-docs/scan`（只桩桥接，不桩路由）。

### T3.2 批次纯逻辑（计划 + 状态机 + 汇总）

`src/lib/local-docs/batch.ts`（服务端/客户端共用的纯函数）：

- `planBatch(files, { inputDir, outputDir, hasBridge })` → `{ rows, refusal?: "same-dir" | "no-output" | "no-bridge" }`（`same-dir` 时附带建议目录 `<inputDir>/processed`）；
- `applyRowStatus(rows, id, patch)` / `summarize(rows)` → `{ done, skipped, failed, embeddedImages, keptImages }`；
- `nextPending(rows, forced)` → 下一条要处理的（尊重 `force` 与 `skip`）。

**RED**：`src/lib/local-docs/batch.test.ts`：拒绝三态各一条；`summarize` 计数正确；`nextPending` 跳过 `skip` 项但尊重 `force`；`planBatch` 不改动入参 ⇒ 模块不存在，failed。

**完成条件**：全部绿。

### T3.3 一键转化（串行编排 + 逐条状态 + 汇总 + 打开目录）

`src/app/local-docs/client.ts` 的 `runBatch(rows, ctx)`（注入 `processDoc` / `saveFile` / `now`，便于单测）+ 面板接线：

- 逐条：`POST /api/local-docs/process`（带 `outputPath` 与 `force`）→ `skipped` ⇒ 行「已处理，跳过」；成功 ⇒ `saveFile(outputDir, filename, markdown)`（`.catch()` 记为该行失败）⇒ 行「完成（内嵌 N 张，保留 M 张）」；抛错 ⇒ 行「失败（原因）」并继续；
- 结束后一行汇总 `成功 N · 跳过 N · 失败 N` + 输出路径 + 「打开目录」（`system.openPath`，失败值给可读提示）；
- `aria-live="polite"` 只在汇总行（无障碍基本项；不做进度条）。

**RED**：① `src/app/local-docs/client.test.ts`（jsdom + 注入 fake）：串行顺序、单条失败不中断、`skip` 不发请求、`saveFile` 抛异常 ⇒ 该行失败且继续、汇总计数正确；② `e2e/local-docs.spec.ts` 追加：临时输入目录 + 桩桥接 + 桩设置（只改写 `input`/`output` 的响应）⇒ 点「一键转化」后逐行变「完成」、汇总出现、产物内容进 `saveFile` 桩；③ 把输出目录设成输入目录 ⇒ 出现拒绝文案 + 建议按钮，点后输出目录变成 `<输入>/processed`；④ 桥接桩**抛异常**时界面有可读报错（不静默）。

**完成条件**：全部绿；e2e 里没有任何断言碰真实下载目录或真实设置文件。

### T3.4 阶段收尾

`./init.sh` 全绿 + `npm run test:e2e` 全绿；`docs/TESTING.md` 补一节「桌面端本地文档处理」（哪些进 `init.sh`、e2e 用临时目录与桩桥接的口径、不碰真实 Downloads 的原因）；`CHANGELOG.md`/`.zh.md` 的 `[Unreleased]` 加用户可见条目（首页模式选择器、本地文档批量处理、插件下载）；`feature_list.json` 记录证据。

---

## Tasks

| id | 任务 | RED（先写失败测试） | 完成条件 | 验证 |
| --- | --- | --- | --- | --- |
| T3.0 | 首页模式选择器 + 插件下载按钮 | `e2e/home.spec.ts` 4 条新用例（默认模式、切换、切回后像素锁仍绿、插件链接属性）⇒ failed | 新用例绿 + 既有像素锁用例未改动且绿 | `npx playwright test --project=chromium -g "模式"` |
| T3.1 | 本地文档面板（降级态 + 目录行 + 列表 + 勾选 + 翻译开关） | `e2e/local-docs.spec.ts` 2 条 ⇒ failed | 两条绿；列表来自真实扫描路由 | `npx playwright test --project=chromium -g "本地文档"` |
| T3.2 | 批次纯逻辑 `batch.ts`（计划/拒绝三态/汇总/下一条） | `batch.test.ts` ⇒ 模块不存在，failed | 全部绿 | `npx vitest run src/lib/local-docs/batch.test.ts` |
| T3.3 | 串行编排 `runBatch` + 状态 + 汇总 + 打开目录（含新 IPC 通道） | `client.test.ts`（注入 fake）与 e2e 追加 3 条 ⇒ failed | 全部绿；桩要能抛且被接住 | `npx vitest run src/app/local-docs/client.test.ts` + `npx playwright test --project=chromium -g "一键转化"` |
| T3.4 | 阶段收尾 | — | `./init.sh` 全绿 + `npm run test:e2e` 全绿；`docs/TESTING.md`/CHANGELOG/feature_list 同步 | `NODE_OPTIONS= ./init.sh && npm run test:e2e` |

## Result

**未开始**。

## Handoff

- 本阶段结束时，A 的四条主路径（扫描 / 勾选 / 一键转化 / 汇总）都有了自动化证据；留给 S4 的是「真对话框 + 真落盘 + 真翻译 + 断网开产物」这四类只能人工验的东西，加上插件分发包。
- `electron/system.mjs` 是本块唯一的 IPC 新增面；`preload.cjs` 与 `preload-contract.cjs` 要同步（与 `output.mjs` 同款做法），T1.3 的 parity 测试要覆盖新通道的路径校验。
- 面板里所有 `await bridge.*` 必须 `.catch()`；e2e 的桩必须能抛，否则这条纪律没有证据。
- `npm run test:e2e` 是门禁不是内循环（约两分钟、`workers: 1`）：迭代用 `npx playwright test --project=chromium -g "…"`，且**先清代理环境变量**。
