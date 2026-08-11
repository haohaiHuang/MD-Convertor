# MD-Convertor

[English](README.md) | **简体中文**

MD-Convertor 是一个 Apple Silicon Mac 网页转 Markdown 单机工具。你可以粘贴公开网页链接，或把自己已经复制的网页富文本粘贴进应用；确认无误后点击转换，即可在本机预览、复制或保存包含内嵌图片的 `.md` 文件。

## 第一阶段能力

- 无账号、无需外部服务器，链接和转换结果只在本机处理
- 每次启动使用随机会话令牌保护本地转换接口，外部网页不能直接调用
- 不调用 AI API，不需要 API Key，也不产生模型调用费用
- 静态网页正文提取，JavaScript 页面使用浏览器兜底
- 动态浏览器请求逐次校验并固定公网 IP，防止目标网页借应用访问本机或内网
- 动态浏览器回退限制为最多 100 个请求、累计 50 MiB 网络传输和单连接 25 MiB，超限时停止相关请求
- 支持可公开访问的微信公众号文章，并识别验证页或已删除文章
- 提供“链接转换”和“富文本转换”两个模式；富文本模式同时读取剪贴板 HTML 与纯文本
- 富文本 HTML 经过语义门控和独立净化；手工编辑后自动降级为纯文本，再次粘贴整体替换
- 富文本请求体最多 5 MiB（按 UTF-8 JSON 实际字节数校验），来源 URL 可选且只用于来源头部和相对资源解析
- 富文本图片按 lazy-first 处理，严格校验 `data:` 图片并沿用 30 图、8 MiB 单图、20 MiB 最终文件预算
- 链接模式自动保留标题、来源和转换时间；富文本模式按可选来源 URL 保留来源
- 支持 JPEG、PNG、WebP、GIF、AVIF 图片以内嵌 Data URI 写入 Markdown
- Mermaid 源码转换为 fenced `mermaid` 代码块；链接页面或粘贴内容只有安全的渲染图时，转为 PNG 并内嵌
- 最终文件不超过 20 MiB；超出预算时优先保留正文并从末张图片开始省略
- 转换中可停止；完成后显示文件大小、正文字数和图片提取数
- 链接模式可一键清空 URL 和旧结果；长结果页面可快速返回顶部继续输入
- Apple Silicon（arm64）Mac 桌面应用

应用不绕过登录页、付费墙、验证码或其他访问限制；富文本模式只处理用户主动复制的剪贴板内容。登录态、临时签名、`blob:` 或需要 Cookie 的图片可能无法重新获取，会保留替代文本并提示。PDF、批量转换、历史记录和跨电脑同步不在第一阶段范围内。

## 两种转换模式

### 链接转换

在“链接转换”页粘贴 HTTP/HTTPS 网页链接，点击“转换为 MD”后由本机安全抓取、提取正文并处理图片。点击“清空链接”可同时清除 URL、校验提示和旧结果；转换进行中该操作不可用。动态网页可使用内置 Chromium 回退；链接、网页和图片不会上传到 MD-Convertor 服务。

结果较长时，页面右下角会在滚动后显示“返回顶部”；它只负责平滑回到输入区，不会清除链接、富文本内容或转换结果。

### 富文本转换

在“富文本转换”页直接粘贴浏览器复制的网页内容。应用读取 `text/html` 和 `text/plain`，输入框显示纯文本：

1. 检测到语义结构时，使用净化后的 HTML、Turndown/GFM 和 lazy-first 图片管线。
2. 没有可用语义 HTML 时，使用剪贴板纯文本；提示会明确显示当前路径。
3. 手工编辑后旧 HTML 会立即丢弃并按纯文本转换；再次粘贴会替换全部内容。
4. 可选填写来源 URL。填写无凭据的 HTTP/HTTPS 地址时输出来源头部并帮助解析相对链接/图片；留空则省略来源行。
5. 点击“清空”可一次移除当前内容、来源 URL 和旧转换结果；转换进行中该操作不可用。

粘贴模式不会重新抓取来源网页、读取浏览器 Cookie 或恢复登录态。懒加载图片缺少真实 URL，或图片依赖登录态、临时签名、`blob:` URL 时，应用会保留替代文本和警告。

Mermaid 源码会保留为 fenced `mermaid` 代码块；应用预览把它显示为代码，支持 Mermaid 的 Markdown 阅读器可自行渲染。链接页面若只有客户端渲染结果，应用会在受控 Chromium 中截图为 PNG。富文本粘贴若只有 Mermaid SVG，会先移除脚本、外部资源和危险属性，再在本机转为 PNG；无法安全转换或只有 Canvas 时保留占位文本并提示。两条路径生成的 PNG 都按现有图片数量和文件大小预算内嵌，原始 SVG 不进入 Markdown。

## 在其他电脑使用

0.1.3 与当前已验收的 v0.2 0.2.0 ZIP 都是自包含的 Apple Silicon Mac 应用。目标电脑不需要安装 Node.js、npm、Chrome、Playwright、AI API 或其他开发环境。使用条件如下：

- Apple Silicon（M1、M2、M3、M4 或后续 arm64 芯片）Mac，不支持 Intel Mac、Windows 或 Linux。
- macOS 12.0 或更高版本；链接模式转换或富文本模式重新嵌入远程 HTTP(S) 图片时需要联网，纯文本和 `data:` 图片可离线转换。
- 解压后建议把 `MD-Convertor.app` 拖入“应用程序”。当前产物未签名和 notarize，首次启动可能需要在 Finder 中右键应用并选择“打开”，或在“隐私与安全性”中允许启动；部分 Mac 会直接提示“文件已经损坏”。
- 不同电脑不会同步历史或结果，需要在当前电脑下载 `.md` 文件自行保留。

当前 0.2.0 ZIP 已包含 `feat-015`、feat-013 的链接/富文本 Mermaid 完整修复，以及 feat-016 的清空链接与返回顶部，并通过完整发布门禁；文件为 `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.2.0.zip`，大小 `354,636,241` bytes，SHA-256 为 `5becae36a53e91129a0dbcb93c3f7f5f3197326b2c83df6f10cb8494d8116485`。

0.1.3 应用已在第二台 Apple Silicon Mac 上完成真实安装和使用验收。该电脑首次启动时出现“文件已经损坏”提示；确认 ZIP 的 SHA-256 与本文记录一致后，移除应用的 quarantine 属性即可启动：

```bash
xattr -dr com.apple.quarantine "/Applications/MD-Convertor.app"
```

如果提示没有权限，再在命令前加 `sudo`。验收时使用 `xattr -cr` 同样成功，但它会递归清除应用的全部扩展属性，因此安装说明优先推荐上面只移除 quarantine 的精确命令。不要对来源或哈希不可信的应用执行该操作。

## 本地开发

需要 Apple Silicon Mac、Node.js 24.x 和 npm；验证脚本会拒绝 Node.js 23 或 25 等其他主版本。

```bash
npm install
npx playwright install chromium
npm run dev:desktop
```

首次构建需要联网下载 Electron 和 Chromium；之后的桌面打包会复用本机缓存。

## 验证

首次执行完整跨浏览器验收前安装三个引擎：

```bash
npx playwright install chromium firefox webkit
```

```bash
./init.sh
npm run test:e2e
npm run test:live
npm run test:live:wechat
npm run desktop:package
```

`npm run test:live` 会联网验证 WalkingLabs 链接/粘贴 Mermaid，是发布前阻断门禁；`npm run test:live:wechat` 保留微信公众号真实对照，但因微信上游验证与超时波动只作为非阻断诊断。目标 Apple Silicon 发布流程使用 `npm run desktop:release`，依次执行基线、三浏览器 E2E、稳定真实网页对照与 ZIP 打包；脚本会拒绝旧 ZIP，核验版本、arm64 架构和包结构，并输出新产物大小与 SHA-256。现状、命令分层、环境变量、冒烟方式和人工验收清单见 [`docs/TESTING.md`](docs/TESTING.md)。

v0.2 的 `desktop:release` 只在 T10 执行：它要求目标版本为 `0.2.0`，并在任何检查或打包命令前保护 `main`/`v0.1.3`、外部只读归档及 0.1.0–0.1.3 历史 ZIP。T9A 的 guard、真实 live、0.2.0 打包与打包窗口人工验收均已通过。

## 构建 Apple Silicon 应用

```bash
npm run desktop:make
```

未签名的测试产物生成在 `out/`。首次打开时 macOS 可能显示安全提示；正式分发前需要完成 Developer ID 签名和 notarization。

0.1.3 个人测试包位于（v0.2 不覆盖该历史产物）：

```text
out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.1.3.zip
```

当前 ZIP SHA-256：`66909aa8759ec41fdde875204773958d32b33a2c903e7b4eb0858a50fb1bdf89`。

解压后可把 `MD-Convertor.app` 拖入“应用程序”。如果 Finder 右键“打开”仍提示应用损坏，请先核对 ZIP 的 SHA-256，再按“在其他电脑使用”中的命令移除 quarantine 属性。

架构与安全边界见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)，产品范围见 [`docs/PRODUCT.md`](docs/PRODUCT.md)。
