# S4 — 前端翻译交互（Spec / Plan / Task）

- 上游：`docs/PRD-translation.md`（§4）、`docs/features/translation/FSD.md`
- 依赖：S3 已完成（`/api/translate/analyze`、`/api/translate/run` 可用）
- 状态：**已完成**（2026-09-17；T4.1–T4.7 全部完成，证据见 `PROGRESS.md` §0.3.0 S4 与 `feature_list.json` `feat-021`）
- feature_list id：`feat-021`

## Spec

**目标**：把翻译接到现有页面上——勾选框、自动触发、双 Tab、复制/下载、进度与取消、失败重试。占比判定的弹窗与 ≥97% 提示属于 S5，本阶段先按「< 70% 直接全文翻译」路径打通。

**行为**（PRD §4）：

1. 链接面板与富文本粘贴面板**共用**一个翻译勾选框；初始值 = 设置里「默认开启翻译」（每次启动重新按开关取值，勾选框状态本身不持久化）。
2. 勾选状态下转换成功 → 自动 `analyze` → 按（S5 的）决策规则发起 `run`；结果区出现「原文 / 译文」Tab。
3. 未勾选、或未配置生效模型 → 不发起翻译，结果区与现状一致（无 Tab）。
4. 「复制」「下载」作用于**当前 Tab**；译文下载名为 `<原名>-<目标语言小写连写>.md`（如 `article-zh-hans.md`）。
5. 统计（文件大小/正文字数/图片数量）与转换警告保持全局显示，不随 Tab 变化。
6. 翻译中显示进度与「取消」；取消后保留原文 Tab，译文 Tab 显示「已取消」。
7. 失败：原文 Tab 不受影响，译文 Tab 显示错误原因（不显示密钥、不显示正文）+「重试」按钮，重试沿用同一 `analysis`。

**非目标**：占比弹窗与 ≥97% 提示（S5）；翻译中的人工编辑；Markdown 源码视图（继续只提供渲染预览与复制）。

## Plan

改动：

- `src/app/page.tsx` — 勾选框（共用状态）、翻译状态机（idle/analyzing/translating/done/failed/cancelled）、双 Tab、进度与取消、重试、复制/下载按 Tab 分流
- `src/app/page.module.css` — Tab、勾选框、进度与错误区域样式（沿用现有视觉语言）

新增：

- `src/lib/translate/filename.ts` — 目标语言后缀文件名（纯函数）
- `src/lib/translate/client.ts` — 前端调用 `analyze` / `run` 的薄封装（含 `AbortController` 取消、错误体解析）
- `e2e/translate.spec.ts` — 端到端行为（使用 `MD_CONVERTOR_TEST_PROVIDER=1`）

## Tasks

| id | 任务 | RED | 完成条件 | 验证 |
| --- | --- | --- | --- | --- |
| T4.1 | 登记 `feat-021`；文件名后缀 | `src/lib/translate/filename.test.ts` | BCP-47 → 小写连写；特殊字符/空格被规范化；空语言回落原名 | `npm test -- filename` |
| T4.2 | 前端客户端封装 | `src/lib/translate/client.test.ts` | 错误体解析为可展示消息；`abort` 触发取消语义；不泄漏请求头 | `npm test -- client` |
| T4.3 | 勾选框与默认值联动 | `e2e/translate.spec.ts` | 开关开 → 启动即勾选；开关关 → 不勾选；取消勾选后本次会话保持取消；两面板状态同步 | `npm run test:e2e` |
| T4.4 | 自动触发与 Tab | `e2e/translate.spec.ts` | 勾选后转换成功自动翻译并出现两个 Tab，默认停在译文 Tab；未勾选无 Tab | `npm run test:e2e` |
| T4.5 | 复制/下载与后缀 | `e2e/translate.spec.ts` | 复制内容随 Tab 变化；译文下载名带后缀；原文下载名不变 | `npm run test:e2e` |
| T4.6 | 进度、取消、失败重试 | `e2e/translate.spec.ts` | 取消后原文可用且译文 Tab 显示已取消；模型失败显示错误并可重试成功 | `npm run test:e2e` |
| T4.7 | 阶段收尾 | — | `./init.sh` 全绿；`npm run test:e2e` 三浏览器全绿；状态文件更新；`feat-021` 置 `done` | `./init.sh`、`npm run test:e2e` |

## Handoff

### 页面状态机（`src/app/page.tsx`）

```ts
type TranslationState =
  | { status: "idle" } | { status: "unconfigured" }
  | { status: "analyzing" } | { status: "translating" }
  | { status: "done"; markdown: string; warnings: string[] }
  | { status: "cancelled" } | { status: "failed"; message: string };
type ResultTab = "original" | "translated";
```

转移（`runConversion` → `runTranslation` → `cancelTranslation` / `retryTranslation`）：

| 起点 | 事件 | 终点 |
| --- | --- | --- |
| 任意 | 开始新转换 | `idle` + `resultTab = "original"`（同时 abort 在途翻译、清空 `analysisRef`） |
| `idle` | 转换成功且已勾选翻译 | `analyzing`（**同时切到译文 Tab**） |
| `analyzing` | analyze 完成 | `translating` |
| `analyzing` / `translating` | run 完成 | `done{markdown, warnings}`（**不再强切 Tab**；Tab 已经在任务开始时切过） |
| `analyzing` / `translating` | 409 `TRANSLATE_NOT_CONFIGURED` | `unconfigured`（不渲染 Tab，改渲染提示 + `/settings` 链接） |
| `analyzing` / `translating` | 其它失败 | `failed{message}`（`role="alert"` + 「重试」） |
| `analyzing` / `translating` | 点「取消」/= 控制器 abort | `cancelled`（可重试） |
| `failed` / `cancelled` | 点「重试」 | 用 `analysisRef.current` + `result.markdown` 直接 `translating`（不再 analyze） |

- 派生值：`showResultTabs = translation.status !== "idle" && translation.status !== "unconfigured"`；`isTranslatedTab = resultTab === "translated" && translatedMarkdown.length > 0`；`activeMarkdown` 决定复制/下载/回退 textarea 的内容。
- Tab 可访问性：tablist `aria-label="转换结果"`；tab id `original-result-tab` / `translated-result-tab`；panel id `original-result-panel` / `translated-result-panel`；`handleResultTabKeyDown` 支持 ArrowLeft/Right/Home/End。
- **未启用翻译时结果区 DOM 与 0.2.1 完全一致**：不包 tabpanel 外层，只渲染 `<MarkdownPreview label="Markdown 预览">`；多包一层会让 home/paste e2e 的 `getByLabel("Markdown 预览")` 撞 strict mode。

### `run` 请求体的最终形状

```jsonc
{ "markdown": "<与 analyze 完全相同的字符串>",
  "targetLanguage": "<settings.languages.target>",
  "analysis": { /* analyze 响应的 analysis 字段，原样回传 */ },
  "scope": "all"             // decideTranslationScope() 恒返回 "all"（S5 接入点）
}
```

因为 analyze 与 run 用同一 markdown，页面路径上 **409 `TRANSLATE_ANALYSIS_STALE` 不可达**，本阶段未实现「重新判定后重试一次」；S5 若加入人工编辑/重排需补上（`client.ts` 已带 `FALLBACK_MESSAGES.TRANSLATE_ANALYSIS_STALE` 文案兜底："文档已变化，请重新转换后再翻译。"）。

### e2e 测试桩的唯一入口开关

`scripts/start-e2e-server.mjs` 里 `process.env.MD_CONVERTOR_TEST_PROVIDER = "1";`。置位后 `resolveEffectiveModel` 直接返回 `kind:"test"`（不读 settings），因此 `e2e/translate.spec.ts` 真实调用 `/api/translate/{analyze,run}` 而不联网、不需预配 Provider；未置位时该分支不存在。另：`playwright.config.ts` 设了 `workers: 1`（翻译任务锁是进程级，并行会撞 429 `TRANSLATE_BUSY`）。

### S5 需要接入的决策点

- `src/app/page.tsx` 的 `decideTranslationScope()`（**L96**）是目前唯一的阈值 seam，调用点在 `runTranslation` **L321**；占比弹窗 / ≥97% 提示应在拿到 `analysis` 之后、`translateDocument` 之前插入（L318–321 之间）。
- 现成可用的输入：`analyzeDocument` 返回的 `analysis`（`ratio` + per-block `language`/`chars`）已存在 `analysisRef.current`；`translateDocument` 已支持 `scope: "non-target"`；`translation.warnings` 已在译文 Tab 下方渲染。
- 不要新增 settings 字段或新端点；`TranslationScope` 仍只有 `"all"` / `"non-target"` 两个取值。
- e2e 门槛：改 UI 后先 `npm run build` 再 `npm run test:e2e`（服务跑 `.next/standalone` 产物）。
