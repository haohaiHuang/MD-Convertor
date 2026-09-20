# MD-Convertor

[English](README.md) | **简体中文**

MD-Convertor 是一个 Apple Silicon Mac 网页转 Markdown 单机工具。你可以转换公开网页链接，也可以粘贴自己已经复制的富文本，然后预览、复制或下载一份自包含的 Markdown 文件。

## 主要能力

- 本机运行，无需账号、MD-Convertor 服务或订阅；不自带也不代付任何模型费用
- 提供相互独立的“链接转换”和“富文本转换”
- 可选把转换结果翻译为 11 种预置目标语言（简体中文、英语、日语、韩语、法语、德语、西班牙语、葡萄牙语、意大利语、俄语、阿拉伯语），也可手填 BCP-47 追加；模型来自本机 agent CLI 或你自行配置的云端 Provider
- 提取静态页面，必要时使用随应用打包的 Chromium 渲染 JavaScript 页面
- 保留标题、段落、链接、列表、表格、fenced 代码块和 GFM 结构
- Mermaid 源码保留为 `mermaid` 代码块；安全的渲染图可转为 PNG 内嵌
- 完整保留微信公众号中由多个 `<code>` 节点组成的同一代码块
- JPEG、PNG、WebP、GIF、AVIF 图片以内嵌 Data URI 写入 Markdown
- 最终文件上限 20 MiB，优先保留正文；不支持或超预算的图片降级为替代文本并提示
- 支持停止转换、清空两种输入、复制、下载、结果统计和快速返回输入区

- 翻译使用你自行配置的模型：本机已安装的 agent CLI（`pi` 或 `claude`），或你在设置页配置的 OpenAI 兼容云端 Provider（只保存一条）。不勾选翻译勾选框就不会发起翻译，MD-Convertor 也不提供任何密钥或账号。

应用不绕过登录页、付费墙、验证码或其他访问限制。富文本模式只处理用户主动提供的剪贴板内容；依赖 Cookie、登录态、临时签名或 `blob:` URL 的图片可能无法获取。勾选翻译后，转换出的正文会发送到你所配置的端点——这是正文唯一离开本机的时机，MD-Convertor 不保留其历史或缓存。

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

- 当前版本：`0.3.3`——文档翻译（Apple Silicon Mac，macOS 12.0+）。`0.3.3` 门禁已于 2026-09-20 通过，并已装到本机。
- 最近一次正式发布：[`v0.3.3`](https://github.com/haohaiHuang/MD-Convertor/releases/tag/v0.3.3)。
- 所有产物均未做 Developer ID 签名与 notarization，仅适合个人测试。

当前已通过门禁并发布的产物（`0.3.3`）：

- ZIP：`out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.3.zip`
- 大小：`232,947,408` bytes
- SHA-256：`1bf807dfe294860c24345efe5caf2b0fcbd54f88476df7085c9bd03b47b37a72`

已发布的上一版产物（`0.3.2`）：`358,726,788` bytes，SHA-256 `8fb7a93f33a07bb03b0b8558df4ff0c2abe40a14eee13fd9dc0348fedcc7f1ba`。

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

发布流程只接受 `0.3.3`，对仓库外仍然存在的历史产物逐个校验哈希（缺失项报为退役而不阻断发布），拒绝旧产物，并校验包内版本、arm64 架构、应用结构、大小和 SHA-256。

更多信息见[产品说明](docs/PRODUCT.zh.md)、[架构说明](docs/ARCHITECTURE.zh.md)、[测试手册](docs/TESTING.zh.md)、[质量报告](docs/QUALITY-AUDIT.md)和[版本记录](CHANGELOG.zh.md)。
