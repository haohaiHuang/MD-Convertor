# Project Progress

## Current State

- Last updated: 2026-08-11
- Active feature: 无；`feat-016 — Quick Return and Clear Link` 已完成自动验证与真实窗口验收。`feat-014` 已取消。
- Overall status: 0.1.3 已以提交 `ce041c9`、标签 `v0.1.3` 和只读 ZIP 归档封版。v0.2 `feat-012`、`feat-015` 与 `feat-013` 已完成；最新 0.2.0 ZIP 已通过自动门禁和真实窗口验收，但按用户决定尚未合并到 `main`。

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
- [x] 新增合成网页精确 Markdown 金标准、稳定真实网页发布门禁，以及独立的微信真实网页诊断检查。
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
- [x] 完成 feat-012 T3 粘贴预处理：DOM 语义门控、安全清洗、HTML/text 降级、标题优先级、lazy 图片属性定向保留与字符统计；32 项专项测试覆盖 MiaoYan 单段落回归、空段落、恶意链接、SVG 标题和畸形 HTML。
- [x] 完成 feat-012 T4 粘贴 Markdown 与文件名规则：HTML/GFM、纯文本字面转义、可选来源、链接解析、标题去重及 MiaoYan 适用语义；审查发现全部关闭，37 项 Markdown 测试通过且链接模式回归不变。
- [x] 完成 feat-012 T5 图片策略：显式区分链接/粘贴模式，lazy-first、严格 Data URI、五格式与 AVIF 防伪、占位/压缩/动图/预算/取消/SSRF 交接均有回归；链接模式警告与行为保持不变。
- [x] 完成 feat-012 T6A 粘贴编排：类型、HTML/text、图片、Markdown、422/413、统计、警告和取消已串联；预算算法经审查改为单次渲染和 marker 定向裁剪，避免 20 MiB 内容重复解析的高内存问题。
- [x] 完成 feat-012 T6B 粘贴 API：新增 5 MiB 有界请求体、同源鉴权路由、字段校验、限流、45 秒总时限和隐私日志；审查关闭流取消悬挂、截止竞态及超长 Content-Length 早期判断问题，旧链接接口保持不变。
- [x] 完成 feat-012 T7A 前端状态契约：剪贴板 HTML/text、编辑降级、内容来源提示、payload/UTF-8 5 MiB 边界、双模式输入隔离与切换清理均由不可变纯函数和 17 项测试固化。
- [x] 完成 feat-012 T7B 双模式界面：链接模式保持旧文案/交互，富文本模式接入剪贴板 HTML/text、来源、预算、停止与共享结果；键盘 Tab、ARIA 和桌面/窄屏布局已检查，审查中发现的三个真实 React 回归均已关闭。
- [x] 完成 feat-012 T8 三浏览器 E2E：9 组粘贴场景在 Chromium、Firefox、WebKit 全绿；旧 21 项链接用例未改，停止测试确认请求启动与 AbortSignal，来源元数据头、5 MiB 和 413 回显均已覆盖。
- [x] 完成 feat-012 T9A 封版自动保护：发布前固定校验 0.1.3 Git 基线、外部只读归档和四个 0.1.x 历史 ZIP manifest；非 0.2.0 目标、缺失、篡改或新增 0.1.x 均在发布命令前失败，后续任一步失败仍执行历史复核。
- [x] 完成 feat-012 T9B 文档同步：产品、架构、测试、质检、README、Changelog、事项、进度和交接均已对齐两模式、粘贴 API、安全限制、图片预算、v0.2 安装条件与 T9A 保护；该记录时点的 T10 live、打包和人工验收随后已完成。
- [x] 完成 feat-012 T10 自动发布门禁：授权升级 Next.js 16.3.0、Undici 8.10.0、DOMPurify 3.4.13 与 Electron 43.3.0 后，生产审计清零；Node.js 24.14.1 连续通过 282 tests、48 E2E、live、Forge、fresh ZIP、启动和长微信 30 图转换冒烟。
- [x] 完成 feat-012 T10 人工验收：用户确认真实打包窗口的富文本转换流程通过；X 匿名图片和 Mermaid/SVG 缺失按已记录边界处理。
- [x] 完成 feat-015 一键清空：富文本模式可同时清除 HTML、纯文本、来源 URL 与旧结果；转换期间入口禁用，清空后可直接粘贴并转换下一份内容；用户已在当前源码的真实 Electron 窗口人工验收通过。
- [x] 完成 feat-013 链接与粘贴实现：Mermaid 源码输出 fenced code；链接页面客户端图表经受控 Chromium 转为可信 PNG；富文本中的 Mermaid SVG 清除主动内容/外部资源后由 Sharp 转为 PNG，并进入既有图片校验、统计与预算。无法安全转换或 Canvas 仍占位警告。
- [x] 完成 feat-016 快速返回与链接清空：链接模式可一键清除 URL、校验和旧结果；长结果滚动后可从右下角平滑返回输入区，桌面与窄屏均通过自动和真实窗口验收。

## Verification Evidence

- Passed with Node.js 24.14.0: v0.2 开工基线 `./init.sh` — Harness、lint、typecheck、18 files / 93 tests、覆盖率门禁和 Next.js production build；此时尚未开始 T3 功能编码。
- Passed with Node.js 24.14.0: v0.2 开工评审修订后 `./init.sh` — lint、typecheck、18 files / 93 tests、覆盖率门禁和 Next.js production build；修订只涉及计划与 Harness 文档，T3 仍未开始。
- Passed with Node.js 24.14.0: feat-012 T3 `npx vitest run src/lib/paste.test.ts` — 1 file / 32 tests；`./init.sh` — lint、typecheck、19 files / 125 tests、覆盖率门禁和 Next.js production build。`paste.ts` 达到 100% statements / lines / functions、88.67% branches。
- Passed with Node.js 24.14.0: feat-012 T4 `npx vitest run src/lib/markdown.test.ts` — 37 tests；`./init.sh` — lint、typecheck、19 files / 159 tests、覆盖率门禁和 production build。`markdown.ts` 达到 99.15% statements/lines、87.77% branches、100% functions。
- Passed with Node.js 24.14.0: feat-012 T5 `src/lib/images.test.ts` — 46 tests；相关图片/编排回归 53 tests；`./init.sh` — lint、typecheck、19 files / 191 tests、覆盖率门禁和 production build。`images.ts` 达到 97.16% statements/lines、88.46% branches、100% functions。
- Passed with Node.js 24.14.0: feat-012 T6A `src/lib/convert-paste.test.ts` — 20 tests；`./init.sh` — lint、typecheck、20 files / 211 tests、覆盖率门禁和 production build。`convert-paste.ts` 达到 96.59% statements/lines、70.96% branches、100% functions。
- Passed with Node.js 24.16.0: feat-012 T6B `paste-request` + `/api/convert-paste` + 旧 `/api/convert` 路由 — 40 tests；`./init.sh` — lint、typecheck、22 files / 245 tests、覆盖率门禁和 production build。`paste-request.ts` 达到 100% statements/lines/functions、93.02% branches。
- Passed with Node.js 24.16.0: feat-012 T7A `src/lib/paste-client.test.ts` — 17 tests；paste-client + paste-request + paste route 51 tests，typecheck、lint、diff-check 通过；服务端与客户端复用同一 5 MiB 常量。
- Passed with Node.js 24.16.0: feat-012 T7B — typecheck、lint、production build、diff-check；旧 Chromium `e2e/home.spec.ts` 7/7。浏览器静态检查 1180px 与 700px 双模式布局无明显回归，console 0 errors。
- Passed with Node.js 24.16.0: feat-012 T8 `./init.sh` — lint、typecheck、22 files / 262 tests、coverage gate、production build；`npm run test:e2e` — Chromium/Firefox/WebKit 48/48，tracked-file check passed；未运行 live。
- Passed with Node.js 24.16.0: feat-012 T9A `scripts/release-guards.test.mjs` — 22/22；`./init.sh` — lint、typecheck、23 files / 281 tests、coverage gate、production build；真实只读 guards 校验 0.1.0–0.1.3 四个 ZIP、外部归档与 Git refs 全部通过；未运行 live、`desktop:make` 或生成产物。
- Passed with Node.js 24.16.0: feat-012 T9B 文档静态核对 — 9 个授权文档、JSON 解析、关键词/死引用检查与 `git diff --check` 通过；未运行 live、`desktop:make` 或生成产物。
- Passed with Node.js 24.14.1: feat-012 T10 `npm run desktop:release` — lint、typecheck、24 files / 282 tests、coverage gate、三引擎 48/48、真实微信门禁、Forge 与 fresh artifact 校验全通过；ZIP 为 0.2.0 / arm64 / macOS 12.0+，354,594,827 bytes，SHA-256 `ab2a463c...a7b7b4`。
- Passed with Node.js 24.14.1: 提交前审查整改后的 `./init.sh` — lint、typecheck、24 files / 285 tests、coverage gate 与 production build；现有 0.2.0 ZIP 经新门禁解压检查，包内版本与 arm64 可执行文件通过。
- Passed with Node.js 24.14.1: feat-015 `src/lib/paste-client.test.ts` — 19/19；`./init.sh` — lint、typecheck、24 files / 287 tests、coverage gate 与 production build；富文本关键 E2E — Chromium/Firefox/WebKit 30/30，tracked-file check passed。
- Passed with Node.js 24.14.1: feat-015 后完整 `npm run test:e2e` — Chromium/Firefox/WebKit 51/51，tracked-file check passed；当前源码包含链接模式 21 项与富文本模式 30 项。
- Passed with Node.js 24.14.1: feat-013 T2/T3 聚焦转换、粘贴、浏览器与图片测试；中途真实页面失败定位为 Google Fonts CSS 挂起安全代理，按 RED/GREEN 只拦截字体样式表后，WalkingLabs Mermaid 门禁通过并生成至少一张安全栅格图。最终 `./init.sh` 为 26 files / 306 tests、coverage 与 build；三引擎 E2E 51/51；微信与 WalkingLabs live 2/2。
- Passed with Node.js 24.14.1: feat-013 `npm run desktop:release` — 306 tests、三引擎 51/51、live 2/2、Forge 与 fresh artifact 校验；新 0.2.0 arm64 ZIP 354,619,347 bytes，SHA-256 `e84ce4bdeb7ea50e50d9a3a5fe2efe0a3f7bdc098cf133f83a513fb2e81328c0`。打包应用 WalkingLabs 冒烟通过：browser mode、11,455 bytes、6,231 non-Base64 chars、1 embedded image。
- Passed with Node.js 24.14.1 after paste-Mermaid remediation and quality review: 用户实际 1170×266 黑图确认来源 CSS 丢失导致黑色回退，固定浅色 palette 后真实页面目视及重新打包应用人工验收通过。后续质检以四项 RED 复现动态多图跳过、纯源码误选、内联样式覆盖和 31 图统计缺口，并发现小型生成 PNG 占位误判；整改后聚焦浏览器/粘贴/图片 123/123，`./init.sh` 27 files / 314 tests、coverage 与 build。随后再次 `desktop:package`，产物确认 0.2.0 / arm64 / macOS 12.0+，用户复测 WalkingLabs 富文本转换正常。此前三引擎 E2E 51/51、WalkingLabs 链接/深色粘贴 live 2/2。正式 `desktop:release` 仍受微信上游 504 阻断，未生成新 ZIP。
- Latest release attempt on 2026-08-11: Node.js 24.14.1 `desktop:release` 通过 314 tests、coverage/build、三引擎 E2E 51/51 与 WalkingLabs live 2/2；固定微信样本 `uFxJIK83ZEgW5QMjogujSw` 在转换阶段约 28 秒后返回 `504 CONVERSION_TIMEOUT`，流程在 Forge 前安全停止。既有 ZIP 保持 354,619,347 bytes / SHA-256 `e84ce4bd...e81328c0`，未被覆盖。
- Passed with Node.js 24.14.1: 用户确认微信上游超时不再阻断个人测试包发布；`test:live` 固定为 WalkingLabs 链接/粘贴 Mermaid 2 项阻断门禁，微信同轮对照保留为 `test:live:wechat` 诊断命令。拆分配置测试先 RED 后 GREEN，release guards 25/25；最终 `desktop:release` 通过 27 files / 315 tests、coverage/build、三引擎 E2E 51/51、WalkingLabs live 2/2、Forge 与 fresh ZIP 校验。新 0.2.0 arm64 ZIP 为 354,631,314 bytes，SHA-256 `b212b359405e53f1a0cc924b51c48c986335a3f74b4520f06f9fb825357d505c`。
- Passed with Node.js 24.14.1: feat-016 TDD — `paste-client.test.ts` 21/21；Chromium 链接页 10/10；`./init.sh` 27 files / 317 tests、coverage gate 与 build；三引擎全量 E2E 60/60、tracked-file check passed。用户随后确认当前源码真实 Electron 窗口验收通过；未运行 live、未打包。
- Passed: feat-015 pre-package source Electron window — 用户在重新发布前确认“一键清空”交互通过；后续发布与打包窗口证据见下一条。
- Passed with Node.js 24.14.1: feat-015 `npm run desktop:release` — 24 files / 287 tests、coverage gate、三引擎 51/51、真实微信门禁、Forge 与 fresh ZIP 校验全部通过；打包应用启动和 `example.com` browser-mode 270-byte 转换冒烟通过，用户确认新打包窗口的“一键清空”无问题。
- Passed: 0.2.0 packaged runtime — loopback standalone 启动；长微信 direct mode 17,643 non-Base64 chars / 30 images / 7,749,111 bytes；打包应用未包含 Forge、concurrently 或 tar；用户已确认真实窗口富文本模式人工验收通过。
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

- v0.2 current App: `out/MD-Convertor-darwin-arm64/MD-Convertor.app` — arm64；最低 macOS 12.0；版本 0.2.0；来自最新完整 release gate。
- v0.2 current ZIP: `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.2.0.zip` — 354,631,314 bytes；SHA-256 `b212b359405e53f1a0cc924b51c48c986335a3f74b4520f06f9fb825357d505c`；包含 feat-015 与 feat-013 完整链接/粘贴 Mermaid 修复。
- 0.1.3 frozen ZIP 保持 `239,281,512` bytes / SHA-256 `66909aa8759ec41fdde875204773958d32b33a2c903e7b4eb0858a50fb1bdf89`；外部只读归档和 0.1.0–0.1.3 四个历史哈希均未变化。

## Blockers and Risks

- 应用尚未进行 Developer ID 签名和 notarization；第二台 Mac 已实际出现“文件已经损坏”提示，需要用户确认来源可信并移除 quarantine 属性后才能启动。
- 默认终端仍是 Node.js 23.11.1，但 `init.sh` 和发布流程现在会在开始阶段拒绝；执行验证前必须显式切换到 Node.js 24.x。
- Node.js 24.16.0 下 Forge 7.11.2 仍会在 finalizing 无产物退出；fresh ZIP 门禁已可靠阻断，当前打包使用已验证的 Node.js 24.14.1。
- 真实微信文章访问存在上游波动：同一版本曾出现 45 秒/20 秒超时，复跑可成功；95% 门禁和长文内容门槛均未降低。
- 2026-08-09 经用户授权完成最小安全升级：生产依赖审计由 5 high / 1 moderate 降至 0；完整树为 1 critical / 26 high / 3 low，剩余项位于未进入应用包的 Electron Forge 等开发/构建链。个人测试门禁放行，但仍跟踪上游修复且不使用 `npm audit fix --force`。
- 登录态、临时签名、Blob 或需要 Cookie 的远程图片可能无法从粘贴 HTML 重新获取；v0.2 明确降级为替代文本并警告，不引入 Cookie 读取。
- 0.2.0 真实窗口人工验收样本 `x.com/lumenxbt/status/2082101954206130402` 为 X Article：正文含 6 个图片实体并另有封面，均位于 `pbs.twimg.com`；本机匿名直连 7/7 返回 `ECONNRESET`，同一打包应用复跑 X 页面也出现 502 上游波动。图片无法下载时保留外层链接，属于当前“不绕过 X 网络/登录限制”的降级，不是 Data URI 格式回归；用户已接受为 v0.2 已知限制，不阻断个人测试发布。
- WalkingLabs 页面静态 HTML 只有空 `.mermaid`、客户端才生成内联 SVG；链接模式已由受控 Chromium 安全截图。真实剪贴板同时含 HTML/text，HTML 中只有渲染 SVG；现已增加专用清洗、固定浅色配色和 Sharp 栅格化，真实粘贴门禁及本机预览/下载人工验收通过。
- feat-012 已完成全部 T3–T10 并以提交 `23294e4` 收口；当前 `codex/feat-015-clear-paste` 分支在其上完成 feat-015，并已重新通过 live、0.2.0 打包、应用冒烟与真实窗口人工验收，但尚未合并到 `main`。
- 2026-08-10 用户确认现有 UI/UX 无需整体调整，取消 `feat-014`；随后授权并完成 `feat-015`，新增富文本模式一键清空粘贴 HTML、纯文本、来源链接和旧结果。

## Recommended Next Step

等待用户决定是否提交当前已验收的 feat-013 与 feat-016 工作树，或另行授权运行完整发布门禁生成包含 feat-016 的新 ZIP；未经授权不自动执行 Git 提交、live、打包或合并。
