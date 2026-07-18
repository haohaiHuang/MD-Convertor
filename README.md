# MD-Convertor

MD-Convertor 是一个 Apple Silicon Mac 网页转 Markdown 单机工具。粘贴一个公开网页链接，确认无误后点击转换，即可在本机预览、复制或保存包含内嵌图片的 `.md` 文件。

## 第一阶段能力

- 无账号、无需外部服务器，链接和转换结果只在本机处理
- 每次启动使用随机会话令牌保护本地转换接口，外部网页不能直接调用
- 不调用 AI API，不需要 API Key，也不产生模型调用费用
- 静态网页正文提取，JavaScript 页面使用浏览器兜底
- 动态浏览器请求逐次校验并固定公网 IP，防止目标网页借应用访问本机或内网
- 动态浏览器回退限制为最多 100 个请求、累计 50 MiB 网络传输和单连接 25 MiB，超限时停止相关请求
- 支持可公开访问的微信公众号文章，并识别验证页或已删除文章
- 自动保留标题、来源和转换时间
- 支持 JPEG、PNG、WebP、GIF、AVIF 图片以内嵌 Data URI 写入 Markdown
- 最终文件不超过 20 MiB；超出预算时优先保留正文并从末张图片开始省略
- 转换中可停止；完成后显示文件大小、正文字数和图片提取数
- Apple Silicon（arm64）Mac 桌面应用

登录页、付费墙、验证码、PDF、批量转换、历史记录和跨电脑同步不在第一阶段范围内。

## 在其他电脑使用

当前 ZIP 是自包含的 Apple Silicon Mac 应用，目标电脑不需要安装 Node.js、npm、Chrome、Playwright、AI API 或其他开发环境。使用条件如下：

- Apple Silicon（M1、M2、M3、M4 或后续 arm64 芯片）Mac，不支持 Intel Mac、Windows 或 Linux。
- macOS 12.0 或更高版本；转换时需要联网访问公开网页。
- 解压后建议把 `MD-Convertor.app` 拖入“应用程序”。当前产物未签名和 notarize，首次启动可能需要在 Finder 中右键应用并选择“打开”，或在“隐私与安全性”中允许启动。
- 不同电脑不会同步历史或结果，需要在当前电脑下载 `.md` 文件自行保留。

应用结构已包含转换服务、Chromium 和图片处理依赖，但尚未在第二台 Apple Silicon Mac 上完成真实安装验收。

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
npm run desktop:package
```

`npm run test:live` 会联网对照指定的真实微信公众号文章，只用于发布前门禁。目标 Apple Silicon 发布流程使用 `npm run desktop:release`，依次执行基线、三浏览器 E2E、真实网页对照与 ZIP 打包；脚本会拒绝旧 ZIP，核验版本、arm64 架构和包结构，并输出新产物大小与 SHA-256。现状、命令分层、环境变量、冒烟方式和人工验收清单见 [`docs/TESTING.md`](docs/TESTING.md)。

## 构建 Apple Silicon 应用

```bash
npm run desktop:make
```

未签名的测试产物生成在 `out/`。首次打开时 macOS 可能显示安全提示；正式分发前需要完成 Developer ID 签名和 notarization。

个人测试包位于：

```text
out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.1.3.zip
```

解压后可把 `MD-Convertor.app` 拖入“应用程序”。如果首次双击被 macOS 阻止，请在 Finder 中右键应用并选择“打开”，然后确认运行。

架构与安全边界见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)，产品范围见 [`docs/PRODUCT.md`](docs/PRODUCT.md)。
