# Project Progress

## Current State

- Last updated: 2026-09-22
- Current version: `0.3.6`（`package.json`、`package-lock.json`、`feature_list.json`、发布门禁 `scripts/release-desktop.mjs` 均为 `0.3.6`；尚未发布——`v0.3.5` 仍是最新已发布版本，tag `5f98307`）。S1 与 S2 的全部验证证据在 `feature_list.json` 的 `feat-041.verification`
- Active feature: `feat-041` 默认 MD 保存路径（**S1、S2 已完成，S2 待提交；S3 待开工**）
- Next step: ① 用户在自己的终端补跑 `npm run test:e2e` 的 **firefox** 引擎（本环境跑不了，见下）；② 真机两态探针（`npm run desktop:package` + 开/关开关各走一遍）；③ 两者都过了再按 `docs/features/default-save-path/S3-release.md` 收口发布
- Branch: `main`；stash@{0} 是 2026-09-21 拉取前的文档备份、与 feat-041 无关
- Scope: unsigned Apple Silicon Mac personal-test application; macOS 12.0+

## 最近一轮（feat-041 S2：主页面下载分叉，2026-09-22）

- **T2.1 三态分叉 e2e（TDD）**：`e2e/home.spec.ts` 新增「下载分叉（默认保存目录）」describe 三例——① 桥接 + 开关 + 目录 → `saveFile` 直写、反馈条「已保存到 …」、**零** `download` 事件与**零** `createObjectURL`；② `saveFile` 失败（EACCES）→ 反馈条含「没有写入权限」且降级浏览器下载（`createObjectURL` 计到 1）；③ 无桥接 → 忽略设置、走旧路径。RED 2 failed / 16 passed；GREEN 18 passed。
- **T2.2 实现**：`page.tsx` 用 `settingsState` 留住整份 `Settings`（`translateEnabled`/`targetLanguage` 行为不变、不额外发请求）；`downloadMarkdown()` 改 `async`，按**三重条件**（`useDefaultPath && defaultPath && outputBridge()`）分叉，成功 `已保存到 <path>` 并 return，失败 `直接保存失败：<原因>已改为浏览器下载。` 后**继续落到原有 Blob/anchor 逻辑**（不吞错）；按钮同步改 `onClick={() => void downloadMarkdown()}`；`.saveNotice` 落在 stats 之前、`role="status"`。新增 `src/app/settings/client.test.ts`（RED 4 failed / 2 passed → GREEN 6 passed）。
- **决策：S2 文档 §4 与实现冲突，取方案 (a)**。文档原称 `EACCES → 没有写入权限`、`ENOENT → 目录不存在`，但 S1 的 `OUTPUT_CODE_MESSAGES` 没有这两个码，而 `electron/output.mjs` 原样回传 fs 的 `error.code`——即 §4 当时不成立。选择补映射（而非改文档用笼统文案），另补 `EPERM`/`ENOTDIR`/`ENOSPC`/`EROFS`；连接词由括号改冒号（映射表每条都是带句号的完整句，塞括号会出现「（没有写入权限。）」）。结论已写入 `S2-download-flow.md` 的「决策记录」与 `feature_list.json` 证据。
- **T2.3 反馈条生命周期**：新用例（再次转换 → 反馈条消失）先跑出真实 RED（`Expected: 0, Received: 1`，陈旧提示残留），再在 `runConversion()` 开头补 `setSaveNotice(null)` ⇒ 19 passed。
- **T2.4 回归**：`./init.sh` exit 0 —— 67 files / **950 tests**（基线 66 / 944，增量为新增的 6 个 client 用例）；chromium + webkit 全量 e2e 绿。
- **环境硬限制（新发现，已写入 ~/.workbuddy/MEMORY.md）**：**Playwright Firefox 在本环境完全无法启动**——它启动时要再套一层 macOS seatbelt，报 `Sandbox error: sandbox_init() failed with error "Operation not permitted"` 后退出，表现为每个用例 30s 超时。chromium 与 webkit 同一用例均绿，故属环境限制而非代码/测试缺陷。**firefox 必须由用户在普通终端补跑**；S2 因此不宣称 firefox 覆盖。
- **未完成**：T2.5 真机两态探针（`npm run desktop:package` + 开/关开关各走一遍）未执行——「开=不弹框直写」目前只有 mock 桥接的 e2e 支撑。
- 唯一推荐下一步：用户终端补 firefox e2e + 真机探针，然后开 S3。

## 仍然生效的约束

- 跑门禁必须用 Node **24.14.1 或 24.15.0**——本机默认 v24.16.0 解压 electron zip 时静默卡死，`electron-forge make` 空跑却 exit 0。
- 所有代码开发遵循 TDD（RED → GREEN → REFACTOR），证据写入 `feature_list.json`。
- `output` 缺失宽容读入是严格校验的唯一放宽点（仅新增字段、仅缺失时）；不得扩散到其他字段。
- filename 穿越校验在 preload 与 main 双层都要做——两层是独立防御，谁也不能删。
- 下载分叉是**三重条件**（开关 && 目录 && 桥接），且失败路径必须降级浏览器下载并告知原因，不得吞错。
- e2e 写设置必须用「取真实响应后只改写 `output` 再 fulfill」，不要 PUT 真设置——e2e 设置目录是全 project 共享的，泄漏会连坐其他引擎。
- 签名/notarization 不做（QA-008 accepted，2026-09-20 用户决定）；UI 评审结论勿重提（2026-09-20 全部不整改）。
- 云端 Provider 端到端实测仍待用户用真实文章走一遍（与 feat-041 无关的遗留项）。

> 历史轮次的完成记录（feat-018 – feat-039 及更早）已归档：逐 feature 的验证证据见 `feature_list.json` 对应条目的 `verification` 字段；发布产物、门禁计数与风险登记见 `docs/QUALITY-AUDIT.md`（含 `## Archived Round Log`）；测试口径与产物哈希见 `docs/TESTING.md`；Git 提交历史保留全部实现细节。
