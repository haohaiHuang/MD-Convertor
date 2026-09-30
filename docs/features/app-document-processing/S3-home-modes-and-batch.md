# S3 — 首页模式选择器与批量编排（Spec / Plan / Tasks）

- 上游：`docs/features/app-document-processing/FSD.md`（§4.1 模式选择、§4.5 翻译、§4.6 写盘与去重、§4.7 反馈）
- 前置：**S1 + S2 已完成**（设置与扫描路由、`processLocalDoc` 的返回形状）
- 状态：**已完成（2026-09-29，T3.0–T3.4 全绿）**；版本面保持 `0.3.7`（未发布），本轮不加版本号
- feature_list id：`feat-042`
- 本阶段是本块的「用户看得见」部分：首页多一个模式选择器与插件下载按钮，多一个本地文档面板，多一条批量处理路径。**现有单篇流程的行为与布局一行不改**。

---

## Spec

**目标**：用户在首页顶部二选一；选「转换既有文档」→ 自动按设置里的输入目录扫出 `.md` 列表 → 勾选 → 「一键转换」→ 每行推进状态 → 收尾汇总（成功/跳过/失败 + 输出路径 + 打开目录）。

**关键决定**：

1. **默认模式仍是现在的「粘贴 · 链接转换」**（FSD V1）：`mode` 初值 `"convert"`；`e2e/home.spec.ts` 的像素锁与 `rectsInOneFrame` 断言必须保持绿（切换前 DOM 与现在一致）。
2. 选择器放 `src/app/page.tsx` 顶部（复用现有 `modeTabs` 的样式与 `role="tablist"` 键盘模型）；内层「链接 / 富文本」两个 tab 只在 `convert` 模式下显示。
3. **面板不在 `page.tsx` 里写**（该文件已 1040 行）：新组件 `src/app/local-docs/panel.tsx` + `panel.module.css` + `client.ts`；`page.tsx` 只多「模式状态 + 条件渲染」约 20 行。
4. 可测逻辑（批次状态机、一批的计划与拒绝条件、fs 码文案）放 `src/app/local-docs/client.ts` 与 `src/lib/local-docs/batch.ts` 的纯函数里，**不放组件**（口径同扩展的 `worker-run.ts`）。
5. 选目录 = 写**同一个** `Settings.input.defaultPath`（与设置页是同一个值，不是第二个目录）；选完自动重新扫描。
6. 输出目录 = 设置里**已有的** `output.defaultPath`；为 `null` 时「一键转换」禁用并说明原因。
7. **源 = 输出 ⇒ 拒绝**，给一键按钮写 `<输入目录>/processed` 到输出设置，然后重新扫描（⑥）。
8. 跳过：`state === "skip"` 的行不发起处理请求，直接给「已处理，跳过」；逃生口是重新勾选该行（`force`）——2026-09-30 起不再有单独的「重新处理」按钮（L4）。
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
- 「一键转换」按钮 + 禁用原因；错误（fs 码）用 `OUTPUT_CODE_MESSAGES` 文案显示，不显示原始 errno 文本；
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

### T3.3 一键转换（串行编排 + 逐条状态 + 汇总 + 打开目录）

`src/app/local-docs/client.ts` 的 `runBatch(rows, ctx)`（注入 `processDoc` / `saveFile` / `now`，便于单测）+ 面板接线：

- 逐条：`POST /api/local-docs/process`（带 `outputPath` 与 `force`）→ `skipped` ⇒ 行「已处理，跳过」；成功 ⇒ `saveFile(outputDir, filename, markdown)`（`.catch()` 记为该行失败）⇒ 行「完成」（内嵌/保留的张数**只在汇总行**给出——2026-09-30 第六轮 R7 把行内那两个数字搬走）；抛错 ⇒ 行「失败（原因）」并继续；
- 结束后一行汇总 `成功 N · 跳过 N · 失败 N` + 输出路径 + 「打开目录」（`system.openPath`，失败值给可读提示）；
- `aria-live="polite"` 只在汇总行（无障碍基本项；不做进度条）。

**RED**：① `src/app/local-docs/client.test.ts`（jsdom + 注入 fake）：串行顺序、单条失败不中断、`skip` 不发请求、`saveFile` 抛异常 ⇒ 该行失败且继续、汇总计数正确；② `e2e/local-docs.spec.ts` 追加：临时输入目录 + 桩桥接 + 桩设置（只改写 `input`/`output` 的响应）⇒ 点「一键转换」后逐行变「完成」、汇总出现、产物内容进 `saveFile` 桩；③ 把输出目录设成输入目录 ⇒ 出现拒绝文案 + 建议按钮，点后输出目录变成 `<输入>/processed`；④ 桥接桩**抛异常**时界面有可读报错（不静默）。

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
| T3.3 | 串行编排 `runBatch` + 状态 + 汇总 + 打开目录（含新 IPC 通道） | `client.test.ts`（注入 fake）与 e2e 追加 3 条 ⇒ failed | 全部绿；桩要能抛且被接住 | `npx vitest run src/app/local-docs/client.test.ts` + `npx playwright test --project=chromium -g "一键转换"` |
| T3.4 | 阶段收尾 | — | `./init.sh` 全绿 + `npm run test:e2e` 全绿；`docs/TESTING.md`/CHANGELOG/feature_list 同步 | `NODE_OPTIONS= ./init.sh && npm run test:e2e` |

## Result

**S3 已完成（2026-09-29，T3.0–T3.4 全绿）**；版本面保持 `0.3.7`（未发布，未跑 `desktop:release`）。本阶段是 A 块第一次真正写盘：唯一写盘出口是既有 `outputBridge().saveFile()`，服务端仍然只读。

| id | 交付 | RED → GREEN 证据 |
| --- | --- | --- |
| T3.0 | 首页模式选择器（`转换既有文档` / `粘贴 · 链接转换`）+ 插件下载链接（`src/app/page.tsx`、`page.module.css`） | RED：把 UI 四处文件 stash 掉并重建后，`npx playwright test --project=chromium e2e/home.spec.ts e2e/local-docs.spec.ts` = **11 failed / 21 passed**（4 条模式用例全红，`getByRole('tab', { name: '粘贴 · 链接转换' })` 找不到）；GREEN：同一命令 **32 passed** |
| T3.1 | `src/app/local-docs/panel.tsx` + `panel.module.css`（降级态 / 目录行 / 列表 / 勾选 / 翻译开关 / 打开目录） | RED 同上（7 条面板用例全红）；GREEN：`e2e/local-docs.spec.ts` 7 条绿。列表来自**真实** `/api/local-docs/scan`（只桩桥接，不桩路由） |
| T3.2 | `src/lib/local-docs/batch.ts`（`planBatch` / 拒绝三态 / `applyRowStatus` / `nextPending` / `summarize` / `isSameDirectory` / `processedOutputDir`） | RED：`Cannot find module './batch'`；GREEN：`npx vitest run src/lib/local-docs/batch.test.ts` = **17 passed** |
| T3.3 | `src/app/local-docs/client.ts`（`scanDirectory` / `processDocument` / `runBatch` / `errorText`）、`electron/system.mjs` 的 `md-convertor:system:open-path`、preload 三处同步 | RED：`Failed to load url ./client` 与 `Failed to load url ./system.mjs`（后者无测试可跑）；`preload.test.cjs` 在通道与 `system` 桥未同步时 **11 failed + 1 contract 失败**；GREEN：`client.test.ts` **11 passed**、`electron/system.test.mjs` **13 passed**、`npx vitest run electron/preload.test.cjs electron/preload-contract.test.cjs electron/system.test.mjs tests/forge-package-scope.test.ts` = **134 passed (4 files)** |
| T3.4 | 阶段收尾 | `NODE_OPTIONS= ./init.sh` exit 0（Node 24.15.0，**91 files / 1233 tests**，较 S2 基线 88/1180 增 3 文件 53 例）；`npm run test:e2e` = **278 passed / 4 skipped / 0 failed**（本轮 V3 那条 firefox 用例也过了，见下）；`tsc --noEmit` 与 eslint 干净 |

**e2e 的写盘与隔离口径**：桥接桩用 `addInitScript` 注入，`saveFile` 三种模式（写入并记录 / `{ok:false,code:"EACCES"}` / **抛 `TypeError`**）；输入输出目录都是 `mkdtemp` 临时目录；设置只改 GET 响应的 `input`/`output` 字段，**PUT 在路由层本地兑现**（不落真实设置文件，因为 e2e 全 project 共用一个设置存储）；没有任何断言碰真实 Downloads。

**过程中发现并修掉的一处新失败（不是 V3）**：firefox 上「切到「转换既有文档」」等 4 条新用例首轮红——点击发生在一个**尚未 hydrate** 的 SSR 按钮上，监听器还没接上，点击被丢弃（chromium/webkit 恰好够快）。修法是先等 `/api/settings` 的 GET 响应（页面自己的挂载副作用）再点，`--repeat-each=3` 在 firefox 上 **96 passed** 复验。这是 SSR + 客户端状态固有的窗口，不是缺陷；`e2e/local-docs.spec.ts` 的 `openLocalDocs` 从一开始就等这一拍，所以从没红过。

**超过任务表、必须声明的选择**：

- 外层 tab 文案去掉了任务表里的括注，只留「转换既有文档」（括注里的「本地 md 批量」移进面板副标题）：390px 视口下带括注会折行。
- `paste.spec.ts:261` 的 `getByRole("tab", { name: "链接转换" })` 补了 `exact: true`：外层「粘贴 · 链接转换」是它的子串，Playwright 的 name 匹配默认是子串匹配，不补就是 strict-mode 冲突。这是新文案带来的**测例侧**一词改动，断言意图未变。
- `nextPending(rows)` 只收一个参数（是否强制在行上），任务表写的是 `nextPending(rows, forced)`：`forced` 本身就是行的属性，再传一次会有两个真相源。
- 桥接探测用 `useSyncExternalStore`（`loading` → `ready` / `absent`）而不是「挂载后 `useEffect` 里 setState」：后者既违反 `react-hooks/set-state-in-effect`，又会让首屏闪一下降级文案。服务端快照返回 `loading`，面板在 hydrate 前渲染 `null`。
- 面板多了一个「恢复默认」按钮（把 `input.defaultPath` 写回 `null`）：FSD 的人工验收清单第 8 条要求它，而面板是本阶段交付物。六行代码。
- `openPath` 的失败只回一个码（`OPEN_PATH_FAILED`），原始 OS 文案只进 `console.warn`：全仓库对渲染进程一律不泄漏原始 errno 文本，这条也照办。
- `tests/forge-package-scope.test.ts` 的排除清单加了 `electron/system.test.mjs`（新增的运行时模块测试文件），与另外三个 preload/output 测试同列。

**未做**：未跑 `desktop:release`（发布 `0.3.7` 未获授权）、未 push、未开工 S4、未动任何历史 tag/ZIP；V3（firefox `home.spec.ts:108`）未修（本轮它自己过了，属既有 flake）。

**2026-09-29 追改（真机反馈，S4 轮内完成）**：实现成「顶部 tablist + 默认落在转换画面」与本文件 §Spec 第 1/2 条一致，但与用户想要的**入口画面**不一致。用户裁定：FSD 第 51 行原话「一开始的选择画面」才是本意（本轮回归入口画面，§Spec 第 1/2 条作废，以本段为准）。落地：`homeMode: "home" | "convert" | "local-docs"`，`"home"` 为初值；入口画面＝两张卡片 + 底部插件链接；二级画面页头「← 返回」；删掉外层 `role="tablist"`/`aria-controls`/`handleHomeModeTabKeyDown`（互斥早返回下 tab 语义不成立）；刷新 / 重开回到入口画面（接受，不写 sessionStorage）。测例侧新增 `e2e/entry.ts`（`gotoHydrated` / `gotoConverter` / `openLocalDocs`），并把「默认仍落在转换画面」的旧断言换成入口画面断言（详见 `feature_list.json` 的 feat-042 verification 与 `docs/QUALITY-AUDIT.md` 第十四轮）。

**2026-09-30 追改（真机反馈第四轮）**：T3.1 的形状有四处变化——①顶部目录行不再含「重新扫描」（它移进工具栏，与「翻译产物」「一键转换」同排，顺序 翻译产物 → 重新扫描 → 一键转换）；②「先勾选要处理的文档。」这类提示行**不再常驻占位**，只在有真实信息（缺桥 / 未设置输出目录）时渲染，所以未勾选时列表紧贴操作区；③收尾区改为数量一行 + 输出目录一行 + 「打开目录」在右侧；④路径回显改为单行 + 省略号 + `title`。用户两条无法复现的报告（返回设置来源、设置页显示「系统下载目录」）只加钉住用例，未改机制（详见 `S4-…md` §第四轮）。

## Handoff

- S4 从本阶段拿到的形状：`planBatch` 的 `refusal` 三态与 `suggestedOutputDir`、`runBatch(rows, ctx)` 的注入面（`processDoc` / `saveFile` / `onRows`）、以及既有设置页面上的「输入」卡片。S4 只补人工验收与插件分发包，不需要重写批量编排。
- **一个 `saveFile` 出口**：面板里所有写盘都经 `runBatch` → `outputBridge().saveFile()`，别再开第二条；e2e 桩的三种模式（成功 / fs 码 / 抛出）就是这条纪律的证据。
- 外层模式选择器是**新增**的一层 tablist，和内层的「链接转换 / 富文本转换」是两层同名碰撞区：任何新断言用 `exact: true`，或换更长的选择器。
- 客户端模块（`batch.ts` / `client.ts` / `panel.tsx`）会被打进浏览器包：**不许 import `node:*`**，跨端只用 `import type`。
- UI 相关 e2e 一律先等 `/api/settings` 的 GET 再点击（`gotoHydrated`）：SSR 页面上「点了没反应」在这套装置里通常是 hydration 未完成，不一定是产品缺陷。
- `npm run test:e2e` 是门禁不是内循环（约两分钟、`workers: 1`）：迭代用 `npx playwright test --project=chromium -g "…"`，且**先清代理环境变量**；源码改动后必须先 `npm run build`（`npx playwright test` 不重建）。
