# Session Handoff

## Current Objective

- Goal: 交付可在 Apple Silicon Mac 本地安装使用的 MD-Convertor。
- Active: `feat-010 — Personal Mac Release`。
- Quality status: `QA-001`、`QA-002`、`QA-003`、关键 `QA-004` 和真实窗口 `QA-007` 已完成；第二台 Mac 验收待完成，Forge 的 Node 24 封装兼容问题仍记录在 `QA-006`。
- Branch: `main`；本地 Git 仓库已初始化，当前 0.1.3 源码与 Harness 作为基线提交管理。

## Current Scope

- 第一阶段只交付 Apple Silicon Mac 单机版，不需要公网服务器、域名或 Docker。
- 不调用 AI API，不需要 API Key。

## Implemented

- Electron 安全窗口启动仅绑定 `127.0.0.1` 随机端口的 Next.js standalone 服务。
- Electron Forge 固定构建 `darwin/arm64`，生成 `.app` 和 ZIP。
- 打包脚本显式收集 Next.js 静态资源、完整 Playwright 运行包和 Apple Silicon Chromium Headless Shell。
- 修复 standalone 中 Turbopack 外部包符号链接被复制为绝对路径的问题。
- 修复微信公众号验证页被当作成功正文的问题：使用桌面 Chrome UA，新增验证页/删除页识别和 3 个回归测试。
- 修复 Node 多地址 DNS 查询与固定 IP 回调不兼容导致图片下载失败的问题，并新增 2 个回归测试。
- 修复微信隐藏 `#js_content` 被 Readability 忽略的问题，并在净化前恢复 `data-src` 正文图。
- 0.1.2 改为粘贴后显式提交，提供停止转换、链接保留和中文无效链接提示。
- 完成区聚焦“转换完成”，新增文件大小、正文字数与图片成功/总数统计。
- 图片超限改为正文优先、从末张图片开始降级，并为超过 8 MiB 的源图提供独立警告。
- 新增合成网页—Markdown 精确金标准、发布前真实微信网页同轮对照和统一 `desktop:release` 门禁。
- 删除已取消且从未发布的 Docker/Caddy 公网部署配置。
- 产品、架构、README、Changelog 和项目级指令已切换到单机版范围。
- 新增逐请求校验并固定目标 IP 的 Chromium 回环代理，HTTPS CONNECT 不再发生第二次 DNS 解析。
- Electron 每次生产启动生成随机会话令牌，由网络层附加；本地 API 校验回环来源、JSON 类型和令牌。
- 修复 `TimeoutError` 的 504 映射，客户端主动停止单独标记；新增服务器关键路径测试与覆盖率门禁。
- 桌面准备显式复制 Sharp/libvips 原生依赖；代理正确处理取消中的 CONNECT，冒烟失败改为非零退出码。
- 0.1.3 将结果按钮统一为“复制”和“下载”，保留“已复制”成功反馈，并补充 Apple Silicon/macOS 12+ 跨电脑使用说明。

## Verification Evidence

| Check | Result | Notes |
|---|---|---|
| 0.1.3 Node 24 `./init.sh` | Passed | lint、typecheck、coverage gate、82 tests、Next build |
| 0.1.3 `npm run test:e2e` | Passed | 21 checks across Chromium, Firefox, WebKit, including new button labels |
| 0.1.3 `npm run test:live` | Passed with variability | first upstream timeout; unchanged-threshold rerun passed |
| 0.1.3 Node 24 `npm run desktop:release` | Partial | baseline/E2E passed; live gate hit an upstream timeout before packaging |
| 0.1.3 Node 24 `npm run desktop:make` | Partial | build/prepare passed; Forge exited at finalizing without artifact |
| Node 23 Forge packaging | Passed | packaged the Node 24-built and prepared resources into final App/ZIP |
| Packaged startup | Passed | loopback standalone service ready |
| Packaged conversion | Passed | example.com, browser mode, 270 bytes |
| WeChat blocked-page regression | Passed | false success now explicit 422 |
| Public WeChat article | Passed | browser mode, 1 Data URI, no warnings, 121,801 bytes |
| User long WeChat article | Passed | about 17,643 non-Base64 chars, 30 Data URIs, no warnings, 7,749,363 bytes |
| Harness audit | Passed | 100/100 |
| 0.1.3 real packaged window | Passed | stop preserved URL; Copy/Download worked; clipboard matched download; long download had 30 embedded images |
| Overall quality audit | Open gates only | source fixes and real-window acceptance complete; second-Mac acceptance, Forge Node 24 gap and dependency triage pending |
| Second-Mac installation | Pending | 当前只有结构核验和本机真实应用验收 |
| Signing/notarization | Pending | 当前为个人测试产物 |

## Artifact

- `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.1.3.zip`
- SHA-256: `d5cd5bac1323827766c2a6bd94bde472b42bec2b790d52a276abed5d124c8a3e`
- Size: `239,266,746` bytes; arm64; minimum macOS `12.0`; version `0.1.3`.
- Packaged smoke: example.com browser mode 270 bytes; long WeChat 17,643 non-Base64 chars / 30 images / 7,749,363 bytes.

## Next Session Startup

1. 阅读 `AGENTS.md`、`PROGRESS.md`、`feature_list.json`、`docs/PRODUCT.md`、`docs/ARCHITECTURE.md`、`docs/TESTING.md` 和 `docs/QUALITY-AUDIT.md`。
2. 运行 `./init.sh`。
3. 把 0.1.3 ZIP 拷贝到第二台 Apple Silicon、macOS 12.0+ 的 Mac，完成解压和首次安全放行。
4. 在第二台 Mac 转换、复制和下载同一公开链接，确认无需安装 Node.js、Chrome 或其他运行环境。
5. 调查 Electron Forge 7.11.2 在 Node 24.16.0 finalizing 阶段提前退出；当前源码构建/准备为 Node 24，最终 Forge 封装临时使用 Node 23。
6. 完成第二台 Mac 验收后决定是否关闭 `feat-010`；对外分发仍需签名与 notarization。

## Recommended Next Step

先在第二台 Apple Silicon、macOS 12.0+ 的 Mac 验收 0.1.3 ZIP；新包哈希见上方 Artifact。
