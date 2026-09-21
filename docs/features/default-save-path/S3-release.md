# S3 — 发布收口（版本门禁、安装、Release、文档）

- 上游：`docs/features/default-save-path/FSD.md`
- 前置：S1 + S2 已完成且各自提交
- 状态：**待实施**
- feature_list id：`feat-041`

## Spec

**目标**：把 `feat-041` 交付为已门禁、已安装、已发布的 `0.3.6`。

**要点（全部沿用既有发布纪律）**：

1. 目标版本 `0.3.6`（若 S3 开工时 `currentVersion` 已被其它 feature 顺延，以当时值为准，不硬编码）。
2. **门禁必须用 Node.js 24.14.1 或 24.15.0**——本机默认 v24.16.0 在解压 electron zip 时静默卡死、`electron-forge make` 空跑却 exit 0（`feat-034` 的教训，见 `docs/QUALITY-AUDIT.md`）。
3. `0.3.1`–`0.3.5` 的历史 ZIP 与 tag 一律不动。
4. 未签名，release notes 必须写明「仅适合个人测试」（QA-008 accepted）。

## Tasks

| id | 任务 | 说明 | 验证 |
| --- | --- | --- | --- |
| T3.1 | 全量验证 | `./init.sh`（lint/typecheck/coverage/build）+ `npm run test:e2e` 三引擎 + `npm run test:live` | 全部 exit 0，计数记入 PROGRESS |
| T3.2 | 发布门禁 | `npm run desktop:release`（Node 24.14.1/24.15.0） | exit 0；记录 ZIP bytes 与 SHA-256 |
| T3.3 | 独立复核 | `unzip -t`、`CFBundleShortVersionString`、Mach-O arm64、包结构、asar 检查 | 与 `docs/TESTING.md` 口径一致 |
| T3.4 | 安装本机 | 退出旧应用 → 备份 → `rm -rf` 旧包 → `ditto` 新包 → 清隔离属性 | `defaults read` 版本正确；`ELECTRON_SMOKE_TEST=1 ELECTRON_SMOKE_TEST_SECRETS=1` exit 0 |
| T3.5 | 真机验收 | 用户两态走查：开默认目录（不弹框、文件落盘）+ 关默认目录（弹框） | 用户确认 |
| T3.6 | 提交与发布 | 提交（含版本与文档）→ `git push` → `gh release create v0.3.6 <zip>`（notes 写明未签名） | tag 指向发布提交、资产 uploaded |
| T3.7 | 文档收口 | `CHANGELOG.md`(+zh) `[Unreleased]` → `[0.3.6]`；`docs/TESTING.md`(+zh) 门禁计数与产物段；`README`(+zh) 如有行为差异；`docs/ARCHITECTURE.md`(+zh) 增补 IPC 通道与安全边界（filename 校验、日志纪律）；`docs/QUALITY-AUDIT.md` 归档本轮；`AGENTS.md` 版本行 → `0.3.6`；`PROGRESS.md` / `session-handoff.md` 重写；`feature_list.json` `feat-041` → done | 下一会话可按 Startup Workflow 无歧义恢复 |

## Handoff

- S3 结束时 `session-handoff.md` 的 Resume Here 必须回到「当前版本 0.3.6、无 in-progress feature」的干净态。
- 提交门沿用用户要求的顺序（ponytail → code-review → neat-freak）。
