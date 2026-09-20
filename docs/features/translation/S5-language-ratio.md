# S5 — 语言占比判定与局部翻译（Spec / Plan / Task）

- 上游：`docs/PRD-translation.md`（§4.2）、`docs/features/translation/FSD.md`
- 依赖：S4 已完成（双 Tab 与翻译流程可用）
- 状态：**已完成**（2026-09-17）
- feature_list id：`feat-022`

## Spec

**目标**：实现 PRD R4——主体已是目标语言时先问再翻，确认后只翻非目标语言部分。

**决策规则**（纯函数，`src/lib/translate/decision.ts`，输入 `analysis` + 目标语言，输出动作）：

| 占比 | 动作 | UI 表现 |
| --- | --- | --- |
| ≥ 0.97 | `skip` | 不显示译文 Tab；结果区提示一行「正文已是<目标语言>，无需翻译」 |
| 0.70 – 0.97 | `confirm` | 弹确认框：「检测到正文约 N% 已是<目标语言>，是否只翻译其余部分？」→ `只翻译非目标语言部分`（`scope="non-target"`）/ `不翻译`（`skip`） |
| < 0.70 | `translate-all` | 不打扰，直接 `scope="all"` |

边界：`totalChars === 0`（全为代码/图片等）→ 按 `skip` 处理并提示一行；`ratio` 计算保留两位小数后用于展示，比较用原始值；恰好 0.70 / 0.97 归入上一行区间（≥ 语义）。

选择「不翻译」后：不显示译文 Tab，原文结果保留，勾选框保持勾选状态，不重复弹窗。

**验收锚点（局部翻译保真）**：`scope="non-target"` 时，所有判定为目标语言的块在结果中**逐字节保持原样**，非目标块被替换为译文，文档结构与顺序不变。

**非目标**：不调整阈值（不做二次抽样）；不新增本地语言检测；不改动 S3 引擎内部逻辑（若发现缺陷，回 S3 修复或在本阶段以补丁形式附带测试）。

## Plan

新增：

- `src/lib/translate/decision.ts` + `decision.test.ts`
- 确认框组件（`src/app/` 内，沿用现有样式体系）

改动：

- `src/app/page.tsx` — 接入决策函数；弹窗两选；≥97% / 空散文提示；「不翻译」路径
- `src/app/page.module.css` — 确认框与提示样式
- `e2e/translate.spec.ts` — 三个区间的端到端分支

## Tasks

| id | 任务 | RED | 完成条件 | 验证 |
| --- | --- | --- | --- | --- |
| T5.1 | 登记 `feat-022`；决策函数 | `decision.test.ts` | 0 / 0.699 / 0.70 / 0.969 / 0.97 / 1 全部边界正确；空散文归 `skip`；`confirm` 携带展示用百分比 | `npm test -- decision` |
| T5.2 | 局部翻译保真回归 | 引擎侧已有的 `scope="non-target"` 测试 + 新增 golden 用例 | 目标语言块逐字节不变；非目标块替换；顺序与结构不变 | `npm test -- segment`、`npm test -- run` |
| T5.3 | 确认框两选 UI | `e2e/translate.spec.ts` | 70–97% 区间弹窗；选「只翻译非目标语言部分」→ `run` 请求 `scope="non-target"`；选「不翻译」→ 无译文 Tab 且原文可用；不重复弹窗 | `npm run test:e2e` |
| T5.4 | ≥97% 与空散文提示 | `e2e/translate.spec.ts` | 提示文案正确；不发起 `run`（断言无翻译请求） | `npm run test:e2e` |
| T5.5 | <70% 直译路径 | `e2e/translate.spec.ts` | 无弹窗、直接 `scope="all"` | `npm run test:e2e` |
| T5.6 | 阶段收尾 | — | `./init.sh` 全绿；`npm run test:e2e` 三浏览器全绿；状态文件更新；`feat-022` 置 `done` | `./init.sh`、`npm run test:e2e` |

## Handoff

### 决策函数（S5 最终形态，勿再引入第二个 seam）

- 位置：`src/lib/translate/decision.ts`，纯函数、无副作用、不读 settings。
- 常量：`export const SKIP_RATIO = 0.97;`、`export const CONFIRM_RATIO = 0.7;`（改阈值只改这里）。
- 签名：`decideTranslation(analysis: TranslationAnalysis): TranslationDecision`，返回
  `{action:"skip", reason:"target-language"|"empty", percent:number}` | `{action:"confirm", percent:number}` | `{action:"translate-all"}`。
- 判定顺序：`totalChars === 0` ⇒ `skip/empty`；`ratio >= 0.97` ⇒ `skip/target-language`；`ratio >= 0.70` ⇒ `confirm`；否则 `translate-all`。比较用原始 `ratio`，`percent = Math.round(ratio * 100)` 仅供展示。
- 页面接入：`src/app/page.tsx` 的 `runTranslation()` 在拿到 `analysis` 之后、`translateDocument()` 之前调用它；S4 的 `decideTranslationScope()` 占位函数已删除。

### 确认框与提示（最终字符串，e2e 直接断言这些文案）

- 确认框：原生 `<dialog>` + `useEffect` 的 `showModal()/close()`；`aria-labelledby="translate-confirm-text"` 指向文案；`onCancel`（Esc）等价于「不翻译」。
- 文案：`检测到正文约 {percent}% 已是{languageLabel(targetLanguage)}，是否只翻译其余部分？`
- 按钮：`不翻译`（⇒ `{status:"skipped", reason:"declined"}`，不发 `run`）、`只翻译非目标语言部分`（⇒ `scope="non-target"`）。
- 提示行（`role="status"`，`showResultTabs` 为 false，不显示译文 Tab）：≥97% `正文已是<目标语言>，无需翻译`（无句号，按 Spec 原文）；空散文 `正文没有可翻译的段落，无需翻译。`；用户选「不翻译」`已选择不翻译，结果保留原文。`
- 状态机新增成员：`{status:"confirming", analysis, percent}` 与 `{status:"skipped", reason:"target-language"|"empty"|"declined"}`；`showResultTabs` 同时排除这两个状态（否则会留下空译文 Tab）。
- 选择结果存 `translationScopeRef`（新转换重置为 `"all"`），`retryTranslation()` 复用 `analysisRef.current` + 该 scope，因此失败重试不会二次弹窗。

### e2e 三个区间的触发方式

- 只 mock `/api/translate/analyze`：`route.fetch()` 拿真实响应，改写 `analysis.totalChars` / `targetChars` / `ratio` 与 `blocks[].language` 后 `route.fulfill({response, json})`；`/api/translate/run` 保持真实端点（它只校验块对齐，不校验语言分布），这正是局部翻译保真的端到端证据。
- fixture：10 个等长段落（`Paragraph number N of the ratio document.`），因此「前 N 段标 target」＝精确的 N/10 占比——≥97% 用 10/10，70%–97% 用 8/10（弹窗文案为 80%），<70% 用 6/10；空散文另用「所有块标记 skipped + chars 0」的响应。
- 断言「不发起翻译」用 `page.on("request")` 统计 `/api/translate/run` 次数与 `scope`（`trackTranslationRequests()`）；不要手写整个 analyze 响应，否则 `run` 会因块数不一致返回 409 `TRANSLATE_ANALYSIS_STALE`。

### S6 需要做的事（发布前清单）

- 覆盖率：`decision.ts` 已有逐文件门槛（95/90/100/95）；S6 若调整 `vitest.config.ts` 的全局门槛，不要降低 `client.ts` / `filename.ts` / `decision.ts` 的现有值。当前全量 statements 95.25%。
- 版与门禁：`currentVersion` 仍为 `0.2.1`；`npm run desktop:release` 的版本守卫锁定 `0.2.1`，S6 需升到 `0.3.0` 并保留「历史 ZIP 不可覆写」的校验，同时验证新 ZIP 的新鲜度/版本/arm64/包结构与 SHA-256。
- 文档：`docs/PRODUCT.md` 隐私段按 `docs/PRD-translation.md` §5 改写（勾选翻译后正文会发往用户自配端点）；`docs/ARCHITECTURE.md`、`docs/TESTING.md`、`docs/QUALITY-AUDIT.md` 同步 S1–S5 现状；`CHANGELOG.md` / `CHANGELOG.zh.md` 的 `[Unreleased]` 已含 S5 条目，发布时归档到 `[0.3.0]`。
- 状态文件：`feature_list.json` 的 `feat-023`、`PROGRESS.md`、`session-handoff.md` 需在 S6 收尾时更新。

### 已知未做（不需再补，除非用户另有要求）

- 没有阈值设置项（S5 范围不含「阈值开关」）。
- `totalChars === 0` 是防御分支（引擎在 analyze 阶段就会 400 `TRANSLATE_EMPTY_INPUT`）。
- 块级语言判定：中英混排段落整体判为目标语言，不会被局部翻译。
