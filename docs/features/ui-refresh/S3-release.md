# S3 — 发布 0.3.5（Spec / Plan / Tasks）

- 上游：`docs/PLAN-next-phase.md`、`docs/features/ui-refresh/FSD.md`
- 前置：S1（色彩系统）、S2（字重收敛）已完成并各自提交
- 状态：**已完成（2026-09-21）**：版本 `0.3.5`、门禁 exit 0、产物已装本机并发布 GitHub Release `v0.3.5`
- feature_list id：`feat-039`

## Spec

**目标**：把视觉刷新作为 `0.3.5` 发布 —— 升版本、过门禁、装本机、发布 Release、同步文档。

**关键决定**：

1. **版本 `0.3.5`**：`0.3.1`–`0.3.4` 均已发布且 tag 已固定，不得移动或覆盖；门禁硬校验唯一目标版本。
2. **门禁必须用 Node 24.14.1 或 24.15.0**：本机默认的 v24.16.0 在解压 electron zip 时会静默卡死，`electron-forge make` 空跑但仍返回 exit 0（即「看起来跑完了其实什么都没产出」）。
3. 版本升级按现有 TDD 流程走，**先 RED 再 GREEN**（见 Tasks T3.1）。
4. 发布前跑提交门（ponytail → code-review → neat-freak），未经用户确认不执行 commit。
5. 签名与 notarization 仍未配置，产物**仅适合个人测试**，Release 说明里要写明。

**非目标**：不改打包配置、不动应用图标、不重打任何历史产物、不动历史 tag。

## Plan

### 1. 版本升级（TDD）

RED：先把 `scripts/release-guards.test.mjs` 的 fixture 改到 `0.3.5` → 应当失败（脚本仍要求 `0.3.4`）。

GREEN：同步四处 ——

- `scripts/release-desktop.mjs`：`RELEASE_VERSION_ERROR`（第 21 行）与目标版本判定（第 155 行）
- `package.json`
- `package-lock.json`（root 与 `packages[""]`）
- `feature_list.json` 的 `currentVersion`

> 坑：不要用整文件替换把旧版本 fixture 一起改掉。`release-guards.test.mjs` 里「旧版本必须被拒」的 fixture 应保持与目标版本**不同**的固定值（`feat-031` 踩过：fixture 被顺带改掉后断言恒真）。

### 2. 验证

| 层级 | 命令 |
| --- | --- |
| 基线 | `./init.sh` |
| 跨浏览器 | `npm run test:e2e` |
| 联网对照 | `npm run test:live`（仅发布前） |
| 门禁 | `npm run desktop:release`（Node 24.14.1/24.15.0） |

### 3. 产物独立复核

ZIP 大小、SHA-256（与门禁输出比对）、`unzip -t`、`CFBundleShortVersionString`、`file` 架构。**另外**：解出包内 CSS，确认已发布产物里就是新配色（`#2a395c`）与收敛后的界面字重（`--weight-ui: 400`、`--weight-body: 400`）与抗锯齿，而不是只验源码。

### 4. 安装与冒烟

退出运行中的旧应用 → 备份 → `ditto` 装到 `/Applications` → 清隔离属性 → `ELECTRON_SMOKE_TEST=1 ELECTRON_SMOKE_TEST_SECRETS=1` 冒烟 → 截图目视确认新配色与收敛后的界面字重（这是本 feature 唯一的真机验收方式）。

### 5. 文档同步

`CHANGELOG.md` + `CHANGELOG.zh.md` 的 `[Unreleased]` 归档为 `[0.3.5]`；`PROGRESS.md`、`session-handoff.md`、`feature_list.json`、`docs/TESTING.md`（产品数字与测试计数）对齐；`docs/features/ui-refresh/*` 状态标 `done`。

## Tasks

| id | 任务 | 状态 | RED（先写失败测试） | 完成条件 | 验证 |
| --- | --- | --- | --- | --- | --- |
| T3.1 | 升版本到 `0.3.5` | done | 改 `scripts/release-guards.test.mjs` fixture → 必须失败 | 四处同步后守卫全绿 | `npm test -- release-guards` |
| T3.2 | 提交前跑提交门 | 待做 | — | ponytail / code-review / neat-freak 三项结论记录在案 | 人工 |
| T3.3 | 跑门禁 | 待做 | — | exit 0，尾段 `Release Artifact Verified` | `npm run desktop:release` |
| T3.4 | 产物独立复核 | 待做 | — | 哈希/架构/版本一致；包内 CSS 含 `#2a395c` | `unzip` + `grep` |
| T3.5 | 装本机并冒烟 | 待做 | — | 冒烟 exit 0；截图确认新配色与收敛后的界面字重 | `ELECTRON_SMOKE_TEST=1 …` |
| T3.6 | 发布 GitHub Release | 待做 | — | tag 指向该 ZIP 的源码提交；资产大小一致 | `gh release view v0.3.5` |
| T3.7 | 文档与状态收尾 | 待做 | — | CHANGELOG 归档；PROGRESS/session-handoff/feature_list 更新；`feat-039` 置 `done` | `./init.sh` |

## Handoff

- 结束时必须写清：ZIP 大小与 SHA-256、tag 指向的提交、本机安装版本、以及「再改代码必须升到 ≥ 0.3.6」。
- 已知限制：未签名未 notarized，Gatekeeper 可能要求显式打开或清除隔离属性；这不是回归，是既定状态。
