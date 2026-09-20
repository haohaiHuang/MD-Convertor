# S3 — 翻译引擎（Spec / Plan / Task）

- 上游：`docs/PRD-translation.md`、`docs/features/translation/FSD.md`（§3–§6 是权威契约）
- 依赖：S2 已完成（可读取当前生效的 Provider/CLI 配置与模型）
- 状态：**已完成**（2026-09-17；T3.1–T3.11 全部完成，证据见 `PROGRESS.md` §0.3.0 S3 与 `feature_list.json` `feat-020`）
- feature_list id：`feat-020`

## Spec

**目标**：后端具备完整翻译能力——分段/重组、语言判定、按范围翻译、批次、限额、超时、取消，两条模型路径（OpenAI 兼容 HTTP / 本机 CLI）。前端在本阶段之后即可只依赖两个端点工作。

**核心不变量（本阶段第一优先级）**：
> 分段器与重组器必须保证：当模型原样返回输入文本时，重组结果与输入**逐字节相同**。

覆盖：H1/多级标题、段落、有序/无序/嵌套列表、引用、表格（含分隔行与管道）、围栏代码块（含 Mermaid）、行内代码、链接与图片（含 base64）、HTML 块与标签、水平线、`> 转换时间：…` 元信息行、CRLF/LF、行尾空格、emoji、全角标点、空行。

**端点**（FSD §1.2）：

- `POST /api/translate/analyze` → `{ analysis, warnings, meta }`；判定块由模型完成，占比由服务端按字符数计算。
- `POST /api/translate/run` → `{ markdown, warnings, meta }`；`scope: "all" | "non-target"`；回传的 `analysis` 与重新分段结果块数不一致时返回 409 要求重新判定。

**限额与行为**：200,000 散文/待翻译字符上限、批次 ≤ 20 块且 ≤ 8,000 字符、单次调用 180s、任务总预算按批次数动态计算（下限 120s，见下表；该值在 0.3.0 之后由固定 120s 修订）、全局单任务锁、取消即中止在途请求并 kill CLI 子进程、错误码严格按 FSD §5。

**测试桩 Provider**：`MD_CONVERTOR_TEST_PROVIDER=1` 时启用内置伪模型（判定：按块内是否含 CJK 返回标签；翻译：`[<lang>] <text>`），仅测试与 e2e 使用，生产环境该变量未设置则完全不存在此分支。

**非目标**：任何 UI（S4/S5）；不新增运行时依赖（JSON 解析、切批、锁都用既有能力实现）；不引入流式。

## Plan

新增：

- `src/lib/translate/segment.ts` — `segmentMarkdown` / `reassemble`
- `src/lib/translate/analysis.ts` — 占比计算与阈值无关的统计
- `src/lib/translate/prompt.ts` — system/user 构造、输出解析、单次重试、容错（剥最外层围栏）
- `src/lib/translate/provider/provider.ts` — 当前生效配置解析（cloud/local）与统一 `callModel` 接口
- `src/lib/translate/provider/openai-compatible.ts` — HTTP 非流式调用
- `src/lib/translate/provider/local-cli.ts` — CLI 参数构造、stdin 写入、stdout 收集、退出码与超时处理
- `src/lib/translate/provider/test-provider.ts` — 测试桩
- `src/lib/translate/run.ts` — 批次、范围过滤、任务锁、超时、取消
- `src/lib/translate/limits.ts` — 全部常量集中
- `src/app/api/translate/analyze/route.ts`、`src/app/api/translate/run/route.ts`
- 探针脚本：`scripts/probe-local-cli.mjs`（一次性，用于确认 CLI 参数，不进入产品路径）

改动：`vitest.config.ts`（coverage `include` 增加两个翻译端点并给 `src/lib/translate/**` 各模块设定门槛）。

测试：上述每个模块的 `*.test.ts`，HTTP 用注入的 `fetch` 伪装，CLI 用注入的 `spawn` 伪装（**不真跑 CLI**）。

## Tasks

| id | 任务 | RED | 完成条件 | 验证 |
| --- | --- | --- | --- | --- |
| T3.1 | 登记 `feat-020`；CLI 探针 | — | 用 `scripts/probe-local-cli.mjs` 实测 `pi` / `claude`：stdin 能否喂 prompt、限权参数、模型参数、长 prompt（>100KB）表现；结论写回本文件 | 探针输出贴入本文件 |
| T3.2 | 分段器 | `segment.test.ts` | **身份回归逐字节一致**（含 FSD §3 全清单）；`skip` 块不进 prompt；元信息行不参与 | `npm test -- segment` |
| T3.3 | 重组器与范围过滤 | `segment.test.ts` | `scope="non-target"` 只替换非目标块，其余字节不变；块数不匹配报错 | `npm test -- segment` |
| T3.4 | prompt 构造与解析 | `prompt.test.ts` | 编号集合校验、重复/缺号/非 JSON/围栏包裹、重试一次后报 `TRANSLATE_INVALID_RESPONSE` | `npm test -- prompt` |
| T3.5 | HTTP 适配器 | `openai-compatible.test.ts` | 请求头含 Bearer、非流式、非 2xx 与网络错误映射、超时中止 | `npm test -- openai` |
| T3.6 | CLI 适配器 | `local-cli.test.ts` | 参数构造含探测结论；prompt 走 stdin；`shell:false`；非零退出与超时 kill 映射；不授予工具权限 | `npm test -- local-cli` |
| T3.7 | 批次、限额、锁、取消 | `run.test.ts` | ≤20 块/≤8000 字符分批；>200k 字符 413；并发 429；取消中止并返回；空散文 400 | `npm test -- run` |
| T3.8 | 判定与统计 | `analysis.test.ts` | 占比按字符数、排除 `skipped`；边界 0 / 100% | `npm test -- analysis` |
| T3.9 | 两个端点 | `route.test.ts` | 两类安全拒绝 + 全部错误码映射 + 分析块数不一致 409 | `npm test -- translate` |
| T3.10 | 测试桩与端到端冒烟 | — | `MD_CONVERTOR_TEST_PROVIDER=1` 下 analyze→run 在真实 HTTP 上跑通；未设置时分支不存在 | 手动 curl + `./init.sh` |
| T3.11 | 阶段收尾 | — | coverage 门槛生效；`./init.sh` 全绿；状态文件更新；`feat-020` 置 `done` | `./init.sh` |

## T3.1 探针结论（实测于 2026-09-17，本机 macOS 26.7 / darwin-arm64）

探针脚本：`scripts/probe-local-cli.mjs`（一次性诊断，不在产品路径内；静态探针默认运行，真实模型调用需 `--live`）。实测版本：`pi 0.85.1`、`claude 2.1.273 (Claude Code)`。

| CLI | stdin 支持 | 限权参数 | 模型参数 | 长 prompt 表现 | 结论 |
| --- | --- | --- | --- | --- | --- |
| pi | **支持**：`printf '<prompt>' \| pi -p --no-tools --no-session --no-extensions --no-skills --no-context-files --mode text` ⇒ exit 0，stdout 含 `{"ok":true}`（2.1s） | `--no-tools`；隔离上下文与落盘另加 `--no-session --no-extensions --no-skills --no-context-files` | `--model <pattern>`（省略 = CLI 默认模型） | stdin 126,063 B ⇒ exit 0 且模型回显 `PROBE-MARKER-OK`（20.5s，未截断）；同长度 argv 亦 exit 0（macOS ARG_MAX ≈1 MB），但不作依赖 | prompt 走 stdin，绝不走 argv；空 stdin 时 `pi -p` exit 0 且 stdout 为空 ⇒ 空输出必须判为无效响应 |
| claude | **支持**：空 stdin 时自报 `Error: Input must be provided either through stdin or as a prompt argument when using --print`；经 stdin 喂入后进入模型调用阶段 | `--tools ""`（禁用全部内置工具）＋ `--output-format text`；**不用** `--bare`（它会禁用 OAuth/keychain，本机为 `oauth_token` 登录） | `--model <id\|alias>`（省略 = CLI 默认模型） | stdin 126,063 B 无 spawn/ARG 错误；同长度 argv 亦未触发 E2BIG | prompt 走 stdin；**本机账号当前无可用模型**（`claude auth status` 为 `loggedIn: true / oauth_token`，但默认 `claude-opus-4-8[1m]` 与 `sonnet`/`opus`/`claude-sonnet-4-5`/`claude-3-5-haiku-latest` 全部返回 `It may not exist or you may not have access to it`），故 claude 端到端译文未能实测 |

探针原始输出（摘要）：

```json
{"pi": {"static": {"version": "0.85.1", "emptyStdin": {"exitCode": 0, "message": ""}}, "live": {"stdin": {"exitCode": 0, "echoOk": true, "durationMs": 2120}, "longStdin": {"promptBytes": 126063, "exitCode": 0, "sawMarker": true, "durationMs": 20532}, "longArgv": {"bytes": 120000, "exitCode": 0}}}}
{"claude": {"static": {"version": "2.1.273 (Claude Code)", "emptyStdin": {"exitCode": 1, "mentionsStdin": true}}, "live": {"stdin": {"exitCode": 1, "echoOk": false, "message": "There's an issue with the selected model (claude-opus-4-8[1m]). ..."}}}}
```

适配器据此确定（T3.6 实现依据）：

- 两条路径的 prompt 一律经 stdin 写入；argv 只承载开关与模型名。
- `selectedModel` 为空时省略 `--model`，由 CLI 自己的默认模型决定。
- 子进程使用一次性临时目录作为 cwd、`shell: false`、环境剔除全部 `MD_CONVERTOR_*`。
- CLI 的 stdout/stderr **永不**回显给客户端或日志；`exitCode !== 0` 或 stdout 为空 ⇒ 502 `TRANSLATE_PROVIDER_ERROR`；被 kill/超时 ⇒ 504 `TRANSLATE_TIMEOUT`。
- claude 在本机无法端到端验证属于环境限制（账号模型权限），不阻塞实现：T3.6 用注入的 mock spawn 测试覆盖参数构造、stdin 写入、非零退出与超时 kill。

## Handoff

### `callModel` 的最终签名

```ts
type ModelMessage = { role: "system" | "user"; content: string };
type ModelCaller = (messages: readonly ModelMessage[]) => Promise<string>;   // 返回模型原始字符串

type EffectiveModelConfig =
  | { kind: "cloud"; providerId: string; baseUrl: string; apiKeyEnv: string | null; model: string }
  | { kind: "local"; cliId: string; executablePath: string; model: string | null }
  | { kind: "test"; model: string };   // test 档的 model 恒为 TEST_PROVIDER_MODEL = "md-convertor-test"

resolveEffectiveModel(settings, env = process.env): EffectiveModelConfig        // 失败一律 409 TRANSLATE_NOT_CONFIGURED
createModelCaller(config, { deps?, signal?, timeoutMs? }): ModelCaller          // 信号与超时在工厂里绑定到每次调用
```

信号/超时不由 `prompt.ts` 传递：`createModelCaller` 把 `signal` 与 `timeoutMs` 绑定进返回的 `ModelCaller`，因此上层只看见 `(messages) => Promise<string>`。`config.kind === "cloud"` 时密钥在工厂里**提前解析**（`resolveProviderKey`），缺失即 409「尚未配置该 Provider 的密钥。」。

### 批次常量实际值（`src/lib/translate/limits.ts`）

| 常量 | 值 | 用途 |
| --- | --- | --- |
| `TRANSLATE_MAX_PROSE_CHARS` | 200,000 | 散文/待翻译字符上限，超出 413 `TRANSLATE_INPUT_TOO_LARGE` |
| `TRANSLATE_BATCH_MAX_BLOCKS` | 20 | 单批块数上限 |
| `TRANSLATE_BATCH_MAX_CHARS` | 8,000 | 单批字符上限（超长单块自成一批，绝不切块） |
| `TRANSLATE_CALL_TIMEOUT_MS` | 180,000 | 单次模型调用超时（0.3.0 之后由 60s 调高：云端推理模型单批要 38–60s，60s 会读体途中切断） |
| `TRANSLATE_TASK_TIMEOUT_MS` | 120,000 | 任务总预算下限（analyze / run 各自计时） |
| `TRANSLATE_TASK_BASE_TIMEOUT_MS` | 30,000 | 固定余量：配置解析、最后一批与重组 |
| `translateTaskTimeoutMs(batchCount)` | `max(120s, 批次数 × 180s + 30s)` | 任务总预算（0.3.0 之后取代固定 120s，长文不再被 120s 切断） |
| `TRANSLATE_MAX_REQUEST_BYTES` | 40 MiB | 两个端点请求体上限（markdown + base64 图片，故不用 64 KiB 的 `MAX_LOCAL_API_BODY_BYTES`） |

### `analysis` 的精确形状（`src/types/translation.ts`）

```ts
{
  targetLanguage: string,          // 请求里的 BCP-47 标签，原样回传
  totalChars: number,              // 只统计非 skipped 块（含 blank 以外的可译块）
  targetChars: number,             // language === "target" 的块字符数
  ratio: number,                   // targetChars / totalChars，totalChars === 0 时为 0
  blocks: { index: number, language: "target" | "other" | "unknown" | "skipped", chars: number }[]
}
```

- `blocks` 覆盖**全部**分段（含 `skip` 段与空行段，它们为 `skipped` / `chars: 0`），因此 `assertBlockAlignment(segments, analysis.blocks)` 比较的是完整分段序列；prompt 只携带可译块。
- 语言比较按 BCP-47 主标签（`zh` == `zh-Hans`；`zh-Hant` 也被当作 `zh-Hans` 目标，属已知上限）。
- `run` 的响应：`{ markdown, warnings: string[], meta: { targetLanguage, model, scope, batches, translatedBlocks, durationMs } }`；`scope: "non-target"` 且无可译块时 `markdown` 原样返回并带 warning「没有需要翻译的段落。」，`batches`/`translatedBlocks` 为 0。

### 两类 Provider 的调用证据

HTTP（`POST {baseUrl}/chat/completions`，`authorization: Bearer <key>`，`accept: application/json`，非流式）：

```json
{"model":"model-a","stream":false,"messages":[{"role":"system","content":"<ANALYZE_SYSTEM>"},{"role":"user","content":"Blocks:\n[{\"i\":0,\"t\":\"Hello\"}]"}]}
```

翻译调用在 user 消息前多一行 `Target language: zh-Hans`。两段 system 文本都要求「只输出 JSON、不要解释」。

CLI（T3.1 实测结论落地，prompt 只走 stdin、cwd 为一次性临时目录、`shell: false`、环境剔除全部 `MD_CONVERTOR_*`）：

```
pi     : pi -p --no-tools --no-session --no-extensions --no-skills --no-context-files --mode text [--model <id>]
claude : claude -p --tools "" --output-format text [--model <id>]
```

### S4 需要的失败/取消行为映射

| 场景 | 状态码 | 错误码 | S4 前端处理 |
| --- | --- | --- | --- |
| 未配置 Provider/CLI 或密钥 | 409 | `TRANSLATE_NOT_CONFIGURED` | 提示去设置页，不重试 |
| 文档变化 / 目标语言变化 | 409 | `TRANSLATE_ANALYSIS_STALE` | 自动重新 analyze 后重试一次 |
| 模型输出不符合契约（含重试一次后） | 502 | `TRANSLATE_INVALID_RESPONSE` | 提示重试 |
| Provider 不可达 / 非 2xx / CLI 非零退出或空输出 | 502 | `TRANSLATE_PROVIDER_ERROR` | 提示重试（消息只含主机名或退出码） |
| 单次调用 180s 或任务超出动态预算 | 504 | `TRANSLATE_TIMEOUT` | 提示重试 |
| 前端 `AbortController` 取消 | 499 | `TRANSLATE_CANCELLED` | 静默，不当作错误展示 |
| 已有任务在跑 | 429 | `TRANSLATE_BUSY` | 提示等待或稍后重试 |
| 无散文 | 400 | `TRANSLATE_EMPTY_INPUT` | 提示没有可翻译正文 |
| 待翻译字符 > 200,000 | 413 | `TRANSLATE_INPUT_TOO_LARGE` | 提示分段 |

取消没有独立端点：前端通过中断 `POST /api/translate/*` 的 `AbortController` 取消，服务端把在途 HTTP 请求中止、把 CLI 子进程 kill，并释放单任务锁。
