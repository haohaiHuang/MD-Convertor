# Project Progress

## Current State

- Last updated: 2026-09-22
- Current version: `0.3.6`（`package.json`、`package-lock.json`、`feature_list.json`、发布门禁 `scripts/release-desktop.mjs` 均为 `0.3.6`；尚未发布——`v0.3.5` 仍是最新已发布版本，tag `5f98307`）。S1 与 S2 的全部验证证据在 `feature_list.json` 的 `feat-041.verification`
- Active feature: `feat-041` 默认 MD 保存路径（**S1、S2 已完成并提交（修复提交 `867aa2a`）；真机缺陷与反馈缺失均已修复；S3 待开工**）
- Next step: ① **用户先 Cmd+Q 关掉当前窗口**（沙箱内无法代劳：`osascript quit` 报 -10004 权限违例；`open` 对已运行实例只激活、不换构建），再打开 `out/MD-Convertor-darwin-arm64/MD-Convertor.app`（21:12 构建，已含反馈修复，指纹 chunk `2-_s5mj5mt1x0.js`），过一遍真机两态验收 —— **口径已变**：开关开时除了文件落盘，还应看到「下载」按钮短暂变「已保存」+ 带 ✓ 的反馈卡片（这就是上一轮「以为没下载成功」的修复）；② 用户补跑 `npm run test:e2e` 的 **firefox** 引擎（本环境跑不了，见下）；③ 两者都过了再按 `docs/features/default-save-path/S3-release.md` 收口发布（发布前先收窄 `forge.config.cjs` 的 asar ignore）
- Branch: `main`；stash@{0} 是 2026-09-21 拉取前的文档备份、与 feat-041 无关
- Scope: unsigned Apple Silicon Mac personal-test application; macOS 12.0+

## 最近一轮（feat-041 S2 反馈缺失修复，2026-09-22）

- **用户真机复测后报障**：直写已经**能下载**了（iCloud 缺陷确认修复），但**没有任何可感知的确认**，导致「会误以为没有下载成功」。
- **先查事实再动手**：提示**不是没渲染** —— e2e 里 `已保存到` 的断言一直绿，而直写分支是唯一会写文件的代码路径，所以 `setSaveNotice` 在用户那次必然执行了。这是**呈现缺陷**，三个成因：① 成功提示是裸的说明文字（`color: var(--muted)`、14px、无背景无边框无标记），跟正文说明一个长相；② **成功与失败共用同一个样式**，连警告都长得像成功；③ 注意力所在的位置（「下载」按钮）毫无反馈 —— 旁边的「复制」会变「已复制」，而默认目录这套功能**故意不弹保存框**，等于把两条反馈渠道同时关掉了。
- **RED**：`e2e/home.spec.ts` 新增「直写成功时给出醒目确认」，并给既有失败用例加 tone 断言 ⇒ chromium **2 failed / 4 passed**；失败输出把当时的 DOM 原文打了出来（裸 `<p role="status" class="…saveNotice">`，无 tone 属性；也没有「已保存」按钮）。
- **GREEN**：`saveNotice` 改为 `{ tone: "success" | "warning"; text: string }`，渲染带 `data-tone` + `aria-live="polite"`；「下载」按钮在直写成功后显示「已保存」1800ms（**照搬旁边「已复制」的既有做法**，用 ref 持有计时器保证新的闪烁永远赢过旧的，`runConversion()` 同时清掉两者）；`.saveNotice` 从说明文字改为填充卡片 —— 成功用 `accent-soft` + ✓ 标记，失败用 `warning-soft`，全部复用本页既有的 status/warning 语汇，字面量只用已白名单内的 `#eed79c`。
- **验证**：chromium `home.spec.ts` **21 passed**；`NODE_OPTIONS= ./init.sh` exit 0 → 67 files / **955 tests**、statements 95.28%；双引擎 e2e exit 0 → **160 passed / 2 skipped**（比 158 多的正是新用例 × 2 引擎）；`git status` 确认除三个预期文件外无 tracked-file 漂移。
- **已提交并重新打包**：提交 `867aa2a`（8 个文件）；`NODE_OPTIONS= npm run desktop:package`（Node 24.14.1）exit 0 → `out/MD-Convertor-darwin-arm64/MD-Convertor.app` 21:12 构建、0.3.6、arm64、566 MB；指纹校验全过（chunk `2-_s5mj5mt1x0.js` 含 `data-tone` + `已保存`；CSS 含 `✓`；客户端无 `includes("~")`；`app.asar` 的 preload 仍含 `startsWith("~")`）。
- **环境发现**：本沙箱**无法用程序关闭已运行的应用** —— `osascript -e 'quit app "MD-Convertor"'` 报 `权限违例 (-10004)`；`open <路径>` 对已运行实例只做激活、不会换成新构建。所以「重新打包 → 重启复测」这一步必须由用户 Cmd+Q。安全列实例：`lsof -nP -iTCP -sTCP:LISTEN | awk '$1 ~ /^MD-Conv/'`。
- 唯一推荐下一步：用户 Cmd+Q 后重新打开新包，再看一遍「开关开 → 点下载」 —— 这次应当能看到按钮变「已保存」以及带 ✓ 的卡片。

## 上一轮（feat-041 S2 真机缺陷修复，2026-09-22）

- **用户真机实测报障**：设置页「输出」卡片的勾选能力正常，但**配好 iCloud 目录 + 打开开关后，点「下载」完全没有反应** —— 既不直写、也不走浏览器下载、也不报错。
- **根因 1：iCloud 路径被路径校验拒掉**。`isAbsoluteDirPath`（`electron/preload-contract.cjs` 与其在 `electron/preload.cjs` 里的等价副本）原实现是 `value.includes("~") → false`，即**路径里出现任何 `~` 都判非法**，而用户选的目录正是 `/Users/huanghaohai/Library/Mobile Documents/com~apple~CloudDocs/Note/未归档`。这是 S1 T1.2 的设计（`leading /, no ~, no .. segment`）被字面执行的结果：`~` 只在**位于路径段开头**时才是家目录简写，`com~apple~CloudDocs` 里的波浪号只是普通字符。改为 `!value.split("/").some((s) => s === ".." || s.startsWith("~"))`，并把 iCloud 场景写进函数注释，防止以后又被收紧回去。
- **根因 2：preload 抛异常而调用处没接**。preload 的 `assert*` 是**抛 `TypeError`**，不是 resolve `{ ok: false }`；`src/app/page.tsx` 里是裸 `await bridge.saveFile(...)`，异常向上冒泡，又被 `onClick={() => void downloadMarkdown()}` 吞掉 → 完全无声。浏览器 e2e 永远抓不到这个，因为桩永远 resolve。修法是把拒绝并入既有失败分支：`.catch(() => null)` + `result?.ok` + `result ? outputCodeMessage(result.code, "文件写入失败。") : "默认保存设置不可用。"`。
- **TDD 证据**：先加 RED —— `preload-contract.test.cjs` 增 2 个 accept（真实 iCloud 路径、`/Users/someone/My~Backup`）与 1 个 reject（`/Users/someone/~/notes`）；`preload.test.cjs` 同步 dirCases（与 contract 一致性的属性测试）；`output.test.mjs` 增同名拒绝用例 + 新增一条真的写进 `com~apple~CloudDocs/Note` 目录的测试；`e2e/home.spec.ts` 增「桥接层拒绝时给出反馈并降级为浏览器下载」（桩在 `rejects` 情况下改为抛异常）。RED：模块测试 4 failed / 86 passed；e2e chromium 3 failed / 16 passed。GREEN：模块测试 89 passed（其中 1 条失败是既有环境噪声 `CODEBUDDY_BROKER_DENY`，在 `git show HEAD:electron/output.test.mjs` 的干净版本上同样复现，与本修复无关）；e2e chromium+webkit **158 passed / 2 skipped**，tracked-file 守卫干净；`tsc --noEmit` 与 `eslint .` 全绿。
- **一个未诊断的观察（不是结论）**：用户实测后留下的 `settings.json` 里 `output.defaultPath` 已是 iCloud 目录（说明「选择目录」持久化正常），但 `output.useDefaultPath: false` —— 盘上是**关**的，而用户说开关是打开的。`toggleUseDefaultPath` 是乐观更新（先改 state、PUT 失败再回滚），所以 PUT 失败会显示「设置保存失败」并把开关拨回去；而**开关若是关的，页面根本不会进入桥接分支**，这本身也足以解释「点了没反应」。**T2.8 复验后判定：不是可复现缺陷**（开关确实能持久化，见下），但用户那次为什么留下 `false` 仍未查明。
- **T2.8 重新打包 + 真机复验：两项全过**。`npm run desktop:package` exit 0（Node 24.14.1）→ 新包 20:37:51 构建，确认**真的带上了修复**（`server/.next/**` 里有 `默认保存设置不可用`、没有 `includes("~")`；`app.asar` 里 `segment.startsWith("~")` 出现 2 次 = preload-contract + preload）。随后 CDP 驱动打包应用的真实渲染层：① 设置页点「使用默认目录」→ 真实 `PUT /api/settings` 落盘，`useDefaultPath` 由 `false` 变 `true`（**开关持久化正常**）；② 开关开 + 目录 `…/com~apple~CloudDocs/Note/未归档` → 转换、点「下载」→ 反馈条 `已保存到 /Users/…/未归档/<文件名>.md`、`download` 事件 0、`createObjectURL` 0、**文件真的落盘（134 B）**。这正是修复前必然失败的那条路径。
- **真机探针的硬约束（新踩的坑）**：**`MD_CONVERTOR_USER_DATA` 无法隔离打包应用** —— `electron/env.mjs` 的 `buildServerEnv()` 里 `MD_CONVERTOR_USER_DATA: userDataDir` 是**无条件覆盖**（注释写明 MD_CONVERTOR_* 永远权威），所以启动时设这个变量**不生效**。后果：任何真机探针都会读写**用户真实的 `settings.json`**、并把文件写进**开关当前指向的真实目录**（本次就真的写进了用户的 iCloud 云盘）。探针必须四步走：备份真实 settings.json → 跑完逐字段比对确认 `output` 之外未被改动（页面 PUT 是整份替换）→ 还原 `defaultPath`/`useDefaultPath` → 删掉落在真实目录里的探针文件。本次四步已全部执行，用户设置与 iCloud 目录已回到探针前状态。

## 上一轮（feat-041 S2：主页面下载分叉，2026-09-22）

- **T2.1 三态分叉 e2e（TDD）**：`e2e/home.spec.ts` 新增「下载分叉（默认保存目录）」describe 三例——① 桥接 + 开关 + 目录 → `saveFile` 直写、反馈条「已保存到 …」、**零** `download` 事件与**零** `createObjectURL`；② `saveFile` 失败（EACCES）→ 反馈条含「没有写入权限」且降级浏览器下载（`createObjectURL` 计到 1）；③ 无桥接 → 忽略设置、走旧路径。RED 2 failed / 16 passed；GREEN 18 passed。
- **T2.2 实现**：`page.tsx` 用 `settingsState` 留住整份 `Settings`（`translateEnabled`/`targetLanguage` 行为不变、不额外发请求）；`downloadMarkdown()` 改 `async`，按**三重条件**（`useDefaultPath && defaultPath && outputBridge()`）分叉，成功 `已保存到 <path>` 并 return，失败 `直接保存失败：<原因>已改为浏览器下载。` 后**继续落到原有 Blob/anchor 逻辑**（不吞错）；按钮同步改 `onClick={() => void downloadMarkdown()}`；`.saveNotice` 落在 stats 之前、`role="status"`。新增 `src/app/settings/client.test.ts`（RED 4 failed / 2 passed → GREEN 6 passed）。
- **决策：S2 文档 §4 与实现冲突，取方案 (a)**。文档原称 `EACCES → 没有写入权限`、`ENOENT → 目录不存在`，但 S1 的 `OUTPUT_CODE_MESSAGES` 没有这两个码，而 `electron/output.mjs` 原样回传 fs 的 `error.code`——即 §4 当时不成立。选择补映射（而非改文档用笼统文案），另补 `EPERM`/`ENOTDIR`/`ENOSPC`/`EROFS`；连接词由括号改冒号（映射表每条都是带句号的完整句，塞括号会出现「（没有写入权限。）」）。结论已写入 `S2-download-flow.md` 的「决策记录」与 `feature_list.json` 证据。
- **T2.3 反馈条生命周期**：新用例（再次转换 → 反馈条消失）先跑出真实 RED（`Expected: 0, Received: 1`，陈旧提示残留），再在 `runConversion()` 开头补 `setSaveNotice(null)` ⇒ 19 passed。
- **T2.4 回归**：`./init.sh` exit 0 —— 67 files / **950 tests**（基线 66 / 944，增量为新增的 6 个 client 用例）；chromium + webkit 全量 e2e 绿。
- **环境硬限制（新发现，已写入 ~/.workbuddy/MEMORY.md）**：**Playwright Firefox 在本环境完全无法启动**——它启动时要再套一层 macOS seatbelt，报 `Sandbox error: sandbox_init() failed with error "Operation not permitted"` 后退出，表现为每个用例 30s 超时。chromium 与 webkit 同一用例均绿，故属环境限制而非代码/测试缺陷。**firefox 必须由用户在普通终端补跑**；S2 因此不宣称 firefox 覆盖。
- **T2.5 真机两态探针（已完成，机器证据）**：`npm run desktop:package` exit 0（Node 24.14.1）→ 用 CDP 驱动打包应用的真实渲染层。开关开：桥接存在、反馈「已保存到 /tmp/s2-probe-out/# 真机探针.md」、download 事件 0、文件真实落盘；开关关：无反馈、download 事件 1、目标目录保持空。探针脚本已删，用户真实 `settings.json` 已逐字节还原。**但这只是机器证据，不等于用户签字**；且随后用户亲手复测就撞上了上面那轮的 iCloud 缺陷——说明探针用的 `/tmp/s2-probe-out` 恰好绕过了真实路径里的 `~`，探针覆盖面本身就是这次漏检的一部分。
- 唯一推荐下一步：用户终端补 firefox e2e + 真机探针，然后开 S3。

## 仍然生效的约束

- 跑门禁必须用 Node **24.14.1 或 24.15.0**——本机默认 v24.16.0 解压 electron zip 时静默卡死，`electron-forge make` 空跑却 exit 0。
- 所有代码开发遵循 TDD（RED → GREEN → REFACTOR），证据写入 `feature_list.json`。
- `output` 缺失宽容读入是严格校验的唯一放宽点（仅新增字段、仅缺失时）；不得扩散到其他字段。
- filename 穿越校验在 preload 与 main 双层都要做——两层是独立防御，谁也不能删。
- 路径校验里 `~` **只在路径段开头**才算家目录简写；`com~apple~CloudDocs`（iCloud 云盘）里的波浪号是普通字符。别再写 `value.includes("~")`，那会把真实用户最常用的目录全部拒掉。
- preload 的校验函数是**抛异常**（`TypeError`）而不是 resolve `{ ok: false }`，所以任何 `await bridge.*` 都必须带 `.catch()`；否则异常会被 `void xxx()` 吞掉，表现为「点了没反应」。mock 桥接的 e2e 抓不到这类问题——桩要能抛。
- 真机探针的目录必须包含**真实用户会选的路径形态**（至少一条 iCloud 路径），只用 `/tmp/...` 的探针等于没测路径校验。
- **`MD_CONVERTOR_USER_DATA` 不能用来隔离打包应用**：`electron/env.mjs` 的 `buildServerEnv()` 无条件用主进程算出的 `userDataDir` 覆盖它。真机探针一定会碰到用户真实的 `settings.json` 与开关指向的真实目录，必须走「备份 → 跑 → 比对 → 还原 → 删产物」五步（详见 `feature_list.json` 的 T2.8 environment trap）。
- 下载分叉是**三重条件**（开关 && 目录 && 桥接），且失败路径必须降级浏览器下载并告知原因，不得吞错。
- e2e 写设置必须用「取真实响应后只改写 `output` 再 fulfill」，不要 PUT 真设置——e2e 设置目录是全 project 共享的，泄漏会连坐其他引擎。
- 签名/notarization 不做（QA-008 accepted，2026-09-20 用户决定）；UI 评审结论勿重提（2026-09-20 全部不整改）。
- 云端 Provider 端到端实测仍待用户用真实文章走一遍（与 feat-041 无关的遗留项）。

> 历史轮次的完成记录（feat-018 – feat-039 及更早）已归档：逐 feature 的验证证据见 `feature_list.json` 对应条目的 `verification` 字段；发布产物、门禁计数与风险登记见 `docs/QUALITY-AUDIT.md`（含 `## Archived Round Log`）；测试口径与产物哈希见 `docs/TESTING.md`；Git 提交历史保留全部实现细节。
