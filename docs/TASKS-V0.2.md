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

- **状态**：done（2026-08-09）
- **依赖**：—
- **边界**：涉及 `src/lib/paste.ts` + `src/lib/paste.test.ts`；不含 Markdown 转换、图片处理、API 路由。
- **TDD 节奏**：先在 `paste.test.ts` 写失败测试 → 实现 `paste.ts` → 清理。
- **用例**：DOM 语义门控（强结构、图片、有效链接/行内格式、多段落）与负例（含 MiaoYan 回归「`<p>an ultimate ulterior plan</p>` 不触发」）；标题提取顺序（title → og:title → h1 → 纯文本首行 → 粘贴内容）；先取 head 元数据再净化 body；script/style/button/nav 移除；只定向保留 `data-src`/`data-lazy-src`；请求 `text` 作为降级路径权威内容；`textLength` 统计。
- **完成条件**：`npx vitest run src/lib/paste.test.ts` 全绿；`npm run typecheck`、`npm run lint` 通过。
- **验证证据**：按 TDD 完成 12 个 RED→GREEN 行为切片，随后补齐评审回归；最终 `npx vitest run src/lib/paste.test.ts` 为 1 file / 32 tests 全绿，`./init.sh`（Node.js 24.14.0）通过 lint、typecheck、19 files / 125 tests、覆盖率门禁和 Next.js production build。`paste.ts` 为 100% statements / lines / functions、88.67% branches。评审发现的空段落误判、SVG `<title>` 误取、非 HTTP(S) 链接触发和测试分组问题均已先以失败测试复现再修正，无开放发现。

---

## T4 — 粘贴 Markdown 转换与头部规则

- **状态**：done（2026-08-09）
- **依赖**：T3
- **边界**：`src/lib/markdown.ts` 新增粘贴模式 HTML/纯文本渲染与粘贴文件名规则 + `src/lib/markdown.test.ts` 扩展；**不改现有 `htmlToMarkdown()` 和链接模式文件名行为**。
- **TDD 节奏**：先写金标准测试 → 实现 → 清理。
- **用例**：MiaoYan 21 项语义移植；HTML 首个重复 h1 去除；纯文本换行与 Markdown 控制字符转义；有 sourceUrl 时输出来源并解析相对链接，无 sourceUrl 时省略来源、保留绝对 HTTP/HTTPS 链接并把相对链接降级为普通文本；无标题时正文首行标题与 `粘贴内容-时间戳.md` 回退。
- **完成条件**：`npx vitest run src/lib/markdown.test.ts` 全绿；typecheck、lint 通过；现有 markdown 用例回归不变。
- **验证证据**：新增 `pastedContentToMarkdown()` 与 `makePasteFilename()`，按 TDD 固化纯文本字面转义、可选来源头部、相对链接规则、标题去重、MiaoYan 块级/行内/GFM 语义和粘贴文件名回退。独立规格/质量审查发现的 Setext/`1)` 结构误判、代码块空行、混合表头、畸形链接、来源 URL 转义与元数据间距问题均以失败测试复现后修复；最终 `npx vitest run src/lib/markdown.test.ts` 为 37/37，Node.js 24.14.0 `./init.sh` 通过 lint、typecheck、19 files / 159 tests、覆盖率门禁和 production build；`markdown.ts` 为 99.15% statements/lines、87.77% branches、100% functions，现有链接模式测试保持通过。

---

## T5 — 图片策略参数与懒加载处理

- **状态**：done（2026-08-09）
- **依赖**：T4
- **边界**：`src/lib/images.ts` 增加无默认值的区分联合参数（链接模式 `src-first`；粘贴模式 `lazy-first + data-uri`）并扩展 `src/lib/images.test.ts`；**链接模式行为零改动**。
- **TDD 节奏**：先写失败测试 → 实现 → 清理。
- **用例**：data: URI 严格 Base64 解码、实际格式/元数据校验、8 MiB、2 MiB/2048px 优化、动图首帧与计数；非法 data/file/blob 拒绝；解码 < 1 KiB 占位图降级；lazy-first 且失败不回退占位 src；sourceUrl 为空时绝对图成功/相对图降级；链接模式 data: 跳过回归；20 MiB 预算降级。
- **完成条件**：目标测试、typecheck、lint 和链接模式编排回归全绿；使用 Node.js 24 执行 `./init.sh`，确认既有 93 tests 仍作为扩展测试集的一部分通过。
- **验证证据**：新增无默认值 `ImageEmbeddingStrategy`，链接模式显式 `src-first`/跳过 Data URI，粘贴模式显式 `lazy-first`/严格处理 Data URI；覆盖五种格式、Base64/8 MiB/AVIF compression 校验、占位图、2048px/WebP、动图首帧、非法协议、无 base、lazy 不回退、SSRF 交接、预算、取消与资源关闭。审查发现的链接模式警告漂移和 HEIF 伪装 AVIF 均先以失败测试复现后修复；最终 `src/lib/images.test.ts` 46 tests、相关 53 tests 全绿，Node.js 24.14.0 `./init.sh` 通过 lint、typecheck、19 files / 191 tests、覆盖率门禁和 production build；`images.ts` 为 97.16% statements/lines、88.46% branches、100% functions。

---

## T6A — 类型扩展与粘贴转换编排

- **状态**：done（2026-08-09）
- **依赖**：T5
- **边界**：`src/types/conversion.ts`（`ExtractionMode` 增加 `"paste"`、响应 `sourceUrl` 可为空）+ 独立粘贴编排模块及测试；不包含 API 路由。
- **TDD 节奏**：先写编排失败测试 → 实现「预处理 → 图片内嵌 → Markdown 预算循环 → 统计/警告」→ 清理。
- **用例**：HTML 与纯文本路径；可选 sourceUrl；图片预算逐张降级；纯正文超过 20 MiB 返回 413；无可用正文 422；取消信号贯穿；标题、文件名、统计和 `extractionMode === "paste"`。
- **完成条件**：粘贴编排相关测试、typecheck、lint 全绿；现有 `convert.test.ts` / `convert-orchestration.test.ts` 保持通过。
- **验证证据**：新增 `ExtractionMode: "paste"`、`convertPastedContent()` 与粘贴预算 helper，串联 T3–T5，覆盖 HTML/text、来源规范化、纯图片/失败资源 422、正文 413、末图降级、统计/警告、同一时间戳文件名和取消。初版逐图 JSDOM/Turndown 循环峰值内存过高，已改为真实 DOM 图片唯一 marker + 单次 Markdown 渲染 + 精确 UTF-8 批量末图裁剪；escaped alt/title、完整/畸形代码图片字面量均不误判。最终专项 20 tests，Node.js 24.14.0 `./init.sh` 通过 lint、typecheck、20 files / 211 tests、覆盖率门禁和 production build；`convert-paste.ts` 为 96.59% statements/lines、70.96% branches、100% functions。

---

## T6B — `/api/convert-paste` 路由与有界请求体

- **状态**：done（2026-08-09）
- **依赖**：T6A
- **边界**：新增请求类型、5 MiB 有界 JSON 读取工具、`src/app/api/convert-paste/route.ts` 与对应测试；不修改 `/api/convert` 契约。
- **TDD 节奏**：先写路由和有界读取失败测试 → 实现鉴权/解析/限流/超时 → 清理。
- **用例**：缺令牌/错误来源 403；Content-Length 声明超限和无/伪造 Content-Length 的实际流式超限均为 413；html/text 均空 400；sourceUrl 非 HTTP(S) 或含凭据 400；纯文本成功；45 秒超时 504；客户端停止内部记录 499；日志不含正文、HTML 或 URL。
- **完成条件**：路由与请求体测试、typecheck、lint 全绿；`/api/convert` 现有测试回归不变。
- **验证证据**：新增 `PastedConvertRequest`、5 MiB UTF-8 有界流读取与 `/api/convert-paste`；鉴权早于正文读取，声明/伪小/缺失 `Content-Length` 的超限路径、schema/sourceUrl 400、429、45 秒总时限、499/504 竞态、日志隐私和 slot 释放均有回归。审查整改关闭 never-settling cancel、转换返回后超时竞态及超长十进制 `Content-Length` 问题。专项及旧 `/api/convert` 路由 40 tests；Node.js 24.16.0 `./init.sh` 通过 lint、typecheck、22 files / 245 tests、覆盖率门禁和 production build。

---

## T7A — 前端粘贴状态与纯函数

- **状态**：done（2026-08-09）
- **依赖**：T6B
- **边界**：新增前端粘贴状态/纯函数模块及测试；不修改页面布局。
- **TDD 节奏**：先写失败测试 → 实现剪贴板快照、payload 构造、UTF-8 JSON 字节计算、编辑降级与模式切换规则 → 清理。
- **用例**：同时保存 HTML/text；手工编辑清除 HTML 并转纯文本；再次粘贴整体替换；sourceUrl trim；5 MiB 上下界（含多字节中文与 JSON 开销）；链接与富文本模式各自保留输入；切换清空结果状态。
- **完成条件**：目标测试、typecheck、lint 全绿。
- **验证证据**：新增浏览器安全的共享 5 MiB 契约、`paste-client` 状态与纯函数；覆盖 HTML/text 同步快照、再次粘贴整体替换、手工编辑降级、`rich/plain/empty/edited` 提示状态、sourceUrl trim、真实 UTF-8 JSON（含中文）精确边界、双模式输入保留、loading 禁切换、切换清派生输出及不可变性。专项 17 tests；与请求体/路由联合 51 tests，typecheck、lint、diff-check 通过。

---

## T7B — 前端双模式 UI 与结果复用

- **状态**：done（2026-08-09）
- **依赖**：T7A
- **边界**：`src/app/page.tsx` + `src/app/page.module.css`；复用现有结果统计、预览、复制、下载和停止逻辑。
- **TDD 节奏**：只实现 T7A 已固化的状态契约；组件交互由 T8 E2E 覆盖。
- **用例**：链接/富文本 Tab；textarea 展示纯文本；富文本识别、纯文本降级、编辑后降级提示；可选来源 URL；转换中 Tab 禁用；停止后内容保留；链接模式现有交互和文案不变。
- **完成条件**：`npm run build`、typecheck、lint 通过，人工静态检查桌面宽度布局无明显回归。
- **验证证据**：`page.tsx` 接入链接/富文本双模式，复用 T7A 单状态与现有停止、结果、复制、下载、预览、警告；支持双 MIME 粘贴、编辑降级、来源 URL、前端 5 MiB 拦截和双 API。CSS 完成 820px 桌面表单与窄屏响应；1180px、700px 静态浏览器截图无明显回归、控制台无错误。审查关闭旧副标题/selector、异步 updater/ref 与 stop 按钮 DOM 复用三项中风险；旧 Chromium E2E 7/7，typecheck、lint、production build、diff-check 通过。

---

## T8 — 三浏览器 E2E

- **状态**：done（2026-08-09）
- **依赖**：T7B
- **边界**：`e2e/` 新增粘贴模式用例。
- **用例**：富文本粘贴（Playwright 注入稳定的 `clipboardData` 双 MIME 数据）→ 转换 → 统计正确 → 复制/下载可用；纯文本降级；编辑后降级；再次粘贴替换；来源 URL 有/无；超 5 MiB；转换中停止保留输入；**0.1.3 既有 21 项 E2E 用例保持全绿（新增用例不得修改既有断言）**。
- **完成条件**：Node.js 24 下 `./init.sh` 与 `npm run test:e2e` 三浏览器全绿，tracked diff check passed；0.1.3 链接模式用例无回归。此里程碑不运行联网 live。
- **验证证据**：仅新增 `e2e/paste.spec.ts`，既有 `home.spec.ts` 断言未修改。9 组覆盖双 MIME 富文本→统计/预览/警告/复制/下载、纯文本与编辑降级、再次粘贴替换、来源有/无且输出头真实、UTF-8 JSON 超 5 MiB 前端阻断、413 中文回显、慢请求 Tab 禁用/停止保留及 AbortSignal 实际触发。Node.js v24.16.0 `./init.sh` 通过 lint、typecheck、22 files / 262 tests、coverage/build；三引擎 48/48 E2E 与 tracked-file check 通过；未运行 live。

---

## T9A — 0.1.3 封版自动保护

- **状态**：done（2026-08-09）
- **依赖**：T8
- **边界**：`scripts/release-guards.mjs`、`scripts/release-guards.test.mjs`、`scripts/release-desktop.mjs`；不生成正式产物。
- **TDD 节奏**：先写失败测试 → 实现 Git ref、外部归档与历史 ZIP 哈希校验 → 清理。
- **用例**：`main` 或 `v0.1.3^{}` 偏离 `ce041c9` 时失败；归档缺失/可写/哈希错误时失败；打包前后任一 0.1.x ZIP 被修改或删除时失败；正确状态通过；错误不得包含敏感内容。
- **完成条件**：release guard 测试、`./init.sh` 通过；不会修改或删除 0.1.x 产物。
- **验证证据**：发布前置门禁固定校验 `main` / `v0.1.3^{}` 完整提交、外部只读 0.1.3 归档及 SHA-256、0.1.0–0.1.3 四个历史 ZIP 的固定文件名与哈希；缺失、篡改、额外 0.1.x 或非 0.2.0 发布目标均在任何发布命令前失败，发布成功或后续任一步失败时都会复核历史清单。Node.js v24.16.0 聚焦 22/22 tests 与 `./init.sh`（23 files / 281 tests、lint、typecheck、coverage、production build）通过；真实 guards 只读检查 4/4 历史 ZIP 和外部归档通过；未运行 live、`desktop:make` 或生成产物。

---

## T9B — 文档同步

- **状态**：done（2026-08-09）
- **依赖**：T9A
- **边界**（无产品代码，逐项核对）：`docs/PRODUCT.md`、`docs/ARCHITECTURE.md`、`docs/TESTING.md`、`docs/QUALITY-AUDIT.md`、`README.md`、`CHANGELOG.md`、`feature_list.json`、`PROGRESS.md`、`session-handoff.md`。每个文件的变更点见 PLAN 第 8 节。
- **完成条件**：逐项核对清单全部满足，内容与实现一致；明确登录态/临时/Blob 图片限制、纯文本编辑降级和 v0.2 安装条件。
- **验证证据**：按 PLAN 第 8 节逐项同步 `docs/PRODUCT.md`、`docs/ARCHITECTURE.md`、`docs/TESTING.md`、`docs/QUALITY-AUDIT.md`、`README.md`、`CHANGELOG.md`、`feature_list.json`、`PROGRESS.md` 和 `session-handoff.md`；明确链接/富文本两模式、`/api/convert-paste`、5 MiB UTF-8 请求体、HTML/text 编辑降级、可选来源 URL、图片格式/预算、登录态/临时签名/Blob 限制、v0.2 安装条件和 T9A 固定封版 guard。完成 JSON、关键词/死引用、Node.js v24.16.0 `./init.sh`（23 files / 281 tests）与 `git diff --check` 验证；未运行 live、`desktop:make` 或生成产物。

---

## T10 — 0.2.0 发布门禁与人工验收

- **状态**：done（2026-08-09）
- **依赖**：T9B
- **边界**：确认 `package.json` 与锁文件仍为 `0.2.0`；`npm run desktop:release`（Node.js 24.x）全流程；真实打包窗口人工验收（粘贴模式全流程 + 链接模式回归）。
- **完成条件**：`npm run desktop:release` 完整通过（这是本迭代唯一的 live 阻断点）；fresh ZIP 校验通过（版本 `0.2.0`/arm64/结构/SHA-256）；扩展后的测试集中 0.1.3 既有 93 tests 与 21 E2E 保持全绿；自动 guard 证明 `main`/标签/外部归档/0.1.x ZIP 未变化；真实窗口完成粘贴模式和链接模式验收并记录到 `feature_list.json`。
- **验证证据**：2026-08-09 经用户授权完成 Next.js 16.3.0、Undici 8.10.0、DOMPurify 3.4.13、Electron 43.3.0 与兼容 Nano ID 锁文件升级；生产审计为 0，完整树剩余 1 critical / 26 high / 3 low 且未进入应用包。Node.js 24.14.1 `npm run desktop:release` 连续通过 24 files / 282 tests、三引擎 48/48、真实微信门禁、Forge 与 fresh ZIP 校验；0.2.0 arm64 ZIP 为 354,594,827 bytes / SHA-256 `ab2a463c...a7b7b4`。打包应用启动与长微信 17,643 字符 / 30 图转换冒烟通过。真实窗口 X Article 样本正文正常；6 张正文图和封面均来自 `pbs.twimg.com`，本机匿名直连 7/7 `ECONNRESET`，因此按既有失败策略保留外链，用户已接受为 v0.2 已知限制。WalkingLabs 样本则确认只有客户端 Mermaid→SVG、无栅格图；当前输出 0 图/0 警告且无 Mermaid fence，用户已接受为 v0.2 已知限制，并将 Mermaid 保留登记为后续 `feat-013`。同日用户确认打包应用的富文本模式人工验收通过，T10 完成。提交前审查又以失败测试确认远程 SVG 可伪装为栅格图、ZIP 校验只看旁路 app；整改后实际格式不匹配会降级，发布门禁直接解压检查包内版本/arm64。最终 Node.js 24.14.1 `./init.sh` 通过 24 files / 285 tests、coverage/build，现有 0.2.0 ZIP 包内只读复验通过。

---

## 备注

- 原编号 T1（Plan 批准）于 2026-08-06 完成（`docs/PLAN-V0.2.md` 获批）。
- 类型扩展原为 T2，为避免脱离代码的孤立变更，并入 T6A 实施。
- 2026-08-09 开工评审后拆分 T6A/T6B、T7A/T7B、T9A/T9B，并固定 API 双通道、编辑降级、语义门控、data URI 完整校验、无 base 资源处理和 T10-only live 门禁。
- 2026-08-07 技术选型：v0.2 不引入 Jina 等第三方代理抓取通道与 OpenCLI/Cookie 登录态路线（决策与可借鉴工程模式见 `docs/PLAN-V0.2.md` 第 13 节）；本 feature 实施中不得引入相关依赖或通道。
