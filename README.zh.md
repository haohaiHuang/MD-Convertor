# MD-Convertor

[English](README.md) | **简体中文**

MD-Convertor 是一个 Apple Silicon Mac 网页转 Markdown 单机工具。你可以转换公开网页链接，也可以粘贴自己已经复制的富文本，然后预览、复制或下载一份自包含的 Markdown 文件。

## 主要能力

- 本机运行，无需账号、服务器、AI API、API Key 或订阅
- 提供相互独立的“链接转换”和“富文本转换”
- 提取静态页面，必要时使用随应用打包的 Chromium 渲染 JavaScript 页面
- 保留标题、段落、链接、列表、表格、fenced 代码块和 GFM 结构
- Mermaid 源码保留为 `mermaid` 代码块；安全的渲染图可转为 PNG 内嵌
- 完整保留微信公众号中由多个 `<code>` 节点组成的同一代码块
- JPEG、PNG、WebP、GIF、AVIF 图片以内嵌 Data URI 写入 Markdown
- 最终文件上限 20 MiB，优先保留正文；不支持或超预算的图片降级为替代文本并提示
- 支持停止转换、清空两种输入、复制、下载、结果统计和快速返回输入区

应用不绕过登录页、付费墙、验证码或其他访问限制。富文本模式只处理用户主动提供的剪贴板内容；依赖 Cookie、登录态、临时签名或 `blob:` URL 的图片可能无法获取。

## 使用条件

- Apple Silicon（arm64）Mac；不支持 Intel Mac、Windows 或 Linux
- macOS 12.0 或更高版本
- 链接网页和远程图片需要联网；纯文本和已内嵌的 `data:` 图片可离线转换
- 运行安装包不需要 Node.js、浏览器、Playwright 或其他开发环境

当前产物未签名、未 notarize。请先核对校验值，再解压并把 `MD-Convertor.app` 拖入“应用程序”，优先尝试 Finder 右键“打开”或在“隐私与安全性”中允许。如果 macOS 仍提示可信 ZIP 中的应用“已经损坏”，可只移除 quarantine 属性：

```bash
xattr -dr com.apple.quarantine "/Applications/MD-Convertor.app"
```

不要对来源或校验值不可信的应用执行该命令。

## 当前版本

- 版本：`0.2.1`
- 平台：Apple Silicon Mac，macOS 12.0+
- ZIP：`MD-Convertor-darwin-arm64-0.2.1.zip`
- 大小：`354,635,067` bytes
- SHA-256：`32c1d96af58a7701e6d2fe0bf619be0f8f224803355c6ef63aad43c85569463e`

请从 [GitHub Releases](https://github.com/haohaiHuang/MD-Convertor/releases) 下载。

## 本地开发

开发需要 Apple Silicon Mac、Node.js 24.x 和 npm：

```bash
npm ci
npx playwright install chromium firefox webkit
npm run dev:desktop
```

基础验证：

```bash
./init.sh
npm run test:e2e
npm run test:live
```

`npm run test:live` 运行稳定的 WalkingLabs 发布阻断对照；微信公众号因验证和超时波动，保留为独立的非阻断诊断命令 `npm run test:live:wechat`。完整 Apple Silicon 发布使用：

```bash
npm run desktop:release
```

发布流程只接受 `0.2.1`，从仓库外的归档保护历史产物清单，拒绝旧产物，并校验包内版本、arm64 架构、应用结构、大小和 SHA-256。

更多信息见[产品说明](docs/PRODUCT.zh.md)、[架构说明](docs/ARCHITECTURE.zh.md)、[测试手册](docs/TESTING.zh.md)、[质量报告](docs/QUALITY-AUDIT.md)和[版本记录](CHANGELOG.zh.md)。
