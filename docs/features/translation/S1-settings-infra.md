# S1 — 设置基建（Spec / Plan / Task）

- 上游：`docs/PRD-translation.md`、`docs/features/translation/FSD.md`
- 状态：**已完成**（2026-09-17；证据见 `PROGRESS.md` §0.3.0 S1 与 `feature_list.json` `feat-018`）
- feature_list id（本阶段起步时登记）：`feat-018`

## Spec

**目标**：建立设置与密钥的持久化基建、主进程到本地服务的安全注入通道、设置页骨架与入口。本阶段不实现任何 Provider 网络调用、不实现翻译。

**关键决定**（细节见 FSD §1、§2）：

1. `settings.json` 由**本地服务**读写（`GET/PUT /api/settings`），因为既有测试与安全校验基建都在 Next 侧且 e2e 可覆盖；`secrets.json` 由 **Electron 主进程**读写（`safeStorage` 只能在主进程用）。两个文件各自只有一个写入者。
2. 设置目录：`process.env.MD_CONVERTOR_USER_DATA`；缺失时回落 `~/.md-convertor`（开发与 e2e 可用临时目录注入）。
3. 密钥解析顺序：服务端进程 env（含主进程注入的 `MD_CONVERTOR_SECRETS` base64 JSON）→ `userData/.env` → safeStorage 项。**响应与日志永不包含明文密钥**，`keyStored: boolean` 是唯一暴露的状态。
4. PATH：主进程合并（`process.env.PATH` + `/bin/zsh -lc 'echo -n $PATH'` + 用户级目录 + 系统目录，去重保序）后作为子进程 `PATH` 注入；服务端直接用 `process.env.PATH`，不重复实现合并。
5. 设置入口：页头 gear → 同窗口 `/settings`；不新增独立窗口、不新增 macOS「设置…」菜单项。
6. 非 Electron 环境（浏览器 / e2e）没有 preload：`window.mdConvertor` 缺失时，设置页隐藏「直接输入密钥」相关控件，其余功能照常可用。

**权限**：`settings.json` 与 `secrets.json` 均 0600；写入为「临时文件 + rename」原子写。

**非目标**：Provider CRUD 的实际网络调用、模型列表拉取、翻译逻辑、语言/开关的完整 UI（S2 做）。

## Plan

新增：

- `src/types/settings.ts` — 设置类型、`DEFAULT_SETTINGS`、校验（纯函数，无 IO）
- `src/lib/settings/paths.ts` — 设置目录与文件路径解析
- `src/lib/settings/store.ts` — 读写、原子写、schema 版本迁移、损坏文件备份并回落默认
- `src/app/api/settings/route.ts` — GET（脱敏）/ PUT（校验后写盘）
- `electron/secrets.mjs` — `safeStorage` 封装（crypto 接口可注入以便测试）
- `electron/env.mjs` — PATH 合并、`.env` 解析、secrets base64 组装（纯函数）
- `electron/preload.cjs` + `electron/preload-contract.cjs` — `contextBridge` 暴露 `window.mdConvertor.secrets.{set,clear,status}`，通道与参数白名单（实现差异见下）
- `src/app/settings/page.tsx`、`src/app/settings/page.module.css` — 设置页骨架（四个分节占位：云端 Provider / 本地代理 / 语言 / 翻译）

改动：

- `electron/main.mjs` — `webPreferences.preload`；`ipcMain.handle` 注册密钥通道；spawn 本地服务时注入 `MD_CONVERTOR_USER_DATA`、`MD_CONVERTOR_SECRETS`、合并后的 `PATH`
- `src/app/page.tsx` — 页头新增 gear 入口链接

测试文件：`src/types/settings.test.ts`、`src/lib/settings/store.test.ts`、`src/app/api/settings/route.test.ts`、`electron/env.test.mjs`、`electron/secrets.test.mjs`、`electron/preload.test.cjs`、`e2e/settings.spec.ts`（vitest 默认 include 已覆盖 `electron/*.test.cjs`）。

实施偏差（T1.6）：Electron 沙箱 preload 不能 `require` 相对路径，实测报 `module not found: ./preload-api.cjs`，故桥逻辑落在自包含的 `electron/preload.cjs`，通道名与限额契约落在 `electron/preload-contract.cjs`（主进程 import），`electron/preload.test.cjs` 用假 `electron` 模块加载真实的 `preload.cjs` 并断言两者一致。

## Tasks

| id | 任务 | RED（先写失败测试） | 完成条件 | 验证 |
| --- | --- | --- | --- | --- |
| T1.1 | 登记 `feat-018` 为 `in-progress`，写设置类型与校验 | `src/types/settings.test.ts` | 非法 URL、非法 BCP-47、未知字段、缺字段被拒绝；默认值稳定 | `npm test -- settings` |
| T1.2 | 设置存储层 | `src/lib/settings/store.test.ts` | 默认回落、原子写、0600、损坏文件备份为 `settings.corrupt-<ts>.json` 且回落默认、未知高版本拒绝 | `npm test -- store` |
| T1.3 | `GET/PUT /api/settings` | `src/app/api/settings/route.test.ts` | 沿用 `validateConvertApiCaller`（token/origin/content-type 三类拒绝）；PUT 非法体 400；响应脱敏（不含密钥类字段） | `npm test -- api/settings` |
| T1.4 | 主进程环境组装 | `electron/env.test.mjs` | PATH 去重保序；`.env` 解析（注释/空行/引号/重复键后者胜/缺文件容错）；secrets base64 组装 | `npm test -- env` |
| T1.5 | 密钥加解密 | `electron/secrets.test.mjs` | 往返一致；`isEncryptionAvailable() === false` 时明确报错**不落明文**；`clear` 后 `keyStored === false` | `npm test -- secrets` |
| T1.6 | preload 与 IPC 白名单 | `electron/preload.test.cjs` | 未注册通道被拒；参数类型/长度校验；非法调用抛错且不产生副作用 | `npm test -- preload` |
| T1.7 | 主进程接线 | 手动冒烟 | spawn 注入三个环境变量；`ipcMain` 通道可用；`ELECTRON_SMOKE_TEST=1` 仍能正常起停 | `npm run desktop:package` 后运行冒烟 |
| T1.8 | 设置页骨架与入口 | `e2e/settings.spec.ts` | 页头 gear 打开 `/settings`；`GET/PUT` 往返生效；无 preload 时密钥控件隐藏 | `npm run test:e2e` |
| T1.9 | 阶段收尾 | — | `./init.sh` 全绿；PROGRESS/session-handoff/feature_list 更新；`feat-018` 置 `done` | `./init.sh` |

## Handoff

- 结束时必须写清：设置文件实际路径、密钥解析顺序的最终实现、`window.mdConvertor` 暴露的确切方法签名、S2 需要的注入点（`/api/runtime/secrets` 尚未实现）。
- 已知限制：开发模式（`npm run dev:desktop`）下本地服务由外部 `next dev` 启动，主进程注入的 `MD_CONVERTOR_SECRETS` 不生效；此时密钥需来自 shell 环境或 `userData/.env`。生产打包模式无此限制。
