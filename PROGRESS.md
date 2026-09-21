# Project Progress

## Current State

- Last updated: 2026-09-21
- Current version: `0.3.6`（`package.json`、`package-lock.json`、`feature_list.json`、发布门禁 `scripts/release-desktop.mjs` 均为 `0.3.6`；尚未发布——`v0.3.5` 仍是最新已发布版本，tag `5f98307`）。S1 的全部验证证据在 `feature_list.json` 的 `feat-041.verification`
- Active feature: `feat-041` 默认 MD 保存路径（**S1 已完成并提交，S2 待开工**）
- Next step: 按 `docs/features/default-save-path/S2-download-flow.md` 开工——主页面下载三态分叉（桥接直写 / 失败降级 / 浏览器下载）+ 反馈条；S2 完成后按 S3 收口发布
- Branch: `main`；stash@{0} 是 2026-09-21 拉取前的文档备份、与 feat-041 无关
- Scope: unsigned Apple Silicon Mac personal-test application; macOS 12.0+

## 最近一轮（feat-041 S1：契约 + IPC + 输出卡片，2026-09-21）

- **T1.0 版本 0.3.5 → 0.3.6（TDD）**：`scripts/release-guards.test.mjs` fixture 先 RED（7 failed / 22 passed，`Release version must be 0.3.5.`，比 S1 文档预估的 5 failed 多 2——`verifyFreshArtifact` 两个用例同样依赖 fixture 版本，且产物 ZIP 文件名随目标版本走，需一并改），再同步 `scripts/release-desktop.mjs`（两处）、`package.json`、`package-lock.json`（root 与 `packages[""]`，注意依赖 `for-each`/`magicast` 恰好也是 0.3.5、不能误改）、`feature_list.json` ⇒ 29 passed。
- **T1.1 settings 契约**：RED 9 failed / 46 passed；GREEN——`OutputSettings` 类型、`OUTPUT_KEYS`、`DEFAULT_SETTINGS.output`、`ROOT_KEYS`、`validateSettings` 的 `output` 缺失宽容分支（唯一放宽点，代码注释写明理由）+ `readOutput` + `useDefaultPath:true && defaultPath:null` 规范化为全默认；`SETTINGS_VERSION` 保持 1（专项测试锁定）；`/api/settings` 的 `sanitizeSettings` 转发 `output`（否则 API 会把已保存的 output 静默抹掉）。全量 vitest 876 passed。
- **T1.2 contract**：新 `electron/preload-contract.test.cjs` RED 25 failed；GREEN——`CHANNELS` 增 `md-convertor:output:select-directory` / `md-convertor:output:save-file`，`isValidOutputFilename`（非空、≤255、无 `/` `\` `..`）与 `isAbsoluteDirPath`（`/` 开头、拒 `~`、拒 `..` 段）⇒ 26 passed。
- **T1.3 preload 桥接**：`preload.test.cjs` 扩用例 RED 20 failed / 16 passed；GREEN——`preload.cjs` 自包含复制通道名与校验（沙箱 preload 不能 require 相对文件），`window.mdConvertor.output.selectDirectory()/saveFile(dirPath, filename, content)`，非法参数同步抛 TypeError、IPC 失败降级 `{ok:false, code:"IPC_FAILED"}`；与 contract 的同步性有属性级测试钉死。
- **T1.4 main IPC**：新 `electron/output.test.mjs`（RED = 模块不存在）；GREEN——新纯模块 `electron/output.mjs` 的 `createOutputChannels({ipcMain, dialog, warn})`：select-directory 弹 `openDirectory+createDirectory` 对话框、取消返回 `CANCELLED`；save-file **独立于 preload 重新校验**（双层防御）、`mkdir -p` 自愈、写入返回 `{ok:true, path}`、失败映射 `error.code` 且 warn 日志只记 code 不记内容与路径；`main.mjs` 在 `app.whenReady()` 注册 ⇒ 23 passed。
- **T1.5 设置页「输出」卡片**：e2e 新用例 RED 5 failed / 24 passed；GREEN——`client.ts` 增 `outputBridge()`/`OutputBridge`/`OutputResult`/`OUTPUT_CODE_MESSAGES`（CANCELLED 不算错误）；`page.tsx` 在「翻译服务提供方」卡片之前插入输出卡片（只读路径展示/未设置、选择目录按钮、使用默认目录开关；无桥接时按钮禁用并提示「目录选择只能在桌面应用中使用」；开关开着但无目录时警告「请先选择目录。」且不落盘）；`settings/theme/translate` 三个 spec 的共享 settings mock 补上 `output` 字段（真实 API 总是返回它——这本身就是一个契约事实：**mock 缺 output 会让页面崩掉**）⇒ settings chromium 29 passed。
- **T1.6 收尾**：`./init.sh` exit 0——66 files / **944 tests**、statements 95.28%、lint + `tsc --noEmit` + 生产构建全绿；全量 chromium e2e **75 passed**（home/paste 行为不变，主页面下载逻辑零改动）；三引擎 e2e 与打包门禁按计划留给 S2/S3。
- 提交：S1 单独一个提交（含上一轮遗留的 4 份规划文档与状态文件修正）。
- **已知限制**：真机上「选择目录」后的直写尚未发生过（S2 真机探针覆盖）；本阶段主页面下载仍走浏览器路径。
- 唯一推荐下一步：按 `docs/features/default-save-path/S2-download-flow.md` 开工，从 T2.1 开始。

## 仍然生效的约束

- 跑门禁必须用 Node **24.14.1 或 24.15.0**——本机默认 v24.16.0 解压 electron zip 时静默卡死，`electron-forge make` 空跑却 exit 0。
- 所有代码开发遵循 TDD（RED → GREEN → REFACTOR），证据写入 `feature_list.json`。
- `output` 缺失宽容读入是严格校验的唯一放宽点（仅新增字段、仅缺失时）；不得扩散到其他字段。
- filename 穿越校验在 preload 与 main 双层都要做——两层是独立防御，谁也不能删。
- 签名/notarization 不做（QA-008 accepted，2026-09-20 用户决定）；UI 评审结论勿重提（2026-09-20 全部不整改）。
- 云端 Provider 端到端实测仍待用户用真实文章走一遍（与 feat-041 无关的遗留项）。

> 历史轮次的完成记录（feat-018 – feat-039 及更早）已归档：逐 feature 的验证证据见 `feature_list.json` 对应条目的 `verification` 字段；发布产物、门禁计数与风险登记见 `docs/QUALITY-AUDIT.md`（含 `## Archived Round Log`）；测试口径与产物哈希见 `docs/TESTING.md`；Git 提交历史保留全部实现细节。
