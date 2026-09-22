# Project Progress

## Current State

- Last updated: 2026-09-22
- Current version: `0.3.6`（`package.json`、`package-lock.json`、`feature_list.json`、发布门禁 `scripts/release-desktop.mjs` 均为 `0.3.6`；尚未发布——`v0.3.5` 仍是最新已发布版本，tag `5f98307`）。S1 与 S2 的全部验证证据在 `feature_list.json` 的 `feat-041.verification`
- Active feature: `feat-041` 默认 MD 保存路径（**S1、S2 已完成并提交；S2 真机缺陷修复已完成、待打包复测；S3 待开工**）
- Next step: ① 用 `npm run desktop:package`（Node **24.14.1**）重新打包，让用户在自己终端重跑真机两态验收（当前 `out/` 里的包是修复前的，点「下载」仍然是死的）；② 用户补跑 `npm run test:e2e` 的 **firefox** 引擎（本环境跑不了，见下）；③ 两者都过了再按 `docs/features/default-save-path/S3-release.md` 收口发布
- Branch: `main`；stash@{0} 是 2026-09-21 拉取前的文档备份、与 feat-041 无关
- Scope: unsigned Apple Silicon Mac personal-test application; macOS 12.0+

## 最近一轮（feat-041 S2 真机缺陷修复，2026-09-22）

- **用户真机实测报障**：设置页「输出」卡片的勾选能力正常，但**配好 iCloud 目录 + 打开开关后，点「下载」完全没有反应** —— 既不直写、也不走浏览器下载、也不报错。
- **根因 1：iCloud 路径被路径校验拒掉**。`isAbsoluteDirPath`（`electron/preload-contract.cjs` 与其在 `electron/preload.cjs` 里的等价副本）原实现是 `value.includes("~") → false`，即**路径里出现任何 `~` 都判非法**，而用户选的目录正是 `/Users/huanghaohai/Library/Mobile Documents/com~apple~CloudDocs/Note/未归档`。这是 S1 T1.2 的设计（`leading /, no ~, no .. segment`）被字面执行的结果：`~` 只在**位于路径段开头**时才是家目录简写，`com~apple~CloudDocs` 里的波浪号只是普通字符。改为 `!value.split("/").some((s) => s === ".." || s.startsWith("~"))`，并把 iCloud 场景写进函数注释，防止以后又被收紧回去。
- **根因 2：preload 抛异常而调用处没接**。preload 的 `assert*` 是**抛 `TypeError`**，不是 resolve `{ ok: false }`；`src/app/page.tsx` 里是裸 `await bridge.saveFile(...)`，异常向上冒泡，又被 `onClick={() => void downloadMarkdown()}` 吞掉 → 完全无声。浏览器 e2e 永远抓不到这个，因为桩永远 resolve。修法是把拒绝并入既有失败分支：`.catch(() => null)` + `result?.ok` + `result ? outputCodeMessage(result.code, "文件写入失败。") : "默认保存设置不可用。"`。
- **TDD 证据**：先加 RED —— `preload-contract.test.cjs` 增 2 个 accept（真实 iCloud 路径、`/Users/someone/My~Backup`）与 1 个 reject（`/Users/someone/~/notes`）；`preload.test.cjs` 同步 dirCases（与 contract 一致性的属性测试）；`output.test.mjs` 增同名拒绝用例 + 新增一条真的写进 `com~apple~CloudDocs/Note` 目录的测试；`e2e/home.spec.ts` 增「桥接层拒绝时给出反馈并降级为浏览器下载」（桩在 `rejects` 情况下改为抛异常）。RED：模块测试 4 failed / 86 passed；e2e chromium 3 failed / 16 passed。GREEN：模块测试 89 passed（其中 1 条失败是既有环境噪声 `CODEBUDDY_BROKER_DENY`，在 `git show HEAD:electron/output.test.mjs` 的干净版本上同样复现，与本修复无关）；e2e chromium+webkit **158 passed / 2 skipped**，tracked-file 守卫干净；`tsc --noEmit` 与 `eslint .` 全绿。
- **一个未诊断的观察（不是结论）**：用户实测后留下的 `settings.json` 里 `output.defaultPath` 已是 iCloud 目录（说明「选择目录」持久化正常），但 `output.useDefaultPath: false` —— 盘上是**关**的，而用户说开关是打开的。`toggleUseDefaultPath` 是乐观更新（先改 state、PUT 失败再回滚），所以 PUT 失败会显示「设置保存失败」并把开关拨回去；而**开关若是关的，页面根本不会进入桥接分支**，这本身也足以解释「点了没反应」。列为待复测确认项，不冒充已定位。
- **代价提醒**：`out/MD-Convertor-darwin-arm64/MD-Convertor.app`（构建于 00:26:17）**早于本次修复**，即当前包仍带着这个死按钮 —— 用户就是这么撞上的。**必须重新打包**才能复测。
- 唯一推荐下一步：重新打包 → 用户重跑真机两态验收（顺带确认开关是否稳定持久化）→ 补 firefox e2e → 开 S3。

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
- 下载分叉是**三重条件**（开关 && 目录 && 桥接），且失败路径必须降级浏览器下载并告知原因，不得吞错。
- e2e 写设置必须用「取真实响应后只改写 `output` 再 fulfill」，不要 PUT 真设置——e2e 设置目录是全 project 共享的，泄漏会连坐其他引擎。
- 签名/notarization 不做（QA-008 accepted，2026-09-20 用户决定）；UI 评审结论勿重提（2026-09-20 全部不整改）。
- 云端 Provider 端到端实测仍待用户用真实文章走一遍（与 feat-041 无关的遗留项）。

> 历史轮次的完成记录（feat-018 – feat-039 及更早）已归档：逐 feature 的验证证据见 `feature_list.json` 对应条目的 `verification` 字段；发布产物、门禁计数与风险登记见 `docs/QUALITY-AUDIT.md`（含 `## Archived Round Log`）；测试口径与产物哈希见 `docs/TESTING.md`；Git 提交历史保留全部实现细节。
