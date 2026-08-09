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
- **计划评审证据**：2026-08-09 用户确认评审修订后再次以 Node.js 24.14.0 运行 `./init.sh`，同样通过 18 个测试文件 / 93 tests、覆盖率门禁和 production build；T3 仍为 pending。

## 任务序列与依赖

```
T3 → T4 → T5 → T6A → T6B → T7A → T7B → T8 → T9A → T9B → T10
（严格串行；每个 Task 只依赖其前序 Task，除任务内明确列出的 0.1.3 回归外不得并行推进）
```

---

## T3 — 粘贴预处理库 `src/lib/paste.ts`

- **状态**：pending
- **依赖**：—
- **边界**：涉及 `src/lib/paste.ts` + `src/lib/paste.test.ts`；不含 Markdown 转换、图片处理、API 路由。
- **TDD 节奏**：先在 `paste.test.ts` 写失败测试 → 实现 `paste.ts` → 清理。
- **用例**：DOM 语义门控（强结构、图片、有效链接/行内格式、多段落）与负例（含 MiaoYan 回归「`<p>an ultimate ulterior plan</p>` 不触发」）；标题提取顺序（title → og:title → h1 → 纯文本首行 → 粘贴内容）；先取 head 元数据再净化 body；script/style/button/nav 移除；只定向保留 `data-src`/`data-lazy-src`；请求 `text` 作为降级路径权威内容；`textLength` 统计。
- **完成条件**：`npx vitest run src/lib/paste.test.ts` 全绿；`npm run typecheck`、`npm run lint` 通过。
- **验证证据**：（待记录）

---

## T4 — 粘贴 Markdown 转换与头部规则

- **状态**：pending
- **依赖**：T3
- **边界**：`src/lib/markdown.ts` 新增粘贴模式 HTML/纯文本渲染与粘贴文件名规则 + `src/lib/markdown.test.ts` 扩展；**不改现有 `htmlToMarkdown()` 和链接模式文件名行为**。
- **TDD 节奏**：先写金标准测试 → 实现 → 清理。
- **用例**：MiaoYan 21 项语义移植；HTML 首个重复 h1 去除；纯文本换行与 Markdown 控制字符转义；有 sourceUrl 时输出来源并解析相对链接，无 sourceUrl 时省略来源、保留绝对 HTTP/HTTPS 链接并把相对链接降级为普通文本；无标题时正文首行标题与 `粘贴内容-时间戳.md` 回退。
- **完成条件**：`npx vitest run src/lib/markdown.test.ts` 全绿；typecheck、lint 通过；现有 markdown 用例回归不变。
- **验证证据**：（待记录）

---

## T5 — 图片策略参数与懒加载处理

- **状态**：pending
- **依赖**：T4
- **边界**：`src/lib/images.ts` 增加无默认值的区分联合参数（链接模式 `src-first`；粘贴模式 `lazy-first + data-uri`）并扩展 `src/lib/images.test.ts`；**链接模式行为零改动**。
- **TDD 节奏**：先写失败测试 → 实现 → 清理。
- **用例**：data: URI 严格 Base64 解码、实际格式/元数据校验、8 MiB、2 MiB/2048px 优化、动图首帧与计数；非法 data/file/blob 拒绝；解码 < 1 KiB 占位图降级；lazy-first 且失败不回退占位 src；sourceUrl 为空时绝对图成功/相对图降级；链接模式 data: 跳过回归；20 MiB 预算降级。
- **完成条件**：目标测试、typecheck、lint 和链接模式编排回归全绿；使用 Node.js 24 执行 `./init.sh`，确认既有 93 tests 仍作为扩展测试集的一部分通过。
- **验证证据**：（待记录）

---

## T6A — 类型扩展与粘贴转换编排

- **状态**：pending
- **依赖**：T5
- **边界**：`src/types/conversion.ts`（`ExtractionMode` 增加 `"paste"`、响应 `sourceUrl` 可为空）+ 独立粘贴编排模块及测试；不包含 API 路由。
- **TDD 节奏**：先写编排失败测试 → 实现「预处理 → 图片内嵌 → Markdown 预算循环 → 统计/警告」→ 清理。
- **用例**：HTML 与纯文本路径；可选 sourceUrl；图片预算逐张降级；纯正文超过 20 MiB 返回 413；无可用正文 422；取消信号贯穿；标题、文件名、统计和 `extractionMode === "paste"`。
- **完成条件**：粘贴编排相关测试、typecheck、lint 全绿；现有 `convert.test.ts` / `convert-orchestration.test.ts` 保持通过。
- **验证证据**：（待记录）

---

## T6B — `/api/convert-paste` 路由与有界请求体

- **状态**：pending
- **依赖**：T6A
- **边界**：新增请求类型、5 MiB 有界 JSON 读取工具、`src/app/api/convert-paste/route.ts` 与对应测试；不修改 `/api/convert` 契约。
- **TDD 节奏**：先写路由和有界读取失败测试 → 实现鉴权/解析/限流/超时 → 清理。
- **用例**：缺令牌/错误来源 403；Content-Length 声明超限和无/伪造 Content-Length 的实际流式超限均为 413；html/text 均空 400；sourceUrl 非 HTTP(S) 或含凭据 400；纯文本成功；45 秒超时 504；客户端停止内部记录 499；日志不含正文、HTML 或 URL。
- **完成条件**：路由与请求体测试、typecheck、lint 全绿；`/api/convert` 现有测试回归不变。
- **验证证据**：（待记录）

---

## T7A — 前端粘贴状态与纯函数

- **状态**：pending
- **依赖**：T6B
- **边界**：新增前端粘贴状态/纯函数模块及测试；不修改页面布局。
- **TDD 节奏**：先写失败测试 → 实现剪贴板快照、payload 构造、UTF-8 JSON 字节计算、编辑降级与模式切换规则 → 清理。
- **用例**：同时保存 HTML/text；手工编辑清除 HTML 并转纯文本；再次粘贴整体替换；sourceUrl trim；5 MiB 上下界（含多字节中文与 JSON 开销）；链接与富文本模式各自保留输入；切换清空结果状态。
- **完成条件**：目标测试、typecheck、lint 全绿。
- **验证证据**：（待记录）

---

## T7B — 前端双模式 UI 与结果复用

- **状态**：pending
- **依赖**：T7A
- **边界**：`src/app/page.tsx` + `src/app/page.module.css`；复用现有结果统计、预览、复制、下载和停止逻辑。
- **TDD 节奏**：只实现 T7A 已固化的状态契约；组件交互由 T8 E2E 覆盖。
- **用例**：链接/富文本 Tab；textarea 展示纯文本；富文本识别、纯文本降级、编辑后降级提示；可选来源 URL；转换中 Tab 禁用；停止后内容保留；链接模式现有交互和文案不变。
- **完成条件**：`npm run build`、typecheck、lint 通过，人工静态检查桌面宽度布局无明显回归。
- **验证证据**：（待记录）

---

## T8 — 三浏览器 E2E

- **状态**：pending
- **依赖**：T7B
- **边界**：`e2e/` 新增粘贴模式用例。
- **用例**：富文本粘贴（Playwright 注入稳定的 `clipboardData` 双 MIME 数据）→ 转换 → 统计正确 → 复制/下载可用；纯文本降级；编辑后降级；再次粘贴替换；来源 URL 有/无；超 5 MiB；转换中停止保留输入；**0.1.3 既有 21 项 E2E 用例保持全绿（新增用例不得修改既有断言）**。
- **完成条件**：Node.js 24 下 `./init.sh` 与 `npm run test:e2e` 三浏览器全绿，tracked diff check passed；0.1.3 链接模式用例无回归。此里程碑不运行联网 live。
- **验证证据**：（待记录）

---

## T9A — 0.1.3 封版自动保护

- **状态**：pending
- **依赖**：T8
- **边界**：`scripts/release-guards.mjs`、`scripts/release-guards.test.mjs`、`scripts/release-desktop.mjs`；不生成正式产物。
- **TDD 节奏**：先写失败测试 → 实现 Git ref、外部归档与历史 ZIP 哈希校验 → 清理。
- **用例**：`main` 或 `v0.1.3^{}` 偏离 `ce041c9` 时失败；归档缺失/可写/哈希错误时失败；打包前后任一 0.1.x ZIP 被修改或删除时失败；正确状态通过；错误不得包含敏感内容。
- **完成条件**：release guard 测试、`./init.sh` 通过；不会修改或删除 0.1.x 产物。
- **验证证据**：（待记录）

---

## T9B — 文档同步

- **状态**：pending
- **依赖**：T9A
- **边界**（无产品代码，逐项核对）：`docs/PRODUCT.md`、`docs/ARCHITECTURE.md`、`docs/TESTING.md`、`docs/QUALITY-AUDIT.md`、`README.md`、`CHANGELOG.md`、`feature_list.json`、`PROGRESS.md`、`session-handoff.md`。每个文件的变更点见 PLAN 第 8 节。
- **完成条件**：逐项核对清单全部满足，内容与实现一致；明确登录态/临时/Blob 图片限制、纯文本编辑降级和 v0.2 安装条件。
- **验证证据**：（待记录）

---

## T10 — 0.2.0 发布门禁与人工验收

- **状态**：pending
- **依赖**：T9B
- **边界**：确认 `package.json` 与锁文件仍为 `0.2.0`；`npm run desktop:release`（Node.js 24.x）全流程；真实打包窗口人工验收（粘贴模式全流程 + 链接模式回归）。
- **完成条件**：`npm run desktop:release` 完整通过（这是本迭代唯一的 live 阻断点）；fresh ZIP 校验通过（版本 `0.2.0`/arm64/结构/SHA-256）；扩展后的测试集中 0.1.3 既有 93 tests 与 21 E2E 保持全绿；自动 guard 证明 `main`/标签/外部归档/0.1.x ZIP 未变化；真实窗口完成粘贴模式和链接模式验收并记录到 `feature_list.json`。
- **验证证据**：（待记录）

---

## 备注

- 原编号 T1（Plan 批准）于 2026-08-06 完成（`docs/PLAN-V0.2.md` 获批）。
- 类型扩展原为 T2，为避免脱离代码的孤立变更，并入 T6A 实施。
- 2026-08-09 开工评审后拆分 T6A/T6B、T7A/T7B、T9A/T9B，并固定 API 双通道、编辑降级、语义门控、data URI 完整校验、无 base 资源处理和 T10-only live 门禁。
- 2026-08-07 技术选型：v0.2 不引入 Jina 等第三方代理抓取通道与 OpenCLI/Cookie 登录态路线（决策与可借鉴工程模式见 `docs/PLAN-V0.2.md` 第 13 节）；本 feature 实施中不得引入相关依赖或通道。
