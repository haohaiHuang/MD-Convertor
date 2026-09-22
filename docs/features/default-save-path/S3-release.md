# S3 — 发布收口（版本门禁、安装、Release、文档）

- 上游：`docs/features/default-save-path/FSD.md`
- 前置：S1 + S2 已完成且各自提交；用户真机两态验收已签字（2026-09-22）
- 状态：**进行中（T3.0 已完成，剩 T3.1–T3.7）**
- feature_list id：`feat-041`

## Spec

**目标**：把 `feat-041` 交付为已门禁、已安装、已发布的 `0.3.6`。

**要点（全部沿用既有发布纪律）**：

1. 目标版本 `0.3.6`（若 S3 开工时 `currentVersion` 已被其它 feature 顺延，以当时值为准，不硬编码）。
2. **门禁必须用 Node.js 24.14.1 或 24.15.0**——本机默认 v24.16.0 在解压 electron zip 时静默卡死、`electron-forge make` 空跑却 exit 0（`feat-034` 的教训，见 `docs/QUALITY-AUDIT.md`）。
3. `0.3.1`–`0.3.5` 的历史 ZIP 与 tag 一律不动。
4. 未签名，release notes 必须写明「仅适合个人测试」（QA-008 accepted）。
5. **T3.0 的 asar 收窄必须先于 `desktop:make`**：它改变打包产物内容，因此必须在同一轮重打并跑冒烟，不能在发布后再补。

## T3.0 背景

收窄前的 asar 把**整个仓库根**装进包（253 个条目：`.workbuddy/`、`AGENTS.md`、`CHANGELOG*`、`docs/`、`e2e/`、`feature_list.json`、`init.sh`、`next.config.ts`、`playwright.config.ts`、`PROGRESS.md`、`README*`、`scripts/`、`session-handoff.md`、`src/`、`tests/`、`tsconfig*`、`vitest*`），而运行时不读其中任何一个。已知代价有三条，**第一条最严重**：

- **私有工作文档会随发布物公开**：`app.asar` 里装着 `.workbuddy/memory/*.md`（跨会话工作日志）、`session-handoff.md`、`PROGRESS.md` 等。本版本的交付形态正是 GitHub Release 的 ZIP，下载者解包即可读到这些内部记录。收窄前等于把它们发布出去。
- **字符串判定被污染**：修复 iCloud 缺陷后，asar 里仍能搜到 6 处 `value.includes("~")`，全部来自被打进包的文档。判断「这个包有没有带上修复」因此需要额外的排除推理，容易误判。
- **冗余副本**：仓库根的 `public/` 已被 `scripts/prepare-desktop.mjs` 复制进 `.desktop/server/public`，asar 里那份是死副本。

运行时真正依赖的两处：

| 依赖 | 位置 | 是否在 asar 内 |
| --- | --- | --- |
| `process.resourcesPath/server`（Next standalone 服务、headless Chromium） | `Contents/Resources/server/` | 否，走 `extraResource` |
| `path.join(import.meta.dirname, "preload.cjs")` 及 `main.mjs` 的 `./*.mjs` 同级导入 | `Contents/Resources/app.asar/electron/` | 是 |
| `package.json`（Electron 据此解析 `main`） | `app.asar/package.json` | 是 |

**风险与回退**：收窄是打包配置改动，若排除过头会让应用启动即失败，且**单元测试抓不到**（它只断言配置，不跑真实包）。因此 T3.0 的完成条件是三重：守卫测试绿 + `asar list` 收敛 + **冒烟 exit 0**。若冒烟失败，回退到收窄前的 ignore 列表并重新打包。

## Tasks

| id | 任务 | 说明 | 验证 |
| --- | --- | --- | --- |
| T3.0 | asar 收窄 ✅ **已完成**（2026-09-22，提交 `7cf1111`） | `forge.config.cjs` 的 `packagerConfig.ignore` 改为**保留清单**：应用运行时只读 `process.resourcesPath/server`（`extraResource`，不在 asar 内）与 `import.meta.dirname` 下的 `electron/` 模块，因此 asar 只保留 `package.json` 与 `electron/`（含 `main.mjs`、`preload.cjs`、`preload-contract.cjs` 及其同级的 `env.mjs` / `output.mjs` / `runtime-secrets.mjs` / `server-binary.mjs` / `secrets.mjs`）。原先的 11 条黑名单换成一条反向正则 + 一条排除 Electron 侧测试文件的正则。**动机**：见下「T3.0 背景」，首要一条是私有工作文档会随发布物公开 | 三项全过：① `tests/forge-package-scope.test.ts` GREEN 44 passed（RED 26 failed / 18 passed）；② `npx asar list` **253 → 10 条目**、2670300 → 35261 字节；③ **打包冒烟 exit 0** 且两个断言都真跑。附带：`./init.sh` exit 0 → 68 files / 999 tests；双引擎 e2e exit 0 → 160 passed / 2 skipped |
| T3.1 | 全量验证 | `./init.sh`（lint/typecheck/coverage/build）+ `npm run test:e2e` 三引擎 + `npm run test:live` | 全部 exit 0，计数记入 PROGRESS。**三引擎自足可跑**（firefox 的沙箱开关已固化进 `playwright.config.ts`，无需任何环境变量）；注意跑 e2e 期间不要编辑 tracked 文件（tracked-file 守卫会报假失败），且若上一轮运行被杀掉，先核实并结束残留的 3000 端口服务（见 `docs/TESTING.md`），否则本轮几秒内就会报 `health is already used` |
| T3.2 | 发布门禁 | `npm run desktop:release`（Node 24.14.1/24.15.0） | exit 0；记录 ZIP bytes 与 SHA-256 |
| T3.3 | 独立复核 | `unzip -t`、`CFBundleShortVersionString`、Mach-O arm64、包结构、asar 检查 | 与 `docs/TESTING.md` 口径一致 |
| T3.4 | 安装本机 | 退出旧应用（**必须由用户 Cmd+Q**：本沙箱 `osascript quit` 报 -10004）→ 备份现有 `settings.json` / `secrets.json` 并记 md5 → 移除旧安装 → `ditto` 新包 → 清隔离属性（`xattr -dr com.apple.quarantine`）。**不要用 `rm -rf` 删构建输出**：本沙箱里它会让整条链式命令静默中止且不产出日志，而 Forge 本来就会替换 `out/MD-Convertor-darwin-arm64`；旧安装也应先移到废纸篓或临时目录 | `defaults read` 版本正确；`ELECTRON_SMOKE_TEST=1 ELECTRON_SMOKE_TEST_SECRETS=1` exit 0；用户 `settings.json` / `secrets.json` md5 与备份一致 |
| T3.5 | 真机验收 | 用户两态走查：开默认目录（不弹框、文件落盘）+ 关默认目录（弹框） | 用户确认 |
| T3.6 | 提交与发布 | 提交（含版本与文档）→ `git push` → `gh release create v0.3.6 <zip>`（notes 写明未签名） | tag 指向发布提交、资产 uploaded |
| T3.7 | 文档收口 | `CHANGELOG.md`(+zh) `[Unreleased]` → `[0.3.6]`；`docs/TESTING.md`(+zh) 门禁计数与产物段；`README`(+zh) 如有行为差异；`docs/ARCHITECTURE.md`(+zh) 增补 IPC 通道与安全边界（filename 校验、日志纪律）；`docs/QUALITY-AUDIT.md` 归档本轮；`AGENTS.md` 版本行 → `0.3.6`；`PROGRESS.md` / `session-handoff.md` 重写；`feature_list.json` `feat-041` → done | 下一会话可按 Startup Workflow 无歧义恢复 |

## Handoff

- S3 结束时 `session-handoff.md` 的 Resume Here 必须回到「当前版本 0.3.6、无 in-progress feature」的干净态。
- 提交门沿用用户要求的顺序（ponytail → code-review → neat-freak）。
