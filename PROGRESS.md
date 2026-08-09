# Project Progress

## Current State

- Last updated: 2026-08-09
- Active feature: `feat-012 — Paste Rich-Text Conversion (v0.2)`，状态 `in-progress`；规划已批准（`docs/PLAN-V0.2.md`），任务追踪见 `docs/TASKS-V0.2.md`（T3 待开工）。`feat-010 — Personal Mac Release` 已完成，`feat-011 — Multi-platform Repository Migration` 已取消。
- Overall status: 0.1.3 已完成自动发布门禁、本机人工操作和第二台 Apple Silicon Mac 安装验收，并以提交 `ce041c9`、标签 `v0.1.3` 和只读 ZIP 归档封版。v0.2 在独立分支 `codex/feat-012-v0.2` 开发，版本已隔离为 0.2.0，完整验收并经用户确认前不得合并到 `main`。

## Completed

- [x] 原有网页转换管线、界面和测试复用于桌面应用。
- [x] 产品与架构范围改为 Apple Silicon Mac 本地运行。
- [x] Electron 安全窗口和仅监听 `127.0.0.1` 随机端口的 standalone 服务。
- [x] Electron Forge `darwin/arm64` 应用与 ZIP 构建。
- [x] Playwright Chromium Headless Shell 随应用打包，不依赖用户电脑已有浏览器。
- [x] 打包应用通过 `https://example.com` 完整转换冒烟测试。
- [x] 修复微信验证页被误判为文章：桌面 UA 降低拦截，并显式识别验证页与删除页。
- [x] 打包应用成功转换一篇近期公开微信公众号文章，browser mode，121,801 bytes，包含 1 张内嵌图片。
- [x] 修复固定 IP 请求的多地址 DNS 回调兼容性，微信文章图片可写入预览和 Markdown。
- [x] 微信文章优先提取隐藏的 `#js_content`，并恢复 30 张 `data-src` 懒加载正文图。
- [x] 粘贴后改为按钮或 Enter 确认转换，转换中可停止并保留链接。
- [x] 完成区移除重复标题和技术提取模式，新增文件大小、正文字数和图片成功/总数统计。
- [x] 图片异常策略覆盖五种支持格式、8 MiB 单图上限、30 张上限、2048px 缩放、动图首帧和 20 MiB 正文优先降级。
- [x] 新增合成网页精确 Markdown 金标准，以及同轮对照真实微信网页的发布阻断门禁。
- [x] 生成版本号、文件名和包内版本均为 0.1.2 的 Apple Silicon ZIP。
- [x] Chromium 动态请求改经逐请求验证并固定 IP 的回环代理，DNS 重绑定回归测试通过。
- [x] Electron 每次启动生成随机会话令牌；本地 API 校验 Host、Origin、`Sec-Fetch-Site`、Content-Type 与令牌。
- [x] `TimeoutError` 正确映射为 504，客户端主动停止单独记录为 499。
- [x] 新增 API、限流、浏览器、代理、逐跳重定向和完整转换编排测试，并启用安全关键覆盖率阈值。
- [x] 桌面准备显式收集 Sharp arm64 与 libvips 原生依赖，修复打包应用 500 错误。
- [x] 新产物中 `localhost` 安全拒绝以退出码 1 阻断冒烟，`example.com` browser 模式与长微信 30 图转换均通过。
- [x] 0.1.3 结果按钮统一为“复制”和“下载”，复制成功后短暂显示“已复制”。
- [x] 真实打包窗口完成停止、复制、下载验收；剪贴板与下载内容一致，长文下载包含 17,643 个非 Base64 字符和 30 张内嵌图。
- [x] README 明确跨电脑条件：Apple Silicon、macOS 12.0+、无需外部运行环境、需要联网及未签名应用首次启动方式。
- [x] 初始化本地 Git 仓库，使用 `main` 管理当前 0.1.3 源码与 Harness 基线；依赖、构建产物、环境变量和日志均不纳入版本控制。
- [x] 动态浏览器代理新增 100 请求、累计 50 MiB、单 CONNECT 隧道 25 MiB 的共享预算，并在声明/流式 HTTP 与隧道超限时拒绝或关闭。
- [x] 新增真实 HTTP 双向传输、并发子资源、CONNECT、取消与 WebSocket 代理集成 Case；代理覆盖率提高到 91.27% lines / 81.31% branches / 95% functions。
- [x] `init.sh` 强制 Node.js 24.x；E2E 使用 production standalone 服务并验证测试前后 tracked diff 不变。
- [x] `desktop:release` 自动阻断旧或缺失 ZIP，校验版本、arm64、包结构并输出大小与 SHA-256。
- [x] 第二台 Apple Silicon Mac 完成跨电脑验收；通过移除未签名应用的 quarantine 属性后正常启动和使用。
- [x] 建立 0.1.3/v0.2 版本边界：`main` 与 `v0.1.3` 固定封版提交，v0.2 使用独立分支和 0.2.0 版本号；正式 ZIP 恢复为外部只读归档。
- [x] 完成 v0.2 开工评审并取得用户确认：补齐 HTML/text 双通道、编辑降级、DOM 语义门控、Data URI 完整图片处理、无来源 URL 资源规则、登录态图片限制和 T10-only live 门禁；任务拆分为 T3/T4/T5/T6A/T6B/T7A/T7B/T8/T9A/T9B/T10。

## Verification Evidence

- Passed with Node.js 24.14.0: v0.2 开工基线 `./init.sh` — Harness、lint、typecheck、18 files / 93 tests、覆盖率门禁和 Next.js production build；此时尚未开始 T3 功能编码。
- Passed with Node.js 24.14.0: v0.2 开工评审修订后 `./init.sh` — lint、typecheck、18 files / 93 tests、覆盖率门禁和 Next.js production build；修订只涉及计划与 Harness 文档，T3 仍未开始。
- Passed with Node.js 24.14.1 and 24.16.0: 0.1.3 `./init.sh` — lint、typecheck、覆盖率门禁、93 tests、Next.js build；2026-07-21 删除失效规划与 Harness 引用后复跑通过。
- Passed: 0.1.3 `npm run test:e2e` — Chromium、Firefox、WebKit 共 21 项，覆盖“复制”“下载”“已复制”和下载文件名。
- Passed with upstream variability: 0.1.3 `npm run test:live` — 首次上游超时，原阈值复跑通过；完整 `desktop:release` 再次在 live 阶段遇到上游超时。
- Partial with Node.js 24.16.0: 0.1.3 `npm run desktop:make` — 构建和资源准备通过，Forge 7.11.2 在 finalizing 无产物退出；Node 23 Forge 随后仅执行最终封装并成功。
- Passed: 0.1.3 packaged runtime — `example.com` browser mode 270 bytes；`localhost` 返回 `403 PRIVATE_TARGET`；长微信 direct mode 17,643 non-Base64 chars / 30 images / 7,749,363 bytes。
- Passed: 0.1.3 real packaged window — 停止后链接保留且可编辑；按钮为“复制”“下载”；“已复制”反馈出现；剪贴板与下载内容完全一致；长文下载 30 图且小于 20 MiB。
- Passed: packaged application startup — local Next.js ready on random loopback port。
- Passed: packaged conversion — browser mode, 270 bytes, no warnings。
- Passed: WeChat verification regression — 原示例由错误的 HTTP 200/267 bytes 改为明确 HTTP 422 `CONTENT_UNAVAILABLE`。
- Passed: image regression — 同一文章由 0 个 Data URI / `IMAGE_FETCH_FAILED` 修复为 1 个 Data URI / 无警告，121,801 bytes。
- Passed: long WeChat article regression — 由约 392 字符 / 1 张封面图修复为约 17,643 个非 Base64 字符 / 30 张正文图 / 无警告，7,749,363 bytes。
- Passed: executable inspection — Mach-O 64-bit arm64。
- Passed: Harness audit — 100/100。
- Completed: 2026-07-18 overall quality audit — 自动门禁、真实网页、依赖和产物抽查完成；结论为 not release-ready，详见 `docs/QUALITY-AUDIT.md`。
- Completed: 2026-07-18 second-round audit — Node.js 24.14.1 `desktop:release` 在隔离副本完整通过并生成 239,266,900-byte ZIP；loopback 子资源代理探针、现有包短页/私网/长文冒烟均通过。新增 `QA-009` 至 `QA-012`，详见质检文档。
- Passed with Node.js 24.14.1: remediation `npm run desktop:release` — 18 files / 93 tests、21 三浏览器 E2E、真实微信门禁、Forge 和 fresh artifact 校验全部通过；新 ZIP 239,281,512 bytes / SHA-256 `66909aa8...df89`。
- Passed: 新打包应用 `example.com` browser mode 270 bytes；长微信文章 direct mode 17,643 non-Base64 chars / 30 images / 7,749,363 bytes。
- Passed: 用户确认 SHA-256 `66909aa8...df89` 对应的当前 Mac 版本人工测试通过；2026-07-20 又完成第二台 Mac 验收。
- Passed: Node.js 23.11.1 执行 `./init.sh` 在其他检查前被拒绝；Node.js 24.16.0 Forge 无产物时发布脚本按预期非零失败。
- Passed: 2026-07-20 第二台 Apple Silicon Mac 验收；首次启动出现“文件已经损坏”提示，执行 `xattr -cr` 移除应用扩展属性后正常使用。
- Pending: Apple Developer ID 签名与 notarization；当前 ZIP 只适合个人测试。

## Decisions

- 第一阶段只支持 Apple Silicon Mac，不再要求服务器、域名、Docker 或跨浏览器公网访问。
- Electron 渲染进程启用 sandbox 和 context isolation，关闭 Node.js integration。
- SSRF 防护继续保留，防止网页链接访问本机和局域网资源。
- Playwright 只打包 Apple Silicon Chromium Headless Shell，减少不必要的 Firefox/WebKit 体积。
- 第一阶段允许未签名产物进行个人测试；正式对外分发前再配置签名与 notarization。
- 第二台 Mac 证实未签名 ZIP 可跨电脑使用，但 Gatekeeper 可能将应用标记为“已损坏”；安装说明优先使用只移除 `com.apple.quarantine` 的精确命令。
- Git 只管理源码、测试和项目知识文件；`node_modules/`、`.next/`、`.desktop/`、`out/`、环境变量和日志必须保持忽略。
- 2026-07-21，用户取消 Windows 版本、多平台仓库迁移和直接粘贴正文生成 Markdown 的后续方案；现有仓库结构、0.1.3 版本和单链接产品边界保持不变。
- 2026-08-07，用户确认 0.1.3 为正式版本：v0.2 构建必须使用独立版本号 0.2.0，不得覆盖或删除 0.1.x 产物；0.1.3 ZIP 已归档至 `~/Downloads/MD-Convertor-0.1.3-release/`（SHA-256 `66909aa8...df89`），链接模式行为零变化。2026-08-09 开工评审进一步统一门禁：T5 运行 `./init.sh`，T8 追加三浏览器 E2E，T10 才运行 live 与完整发布流程。
- 2026-08-09，用户确认 v0.2 修订契约：API 同时接收 HTML/纯文本/可选来源；编辑后丢弃旧 HTML；普通段落、链接和图片纳入语义门控；无标题优先使用正文首行；登录态、临时与 Blob 图片可能无法内嵌；Data URI 必须经完整图片校验和优化而非原样透传。
- 2026-08-07，完成 Agent-Reach（github.com/Panniantong/agent-reach）技术选型评估：v0.2 不引入 Jina 等第三方代理抓取通道（隐私冲突 + 对登录墙无效 + 破坏图片内嵌）与 OpenCLI/Cookie 登录态路线（越过非目标 + 安全边界复杂）；可借鉴其工程模式（多后端降级路由、能力探测三段式、故障隔离、最小权限凭据、只读观察纪律）。Jina 保留为后续迭代讨论项，触发条件与评估见 `docs/PLAN-V0.2.md` 第 13 节。

## Artifacts

- App: `out/MD-Convertor-darwin-arm64/MD-Convertor.app` — 568 MiB；arm64；最低 macOS 12.0；版本 0.1.3。
- ZIP: `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.1.3.zip` — 239,281,512 bytes。
- ZIP SHA-256: `66909aa8759ec41fdde875204773958d32b33a2c903e7b4eb0858a50fb1bdf89`。

## Blockers and Risks

- 应用尚未进行 Developer ID 签名和 notarization；第二台 Mac 已实际出现“文件已经损坏”提示，需要用户确认来源可信并移除 quarantine 属性后才能启动。
- 默认终端仍是 Node.js 23.11.1，但 `init.sh` 和发布流程现在会在开始阶段拒绝；执行验证前必须显式切换到 Node.js 24.x。
- Node.js 24.16.0 下 Forge 7.11.2 仍会在 finalizing 无产物退出；fresh ZIP 门禁已可靠阻断，当前打包使用已验证的 Node.js 24.14.1。
- 真实微信文章访问存在上游波动：同一版本曾出现 45 秒/20 秒超时，复跑可成功；95% 门禁和长文内容门槛均未降低。
- 生产依赖审计有 2 个 moderate；完整依赖树有 20 high、2 moderate、3 low，high 主要位于 Electron Forge 构建链，需区分运行时与构建时影响后处理。
- 登录态、临时签名、Blob 或需要 Cookie 的远程图片可能无法从粘贴 HTML 重新获取；v0.2 明确降级为替代文本并警告，不引入 Cookie 读取。
- `feat-012` 尚未开始功能编码；开工准备完成后从 T3 进入 TDD，不得并行推进后续 Task。

## Recommended Next Step

实施 `feat-012`（v0.2 富文本粘贴转换）的 T3：`src/lib/paste.ts` 预处理（结构门控/清洗/标题提取），TDD 先行——先写 `paste.test.ts` 失败测试再实现。完整任务边界与验证方式见 `docs/TASKS-V0.2.md`。遗留项：`QA-005` 依赖升级、`QA-008` 签名与 notarization（仅对外分发时需要）。
