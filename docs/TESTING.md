# Testing and Release Guide

## 环境准备

项目目标运行时为 Node.js 24，使用 npm。桌面开发和动态网页转换至少需要 Chromium；完整界面验收需要三个 Playwright 浏览器引擎。

```bash
npm install
npx playwright install chromium
npx playwright install chromium firefox webkit
```

只开发桌面应用时执行第一条浏览器安装命令即可；准备运行 `npm run test:e2e` 或 `npm run desktop:release` 时再安装全部三个引擎。

## 验证层级

| 命令 | 用途 | 是否联网 |
|---|---|---|
| `./init.sh` | Harness、lint、typecheck、单元/安全/金标准测试、生产构建 | 依赖已安装时不需要 |
| `npm run test:coverage` | 项目源代码覆盖率与安全关键模块阈值 | 不需要 |
| `npm run test:e2e` | Chromium、Firefox、WebKit 的交互与排版验收 | 只访问本机测试服务 |
| `npm run test:live` | 同轮读取真实微信公众号文章并对照标题、正文覆盖率、图片数和 20 MiB 上限 | 需要 |
| `npm run desktop:package` | 生成未压缩的 Apple Silicon `.app` | 不需要，前提是缓存齐全 |
| `npm run desktop:make` | 生成 Apple Silicon ZIP | 不需要，前提是缓存齐全 |
| `npm run desktop:release` | 依次执行完整基线、三浏览器 E2E、真实网页门禁和 ZIP 打包 | 需要 |

`test:live` 默认使用项目中已经验收的微信公众号文章，不进入日常 `npm test`。测试只在内存中比较网页正文，不把正文写入文件或测试输出。可临时指定另一个同类页面：

```bash
MD_CONVERTOR_LIVE_URL=https://mp.weixin.qq.com/s/example npm run test:live
```

真实网页门禁低于 95% 时只输出覆盖率、字符数、图片数、提取模式和警告代码，不输出正文。日常 `./init.sh` 已把覆盖范围限制到 `src/lib` 和转换 API，并对 URL 安全、动态浏览器、接口鉴权、限流、超时与转换编排设置阈值。

## 发布与冒烟环境变量

| 变量 | 用途 |
|---|---|
| `MD_CONVERTOR_LIVE_URL` | 覆盖真实网页门禁的默认微信文章 |
| `ELECTRON_SMOKE_TEST=1` | 打包应用窗口加载完成后自动退出，用于启动冒烟 |
| `ELECTRON_CONVERSION_SMOKE_URL` | 让打包应用通过其本机 API 转换指定公开网页后退出 |
| `ELECTRON_SMOKE_MIN_TEXT_CHARS` | 转换冒烟要求的最少非 Base64 字符数 |
| `ELECTRON_SMOKE_MIN_IMAGE_COUNT` | 转换冒烟要求的最少内嵌图片数 |
| `ELECTRON_CACHE` | 覆盖 Electron ZIP 缓存目录 |
| `PLAYWRIGHT_BROWSERS_PATH` | 覆盖 Playwright 浏览器缓存目录 |

`MD_CONVERTOR_SESSION_TOKEN`、`ELECTRON_RENDERER_URL`、`PLAYWRIGHT_EXECUTABLE_PATH` 和 `ELECTRON_RUN_AS_NODE` 由 Electron、开发脚本或打包运行时内部设置，日常使用不要手工配置。生产模式缺少会话令牌时，本地转换 API 会拒绝请求。

## 当前 Node.js 24 打包限制

项目目标运行时仍是 Node.js 24。当前 Electron Forge 7.11.2 在 Node.js 24.16.0 的 finalizing 阶段可能无错误退出且不生成产物；因此只有在 `out/make/zip/darwin/arm64/` 中确实出现新 ZIP 时，才能把 `npm run desktop:release` 记录为完整通过。现有 0.1.3 个人测试包使用 Node.js 24 完成基线、构建和资源准备，再临时用 Node.js 23.11.1 执行 Forge 封装；这不满足关闭 `QA-006` 所需的完整 Node.js 24 发布证据。

遇到该问题时不要把提前退出视为成功，也不要为绕过问题修改发布门禁。先保留终端证据并调查 Forge 兼容性；修复后需在 Node.js 24 下重新运行完整 `npm run desktop:release`、打包冒烟和哈希核验。

## 0.1.3 人工验收

自动门禁通过后，仍需在最终 `.app` 窗口完成以下检查，才能结束 `feat-009`：

1. 粘贴有效链接，确认不会自动转换。
2. 点击“转换为 MD”后立即停止，确认链接保留且可修改。
3. 重新转换已验收的微信文章，确认完成区显示文件大小、正文字数和图片数量。
4. 确认预览正文和图片完整，结果区没有重复文章标题。
5. 分别执行复制和下载，并在 Markdown 阅读器中打开 `.md` 检查正文与内嵌图片。
6. 确认文件不超过 20 MiB；若图片被省略，界面必须显示对应警告。

当前产物未签名。首次打开被 macOS 阻止时，在 Finder 中右键应用并选择“打开”。

本机 0.1.3 验收已完成：真实打包窗口中的停止、复制、下载均通过；剪贴板与下载内容一致；长微信文章下载为 7,749,363 bytes、17,643 个非 Base64 字符和 30 张内嵌图片。跨电脑能力仍需在第二台 Apple Silicon、macOS 12.0+ 的 Mac 上执行同一清单，且目标电脑不应预装 Node.js、Chrome 或 Playwright 作为前置条件。

当前个人测试包：`out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.1.3.zip`；SHA-256 为 `d5cd5bac1323827766c2a6bd94bde472b42bec2b790d52a276abed5d124c8a3e`。

## 常见失败

- E2E 提示浏览器不存在：运行 `npx playwright install chromium firefox webkit`。
- 打包提示 Electron 或 Chromium 缓存缺失：联网执行 `npm install` 和 `npx playwright install chromium`。
- `test:live` 失败：先确认目标文章仍公开可访问且 `#js_content` 未改版；不要降低 95% 覆盖率绕过失败。
- `desktop:release` 在 Forge finalizing 后没有 ZIP：这是 `QA-006` 的已知 Node.js 24 工具链问题，不得按成功记录；按上节保留证据并调查。
- 其他 Mac 无法直接打开：这是未签名产物的预期限制，不代表转换管线失败。
