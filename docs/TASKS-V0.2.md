# Tasks — v0.2 富文本粘贴转换（feat-012）

- 用途：feat-012 的**任务级事实源**（Harness：PLAN 与 TASK 分离）。方案设计见 `docs/PLAN-V0.2.md`，本文件只追踪任务执行。
- 规则：
  - 一次只推进一个 `in-progress` Task。
  - 所有代码 Task 遵循 TDD：先写失败测试（RED）→ 最小实现（GREEN）→ 清理重构（REFACTOR）。
  - 完成条件即「可验证」：相关验证命令实际运行且通过，命令与结果记录到本文件对应 Task 的「验证证据」，并同步 `feature_list.json`。
- 状态流转：`pending` → `in-progress` → `done`（或 `blocked`）。

## 开工准备

- **状态**：done（2026-08-09）
- **版本边界**：`main` 固定在 0.1.3 封版提交 `ce041c9`，Git 标签为 `v0.1.3`；v0.2 只在 `codex/feat-012-v0.2` 开发，完成 T10 并经用户确认后才允许合并。
- **版本隔离**：开发分支从开工起使用 `0.2.0`，避免任何中途打包生成或覆盖 0.1.3 产物。
- **产物保护**：0.1.3 ZIP 已重新复制至 `~/Downloads/MD-Convertor-0.1.3-release/` 并设为只读；SHA-256 为 `66909aa8759ec41fdde875204773958d32b33a2c903e7b4eb0858a50fb1bdf89`。
- **工具状态**：`.workbuddy/` 为本地工具私有状态，加入 `.gitignore`，不纳入项目版本控制。
- **验证证据**：2026-08-09 使用 Node.js 24.14.0 运行 `./init.sh` 通过：lint、typecheck、18 个测试文件 / 93 tests、覆盖率门禁和 Next.js production build 全部成功。

## 任务序列与依赖

```
T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10
（T3 无依赖；T4 依赖 T3；T5 依赖 T4；T6 依赖 T3/T4/T5；T7 依赖 T6；T8 依赖 T7；T9 依赖 T8；T10 依赖 T9）
```

---

## T3 — 粘贴预处理库 `src/lib/paste.ts`

- **状态**：pending
- **依赖**：—
- **边界**：涉及 `src/lib/paste.ts` + `src/lib/paste.test.ts`；不含 Markdown 转换、图片处理、API 路由。
- **TDD 节奏**：先在 `paste.test.ts` 写失败测试 → 实现 `paste.ts` → 清理。
- **用例**：结构门控正/负例（含 MiaoYan 回归「`<p>an ultimate ulterior plan</p>` 不触发」）；标题提取优先级（title → og:title → 第一个 h1 → 空串）；DOMPurify 清洗（script/style/button 移除）；`textLength` 统计；纯文本降级标记。
- **完成条件**：`npx vitest run src/lib/paste.test.ts` 全绿；`npm run typecheck`、`npm run lint` 通过。
- **验证证据**：（待记录）

---

## T4 — 粘贴 Markdown 转换与头部规则

- **状态**：pending
- **依赖**：T3
- **边界**：`src/lib/markdown.ts` 新增 `htmlToMarkdownFromPaste()` + `src/lib/markdown.test.ts` 扩展；**不改现有 `htmlToMarkdown()` 行为**。
- **TDD 节奏**：先写金标准测试 → 实现 → 清理。
- **用例**：MiaoYan 21 项语义移植（标题/段落、有序+嵌套无序列表、引用、代码围栏含 language 类与反引号冲突、GFM 表格含 `\|` 转义与无表头、`hr`、行内混合、链接含锚点去链接、script/style 丢弃、空白折叠、实体解码、CJK 全流程、代码块内空行保留、列表内代码顺序）；头部规则（`# 标题` + `> 转换时间`；有 sourceUrl 时输出 `> 来源` 行，无则省略）。
- **完成条件**：`npx vitest run src/lib/markdown.test.ts` 全绿；typecheck、lint 通过；现有 markdown 用例回归不变。
- **验证证据**：（待记录）

---

## T5 — 图片策略参数与懒加载处理

- **状态**：pending
- **依赖**：T4
- **边界**：`src/lib/images.ts` 增加 `sourcePriority: "src-first" | "lazy-first"` 参数 + `src/lib/images.test.ts` 扩展；**链接模式行为零改动**。
- **TDD 节奏**：先写失败测试 → 实现 → 清理。
- **用例**：data: URI 保留与计数（粘贴模式）、非法 data: 拒绝、`file:` 拒绝、解码 < 1 KiB 占位图降级替代文本、`data-src`/`data-lazy-src` 优先于占位 `src`、懒加载源下载失败不回退占位 `src`、链接模式 data: 跳过行为回归、20 MiB 预算降级。
- **完成条件**：`npx vitest run src/lib/images.test.ts` 全绿；typecheck、lint 通过；`convert.test.ts` / `convert-orchestration.test.ts` 链接模式回归全绿。
- **验证证据**：（待记录）

---

## T6 — 类型扩展 + `/api/convert-paste` 路由与编排

- **状态**：pending
- **依赖**：T3、T4、T5
- **边界**：`src/types/conversion.ts`（`ExtractionMode` 增加 `"paste"`、`sourceUrl` 可空）+ 新编排函数（paste 预处理 → 图片内嵌 → 预算循环）+ `src/app/api/convert-paste/route.ts` + 对应测试。
- **TDD 节奏**：先写 `route.test.ts` 与编排测试 → 实现路由与编排 → 清理。
- **用例**：鉴权（缺令牌/错误来源 403）；Content-Length 超 5 MiB 413；缺 `html` 字段 400；无结构 HTML 纯文本降级；`extractionMode === "paste"`；图片预算降级；45 秒超时 504；客户端停止 499。
- **完成条件**：`npx vitest run src/app/api/convert-paste src/lib` 相关测试全绿；typecheck、lint 通过；`/api/convert` 现有测试回归不变。
- **验证证据**：（待记录）

---

## T7 — 前端双模式 UI 与剪贴板获取

- **状态**：pending
- **依赖**：T6
- **边界**：`src/app/page.tsx` + `src/app/page.module.css` + 抽出的纯函数（如 `src/lib/paste-ui.ts`：HTML 识别、payload 构造、5 MiB 前端校验、占位图提示文案生成）。
- **TDD 节奏**：纯函数先写失败测试再实现；组件交互由 T8 E2E 覆盖。
- **完成条件**：纯函数测试全绿；`npm run build` 通过；`npm run typecheck`、`npm run lint` 通过。
- **验证证据**：（待记录）

---

## T8 — 三浏览器 E2E

- **状态**：pending
- **依赖**：T7
- **边界**：`e2e/` 新增粘贴模式用例。
- **用例**：富文本粘贴（Playwright 注入 `text/html` 剪贴板）→ 转换 → 统计正确 → 复制/下载可用；纯文本粘贴降级提示；超 5 MiB 413 提示；转换中停止保留输入；**0.1.3 既有 21 项 E2E 用例保持全绿（新增用例不得修改既有断言）**。
- **完成条件**：`npm run test:e2e` 三浏览器全绿，tracked diff check passed；0.1.3 链接模式用例无回归。
- **验证证据**：（待记录）

---

## T9 — 文档同步

- **状态**：pending
- **依赖**：T8
- **边界**（无代码，逐项核对）：`docs/PRODUCT.md`、`docs/ARCHITECTURE.md`、`docs/TESTING.md`、`README.md`、`CHANGELOG.md`（`[Unreleased]`）、`feature_list.json`、`PROGRESS.md`、`session-handoff.md`。每个文件的变更点见 PLAN 第 8 节。
- **完成条件**：逐项核对清单全部满足，内容与实现一致。
- **验证证据**：（待记录）

---

## T10 — 0.2.0 发布门禁与人工验收

- **状态**：pending
- **依赖**：T9
- **边界**：确认 `package.json` 与锁文件仍为 `0.2.0`；`npm run desktop:release`（Node.js 24.x）全流程；真实打包窗口人工验收（粘贴模式全流程 + 链接模式回归）。
- **完成条件**：fresh ZIP 校验通过（版本 `0.2.0`/arm64/结构/SHA-256）；**0.1.3 既有 93 tests 基线全绿；构建前后 `out/make/zip/darwin/arm64/` 下 0.1.x ZIP 哈希不变（正式版保护，见 PLAN 第 12 节）**；真实窗口验收记录到 `feature_list.json`。
- **验证证据**：（待记录）

---

## 备注

- 原编号 T1（Plan 批准）于 2026-08-06 完成（`docs/PLAN-V0.2.md` 获批）。
- 类型扩展原为 T2，为避免脱离代码的孤立变更，并入 T6 第一步实施。
- 2026-08-07 技术选型：v0.2 不引入 Jina 等第三方代理抓取通道与 OpenCLI/Cookie 登录态路线（决策与可借鉴工程模式见 `docs/PLAN-V0.2.md` 第 13 节）；本 feature 实施中不得引入相关依赖或通道。
