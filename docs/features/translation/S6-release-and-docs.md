# S6 — 0.3.0 发布门禁与文档（Spec / Plan / Task）

- 上游：`docs/PRD-translation.md`、`docs/features/translation/FSD.md`
- 依赖：S5 已完成（功能齐全、测试全绿）
- 状态：**待批准**（未开始）
- feature_list id：`feat-023`

## Spec

**目标**：把 0.3.0 变成可发布版本——版本升级与发布门禁改造、覆盖率门槛、全部相关文档据实更新、打包与产物校验、全量回归。

**版本升级面**（当前发布门禁硬编码要求版本正好是 `0.2.1`，必须同步改造）：

- `package.json` 的 `version`
- `feature_list.json` 的 `currentVersion` 与全部 `feat-018…023` 状态/证据
- `scripts/release-guards.mjs` 的目标版本常量与其测试 `scripts/release-guards.test.mjs`
- `CHANGELOG.md`：`[Unreleased]` → `[0.3.0]`，含用户可见变化（设置、翻译、双 Tab、语言占比提示）
- 历史归档与 `v0.1.3` 保护逻辑**保持不变**（只改目标版本，不得放宽任何既有校验）

**必须更新的文档**：

| 文档 | 更新内容 |
| --- | --- |
| `docs/PRODUCT.md` | PRD §5：删除「不使用 AI API/密钥/模型」非目标；改写隐私段（内容会发送到用户配置端点）；补入翻译能力与 11 种目标语种 |
| `docs/ARCHITECTURE.md` | 新增本地 API（`/api/settings`、`/api/provider/models`、`/api/local-clis/*`、`/api/runtime/secrets`、`/api/translate/*`）、设置与密钥存储、Provider 端点安全策略与抓取 SSRF 策略的差异、CLI 进程边界 |
| `docs/TESTING.md` | 新验证入口（翻译相关单测、e2e 分支、测试桩 Provider 开关）、覆盖率门槛 |
| `docs/QUALITY-AUDIT.md` | 本轮新风险（密钥处理、内容出网、子进程调用）与复验清单、放行条件 |
| `README.md` / `README.zh.md` | 功能列表与使用前置（需自行配置模型；本地 CLI 需已安装） |
| `AGENTS.md` | 新增规划文档的用途与读取时机（`docs/PRD-*.md`、`docs/features/**`） |

**打包与产物**：`npm run desktop:release` 只允许目标版本 `0.3.0`；产物新鲜度、版本、arm64、包结构、SHA-256 校验全部沿用既有脚本；签名与 notarization 仍未配置时必须在报告中明确「仅适合个人测试」。

**非目标**：不新增功能；不调整阈值与接口；不修改历史归档与历史标签。

## Plan

改动：`package.json`、`feature_list.json`、`scripts/release-guards.mjs`（+ 测试）、`CHANGELOG.md`、`PROGRESS.md`、`session-handoff.md`、上表全部文档。

## Tasks

| id | 任务 | RED（先改测试） | 完成条件 | 验证 |
| --- | --- | --- | --- | --- |
| T6.1 | 登记 `feat-023`；版本与门禁改造 | `scripts/release-guards.test.mjs` | 目标版本 `0.3.0`；旧版本被拒；历史归档保护与新鲜度校验未被放宽 | `npm test -- release-guards` |
| T6.2 | 覆盖率门槛 | `vitest.config.ts` 门槛调整 | `src/lib/translate/**` 纳入 coverage `include` 并达标 | `npm run test:coverage` |
| T6.3 | 文档更新 | — | 上表六份文档全部更新且与实现一致（无剩余冲突表述） | 人工复核 + `grep` 冲突表述 |
| T6.4 | 发布产物 | — | `npm run desktop:release` 通过；ZIP 版本 `0.3.0`、arm64、SHA-256 与大小记录到 PROGRESS | `npm run desktop:release` |
| T6.5 | 全量回归 | — | `./init.sh`、`npm run test:e2e`（三浏览器）、桌面冒烟全绿；`npm run test:live` 结果记录（不阻断） | 上述命令 |
| T6.6 | 收尾 | — | `feature_list.json` 全部条目 `done` 且有证据；PROGRESS / session-handoff / CHANGELOG 对齐；`activeFeature: null` | 人工复核 |

## Handoff

- 写清：最终版本号、产物路径/大小/SHA-256、各项验证的实测数字、未签名限制的表述、以及「下一轮工作如何起步」的一句话结论。

## 已授权的偏差（2026-09-18）

Spec 与 T6.1 的「历史归档保护不得改动」是**在归档仍存在**的前提下写的。执行时发现 0.1.0–0.2.0 的 ZIP 与 0.1.3 只读副本已从本机永久丢失（已穷尽废纸篓/iCloud/外接盘/备份工具/快照/GitHub 各路径），原条件无法满足。

用户选择方案 A 并明确授权修改 `scripts/release-guards.mjs`：**缺文件不再阻断发布**（报 retired 并继续），但**仍然存在的归档照旧逐字节校验哈希**，被改动/可写的归档、目录中未登记的发布 ZIP、`v0.1.3` 标签仍硬失败。改造按 TDD 先行（RED 6 failed / 23 passed），并把重下的 `0.2.1`（SHA-256 与历史记录逐字节一致）加回 `PROTECTED_HISTORICAL_ZIP_MANIFEST` 使其重新受强制校验。结果：`npm run desktop:release` 通过并产出 `0.3.0` ZIP。
