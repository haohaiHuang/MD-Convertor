# Project Progress

## Current State

- Last updated: 2026-07-18
- Active feature: `feat-010 — Personal Mac Release`
- Overall status: 0.1.3 arm64 个人测试包、真实窗口停止/复制/下载及长文 30 图验收通过；等待第二台 Apple Silicon Mac 安装验收，Node 24 下 Forge 提前退出的工具链差异仍需后续处理。

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

## Verification Evidence

- Passed with Node.js 24.16.0: 0.1.3 `./init.sh` — lint、typecheck、覆盖率门禁、82 tests、Next.js build。
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
- Pending: 在第二台 Apple Silicon Mac 上解压、首次安全放行、转换、复制和下载验收。
- Pending: Apple Developer ID 签名与 notarization；当前 ZIP 只适合个人测试。

## Decisions

- 第一阶段只支持 Apple Silicon Mac，不再要求服务器、域名、Docker 或跨浏览器公网访问。
- Electron 渲染进程启用 sandbox 和 context isolation，关闭 Node.js integration。
- SSRF 防护继续保留，防止网页链接访问本机和局域网资源。
- Playwright 只打包 Apple Silicon Chromium Headless Shell，减少不必要的 Firefox/WebKit 体积。
- 第一阶段允许未签名产物进行个人测试；正式对外分发前再配置签名与 notarization。
- Git 只管理源码、测试和项目知识文件；`node_modules/`、`.next/`、`.desktop/`、`out/`、环境变量和日志必须保持忽略。

## Artifacts

- App: `out/MD-Convertor-darwin-arm64/MD-Convertor.app` — 568 MiB；arm64；最低 macOS 12.0；版本 0.1.3。
- ZIP: `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.1.3.zip` — 239,266,746 bytes。
- ZIP SHA-256: `d5cd5bac1323827766c2a6bd94bde472b42bec2b790d52a276abed5d124c8a3e`。

## Blockers and Risks

- 应用尚未进行 Developer ID 签名和 notarization，其他 Mac 首次打开时会出现系统安全提示。
- 当前结构已自包含 Node.js/Electron、Chromium 和图片原生依赖，但尚未在第二台 Apple Silicon Mac 上完成真实安装与首次启动验收。
- 默认终端仍指向 Node.js 23.11.1；Node.js 24.16.0 已完成 `npm ci`、基线、E2E、真实网页、构建和桌面资源准备，但 Electron Forge 7.11.2 在 Node 24 下于 finalizing 阶段无错误提前退出，最终封装临时使用 Node 23.11.1。
- 真实微信文章访问存在上游波动：同一版本曾出现 45 秒/20 秒超时，复跑可成功；95% 门禁和长文内容门槛均未降低。
- 生产依赖审计有 2 个 moderate；完整依赖树有 20 high、2 moderate、3 low，high 主要位于 Electron Forge 构建链，需区分运行时与构建时影响后处理。

## Recommended Next Step

把 0.1.3 ZIP 拷贝到第二台 Apple Silicon、macOS 12.0+ 的 Mac，完成解压、首次安全放行、转换、复制和下载验收；同时单独调查/升级 Electron Forge，使封装步骤也能在 Node 24 下稳定产出。
