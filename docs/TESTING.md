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
| `npx vitest run scripts/release-guards.test.mjs` | 验证 0.1.3 固定源码/归档、四个历史 ZIP manifest、版本隔离和发布编排错误处理 | 不需要 |

`test:live` 默认使用项目中已经验收的微信公众号文章，不进入日常 `npm test`。测试只在内存中比较网页正文，不把正文写入文件或测试输出。可临时指定另一个同类页面：

```bash
MD_CONVERTOR_LIVE_URL=https://mp.weixin.qq.com/s/example npm run test:live
```

真实网页门禁低于 95% 时只输出覆盖率、字符数、图片数、提取模式和警告代码，不输出正文。日常 `./init.sh` 已把覆盖范围限制到 `src/lib` 和转换 API，并对 URL 安全、动态浏览器、代理真实 HTTP/CONNECT I/O、接口鉴权、限流、超时与转换编排设置阈值。动态代理 Case 覆盖请求数量、并发共享预算、HTTP 请求体与响应、声明/流式超限、CONNECT 超限、取消关闭和 WebSocket 拒绝。

## v0.2 富文本粘贴验证

富文本模式只处理用户主动复制的剪贴板内容，不替代链接模式的抓取流程。单元和 API 测试应覆盖：

- `src/lib/paste.test.ts`：DOM 语义门控、标题回退、粘贴模式净化、`data-src`/`data-lazy-src` 定向保留和 HTML→纯文本降级。
- `src/lib/markdown.test.ts`、`src/lib/images.test.ts`、`src/lib/convert-paste.test.ts`：Turndown/GFM 输出、纯文本字面转义、可选来源头部、lazy-first 图片、严格 `data:` 解码/格式校验、30 图/8 MiB/20 MiB 预算、登录态/临时/blob 图片降级和取消。
- `src/app/api/convert-paste/route.test.ts` 与 `src/lib/paste-request.test.ts`：回环/同源/令牌鉴权、HTML/text 字段、无凭据 `sourceUrl`、声明与实际 UTF-8 5 MiB 超限、429/499/504、日志不含正文/HTML/URL。
- `scripts/release-guards.test.mjs`：固定 `main`/`v0.1.3` 提交、只读外部归档、0.1.0–0.1.3 固定 ZIP manifest、非 0.2.0 拒绝、前后历史清单复核及双重失败错误隐私。

浏览器 E2E（`npm run test:e2e`）在 Chromium、Firefox、WebKit 覆盖富文本双 MIME 粘贴、纯文本降级、编辑后降级、再次粘贴替换、来源 URL 有/无、5 MiB 前后端拒绝、转换中停止保留输入，以及复制/下载和统计；T8 的三引擎结果为 48/48，既有 0.1.3 链接模式用例保持通过。

手工验收还需确认：富文本 Tab 能粘贴并显示纯文本；识别提示在富文本/纯文本/编辑后状态间准确切换；填写有效来源 URL 时输出来源头部、留空时省略；停止后内容仍可编辑；登录态、临时签名、`blob:` 或 Cookie 图片失败时只显示替代文本和警告。富文本模式不读取 Cookie，不通过粘贴绕过登录、付费墙或验证码。

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

当前 `desktop:release` 会在任何 `init.sh`、E2E、live 或 Forge 命令前拒绝非 `0.2.0` 目标，并校验固定源码 ref、外部只读归档和四个 0.1.x ZIP manifest；成功或后续失败都会复核历史清单。随后脚本记录开始时间和既有 ZIP 的修改时间；Forge 完成后必须存在修改时间已推进的目标 ZIP，并解压检查 ZIP 内应用的版本、arm64 可执行文件和包结构，最后打印文件大小与 SHA-256。Forge 提前退出、沿用旧 ZIP 或校验不符都会以非零状态失败。T10 前不得以 `desktop:release` 作为已完成证据，打包应用转换冒烟仍按本章命令单独执行。

当前 v0.2 候选包使用 Node.js 24.14.1 / npm 11.11.0 生成。Node.js 24.16.0 可通过日常基线，但本机 Forge 仍会在 finalizing 阶段无产物退出；fresh ZIP 门禁已再次确认会将该情况判定为失败，因此打包阶段以 24.14.1 为已验证组合。T10 的基线、三浏览器、live、Forge、fresh ZIP、启动、长微信转换冒烟和真实窗口人工验收均已通过。

Electron 43 起 `npm install` 不再自动下载 Electron 运行时；`desktop:prepare` 已显式调用官方 `install-electron`，首次打包会联网下载并缓存对应的 darwin/arm64 ZIP，后续复用缓存。T10 产物为 `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.2.0.zip`，大小 `354,594,827` bytes，SHA-256 `ab2a463cf0a98a51cacdcad3a2cab5ed34b458b47b504ac644d56b7914a7b7b4`。

该 T10 产物对应 feat-012 基线；当前源码已完成 feat-015，但 feat-015 尚未重新打包，因此不能把现有 ZIP 作为包含“一键清空”的安装包。

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
- 打包提示 Electron 或 Chromium 缓存缺失：联网执行 `npm run desktop:prepare` 和 `npx playwright install chromium`；前者会通过官方 `install-electron` 下载当前声明版本。
- `test:live` 失败：先确认目标文章仍公开可访问且 `#js_content` 未改版；不要降低 95% 覆盖率绕过失败。
- `desktop:release` 在 Forge finalizing 后没有新 ZIP：脚本会自动失败；保留错误与终端证据，调查工具链后在 Node.js 24 下重跑完整发布门禁。
- `./init.sh` 提示 Node 版本不符：切换到 Node.js 24.x 后重新运行，不要用其他主版本生成验证或发布证据。
- E2E 报告修改了 tracked 文件：检查 `git diff`，修复产生副作用的服务或测试配置，不要把自动生成变化混入发布。
- 其他 Mac 提示“文件已经损坏”：这是未签名、未 notarize 产物的 Gatekeeper 限制。先核对 ZIP 哈希，再使用本章的精确 `xattr` 命令移除 quarantine；仍不能打开时不要继续绕过系统校验，应保留错误并重新检查产物来源。
