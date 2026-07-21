# Testing and Release Guide

## 环境准备

项目固定使用 Node.js 24.x 和 npm；`./init.sh` 会在执行其他检查前拒绝不同主版本。桌面开发和动态网页转换至少需要 Chromium；完整界面验收需要三个 Playwright 浏览器引擎。

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
| `npm run test:e2e` | production standalone 服务上的 Chromium、Firefox、WebKit 交互与排版验收，并阻断 tracked 文件副作用 | 只访问本机测试服务 |
| `npm run test:live` | 同轮读取真实微信公众号文章并对照标题、正文覆盖率、图片数和 20 MiB 上限 | 需要 |
| `npm run desktop:package` | 生成未压缩的 Apple Silicon `.app` | 不需要，前提是缓存齐全 |
| `npm run desktop:make` | 生成 Apple Silicon ZIP | 不需要，前提是缓存齐全 |
| `npm run desktop:release` | 依次执行完整基线、三浏览器 E2E、真实网页门禁和 ZIP 打包 | 需要 |

`test:live` 默认使用项目中已经验收的微信公众号文章，不进入日常 `npm test`。测试只在内存中比较网页正文，不把正文写入文件或测试输出。可临时指定另一个同类页面：

```bash
MD_CONVERTOR_LIVE_URL=https://mp.weixin.qq.com/s/example npm run test:live
```

真实网页门禁低于 95% 时只输出覆盖率、字符数、图片数、提取模式和警告代码，不输出正文。日常 `./init.sh` 已把覆盖范围限制到 `src/lib` 和转换 API，并对 URL 安全、动态浏览器、代理真实 HTTP/CONNECT I/O、接口鉴权、限流、超时与转换编排设置阈值。动态代理 Case 覆盖请求数量、并发共享预算、HTTP 请求体与响应、声明/流式超限、CONNECT 超限、取消关闭和 WebSocket 拒绝。

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

## Node.js 24 与发布产物确认

项目固定运行时为 Node.js 24.x。第一轮曾观察到 Electron Forge 7.11.2 在 Node.js 24.16.0 的 finalizing 阶段无错误退出且不生成产物；第二轮已在 Node.js 24.14.1 的干净隔离副本中完整运行 `npm run desktop:release`，成功生成新 ZIP 并通过打包应用冒烟，`QA-006` 因此关闭。

当前 `desktop:release` 会记录开始时间和既有 ZIP 的修改时间；Forge 完成后必须存在修改时间已推进的目标 ZIP，并同时通过应用版本、arm64 可执行文件和 ZIP 包结构检查，最后打印文件大小与 SHA-256。Forge 提前退出、沿用旧 ZIP 或校验不符都会以非零状态失败。打包应用转换冒烟仍按本章命令单独执行。

当前正式整改包使用 Node.js 24.14.1 / npm 11.11.0 生成。Node.js 24.16.0 可通过日常基线，但本机 Forge 仍会在 finalizing 阶段无产物退出；fresh ZIP 门禁已确认会将该情况判定为失败，因此打包阶段暂以 24.14.1 为已验证组合。

## 0.1.3 人工验收

自动门禁通过后，仍需在最终 `.app` 窗口完成以下检查，才能结束 `feat-009`：

1. 粘贴有效链接，确认不会自动转换。
2. 点击“转换为 MD”后立即停止，确认链接保留且可修改。
3. 重新转换已验收的微信文章，确认完成区显示文件大小、正文字数和图片数量。
4. 确认预览正文和图片完整，结果区没有重复文章标题。
5. 分别执行复制和下载，并在 Markdown 阅读器中打开 `.md` 检查正文与内嵌图片。
6. 确认文件不超过 20 MiB；若图片被省略，界面必须显示对应警告。

当前产物未签名。首次打开被 macOS 阻止时，先在 Finder 中右键应用并选择“打开”。如果系统直接提示“文件已经损坏”，先确认 ZIP 的 SHA-256 为本文记录值，再仅移除该应用的 quarantine 属性：

```bash
xattr -dr com.apple.quarantine "/Applications/MD-Convertor.app"
```

如果普通权限无法修改，可在命令前加 `sudo`。第二台 Mac 实际验收使用 `xattr -cr /Applications/MD-Convertor.app` 后成功，但 `-c` 会清除全部扩展属性，范围大于所需，因此日常安装优先使用 `-d com.apple.quarantine`。不要对来源或哈希不可信的应用执行这些命令。

本机 0.1.3 验收已完成：真实打包窗口中的停止、复制、下载均通过；剪贴板与下载内容一致；长微信文章下载为 7,749,363 bytes、17,643 个非 Base64 字符和 30 张内嵌图片。2026-07-20，第二台 Apple Silicon Mac 也完成验收；首次启动的“文件已经损坏”提示通过移除 quarantine 属性解决，随后应用可正常使用。`feat-010` 据此完成。

当前个人测试包：`out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.1.3.zip`；大小为 `239,281,512` bytes，SHA-256 为 `66909aa8759ec41fdde875204773958d32b33a2c903e7b4eb0858a50fb1bdf89`。

## 常见失败

- E2E 提示浏览器不存在：运行 `npx playwright install chromium firefox webkit`。
- 打包提示 Electron 或 Chromium 缓存缺失：联网执行 `npm install` 和 `npx playwright install chromium`。
- `test:live` 失败：先确认目标文章仍公开可访问且 `#js_content` 未改版；不要降低 95% 覆盖率绕过失败。
- `desktop:release` 在 Forge finalizing 后没有新 ZIP：脚本会自动失败；保留错误与终端证据，调查工具链后在 Node.js 24 下重跑完整发布门禁。
- `./init.sh` 提示 Node 版本不符：切换到 Node.js 24.x 后重新运行，不要用其他主版本生成验证或发布证据。
- E2E 报告修改了 tracked 文件：检查 `git diff`，修复产生副作用的服务或测试配置，不要把自动生成变化混入发布。
- 其他 Mac 提示“文件已经损坏”：这是未签名、未 notarize 产物的 Gatekeeper 限制。先核对 ZIP 哈希，再使用本章的精确 `xattr` 命令移除 quarantine；仍不能打开时不要继续绕过系统校验，应保留错误并重新检查产物来源。
