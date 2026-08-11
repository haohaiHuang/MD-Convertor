# MD-Convertor Project Instructions

本文件继承并补充全局指令 `~/.codex/AGENTS.md`。开始工作前必须先完整阅读全局指令，再阅读本文件；若两者冲突，以本项目指令为准，但不得违反更高优先级的系统或用户指令。

## Project Purpose

本项目将开发一个把网页链接转换为 Markdown 文档的工具。

第一阶段交付 Apple Silicon Mac 单机应用。Electron 承载现有 Next.js 16 / Node.js 24 / TypeScript strict 应用，使用 Readability、Turndown、Playwright 和 Sharp 完成安全抓取、正文提取、动态渲染和图片内嵌。产品范围见 `docs/PRODUCT.md`，本地安全与打包边界见 `docs/ARCHITECTURE.md`。

## Startup Workflow

开始修改前，依次执行：

1. 用 `pwd` 确认位于项目根目录。
2. 阅读 `~/.codex/AGENTS.md` 与本文件。
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
- 当前项目只构建和验收 `darwin/arm64`；Windows、多平台仓库迁移均已取消，未经用户重新明确授权不得恢复。
- 直接粘贴内容转换：0.1.x 阶段取消；已于 2026-08-06 在 v0.2（`feat-012`）以「富文本粘贴转换」形式重新授权，范围以 `docs/PLAN-V0.2.md` 为准（仅处理用户主动复制的剪贴板 HTML/纯文本，不绕过任何访问限制）。
- **所有代码开发必须遵循 TDD**：先写失败测试（RED），再写最小实现使其通过（GREEN），最后清理重构（REFACTOR）；每个实现步骤都应有对应的自动化测试作为证据，禁止先实现后补测试。
- **0.1.3 为已发布正式版本，后续开发（含 v0.2）不得破坏**：v0.2 构建必须使用独立版本号（0.2.0），输出文件名与 0.1.x 隔离，不得覆盖或删除历史产物；0.1.3 正式 ZIP 已归档于 `~/Downloads/MD-Convertor-0.1.3-release/`（SHA-256 `66909aa8759ec41fdde875204773958d32b33a2c903e7b4eb0858a50fb1bdf89`）。T5 运行 `./init.sh`，T8 追加 21 项三浏览器链接模式 E2E，T10 才运行包含 live 的完整发布门禁；0.1.3 既有 93 tests 与 21 E2E 必须始终作为扩展测试集的一部分保持通过，链接模式行为零变化。
- 产品或架构决策写入相应项目文档；会话状态写入 `PROGRESS.md`，不要依赖聊天记录延续上下文。
- 面向用户的显著变化记录到 `CHANGELOG.md` 的 `[Unreleased]`。
- 不提交密钥、令牌、Cookie、个人数据、受版权保护的完整网页内容或其他敏感材料。

## Required State Artifacts

- `feature_list.json`：事项、依赖、状态、完成条件与验证证据的结构化事实源。
- `PROGRESS.md`：当前状态、决定、风险和下一步。
- `session-handoff.md`：跨会话交接；短会话也应保证其关键内容不过期。
- `CHANGELOG.md`：面向用户的重要变更记录。
- `init.sh`：统一、可重复、失败即退出的基线验证入口。
- `docs/QUALITY-AUDIT.md`：整体质检结论、问题等级、整改顺序与复验清单；安全整改和发布放行前读取。
- `docs/TASKS-*.md`：进行中 feature 的任务级事实源（与对应 PLAN 文档分离）。每个任务记录状态、边界、完成条件与验证证据；一次只推进一个 `in-progress` 任务；开始实施前读取对应文件。

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
4. 更新 `session-handoff.md`；有用户可见变化时同步更新 `CHANGELOG.md`。
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

真实网页对照只在发布前执行 `npm run test:live`，不得加入日常单元测试；它会联网但不得保存或输出网页正文。桌面打包、环境变量、冒烟和人工验收统一按 `docs/TESTING.md` 执行。当前正式 v0.2 发布门禁使用 `npm run desktop:release`，且只允许目标版本 `0.2.0`；脚本必须保护 0.1.3 基线与历史 ZIP，并自动验证新 ZIP 的新鲜度、版本、arm64 架构、包结构和 SHA-256，不能把 Forge 无产物退出视为成功。签名和 notarization 尚未配置时必须明确报告产物仅适合个人测试。

## Escalation

- 产品边界、交付形态或关键技术取舍不清：先查项目企划与架构文档；仍不清楚则询问用户。
- 同一验证连续失败：在 `PROGRESS.md` 记录命令、错误和已尝试方案，再请求协助。
- 当前事项需要扩大范围或改动无关文件：暂停并取得授权。
