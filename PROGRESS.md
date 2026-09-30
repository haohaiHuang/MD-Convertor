# Project Progress

## Current State

- Last updated: 2026-09-30（**第十九轮收尾：行状态只报状态 + `feat-042` 关闭**——R7 已按 TDD 改（`panel.tsx` 的 `done` 分支，RED 1 failed → GREEN 14 passed），张数改由汇总行给出；spec 随之改：FSD §4.7/§4.4、S3、S4（新增 §第六轮 + 验收表第 12 条改写）。**用户已在真机跑完全部 12 条人工验收并口头签字（「真机测试OK」）**，因此 `feat-042` 已置 `done`（2026-09-30），这是本阶段最后一个待办。门禁 `./init.sh` exit 0 + e2e 306/6/0；构建 572 M、PID 60736。**新发现（未修，待用户裁决）**：`.app` 里 `Resources/server` 是整仓镜像副本（清 `out/`/`.desktop` 后 572 M））
- Current version: `0.3.7`（**开发中，未发布**）。最后一个已发布版本是 `0.3.6`（GitHub Release `v0.3.6`，2026-09-22；产物 235,956,668 bytes / SHA-256 `9b89d55c…f351`；已装到本机 `/Applications`）。**发布 `0.3.7` 未获授权**（`desktop:release` 的目标版本已随 S1 T1.0 改成 `0.3.7`，但要不要发布由用户单独下指令；脚本仍会逐个校验历史 ZIP）
- Active feature: **无**。`feat-042`（A 桌面端「文档处理」）**已于 2026-09-30 置 `done` 并关闭**（S1–S4 全部实施完成，12 条真机人工验收由用户跑完后签字；阶段文档在 `docs/features/app-document-processing/`）。`feat-040`（B 浏览器插件）已于同日关闭（S1/S2/S3 完成、T3.4 人工验收 6 条全过）；`feat-041` 已完成、已发布、已关闭。
- Next step: **现役事项已清空，等用户下一条指令**。可选项（均需单独授权，按当前证据排序）：① 跑 `desktop:release` 发布 `0.3.7`（脚本目标版本已是 `0.3.7`，未获授权；发布前要重跑门禁）；② 收窄打包镜像（`scripts/prepare-desktop.mjs` 只拷 `server.js` / `.next` / `node_modules` / `public` / `browser` + 守卫测试，属另开一轮）；③ `extension/` 写方 percent-encode 文件名（B1 只修了读方）；④ 云端 Provider 端到端实测（需真实文章）。**不要再 bump 版本**（已是 `0.3.7`）、**不要重写第二套批量编排或第二条写盘路径**、commit 待指示。
- Branch: `main`，**本地领先 `origin/main` 1 个提交**（第十轮 A 规划定稿，已提交未 push；自指的 commit hash 故意不写——每次 amend 都会变）；**S1、S2、S3、S4 的全部改动尚未提交**（用户指示「commit 等另行指示」）；上一个推送点是 B 插件整条线路（已推 `24bf00f` → `335e0d4`，16 个提交）；**stash 列表本轮验证为空**（`git stash list` 无输出，那条「2026-09-21 文档备份」在本轮之前就已不在；本轮临时用过的 stash 已 pop 掉）
- Scope: unsigned Apple Silicon Mac personal-test application; macOS 12.0+（桌面产物）；浏览器插件另行验收于 Chromium，不进桌面发布门禁

## 本轮（2026-09-30 第十九轮：行状态只报状态 + `feat-042` 关闭）

- **用户报告 1 条（R7）**：「某篇文章转换后，里边的状态显示状态就好（例如已完成），不要显示什么内嵌图片数量什么的」。
- **改动（TDD）**：`src/app/local-docs/panel.tsx` 的 `statusLabel` 把 `done` 分支由「完成（内嵌 N 张，保留 M 张）」改成 `return "完成"`；数据层没动（`client.ts` 仍把 `status.embedded` / `status.kept` 存进 `BatchSummary`），**张数搬到汇总行**（`countsText()` 的 `内嵌图片 N 张 · 未内嵌 M 张`），失败行仍带原因。RED：`e2e/local-docs.spec.ts` 两处断言改成 `getByRole("cell", { name: "完成", exact: true })`（必须 `exact`，否则子串匹配在旧文案下会误绿）→ chromium 1 failed；GREEN：该文件 14 passed。
- **这推翻了 FSD §4.7 的「每行状态」与 §4.4 的「已知命中」原裁定**（原口径要求行内写出 N/M，防 ≥30 图长文的用户以为图丢了）；已按用户新口径同步 FSD（两处）、S3 的 `## Result` 行、S4（新增 §第六轮 + 两张验收表的第 12 条）、CHANGELOG.md/`.zh.md`。
- **门禁**：`NODE_OPTIONS= ./init.sh` exit 0；清代理后 `npm run test:e2e` **306 passed / 6 skipped / 0 failed**（三引擎 2.5m）+ `E2E tracked-file check passed.`；`feature_list.json` 合法（当时 feat-042 38 条 / `in-progress`；同日签字后为 39 条 / `done`）。
- **产物**：清 `out/` + `.desktop` 后重跑 `desktop:make` → `.app` **572 M**（`.desktop/server` 293 M / `out` 832 M）；包内 `Resources/server/.next/static/chunks` 已无 `完成（内嵌` 模板、`内嵌图片 ` 仍在（指纹核实）。**新构建已打开供重测**：PID **60736**，服务 `127.0.0.1:49466`。
- **用户真机签字（收尾）**：用户在同一构建上跑完全部 **12 条人工验收**并入「真机测试OK」⇒ 12 条全部记为通过，`feature_list.json` 的 `feat-042.status` 由 `in-progress` 改为 **`done`**（verification 增至 39 条；原「ALL 12 PENDING」句改写为已签字）。**本步未改任何代码**，只动台账与文档。
- **未做**：未跑 `desktop:release`、未 push、未动 tag/ZIP、未 commit、未 bump 版本；打包镜像膨胀仍只报未修（待用户裁决）。
- **本轮的只报未改（提交门评审提出，均不改代码——已签字的构建不再动）**：① `statusLabel` 的 `phase: "skipped"` 分支在 UI 上不可达，且「全选 + 一键转换」会把已处理的文档一并重做（`panel.tsx` 全选设 `forced: true`、`planBatch` 不勾 `skip` 行）——与 FSD §4.6「已处理的不重复处理」的字面读法有出入，但与 L4「勾选即重做」自洽，等用户裁决；② `process.ts` 的 `force` 会跳过 sha256 短路，重新勾选未改动的文档会整篇重算（预期行为，但规格文字写得比实现窄）；③ FSD §6 第 4 条已补注证据口径（单测 + 人工第 9 条）。④ ponytail 提出 3 处可删（`resolveScanDir` 只被自己的测试调用、`joinDocPath` 重复了 `batch.ts` 的去尾斜杠、`scan.ts`/`process.ts` 各有一份相同的目录守卫），属装饰性，**不开新轮**。

## 上一轮（2026-09-30 第十八轮：设置页长路径省略 + 验证范围收口）

- **用户报告 1 条**：设置页「输入」卡片路径过长时，右侧两个按钮被挤到下一行；要求固化显示区宽度、超出用省略号。
- **根因**：`.providerHead` 是 `flex-wrap: wrap`，折行看各元素的 max-content 宽度；`.path` 只有 `min-width:0` + 省略号，没有 flex basis ⇒ 超长路径先撑断行、按钮才下移（实测按钮与路径中心差 40px）。
- **修复**：`.providerHead .path { flex: 1 1 0 }`（输入 / 输出 / 本地代理三处共用该规则；`.providerHead` 保留 `wrap`，窄屏仍能换行）。
- **TDD**：`e2e/settings.spec.ts` 「输入目录」组内新增长路径用例（title 完整值 / nowrap / ellipsis / scrollWidth > clientWidth / 单行高度 / 按钮与路径中心对齐）。RED：只有居中断言失败（40px）→ GREEN：`settings.spec.ts` + `local-docs.spec.ts`（chromium）47 passed。
- **同轮修掉上一轮钉住用例自身的测试缺陷**：`e2e/local-docs.spec.ts:125` 在导航后立即结束，转发的 `/api/settings` 桩还在 `route.fetch()`，Playwright 关上下文时报 `Response has been disposed`（两次全量跑各红 1 例，webkit/chromium 各一）。现在两次导航各自等设置请求落地（`--repeat-each=10` 10/10 绿）。
- **`vitest.config.ts` 的 `test.exclude` 加 `.desktop/**` + `out/**`**：它们是 `.next/standalone` 那份仓库镜像的副本（`prepare-desktop` 整目录 `cp` → forge 的 `extraResource`），少了会让 `desktop:make` 之后的 `./init.sh` 收进 307 个文件 / 51 failed。
- **新发现（只报未修，待用户裁决）**：`next build` 的 `output: "standalone"` 会把仓库根整个镜像进 `.next/standalone`（`AGENTS.md` / `docs/` / `e2e/` / `src/` / `tests/` / `feature_list.json`…，401 M，其中 389 M 是正牌 `node_modules`），`Resources/server` 因此带一份仓库副本。清掉 `out/` 与 `.desktop` 再打包能把包从 2.3 G 降到 571 M，但副本仍在；收窄要改 `scripts/prepare-desktop.mjs` 只拷 `server.js` / `.next` / `node_modules` / `public` / `browser`，属另开一轮的事。`/Applications` 里的 0.3.6 没有这份副本，机制未查明。
- **门禁**：`NODE_OPTIONS= ./init.sh` exit 0；`npm run test:e2e` **306 passed / 6 skipped / 0 failed**（三引擎 2.5m；含新增的 settings 用例）。
- **未做**：未跑 `desktop:release`、未 push、未动 tag/ZIP、未改任何生产行为（只 CSS 10 行 + 测试基建）；12 条真机人工验收仍待签；commit 待用户指示。

## 上一轮（2026-09-30 第十七轮：真机第二轮 5 条）

- **用户报告 5 条**（面板布局 3 + 返回/设置显示 2）。**分档处置**：可确认的 3 条按 TDD 修（RED：`e2e/local-docs.spec.ts` 3 failed → GREEN：该文件 14 passed）；无法复现的 2 条不猜改机制，只加钉住用例 + 如实汇报。
- **已修**：①删掉「先勾选要处理的文档。」这一支与常驻占位（`notice` 只在有真实信息时渲染，`.hint` 去掉 `min-height`）——推翻上一轮 L1 的「常驻占位」；②`.toolbar { justify-content: flex-end }`（原 `space-between` 把「翻译产物」顶到最左）；③`summaryText` 拆出 `countsText`，结果区改 `.result` + `.resultText`（两行）+ `.actions`（按钮在右）。
- **未复现（附证据）**：**R1**（面板→设置→「返回转换」回到入口画面）——浏览器探针与**真实 Electron**（真实 preload + 真实 `settings.json`，`--user-data-dir` 隔离）都正确回到面板，URL 确为 `/settings?from=local-docs`；**R5**（设置页显示「系统下载目录」文字）——两端都显示解析后的 `/Users/huanghaohai/Downloads`（只有 `/api/settings` 少了 `defaults` 才可能回落，而 GET/PUT 都带）。反向推断：用户机器上 `/Applications/MD-Convertor.app`、`out/`、`.desktop/server/server.js` 的 mtime 全是 **9-23**，早于面板（`local-docs/**`）落地，不可能是所跑的那个应用。
- **新增钉住用例 2 条**（`e2e/local-docs.spec.ts`，都是真实路由）：面板→设置→返回落回面板；设置页与面板显示同一个解析后的路径。
- **文档**：`S4-…md`（新增 §第四轮 + 验收表第 3/6 条期望 + 推翻 L1 半条的注）、`FSD.md`（§4.7 汇总排版）、`S3-…md`（追改段）、`CHANGELOG.md`/`.zh.md`（[Unreleased] 变更条改写）、`feature_list.json`、`session-handoff.md`、本文件、`docs/QUALITY-AUDIT.md`。
- **门禁**：`NODE_OPTIONS= ./init.sh` **exit 0**；`npx vitest run` **93 files / 1252 tests**（coverage 96 / 87.78 / 98.2）；清代理后 `npm run test:e2e` **303 passed / 6 skipped / 0 failed**（三引擎 2.5m）。首次全量跑有 1 条 firefox flake（`settings.spec.ts:731` 停在「正在读取设置…」30s——桩路由未命中；隔离 `--repeat-each=3` 3/3 绿），复跑即无，未修（范围外）。
- **未做**：未跑 `desktop:release`、未 push、未动 tag/ZIP；12 条真机人工验收仍待签；commit 待用户指示。

## 上一轮（2026-09-30 第十六轮：真机 16 条 + B1 全部落地）

- **用户授权**：7 个决策点答复（删 eyebrow / 窄屏退化 / 上下居中 / 好 / 不保留只改状态 / 参考面板路径样式 / 按建议用 URL 参数）+「其他按你的意见执行」，故 16 条（U1–U6、L1–L7、B1–B3）全部落地；路径显示统一按面板样式（单行 + 省略号 + `title`）。
- **B1 定位与修复（TDD）**：真机样例 `~/Downloads/X 上的 姚金刚 (@yaojingang).md`（11 图）→ `src/lib/local-docs/scan-refs.ts` 的 `INLINE_IMAGE` 用 `[^\s)]+` 取目标，路径含空格/半角括号时整条 link 不匹配、静默跳过（行状态「完成（内嵌 0 张，保留 0 张）」）。改为目标允许空格与配平括号、不跨行。RED 4+1 例 → 3 failed；GREEN `npx vitest run src/lib/local-docs/` = 7 files / 99 tests；真机探针 `{"embedded":11,"kept":0,"warnings":[]}`。**只修读方**，写方（插件 percent-encode）未动、需另行授权。
- **U1–U6（入口画面）**：删标题/副标题/eyebrow；卡片 `aspect-ratio:1/1`（<761px 退化 auto）；文案「粘贴URL/富文本转换」「生成 .md 文件。」「转换既有文档」note 改写、插件副标题「Chrome里直接转存网页为本地.md」且居中；插件链接加下划线。
- **L1–L5（面板）**：三处条件提示保留占位行（列表不再下沉）；`.toolbar` 顺序 翻译产物 → 重新扫描 → 一键转换；删掉每行「重新处理」（重新勾选即重做，`batch.ts` 注释同步），失败行显示「处理失败（原因）」；「一键转化」全部改「一键转换」（产品串 + 8 条 e2e 断言 + 文档）。
- **L6–L7（设置）**：两边共用 `inputDirLabel()`，`/api/settings` GET 增 `defaults.inputDir`（显示口径一致）；设置页用 `?from=`（home/convert/local-docs）记住来源画面，返回时 `pendingHomeMode()` 落回转换画面。
- **B2/B3**：品牌 `MD-Convertor` 三个画面水平位置一致（补 e2e 断言）；设置页长路径单行截断（`min-width:0` + 省略号），按钮不再换行。
- **路径显示统一**：面板 `.path` 与设置 `.path` 均为单行 + 省略号 + `title`，颜色 `--ink`、12.5px；面板补 `min-width:0; flex:1 1 0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis`。RED 两次（先无 `title`，后按钮换行直到加 `flex:1 1 0`）。
- **文档收口**：S4（反馈段改「已实施」+ 追改段 + 人工清单第 9 条改写）、FSD §4.1/§4.6/§6、PRD R8/§3、S3、`docs/TESTING.md`（子串口径更正）、`CHANGELOG`/`.zh`、`feature_list.json`（feat-042 verification 三批改「已实施」+ 新增本轮条目）、`session-handoff.md`、`docs/QUALITY-AUDIT.md`。
- **未做**：12 条真机人工验收待签（第 9 条按修订版重跑）；未跑 `desktop:release`、未 push、未动 tag/ZIP。
- **门禁**：`NODE_OPTIONS= ./init.sh` **exit 0**（Node 24.15.0；**93 files / 1252 tests**，较上次记录的 92/1237 增 1 文件 15 例；覆盖率 96% / 分支 87.78% / 函数 98.2%）；`npx tsc --noEmit` 与 eslint 干净；清代理后 `npm run test:e2e` **296 passed / 4 skipped / 0 failed**（三引擎，2.5m）；无 flake。

### 上一轮（2026-09-29 第十五轮）逐条记录

- **用户裁定**：首页应为**入口画面**（两张入口卡 + 底部插件下载），二级画面能回入口；这就是 FSD 第 51 行「一开始的选择画面」的本意，S3 实现的「顶部 tablist + 默认落转换画面」作废（不是新增需求，不重复需求对齐）。
- **落地（有真 RED）**：`src/app/page.tsx` 改为 `homeMode: "home" | "convert" | "local-docs"` 互斥早返回（`"home"` 为初值），入口画面＝两张 `role="button"` 卡片 + `.pluginNote` 插件链接；二级画面页头左侧「← 返回」（`aria-label="返回首页"`，避开结果页的「返回顶部」）；删掉外层 `role="tablist"`/`aria-controls`/`handleHomeModeTabKeyDown`（互斥早返回下 tab 语义不成立）；CSS 新增 `.headerLeft`/`.backButton`/`.landing`/`.landingTitle`/`.landingLead`/`.entryGrid`/`.entryCard`/`.entryTitle`/`.entryNote`/`.pluginNote`，删掉死掉的 `.homeNav`（未新增调色板、未加 emoji 图标、未继承 `.title`/`.subtitle`——那条 `nowrap` 媒体查询会撑破入口标题）。RED：`npx playwright test --project=chromium e2e/home.spec.ts -g "首页入口画面"` = **4 failed**；GREEN：chromium 四个文件 **48 passed**。
- **测例侧**：新增共享 `e2e/entry.ts`（`gotoHydrated` 等页面自己的 `/api/settings` GET → `gotoConverter` / `openLocalDocs`），13 处 `page.goto("/")` 改走它；`theme.spec.ts` 两条针对页面本身的断言仍保留裸 `goto`；`translate.spec.ts` 的 `page.reload()` 现在会回到入口画面 ⇒ 重载后补一行 `gotoConverter`，断言意图未变（这是一条真实行为后果，不是测试权宜）。
- **修掉 `home.spec.ts:109`（**确定性失败，不是 flake**）**：本机 firefox 在视口底部一条窄带（该布局下 y≈672＝按钮垂直中心）会丢掉合成鼠标点击（同 y 上各 x 全空；`y=661`/`y=690` 正常；一次 `y=700` 的探针落到 `clientY=652`）。`document.elementFromPoint` 仍命中按钮、DOM `click()` 能切 tab ⇒ 属输入派发，不是页面逻辑。修法：点按钮偏上位置（`click({ position: { x: 30, y: 6 } })`，仍是真实鼠标点击）；**试过的 `toPass` 重试包装 5/5 全红**（它等不到那次点击落地）。机制与口径已写进 `docs/TESTING.md`。
- **门禁**：`NODE_OPTIONS= ./init.sh` **exit 0**（92 files / 1237 tests，与 S4 基线相同——`src/app/**` 不在 vitest 覆盖率 include 里）；`npx tsc --noEmit` 与 eslint 干净；`npm run test:e2e` **278 passed / 4 skipped / 0 failed**（三引擎，2.4m）；`e2e/home.spec.ts` 三引擎 × `--repeat-each=3` **225 passed**；临时诊断文件 `e2e/debug.spec.ts` 与 `test-results/` 均已删除。
- **文档收口**：`docs/PRD-app-document-processing.md`（R8/R9 + §3.1）、`docs/features/app-document-processing/FSD.md`（§4.1 整表重写、§6 第 2/6 条）、`S3-home-modes-and-batch.md`（`## Result` 追改段）、`S4-...-acceptance.md`（人工清单第 1 条期望改成入口画面 + 追改段）、`docs/TESTING.md`（`e2e/entry.ts` 口径 + firefox 点击带 + 两层 tablist 段更正）、`CHANGELOG.md`/`.zh.md`（`[Unreleased]` 第一条改写为入口画面）、`feature_list.json`（feat-042 verification 增一条）、`session-handoff.md`、`docs/QUALITY-AUDIT.md`。
- **未做 / 待用户**：**12 条真机人工验收仍待签字**；**真机反馈两批共 9 条已记录未修**——3 条缺陷（B1/B2/B3，见下）+ 6 条入口画面 UX 优化（U1–U6 入口画面文案与卡片，落点 `src/app/page.tsx` + `page.module.css`；L1 提示行致列表下沉 / L2+L3 重新扫描与翻译勾选并入一键转换同排 / L4 去掉已处理行的「重新处理」/ L5「一键转化」统一为「一键转换」/ L6 设置页与扫描页目录显示口径统一 + 双向同步 / L7「返回转换」记住来源画面，落点 `src/app/local-docs/panel.*`、`panel.module.css`、`src/app/settings/page.tsx`、`src/app/api/settings/route.ts`；两组变更分别走 design-references 环节 2/3 → 环节 4）；首轮 3 条缺陷明细：（B1 转换后图片未嵌入成功，未复现且不知走哪条路径；B2 二级画面「← 返回」把品牌 `MD-Convertor` 推右，`page.module.css:18`；B3 设置页长路径把右侧按钮挤换行、期望「…」缩略，`settings/page.module.css:210` + `:242`）；未跑 `desktop:release`、未 push、未动 tag/ZIP；`design_router` 环节 4 的 `design_audit` 跑出 7 条 🔴 全部落在改动之外，已核实为既有基线，本轮未顺手修。

> 2026-09-29 第十四轮（S4 插件 ZIP 与收口）：`extension/使用说明.md`（7 节）、既有 `scripts/build-extension.mjs` 追加产出 `public/md-convertor-extension.zip`（34692 bytes）、`prebuild` 接线、`.gitignore` 两条、`eslint.config.mjs` 全局忽略暂存目录；**门禁一度红的真因是两个 vitest 文件并行跑 `build:extension` 互踩**，已修为「暂存目录带 `<pid>` + 先打包成 `pack.zip` 再 `rename` 原子落位」（并列跑 5/5 绿）；12 条人工验收已分类写进 S4 与 `feature_list.json`。

> 2026-09-29 第十三轮（S3 首页模式 + 批量写盘）与 2026-09-24 第一至第十二轮的逐轮叙述已压进 `docs/QUALITY-AUDIT.md` 的 `## Archived Round Log`；A 块的规划细节以 `docs/features/app-document-processing/FSD.md` 与 `docs/PRD-app-document-processing.md` 为准，S1–S4 的逐任务证据在 `feature_list.json` 的 `feat-042.verification` 与四份阶段文档的 `## Result`。

> 日期口径（本轮核实）：S1/S2 的条目写 2026-09-24（沿用规划轮日期），但 `package.json`（11:42）、`paths.ts`（11:44）、`process.ts`（12:08）的 mtime 都指向 **2026-09-29**，而同一天未被触碰的文件仍保留 2026-09-24 的 mtime——即 S1–S4 实际同在 2026-09-29 完成；本轮按真实系统日期记 2026-09-29。

## 三条已固化的教训（都已写进约束清单）
- **范围蔓延**：用户的需求只是「加一个默认下载目录」，我却顺手把打包收窄、firefox 解锁、既有 flake 修复、自建 skill 都塞进了同一轮收尾，被用户明确指出「我只是搞一个文档下载路径，你为什么要搞这么多有的没的」。**后续遇到范围外问题（发现缺陷、flaky 用例、基建改进），先单独提出来问，不要顺手做。**
- **「私有文档」的定性是错的**：T3.0 最初的理由写成「私有工作文档会随发布物公开」。核实后发现仓库是 public，`PROGRESS.md` / `session-handoff.md` / `feature_list.json` / `AGENTS.md` / `docs/**` 早已在 `origin/main` 上公开，打包不构成新增暴露；唯一真正非公开的是 `.workbuddy/memory/*.md`。收窄仍然正确，理由已就地更正。
- **把「我试过的一次失败」当成「不可能」是懒惰归因**（firefox）：我先宣布 firefox 在沙箱内不可跑并让用户补跑，用户追问后才发现官方开关 `MOZ_DISABLE_CONTENT_SANDBOX=1` 一直就在那里。看到底层错误码时，先查被启动的程序有没有为这种情况准备的官方开关。

## 仍然生效的约束

- **`session-handoff.md` 只写现役（≤150 行 / ≤25KB）**：阶段间交接写对应阶段文档的 `## Handoff`，轮次历史每条 ≤10 行进 `docs/QUALITY-AUDIT.md` 的 `## Archived Round Log`；需要旧叙述时用 `git show ab1d653:session-handoff.md`，不把历史搬回本文件。
- 跑门禁必须用 Node **24.14.1 或 24.15.0**——本机默认 v24.16.0 解压 electron zip 时静默卡死，`electron-forge make` 空跑却 exit 0。
- 所有代码开发遵循 TDD（RED → GREEN → REFACTOR），证据写入 `feature_list.json`。
- `output` 与 `input` 的缺失宽容读入是严格校验的唯一放宽点（仅新增字段、仅缺失时，见 `LENIENT_ROOT_KEYS`）；不得扩散到其他字段。
- filename 穿越校验在 preload 与 main 双层都要做——两层是独立防御，谁也不能删。
- 路径校验里 `~` **只在路径段开头**才算家目录简写；`com~apple~CloudDocs`（iCloud 云盘）里的波浪号是普通字符。别再写 `value.includes("~")`，那会把真实用户最常用的目录全部拒掉。
- preload 的校验函数是**抛异常**（`TypeError`）而不是 resolve `{ ok: false }`，所以任何 `await bridge.*` 都必须带 `.catch()`；否则异常会被 `void xxx()` 吞掉，表现为「点了没反应」。mock 桥接的 e2e 抓不到这类问题——桩要能抛。
- 真机探针的目录必须包含**真实用户会选的路径形态**（至少一条 iCloud 路径），只用 `/tmp/...` 的探针等于没测路径校验。
- `forge.config.cjs` 的 `ignore` 是**保留清单**（「只留 `package.json` + `electron/`」的反向正则），不是黑名单。新增仓库顶层文件/目录时不需要改它；**但要新增运行时模块，必须放在 `electron/` 下**，否则不会进包 —— `tests/forge-package-scope.test.ts` 会从 `main.mjs` 的 import 反推并拦下。
- 该 `ignore` 必须保持**数组**形式：`@electron/packager` 只在数组形式下追加 `DEFAULT_IGNORES`（`.git`、锁文件、`*.o`、`node_modules/.bin`）；换成文档推荐的 `IgnoreFunction` 会静默丢掉这些默认项。
- 判断「某个包带没带某项修复」，不要只看字符串命中：asar 收窄前会命中文档文本。正确做法是 grep 新包 `static/chunks/` 得到指纹 chunk 名，再 `curl` 运行中实例的该路径（404 = 仍是旧构建）。
- **`MD_CONVERTOR_USER_DATA` 不能用来隔离打包应用**：`electron/env.mjs` 的 `buildServerEnv()` 无条件用主进程算出的 `userDataDir` 覆盖它。真机探针一定会碰到用户真实的 `settings.json` 与开关指向的真实目录，必须走「备份 → 跑 → 比对 → 还原 → 删产物」五步（详见 `feature_list.json` 的 T2.8 environment trap）。
- 下载分叉是**三重条件**（开关 && 目录 && 桥接），且失败路径必须降级浏览器下载并告知原因，不得吞错。
- e2e 写设置必须用「取真实响应后只改写 `output` 再 fulfill」，不要 PUT 真设置——e2e 设置目录是全 project 共享的，泄漏会连坐其他引擎。
- **Firefox 在受限沙箱内靠 `MOZ_DISABLE_CONTENT_SANDBOX=1` 才能启动**（已固化进 `playwright.config.ts` 顶部，`??=` 形式所以调用方可用 `=0` 关掉）。原因：macOS 禁止嵌套沙箱，Firefox 给 content process 套 Seatbelt 时 `sandbox_init()` 返回 EPERM。**别改用 `firefoxUserPrefs: { "security.sandbox.content.level": 0 }`** —— 实测进程被 SIGKILL（exit 137）。只需这一个变量，GMP/RDD/Socket 三个同名开关各自都无效。
- 跑 `npm run test:e2e` 前**清掉代理环境变量**（`unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy`，并设 `NO_PROXY=127.0.0.1,localhost`）：Playwright 继承它们，而 Firefox 还会读系统代理，历史上出现过 `NS_ERROR_PROXY_CONNECTION_REFUSED` 的偶发失败。
- **比较布局矩形必须用 `e2e/geometry.ts` 的 `rectsInOneFrame`，不要连着调两次 `boundingBox()`**：每次调用都是独立往返，两次之间的滚动会被量成「布局错位」（Base URL 行在 firefox 上 15% 概率假报 131px 错位，`scrollY` 132 精确解释差值）。等 `document.fonts.ready` 解决不了它——那跑在触发滚动的 `fill()` 之前。
- **`npm run test:e2e` 是门禁不是内循环**（约两分钟，`workers: 1` 是翻译任务锁要求的）。迭代用 `npx playwright test`（复用 `.next/standalone` 现有构建、跳过重建）+ `--project=chromium` + `-g` 收窄；验证时序竞态用 `--repeat-each=20` 量级即可。**源码改动后不要跳过重建直接跑**，那会测到旧构建。
- 中途被杀掉的 e2e 运行会在 3000 端口留下服务；`reuseExistingServer: false` 是刻意的（保证每轮从本轮构建起服务），处置办法是核实 PID 后按精确 PID 结束，**不能按模式盲杀**。
- **在 agent shell 里启动打包应用要先 `env -u ELECTRON_RUN_AS_NODE`**：Electron 宿主（WorkBuddy、VS Code 等）会把 `ELECTRON_RUN_AS_NODE=1` 传给子 shell，Electron 二进制读到它会以纯 Node 启动——症状是日志里出现 `Welcome to Node.js v24.x` 与 `>` 提示符并卡在 stdin，像卡死而不像报错。同时加 `NODE_OPTIONS=` 清掉宿主注入的 `--require`。
- **外层已有沙箱时 Chromium 无法再给自己套沙箱**（`sandbox initialization failed: Operation not permitted` → GPU 进程 exit 6 → `FATAL: GPU process isn't usable. Goodbye.`，exit 133）。这与 Playwright Firefox 是同一根因，属环境限制而非产物缺陷：同一 bundle 从 Finder 启动一切正常。沙箱内可用 `--no-sandbox --disable-gpu` 拿功能证据，但**规范的那一次必须在 Terminal 里跑**。
- 装本机时**安装源用发布 ZIP 解压，不要用正在运行的 `out/` bundle**——既避免复制活着的 bundle，也让「装上的就是发布的那一个」可证。旧安装先 `mv` 到归档目录（可恢复），不要 `rm -rf`。
- **扩展轮次不动桌面**：只改 `extension/` 的轮次不改 `src/` `electron/` `forge.config.cjs` `playwright.config.ts`，不跑 `desktop:release`，也不把 `0.3.6` bump 到 `0.3.7`（bump 只由桌面代码改动触发）；插件版本由 `extension/manifest.json` 自管。详见 `AGENTS.md` 的 Working Rules 与 Verification。
- **扩展测试两层进 `./init.sh`、构建与集成不进**：① 纯函数单测（vitest + jsdom）② `chrome.*` 打桩编排单测（依赖注入，不装 sinon）随 `npm test` 进 `init.sh`；③ 浏览器内冒烟 ④ 真实 MV3 扩展集成走 `npm run test:extension`（自带 `playwright.extension.config.ts`，不碰桌面 e2e 项目与 `run-e2e.mjs`）；⑤ 工具栏点击与 `activeTab` 授权只能人工验收。
- **插件核心只收 DOM、不收 HTML 字符串**：`turndown` 的 `package.json` 有 `"browser": { "@mixmark-io/domino": false }`，esbuild 会把 domino 映射为空 stub（这正是浏览器产物零 Node 残留的机制）；喂字符串会拿到空 stub 而不是解析器。净化实例与时间戳一律**注入**（Node `createDOMPurify(window)`、浏览器 `DOMPurify` 本身）。因此在类型上也收 `HTMLElement`，不留一个字符串重载。
- **Readability 会丢掉所有 `data-*`**：惰性图必须在 `cloneNode(true)` 之后、`new Readability(...)` **之前**提升 `data-src`/`data-lazy-src` 到 `src`，否则正文里留的是占位图（桌面端只有微信分支做提升，插件两条分支都做）。
- **Readability 会把导航栏当正文返回**：两条提取分支都要跑 `MIN_TEXT_LENGTH = 50` 的字符下限，挑不出正文就返回 `null`（插件不做整页兜底，这是刻意与桌面端不同）。
- **`playwright.extension.config.ts` 的 `testMatch` 必须是 `**/*.spec.ts`**：`extension/tests/` 里同时住着 vitest 单测（`extension-build.test.mjs`），默认匹配会被 Playwright 收走并报 `Vitest failed to access its internal state`。同理，spec 里的 fixture 路径用 `path.resolve(__dirname, "../..")`（`__dirname` 是 spec 所在目录，不是项目根）。
- **`esbuild` 必须精确锁 `0.28.1`**：写 `^0.28.1` 会解析到 0.28.2 并重写约 215 行 lock（本轮已踩过）。
- **扩展的可测逻辑一律放 `worker-run.ts`（或更小的纯函数模块），不放 `content.ts` / `worker.ts`**：后两者是浏览器专用入口、不进 vitest 覆盖率，塞进去等于没有门禁。角标与失败原因映射就是这么放进去的（`ChromeDeps` 因此多一个 `action` 成员）。
- **payload 等待用的是全局 `setTimeout`，不受注入的 `timers` 影响**：测 `TIMEOUT` 分支必须 `vi.useFakeTimers()` + `advanceTimersByTimeAsync(10_000)`，用完还原；`timers` 只推进图片轮询与角标清空。
- **扩展的三处覆盖率阈值取「实测值之下一点」**（`worker-run.ts` 95/85/85/95、`references.ts` 100/90/100/100、`write.ts` 全 100）：阈值只用来拦回归，不假装已经测满；要抬阈值先补测试。
- **`npm run test:extension` 会先跑 `build:extension`；扩展套件实测不需要沙箱开关**（裸跑 15 passed / 4.2s）。`MD_CONVERTOR_EXTENSION_CHROMIUM_ARGS` 只是逃生舱；**需要 `--no-sandbox --disable-gpu` 的是打包后的 Electron，不是 Playwright 自带的 Chromium**，别把桌面那条环境限制套到扩展测试上（§ 上面的 Electron 沙箱条目另算）。
- **`chrome.downloads.download()` 在下载「开始」时就 resolve，`run()` 不等它写完**（`worker-run.ts` 的 `writeMarkdown()` 之后直接返回）：读落盘 md 前必须等 `chrome.downloads.search()` 里 `state === "complete"`，否则约 1/10 的概率读到空/截断内容（这正是 T3.1–T3.3 那两次不可复现的 flake）。装置已固化在 `extension/tests/harness.ts` 的 `waitForDownloadComplete()`；图片不受影响（`waitForImage` 在 `run()` 返回前就等到了）。
- **整篇图片全失败会留下一个空 `<标题>.images/` 目录**：Chrome 先建目标目录再发请求，中断只删半成品文件，而 `chrome.downloads` 删不了目录。断言按「不存在或为空」，不要去调 `removeFile` 硬删 —— 这是接受的已知行为，不是缺陷。
- **`activeTab` 授权只能来自真实点击**，Playwright 点不到浏览器 chrome：集成测试走 `copyExtensionWithHostPermission()`（把 `extension/dist` 拷到临时目录给那一份副本加 `host_permissions`）后直接调 service worker；没有这一手，无手势注入会报 `Cannot access contents of the page…`（S2 探针 1 已实测）。
- **fixture 站用 `node:http` + 临时端口（0），不引入框架、不用固定端口**：`extension/tests/fixtures/server.ts` 把 `origin` 交回调用方，并行/重复跑都不会撞端口；它自己的单测 `server.test.ts` 属第 1 层，随 `init.sh` 跑。fixture 写成 `.ts` 而非 `.mjs`（`.mjs` 导入在 TS program 里是 `TS7016`；vitest 收 `.test.ts`、Playwright 的 `testMatch` 只收 `*.spec.ts`，两者不会打架）。
- **插件与桌面端的引用口径**：md 里先写 `md-convertor-image-<n>` 占位符（纯词，不含 `:` `/`，Turndown 不会改写），落盘后用 `chrome.downloads.search()` 的**真实 basename** 回写引用（浏览器可能自己补扩展名）；真实父目录名 ≠ 请求的 `<标题>.images` 时按失败处理，退回原 URL，不写指向找不到的文件的引用。
- **Playwright 跑扩展时下载会被改名（S2 探针实测）**：Playwright 对 persistent context 一律先发 CDP `Browser.setDownloadBehavior{behavior:"allowAndName"}`，每个下载都被写成 `<guid>`（无扩展名、丢掉请求的子目录）——不修装置就测不出「文件名是否被补扩展名」「相对子目录路径」「同名覆盖」这三条。修法两步：profile 里预写 `Default/Preferences` 的 `download.default_directory`，启动后自己再发一次 `behavior:"default"`；**`downloadsPath` 选项不能碰**（它就是 `allowAndName` 的入口），`acceptDownloads` 传什么都被归一成 `accept`。
- **TS 6 不再自动收 `@types`**：`node_modules/@types/*` 不会自动进 program（本项目的 `@types/node` 是被 `next-env.d.ts` → `next` 间接带进来的），所以 `@types/chrome` 必须显式引用 —— 靠 `extension/src/chrome-types.d.ts` 里一行 `/// <reference types="chrome" />`（零 import）覆盖扩展全部文件；新增用 `chrome.*` 的文件不要再逐个加指令。
- **同名用 `overwrite` 而不是 `uniquify`**：`uniquify` 只改 md 名（`标题 (1).md`）、目录名不变，一次重复导出就把文件对拆散；这也是不加时间戳的理由。
- 签名/notarization 不做（QA-008 accepted，2026-09-20 用户决定）；UI 评审结论勿重提（2026-09-20 全部不整改）。
- **A 块（`feat-042`）S1–S4 已实施（S4 于 2026-09-29）**：版本面已是 `0.3.7`（**不要再 bump**，发布需用户单独授权）。三条已定约束：图片内联在 **Markdown 层**复用 `src/lib/images.ts`（不另写一套 sharp/尺寸判断，提为导出是行为不变的 A1 重构）；**服务端路由只读、写盘只经既有 `outputBridge().saveFile()`**（S2 的 `/api/local-docs/process` 也不写盘）；A 的 e2e **不得读真实下载目录**（默认目录的解析只在路由单测里注入环境变量验证），桥接桩必须能抛。S1 已交付可复用：`src/lib/local-docs/paths.ts`（`isSafeDirectoryPath`/`isMarkdownFileName`/`resolveScanDir`）、`dedup.ts`、`scan.ts`（`scanLocalDocs`/`defaultDownloadsDir`）。S2 已交付可复用：`scan-refs.ts`（`scanImageRefs`）、`inline-images.ts`（`inlineLocalDocImages`）、`process.ts`（`processLocalDoc`，返回 `{skipped} | {markdown,filename,sha256,warnings,stats,translation}`；服务端自己重算跳过判定），以及 `images.ts` 新导出 `embedImageBuffer`/`mapWithConcurrency`/`MAX_IMAGES`/`MAX_SOURCE_IMAGE_BYTES`。S2 的一条口径已定稿：**本地图片只允许源 md 所在目录树内的相对路径**，根外绝对路径 / `..` / `scheme:` / `//` 一律拒（保留原引用 + warning），远端只走 `fetchPublicResource`，`data:` 原样保留不计数。**S3 已交付可复用**：`src/lib/local-docs/batch.ts`（`planBatch`/`isSameDirectory`/`processedOutputDir`/`applyRowStatus`/`nextPending`/`summarize`）、`src/app/local-docs/{client.ts,panel.tsx,panel.module.css}`（`runBatch(rows, ctx)` 注入 `processDoc`/`saveFile`/`onRows`）、`electron/system.mjs` 的 `md-convertor:system:open-path`。
- **面板写盘只有一条路**：全部经 `runBatch` → `outputBridge().saveFile()`；e2e 只桩 preload 桥（成功 / fs 码 / **抛异常** 三态），扫描与处理必须走真实路由，目录一律 `mkdtemp`，**不得碰真实 Downloads**。
- **入口卡片是 `role="button"`、名字仍是子串**：卡片「粘贴URL/富文本转换」包含内层 tab「富文本转换」，断言内层 tab 仍要 `exact: true`（同屏可达时 Playwright 的 name 匹配是子串）；同理 `<td>` 里带 checkbox 时，name 单元格的可访问名会吸到 `aria-label="选择 …"`，也要 `exact: true`。
- **点首页模式选择器前先等 hydration**：模式是客户端状态，SSR 页上的点击会被静默丢弃（firefox 尤其容易）；`gotoHydrated` 等的是页面自己的 `/api/settings` GET。看到「点了没反应」先查这一拍，别先当产品缺陷。
- **浏览器包内模块（`batch.ts` / `client.ts` / `panel.tsx`）不得 import `node:*`**：跨层类型只用 `import type`（会被完全擦除），路径用普通字符串拼接。
- **面板探测桥接用 `useSyncExternalStore`（`loading`/`ready`/`absent`）而非挂载后 setState**：React 19 的 `react-hooks/set-state-in-effect` 会拦后者，且首屏会闪一下降级文案；服务端快照返回 `loading` 才不产生 hydration mismatch。带 `use` 前缀的普通函数会被当成 hook，命名绕开。
**S4 已交付可复用**：`extension/使用说明.md`（进 ZIP）、`scripts/build-extension.mjs`（暂存 `extension/dist-package/<pid>/md-convertor-extension/` → `ditto` 到 `pack.zip` → `rename` 成 `public/md-convertor-extension.zip`）、打包单测 `extension/tests/extension-package.test.mjs`（在 `beforeAll` 自建产物，随 `init.sh` 跑）、`package.json` 的 `prebuild`。
- **`ditto` 打 ZIP 必须带 `--norsrc --noextattr`**：不带会带出 `._*` AppleDouble 伴生条目（ZIP 从 5 条变成 9 条）；且 `ditto` 不写 UTF-8 标志位，`unzip -Z1` 对 `使用说明.md` 显示乱码（`ditto -x -k`/`unzip` 实际解压正确）——**测试要解压后读字节，不要对非 ASCII 条目名做字节比对**。
- **`build-extension.mjs` 必须对并发调用安全**：`extension-build.test.mjs` 与 `extension-package.test.mjs` **都**在 `beforeAll` 跑它，而 vitest 默认按文件并行 fork —— 共享暂存目录会被一个进程 `rm -rf` 时另一个正在 `ditto`，共享输出路径也会被两个进程同时写。所以暂存目录带 `process.pid`，ZIP 先写同目录 `pack.zip` 再 `rename`（同卷原子）。**以后新增任何在 `beforeAll` 调 `build:extension` 的测试，都不需要再动脚本；反过来，不要把 `<pid>` 或 `rename` 删掉。** 回归检查＝并列跑那两个文件（`init.sh` 就是并列跑的）。
- **`public/md-convertor-extension.zip` 已由 `prebuild` 保证**：任何 `next build`（`init.sh`、e2e 重建、`desktop:make`）都先跑 `build:extension`，首页下载链接不再是死链。`extension/dist-package/**` 已进 `eslint.config.mjs` 的 `globalIgnores`（否则暂存目录里的压缩包会被当源码扫出 `no-this-alias`）；`vitest.config.ts` 只排 `extension/tests/**/*.spec.ts`，所以 `.test.mjs` 打包单测确实随 `init.sh` 跑。
- **`vitest.config.ts` 的 `test.exclude` 必须保留 `.next/**`**：`next build`（`output: "standalone"`）把整个仓库镜像进 `.next/standalone`，测试文件也在内；少了这条，任何跟在一次 build 或 e2e 之后的 `./init.sh` 都会收进约 85 个重复套件并报红（实测 17 failed / 162 passed / 179 files）。要复现「某条 e2e 失败是否早有」用干净 worktree（`git worktree add /tmp/x HEAD` + `cp -Rc node_modules`，**不要 symlink** node_modules）。
- 云端 Provider 端到端实测仍待用户用真实文章走一遍（与 feat-041 无关的遗留项）。

> 历史轮次的完成记录（feat-018 – feat-039 及更早）已归档：逐 feature 的验证证据见 `feature_list.json` 对应条目的 `verification` 字段；发布产物、门禁计数与风险登记见 `docs/QUALITY-AUDIT.md`（含 `## Archived Round Log`）；测试口径与产物哈希见 `docs/TESTING.md`；Git 提交历史保留全部实现细节。
