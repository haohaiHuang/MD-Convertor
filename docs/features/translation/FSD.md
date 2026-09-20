# FSD 总纲 — 文档翻译能力（v0.3.0）

- 状态：**规划完成，待批准实施**
- 日期：2026-09-17
- 上游：`docs/PRD-translation.md`（产品决定全部以 PRD 为准，本文件只定技术方案）
- 阶段执行文档：`docs/features/translation/S1-*.md` … `S6-*.md`（每份含 Spec / Plan / Task 三段，可独立新会话执行）

---

## 1. 架构决定

### 1.1 进程与职责边界

| 位置 | 职责 | 不做什么 |
| --- | --- | --- |
| Electron 主进程（`electron/`） | 设置文件与密钥存储（`safeStorage`）、拼接 PATH、启动 Next 子进程、把已保存的密钥推送给运行中的服务、提供受限 IPC | 不发起模型请求、不 spawn CLI、不含翻译逻辑 |
| Next 本地服务（`src/app/api/**`，`src/lib/**`） | 全部翻译逻辑：分段、判定、调模型（HTTP/CLI）、限额、超时、取消 | 不直接读 `safeStorage`、不写设置文件 |
| Renderer（`src/app/**`） | 设置界面、勾选框、Tab、进度与错误展示 | 永不接触明文密钥、不直接调模型 |

**密钥流向**：主进程解密 `safeStorage` 项 → 注入 Next 子进程的运行时密钥表（`MD_CONVERTOR_SECRETS`），并在每次保存/清除后推送更新 → 服务端只按 Provider id 取值 → 仅用于出站请求头。明文密钥不出现在 renderer、日志、错误响应与设置文件中。

选择理由：现有全部逻辑与测试基建都在 Next 侧（`src/lib/**` + vitest + 既有 API 安全校验），把翻译引擎放这里可复用 `validateConvertApiCaller`、限流、`AppError` 与测试模式；主进程保持薄壳（与现状一致）。

### 1.2 新增本地 API（全部沿用既有安全前置）

所有新端点都必须通过 `validateConvertApiCaller`（loopback Host + Origin/Sec-Fetch-Site + 会话 token + Content-Type）。

| 端点 | 方法 | 请求 | 响应 |
| --- | --- | --- | --- |
| `/api/provider/models` | POST | `{ providerId }` 或草稿 `{ baseUrl, apiKey }`（草稿缺的一半回退到已保存的 Provider） | `{ models: string[] }`（服务端带密钥请求 `GET {base}/models`；草稿请求不写 settings） |
| `/api/local-clis/scan` | POST | `{}` | `{ clis: [{ id, name, path, installed }] }` |
| `/api/local-clis/models` | POST | `{ cliId }` | `{ models: string[] }`（无列表能力的 CLI 返回空数组，表示用 CLI 默认模型） |
| `/api/translate/analyze` | POST | `{ markdown, targetLanguage }` | `{ analysis, warnings, meta }` |
| `/api/translate/run` | POST | `{ markdown, targetLanguage, analysis, scope }` | `{ markdown, warnings, meta }` |

`analysis` 结构：

```ts
type BlockLanguage = "target" | "other" | "unknown" | "skipped";
type TranslationAnalysis = {
  targetLanguage: string;
  totalChars: number;    // 参与统计的散文总字符数
  targetChars: number;   // 其中判定为目标语言的部分
  ratio: number;         // targetChars / totalChars
  blocks: { index: number; language: BlockLanguage; chars: number }[];
};
```

`scope`：`"all"`（全文翻译）| `"non-target"`（只翻译 `language !== "target"` 且未跳过的块）。

`analyze` 与 `run` 分两次调用（判定先行）的原因：占比 ≥ 97% 时不产生任何翻译调用；弹确认框后不重复判定（客户端把服务端返回的 `analysis` 原样回传，服务端用重新分段的结果校验块数一致性，不一致则要求重新判定）。本地单用户场景，不额外做防篡改。

---

## 2. 设置数据模型

`userData/settings.json`（0600，原子写：临时文件 + rename；解析失败时备份为 `settings.corrupt-<ts>.json` 并回落默认）：

```ts
type Settings = {
  version: 1;
  mode: "cloud" | "local";            // 全局当前生效（二选一）
  cloud: {
    providers: {
      id: string;
      name: string;
      baseUrl: string;                // 如 https://api.openai.com/v1
      keyStored: boolean;             // 是否已在系统密钥库中（明文永不写入本文件）
      models: string[];
      selectedModel: string | null;
    }[];
    activeProviderId: string | null;
  };
  local: {
    clis: {
      id: "pi" | "claude";
      name: string;
      enabled: boolean;
      detectedPath: string | null;
      models: string[];
      selectedModel: string | null;   // null = 用 CLI 默认模型
    }[];
    activeCliId: string | null;
  };
  languages: {
    target: string;                   // BCP-47，如 "zh-Hans"
    custom: string[];                 // 手填追加
  };
  translation: {
    defaultEnabled: boolean;          // PRD R1c
  };
};
```

密钥存储 `userData/secrets.json`：`{ version: 1, entries: { "<providerId>": "<base64 of safeStorage.encryptString>" } }`。解密只在主进程进行。

**密钥解析**（服务端）：只读运行时密钥表——由主进程在启动时注入、保存或清除后即时更新。无值 → `TRANSLATE_NOT_CONFIGURED`。

**PATH 解析**（主进程，复用参考实现做法）：`process.env.PATH` + `/bin/zsh -lc 'echo -n $PATH'` + `~/.npm-global/bin`、`~/.local/bin`、`~/bin` + `/usr/bin`、`/bin`、`/usr/sbin`、`/sbin`、`/usr/local/bin`、`/opt/homebrew/bin`，去重保序后注入子进程环境。理由：GUI 双击启动时 launchd 注入的 PATH 不含用户级目录。

---

## 3. 分段与重组（核心不变量）

`src/lib/translate/segment.ts`——纯函数，无 IO。

- `segmentMarkdown(markdown) -> Segment[]`，`Segment = { index, kind, prefix, text, suffix }`：
  - `prefix`/`suffix` 为该块的 Markdown 标记（如 `## `、`- `、`> `、表格管道、围栏行），**原样保留**；
  - `text` 是唯一可能被模型改写的部分。
- **必须整块跳过（`kind: "skip"`，不进 prompt）**：围栏代码块（含 Mermaid）、行内代码、图片与链接的目标地址（`text` 中保留原样，仅链接文字可翻译）、HTML 标签与属性、水平线与表格分隔行、我们生成的「转换时间」元信息行、纯空白块。
- `reassemble(segments, translations) -> string`：按 `index` 回填 `text`，其余字节原样拼接。

**回归锚点（必须在 S3 先写 RED）**：模型返回与输入完全相同文本时，`reassemble(segmentMarkdown(src), identity)` 必须与 `src` **逐字节相同**（覆盖标题、列表、引用、表格、代码块、链接、图片、Mermaid、元信息行、CRLF/LF、行尾空格、emoji、全角标点）。任何结构破坏都会让该测试失败。

---

## 4. Prompt 契约

两次调用，均为「JSON 进、JSON 出」，禁止散文回答。

**判定（analyze）**：输入 `[{ "i": 0, "t": "…" }]`，要求输出 `[{ "i": 0, "lang": "zh-Hans" }]`（只允许 BCP-47 标签）。校验：`i` 集合与输入完全一致、无重复、`lang` 可解析。不合法 → 重试一次 → 仍失败 `TRANSLATE_INVALID_RESPONSE`。

**翻译（run）**：输入 `[{ "i": 0, "t": "…" }]`，要求输出 `[{ "i": 0, "t": "…" }]`。校验：`i` 集合一致、`t` 为非空字符串、不含整段代码围栏包裹。不合法 → 重试一次 → 仍失败报错。

解析容错（唯一允许的宽容）：剥掉最外层 ``` 围栏后再解析 JSON；正文中的 Markdown 代码块由分段器保护，不依赖模型守规矩。

系统提示固定声明：只输出 JSON、保留 Markdown 行内标记、保留已有 Markdown 语法与占位、不做解释、不改变编号。批次内块数 ≤ 20 且合计字符 ≤ 8,000。

---

## 5. 限额、错误码与取消

| 场景 | 行为 |
| --- | --- |
| 待翻译散文 > 200,000 字符 | 413 `TRANSLATE_INPUT_TOO_LARGE`（提示可先删减或分段转换） |
| 无可翻译散文（全为代码/图片等） | 400 `TRANSLATE_EMPTY_INPUT` |
| 无生效模型 / CLI 未安装 / 无密钥 | 409 `TRANSLATE_NOT_CONFIGURED` |
| 已有翻译任务在跑 | 429 `TRANSLATE_BUSY` |
| 单次模型调用 > 180s / 任务超出动态预算 | 504 `TRANSLATE_TIMEOUT`（沿用 `toAppError` 对 Abort/Timeout 的映射习惯） |
| Provider HTTP 非 2xx、网络失败、CLI 非零退出 | 502 `TRANSLATE_PROVIDER_ERROR`（错误信息不含密钥与正文，仅状态码与端点主机名） |
| 模型输出不合契约（重试后） | 502 `TRANSLATE_INVALID_RESPONSE` |
| 用户取消 | 中止在途请求并终止 CLI 子进程；不写入任何结果 |

并发：服务端单例锁，同一时刻一个任务（判定与翻译共享该锁）。

---

## 6. 模型适配

两条实现路径，共用 prompt 契约与解析器：

**HTTP（云端，OpenAI 兼容）**：`POST {baseUrl}/chat/completions`，`Authorization: Bearer <key>`，`messages: [{role:"system"…},{role:"user"…}]`，非流式，取 `choices[0].message.content`。模型 = `selectedModel`。

**CLI（本地代理）**：注册表 `[{id:"pi",name:"pi"},{id:"claude",name:"claude"}]`。
- 扫描：按 §2 合并 PATH，逐目录探测可执行文件（可注入目录列表以便测试）。
- 调用：`spawn(absolutePath, args, { shell: false, cwd: <临时目录>, env: 最小环境 })`；prompt 走 **stdin**；模型参数仅在 `selectedModel` 非空时附加。
- **不授予任何文件/工具权限**（不加 NotchInbox 的 full-tools 开关）。
- 输出：读 stdout 全文 → 取最外层 JSON（必要时剥围栏）→ 同一解析器。
- 各 CLI 的确切参数（stdin 支持形式、限权参数、模型参数）由 S3 的探针任务实测确认后写入该阶段 TASKS；`claude` 现状把消息放命令行参数，长 prompt 会撞 ARG_MAX，探针失败则降级为临时文件 + 参数引用。

---

## 7. 与既有 MD 获取能力的关系（回答 Q6.3）

**既有 MD 获取不存在「按字符数截断正文」的逻辑**（已核实：`src/lib/markdown.ts:5` 的 20 MiB 是输出上限，超限时丢的是图片；5 MiB 是粘贴请求体上限；300/50 字符是走浏览器渲染与报错的下限阈值；45s 是抓取截止时间）。因此：

- MD 获取侧逻辑**不做任何改动**，与是否接入模型无关。
- 翻译侧新增的 200,000 字符上限属于独立新限制，且**按散文文本计**（分段后待翻译文本字符数），不按 Markdown 字节计（其中可能含大量 base64 图片）。
- base64 图片数据永不进入 prompt；`skip` 块不计入上限。

---

## 8. 测试策略（TDD 强制）

每阶段先写失败测试（RED）再实现（GREEN），禁止先实现后补测试。

- **单元（vitest，`src/lib/translate/**` 与 `electron/*.test.mjs`）**：分段/重组身份回归（§3）、prompt 解析与重试、限额与错误码、批处理切批、Provider 端点校验、设置读写与迁移、IPC 通道白名单、CLI 路径合并与参数构造（mock 子进程，不真跑 CLI）。
- **端点（`src/app/api/**/route.test.ts`）**：沿用现有 `route.test.ts` 模式，覆盖 token/origin/content-type 拒绝、错误码映射、请求体上限。
- **端到端（Playwright）**：设置页云端配置与本地 CLI 管理、勾选框默认值随开关变化、翻译流程用**内置测试桩 Provider**（`MD_CONVERTOR_TEST_PROVIDER=1` 时服务端返回可预期的伪译文）覆盖正常/失败/取消/≥97% 提示/70–97% 确认框两选。
- **不新增联网 live 测试**；`npm run test:live` 与 `/api/translate*` 无关。
- 覆盖率门槛：`vitest.config.ts` 的 coverage `include` 增加 `src/lib/translate/**`，并为分段器与解析器设定门槛（具体数值在 S3 设定并在 S6 复核）。

---

## 9. 阶段划分（每阶段一个可独立新会话执行的工作包）

| 阶段 | 文档 | 内容 | 依赖 | 建议 |
| --- | --- | --- | --- | --- |
| S1 | `S1-settings-infra.md` | 设置存储、密钥存储、IPC 桥、进程环境注入、设置页骨架与入口 | 无 | 必须最先，所有 UI 的前置 |
| S2 | `S2-providers-and-languages.md` | 云端 Provider CRUD + 模型拉取、本地 CLI 扫描与管理、全局生效二选一、语言设置、默认翻译开关 | S1 | 只做配置管理，不发起翻译 |
| S3 | `S3-translation-engine.md` | 分段/重组、判定与翻译端点、prompt 契约与解析、HTTP/CLI 适配、限额/超时/取消、测试桩 Provider | S2 | 工作量最大，单独会话 |
| S4 | `S4-frontend-tabs.md` | 勾选框、自动触发、双 Tab、复制/下载后缀、进度/取消/失败重试 | S3 | 可只读 S3 的接口契约 |
| S5 | `S5-language-ratio.md` | 阈值决策 UX、确认框两选、≥97% 提示、`scope="non-target"` 端到端保真验收 | S4 | 可与 S6 并行 |
| S6 | `S6-release-and-docs.md` | 版本 0.3.0 与发布门禁改造、覆盖率门槛、PRODUCT/ARCHITECTURE/TESTING/QUALITY-AUDIT 更新、打包与产物校验 | S5 | 与 S5 并行亦可，但收尾在最后 |

阶段顺序固定；同一时间只允许一个阶段处于 `in-progress`（AGENTS.md「One feature at a time」）。

### 9.1 新会话执行规则

- 每个阶段开始时按 `AGENTS.md` Startup Workflow 执行：`./init.sh` → 读 PRD + 本 FSD + 该阶段文档 + `PROGRESS.md` / `session-handoff.md` / `feature_list.json`；**不需要**读其它阶段的执行文档，除非该阶段显式引用。
- 每阶段结束前更新 `PROGRESS.md`（状态/证据/风险/下一步）、`session-handoff.md`（下一阶段入口与已验证事实）、`feature_list.json`（本阶段 evidence）+ 必要时 `CHANGELOG.md` 的 `[Unreleased]`。
- 阶段间不依赖聊天上下文：任何「上一会话口头约定」都不算数，未写入文档的结论无效。
- 跨阶段需要变更 PRD/FSD 时，先改文档再改代码。

### 9.2 feature_list 登记方案

实施起步时（S1 第一个任务）在 `feature_list.json` 中登记以下条目；本次规划**不预先修改**该文件，以免在 0.2.1 仍是正式发布版本时产生半更新状态：

| id | 标题 | 依赖 |
| --- | --- | --- |
| feat-018 | Settings Infrastructure (0.3.0) | — |
| feat-019 | Provider And Language Settings | feat-018 |
| feat-020 | Translation Engine | feat-019 |
| feat-021 | Translation Front-End | feat-020 |
| feat-022 | Language Ratio Decision | feat-021 |
| feat-023 | Release 0.3.0 Gate And Docs | feat-022 |

每条目的完成条件与验证证据引用对应阶段文档；`currentVersion` 保持 `0.2.1` 直到 S6 执行版本升级。

---

## 10. 不做（与本轮范围冲突的实现一律拒绝）

- 不引入新的运行时依赖完成分段、解析或 JSON 校验（用既有 TypeScript 与标准能力实现）。
- 不引入本地语言检测库、不做多 provider 并发、不做结果缓存、不做翻译历史。
- 不修改既有抓取/提取/图片/Mermaid 管线与任何既有安全限制。
