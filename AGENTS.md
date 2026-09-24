# MD-Convertor Project Instructions

本文件继承并补充**全局指令**。全局指令按代理不同存放在两份文件里，内容并不完全相同（pi 版多「证据先于断言」「本机环境已知问题」「工作流」三段）：

- `~/.codex/AGENTS.md` —— Codex 会话加载
- `~/.pi/agent/AGENTS.md` —— pi 会话加载

同一项目可能被不同代理开发，所以**两份都点名**；开始工作前先完整阅读本运行时代理实际加载的那一份，再阅读本文件。若与本文件冲突，以本项目指令为准，但不得违反更高优先级的系统或用户指令。

## Project Purpose

本项目将开发一个把网页链接转换为 Markdown 文档的工具。

第一阶段交付 Apple Silicon Mac 单机应用。Electron 承载现有 Next.js 16 / Node.js 24 / TypeScript strict 应用，使用 Readability、Turndown、Playwright 和 Sharp 完成安全抓取、正文提取、动态渲染和图片内嵌。0.3.0 起另提供可选文档翻译：正文交给用户自行配置的模型（本机 agent CLI 或云 Provider），只翻译非目标语言部分。0.3.6 起可在设置里指定默认保存目录，让「下载」直接把 Markdown 写进该目录而不再每次弹保存框（未启用或直写被拒时仍走原保存对话框）。产品范围见 `docs/PRODUCT.md`，翻译产品需求见 `docs/PRD-translation.md`，本地安全与打包边界见 `docs/ARCHITECTURE.md`。

0.3.6 之后的当前阶段是**浏览器插件线路**（两个产品，详见 `docs/PLAN-browser-extension.md`）：**B 浏览器插件（`feat-040`）先做**——点一下工具栏图标就把当前页正文与图片存成 `<标题>.md` + `<标题>.images/`（Chromium MV3，代码在 `extension/`，不影响桌面产物）；**A 桌面端「文档处理」（`feat-042`）另案后做**（批量处理本地 `.md`，无顺序与代码依赖）。B 的实施文档是 `docs/features/browser-extension/`（`FSD.md` + S1/S2/S3），**S1–S3 已全部实施；T3.4 真机人工验收进行中（第 1/2/4/6 条已通过，第 3、5 条未测）**；接手时先读 `FSD.md` 与该阶段文档。

## Startup Workflow

开始修改前，依次执行：

1. 用 `pwd` 确认位于项目根目录。
2. 阅读本运行时代理实际加载的全局指令（`~/.codex/AGENTS.md` 或 `~/.pi/agent/AGENTS.md`）与本文件。
3. 阅读 `PROGRESS.md`、`feature_list.json` 和 `session-handoff.md`。
4. 涉及产品行为时阅读 `docs/PRODUCT.md`；涉及抓取、安全或部署时阅读 `docs/ARCHITECTURE.md`；涉及验证、打包或发布时阅读 `docs/TESTING.md`；涉及质检、安全整改或发布放行时同时阅读 `docs/QUALITY-AUDIT.md`。
5. 运行 `./init.sh` 建立基线。
6. 若仓库已启用 Git，查看 `git status --short` 与最新 5 条提交。

基线失败时，先记录失败证据并处理或上报，不要在未知状态上扩展范围。

## Working Rules

- **One feature at a time**：一次只推进 `feature_list.json` 中一个状态为 `in-progress` 的事项。
- 实施前确认目标、非目标、完成条件和验证方式；重大缺口无法从现有资料推断时，向用户确认。
- **Stay in scope**：只修改当前事项需要的文件，不顺手重构或扩展未获授权的功能。
- 保持 Node.js 24、Next.js 16、Electron、npm 和当前锁文件；未经批准不要替换框架或包管理器。
- 当前项目只构建和验收 `darwin/arm64`（指**桌面产物**）；Windows、多平台仓库迁移均已取消，未经用户重新明确授权不得恢复。**浏览器插件（`extension/`）不受此限**：它是独立的 MV3 扩展，验收环境为 Chromium（Playwright 加载真实扩展 + 真机 Chrome 加载未打包扩展），不产出桌面产物、不进 `desktop:release`。
- **版本面与桌面的关系**：`package.json` 的版本与 `desktop:release` 只对应**桌面端**，所以「再改代码前先 bump 到 `0.3.7`」仅指改动桌面代码（`src/`、`electron/`、打包配置）的轮次；只改 `extension/` 的轮次**不 bump** 桌面版本，插件版本由 `extension/manifest.json` 自管。
- 富文本粘贴转换只处理用户主动复制的剪贴板 HTML/纯文本，不读取浏览器登录态，也不绕过任何访问限制；现行范围以 `docs/PRODUCT.md` 和 `docs/ARCHITECTURE.md` 为准。
- **所有代码开发必须遵循 TDD**：先写失败测试（RED），再写最小实现使其通过（GREEN），最后清理重构（REFACTOR）；每个实现步骤都应有对应的自动化测试作为证据，禁止先实现后补测试。
- **v0.3.6 是当前版本（已于 2026-09-22 发布为 GitHub Release `v0.3.6`；`0.3.1`–`0.3.5` 亦均已发布，`0.3.0` 的 ZIP 是历史构建），0.1.3 为不可变历史基线**：`main` 代表当前版本；`v0.3.3` 的 ZIP 与源码不再逐字节对应（其后的 `feat-035` 修掉了 `next.config.ts` 的追踪缺口，但打包产物保持文件级等价），`v0.3.5` 的 ZIP 由视觉刷新完成后的源码构建，tag `v0.3.5` 指向提交 `5f98307`；`v0.1.3` 标签固定在提交 `ce041c9`。0.2.1 的 ZIP 归档于 `~/Downloads/MD-Convertor-archive/releases/`；0.1.0–0.2.0 的 ZIP 与原 0.1.3 只读副本已从本机丢失且无法恢复，发布门禁对这些缺失项只报退役。后续版本不得移动历史标签、覆盖或删除仍然存在的受保护产物；既有回归继续包含在扩展测试集中。
- 产品或架构决策写入相应项目文档；会话状态写入 `PROGRESS.md`，不要依赖聊天记录延续上下文。
- 面向用户的显著变化记录到 `CHANGELOG.md` 的 `[Unreleased]`。
- 不提交密钥、令牌、Cookie、个人数据、受版权保护的完整网页内容或其他敏感材料。

## Required State Artifacts

- `feature_list.json`：事项、依赖、状态、完成条件与验证证据的结构化事实源。
- `PROGRESS.md`：当前状态、决定、风险和下一步。
- `session-handoff.md`：跨会话交接，**只写现役状态**（目标 ≤150 行 / ≤25KB）。阶段之间的交接写对应阶段文档的 `## Handoff`；轮次历史压进 `docs/QUALITY-AUDIT.md` 的 `## Archived Round Log`（每条 ≤10 行），不再留在本文件（2026-09-24 起）。
- `CHANGELOG.md`：面向用户的重要变更记录。
- `init.sh`：统一、可重复、失败即退出的基线验证入口。
- `docs/QUALITY-AUDIT.md`：整体质检结论、问题等级、整改顺序与复验清单；安全整改和发布放行前读取。
- ~~`docs/TASKS-*.md`~~：**该模式已于 0.2.1 退役**（当时的 `docs/TASKS-*.md` 已随该版本清理，见 `394cf3d`）。0.3.0 起的任务级事实源就在 `docs/features/<feature>/S<n>-*.md` 的 **Tasks 表**（含 RED、完成条件、验证列），不要再新建 `docs/TASKS-*.md`。
- `docs/PRD-*.md`：产品需求事实源。当前在册：`docs/PRD-translation.md`（0.3.0 翻译）、`docs/PRD-app-document-processing.md`（A 桌面端「文档处理」）、`docs/PRD-browser-extension.md`（B 浏览器插件）。涉及产品范围、非目标或隐私条款变化时，先读 PRD 再读 `docs/PRODUCT.md`；PRD 与 PRODUCT.md 冲突时以 PRD 为准并同步修订 PRODUCT.md。
- `docs/PLAN-browser-extension.md`：**当前阶段的路线图**（浏览器插件线路 —— 两个产品的分工、顺序、边界、已定决策；§6 的四组规则冲突已于 2026-09-24 裁定、§7 是当前未验证与风险）。2026-09-24 起顺序为 **B 先做（`feat-040`，已有阶段文档）、A 另案（`feat-042`，无顺序依赖）**。施工级细节在对应 feature 文档里。**开工前先读本文件与 `docs/features/browser-extension/FSD.md`。**
- `docs/PLAN-next-phase.md`：`0.3.5` 视觉刷新的路线图，**已完成并归档**（2026-09-21 发布）；只在追溯那一阶段的方向与决策时读取。
- `docs/PRD-upgrade-v2.md` 与 `docs/UI-DESIGN-SPEC.md`：**已于 2026-09-21 删除**（作废原因见路线图 §7）；不要重建，也不要把两者中的范围、色板或改造文件清单搬回来。
- `docs/features/<feature>/**`：FSD 执行文档（`FSD.md` 总纲 + 每阶段一份 Spec/Plan/Task 一体的执行文档）。实施某阶段时只读 `FSD.md` 与该阶段文档，不必读其它阶段文档。当前在册：`docs/features/translation/`（0.3.0，已完成）、`docs/features/ui-refresh/`（0.3.5，已完成）、`docs/features/default-save-path/`（feat-041 默认 MD 保存路径，0.3.6，已完成）、`docs/features/browser-extension/`（B 浏览器插件，`feat-040`，**S1/S2/S3 已完成，唯 S3 的 T3.4 真机人工验收尚在收尾（第 1/2/4/6 条已通过，第 3、5 条未测）**）。A 桌面端「文档处理」（`feat-042`）尚无阶段文档，待其启动时自行走一轮规划（§6 的四组规则已于 2026-09-24 裁定，可直接引用）。

后续企划新增文档时，应在这里补充其用途和读取时机，而不是把详细方案堆入本文件。

## Definition of Done

事项仅在以下条件全部满足时可标记为 `done`：

- 目标行为或文档结果已完成，且未超出约定范围。
- 相关验证已实际运行并通过。
- 验证命令和结果已记录在 `feature_list.json` 或 `PROGRESS.md`。
- 相关项目文档及 `CHANGELOG.md` 已按影响更新。
- 仓库可由下一会话按 Startup Workflow 无歧义地继续。

## End of Session

1. 重新运行与本次改动相称的验证。
2. 更新 `feature_list.json` 的状态与证据。
3. 更新 `PROGRESS.md` 的已完成项、风险和唯一推荐下一步。
4. 更新 `session-handoff.md` 的现役段（Resume Here / 开工提示词 / Latest Change / Boundaries / Next Stage Entry / Environment Notes / Recommended Next Action），把本轮结论压一条 ≤10 行的条目进 `docs/QUALITY-AUDIT.md` 的 `## Archived Round Log`；有用户可见变化时同步更新 `CHANGELOG.md`。
5. 检查改动范围；只有在用户要求且仓库已启用 Git 时才提交。

结束时必须留下 clean、restartable state，使下一会话可直接按 Startup Workflow 恢复。

## Verification

当前统一入口：

```bash
./init.sh
```

该命令先强制检查 Node.js 24.x，再依次验证 Harness、lint、type-check、单元/安全测试和生产构建。跨浏览器测试需要浏览器运行时，单独执行：

```bash
npm run test:e2e
```

浏览器插件的测试分五层（见 `docs/features/browser-extension/FSD.md` §3.7）：纯函数单测与 `chrome.*` 打桩编排单测**进** `./init.sh`；浏览器内冒烟与真实扩展集成**不进** `init.sh`，单独执行（会先跑 `npm run build:extension`）：

```bash
npm run test:extension
```

注：`build:extension` 与 `test:extension`（以及 `extension/src/convert/`、`scripts/build-extension.mjs`、`playwright.extension.config.ts`）已由 S1（`docs/features/browser-extension/S1-convert-core.md` 的 T1.0）落地并可用；S1 的 T1.0 另有 `extension/tests/core-smoke.spec.ts`（浏览器内冒烟）与 `extension-build.test.mjs`（S2 T2.8 扩到 4 条，钉住 `extension/dist/` 恰含 `manifest.json` / `content.js` / `worker.js` 且无 Node 残留）。S2（`S2-extension-shell-and-writes.md`，T2.0–T2.8 已完成）补上 `extension/manifest.json` 与 `extension/src/{messages,content,write,references,worker-run,worker}.ts`，`npm run build:extension` 产出 `extension/dist/` 的三份文件（`core.js` 仍只进 `dist-test/`）。S3（`S3-e2e-and-acceptance.md`，T3.0–T3.3/T3.5/T3.6 已完成）补上 `extension/tests/fixtures/server.ts`（fixture 站；其单测 `server.test.ts` 属第 1 层，**进** `init.sh`）与 `integration.spec.ts`（真实扩展 + 真实落盘，5 条，第 4 层），并给 `extension/tests/harness.ts` 加了 `waitForDownloadComplete()` —— `downloads.download()` 在下载**开始**时就 resolve，读 md 前必须等 `search()` 里的 `state === "complete"`，否则偶发读到空/截断内容。构建产物 `extension/dist-test/` 与 `extension/dist/` 均已 gitignore。

真实网页对照只在发布前执行 `npm run test:live`，不得加入日常单元测试；它会联网但不得保存或输出网页正文。桌面打包、环境变量、冒烟和人工验收统一按 `docs/TESTING.md` 执行。当前正式发布门禁使用 `npm run desktop:release`，且只允许目标版本 `0.3.6`（`0.3.6` 已发布；再改代码前先 bump 到 `0.3.7` 并同步该行）；脚本必须对仍然存在的历史 ZIP 逐个校验哈希（缺失项报退役并继续），并自动验证新 ZIP 的新鲜度、版本、arm64 架构、包结构和 SHA-256，不能把 Forge 无产物退出视为成功。签名和 notarization 尚未配置时必须明确报告产物仅适合个人测试。

## Escalation

- 产品边界、交付形态或关键技术取舍不清：先查项目企划与架构文档；仍不清楚则询问用户。
- 同一验证连续失败：在 `PROGRESS.md` 记录命令、错误和已尝试方案，再请求协助。
- 当前事项需要扩大范围或改动无关文件：暂停并取得授权。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
