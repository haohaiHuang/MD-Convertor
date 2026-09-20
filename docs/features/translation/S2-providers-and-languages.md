# S2 — Provider / Model 与语言设置（Spec / Plan / Task）

- 上游：`docs/PRD-translation.md`、`docs/features/translation/FSD.md`、S1 交接说明
- 依赖：S1 已完成（设置存储、IPC 桥、注入通道可用）
- 状态：**已完成**（2026-09-17；T2.1–T2.9 全部完成，证据见 `PROGRESS.md` §0.3.0 S2 与 `feature_list.json` `feat-019`）
- feature_list id：`feat-019`

## Spec

**目标**：把 PRD 的 R1a / R1b / R1c 全部做完——云端 Provider 与本地代理分开配置、模型列表获取与管理、全局「当前生效」二选一、目标语言设置、默认翻译开关。本阶段**不发起任何翻译调用**。

**接口**（FSD §1.2、§2）：

| 端点 | 行为 |
| --- | --- |
| `POST /api/provider/models` | 用 active/指定 Provider 的密钥请求 `GET {baseUrl}/models`，返回 `data[].id`；失败映射为 `TRANSLATE_PROVIDER_ERROR`（信息仅含状态码与主机名） |
| `POST /api/local-clis/scan` | 按 `process.env.PATH` 逐目录探测注册表内 CLI（`pi`、`claude`），返回路径与是否安装 |
| `POST /api/local-clis/models` | `pi` 走 `--list-models` 解析；无列表能力的 CLI 返回 `[]`（表示用 CLI 默认模型） |
| `POST /api/runtime/secrets` | 主进程→服务端推送单个密钥（保存/删除后立即生效，不重启服务）；请求体不落盘、不记日志 |

**Provider 端点安全**（独立于网页抓取 SSRF 策略，`src/lib/provider/endpoint.ts`）：仅 `http:`/`https:`；允许 loopback 与私网（用户显式配置的本地代理/自建网关）；拒绝含凭据的 URL、`169.254.169.254` 等云元数据地址、`0.0.0.0`、组播地址；**禁止跨主机重定向**（重定向必须是同主机同 scheme，否则报错）。这与 `src/lib/security/url.ts` 的策略相反，两套实现与两套测试并存，注释写明差异原因。

**密钥来源（UI 口径）**：每个 Provider 可填「环境变量名」（`apiKeyEnv`）和/或直接输入密钥（写入 `safeStorage`）。解析顺序按 FSD §2：进程 env → `userData/.env` → safeStorage。界面显示「已配置 / 未配置」，永不回填明文。

**语言设置**：预置 11 种（简体中文、英语、日语、韩语、法语、德语、西班牙语、葡萄牙语、意大利语、俄语、阿拉伯语）+ 手填 BCP-47 追加；单一 active；源语言固定「自动识别（由模型判定）」，只读展示。

**默认翻译开关**：`translation.defaultEnabled` 持久化；勾选框状态不持久化（S4 消费该开关）。

**非目标**：翻译引擎、结果区 Tab、占比判定；不新增运行时依赖。

## Plan

新增：

- `src/lib/provider/endpoint.ts` — Provider URL 校验与安全请求（禁用跨主机重定向）
- `src/lib/provider/models.ts` — `/models` 拉取与响应解析
- `src/lib/local-cli/registry.ts`、`src/lib/local-cli/scan.ts`、`src/lib/local-cli/models.ts` — CLI 注册表、PATH 扫描（目录列表可注入）、模型列表解析
- `src/app/api/provider/models/route.ts`、`src/app/api/local-clis/scan/route.ts`、`src/app/api/local-clis/models/route.ts`、`src/app/api/runtime/secrets/route.ts`
- `src/lib/settings/languages.ts` — 11 种预置清单与 BCP-47 校验
- `src/app/settings/*` — 四个分节的实际界面（CRUD、拉取模型、手填、active、模式切换、语言、开关）

改动：

- `src/lib/settings/store.ts`、`src/types/settings.ts` — 按 §2 模型补校验与迁移
- `src/app/api/settings/route.ts` — 接受本阶段新增字段
- `electron/main.mjs`、`electron/preload.cjs` — 保存密钥后向 `/api/runtime/secrets` 推送

测试：`src/lib/provider/endpoint.test.ts`、`src/lib/provider/models.test.ts`、`src/lib/local-cli/*.test.ts`、对应 `route.test.ts`、`e2e/settings.spec.ts` 扩充。

## Tasks

| id | 任务 | RED | 完成条件 | 验证 |
| --- | --- | --- | --- | --- |
| T2.1 | 登记 `feat-019`；Provider URL 安全策略 | `src/lib/provider/endpoint.test.ts` | 允许 loopback/私网；拒绝凭据 URL、元数据 IP、非 http(s)、跨主机重定向；DNS 校验与网页抓取策略隔离 | `npm test -- provider` |
| T2.2 | 模型列表拉取 | `src/lib/provider/models.test.ts` | 正常解析、非 2xx 与网络错误映射、无密钥 409、响应体不含密钥 | `npm test -- models` |
| T2.3 | 本地 CLI 扫描与模型 | `src/lib/local-cli/*.test.ts` | 注入目录列表可测；未安装返回空；`--list-models` 解析；无列表能力返回 `[]` | `npm test -- local-cli` |
| T2.4 | 四个新端点 | 对应 `route.test.ts` | 全部走 `validateConvertApiCaller`；错误码符合 FSD §5；`/api/runtime/secrets` 不落盘不记日志 | `npm test -- api/` |
| T2.5 | 语言设置与预置清单 | `src/lib/settings/languages.test.ts` | 11 种预置齐全；非法 BCP-47 拒绝；手填追加去重 | `npm test -- languages` |
| T2.6 | 云端档界面 | `e2e/settings.spec.ts` | 增删改 Provider、拉取/手填模型、选 active、删除二次确认 | `npm run test:e2e` |
| T2.7 | 本地档界面与全局二选一 | `e2e/settings.spec.ts` | 扫描结果展示与启停；active CLI 与模型；模式切换持久化 | `npm run test:e2e` |
| T2.8 | 密钥写入与即时生效 | `electron/secrets.test.mjs` + 手动冒烟 | 保存后 `/api/runtime/secrets` 生效（无需重启）；删除后回退 env/`.env`；界面只显示「已配置」 | 打包冒烟 |
| T2.9 | 默认翻译开关与阶段收尾 | `e2e/settings.spec.ts` | 开关持久化；`./init.sh` 全绿；状态文件更新；`feat-019` 置 `done` | `./init.sh` |

## Handoff

- 写清：settings 最终 schema（含新增字段）、密钥解析与推送的实际路径、CLI 注册表与扫描目录的最终顺序、S3 需要的「当前生效配置」读取函数名与返回形状。
