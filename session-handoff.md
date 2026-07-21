# Session Handoff

## Current Objective

- Goal: 交付可在 Apple Silicon Mac 本地安装使用的 MD-Convertor。
- Active: 无；`feat-010 — Personal Mac Release` 已完成，`feat-011 — Multi-platform Repository Migration` 已取消。
- Quality status: 自动发布门禁、本机操作和第二台 Apple Silicon Mac 验收均已通过；依赖升级和对外分发签名仍待完成。
- Branch: `main`；本地 Git 仓库已初始化，当前 0.1.3 源码与 Harness 作为基线提交管理。

## Current Scope

- 第一阶段只交付 Apple Silicon Mac 单机版，不需要公网服务器、域名或 Docker。
- 不调用 AI API，不需要 API Key。
- Windows 版本和直接粘贴正文生成 Markdown 的方案均已取消；当前 macOS 根目录是唯一有效应用项目。

## Cancelled Future Work

- 2026-07-21，用户取消 `feat-011`、Windows 应用及多平台目录迁移；原 `docs/MULTIPLATFORM-PLAN.md` 已删除，不能再作为后续执行依据。
- 同日取消讨论中的“直接粘贴内容并转换为 Markdown”方案；该方案未进入代码、版本号或正式 feature，不创建 `0.2.0` 待办。
- 除非用户以后重新明确授权，后续会话只维护现有 Apple Silicon Mac 单链接转换能力。

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
- 动态浏览器代理新增每次回退 100 请求、累计 50 MiB、单 CONNECT 隧道 25 MiB 的共享预算；真实 HTTP/CONNECT、并发、流式超限、取消和 WebSocket Case 已覆盖。
- Node.js 主版本固定为 24；E2E 改用 production standalone 服务并校验 tracked diff；发布脚本校验 fresh ZIP、版本、arm64、包结构、大小和 SHA-256。
- 第二台 Apple Silicon Mac 验收通过；未签名应用首次被 Gatekeeper 提示损坏，移除 quarantine 属性后正常使用，精确处理命令已写入 README 与测试手册。

## Verification Evidence

| Check | Result | Notes |
|---|---|---|
| 0.1.3 Node 24 `./init.sh` | Passed | lint、typecheck、coverage gate、18 files / 93 tests、Next build；2026-07-21 取消方案并清理 Harness 后复跑通过 |
| 0.1.3 `npm run test:e2e` | Passed | 21 checks across Chromium, Firefox, WebKit, including new button labels |
| 0.1.3 `npm run test:live` | Passed with variability | first upstream timeout; unchanged-threshold rerun passed |
| Second-round Node 24.14.1 `npm run desktop:release` | Passed in clean clone | baseline、21 E2E、live、Forge ZIP 全部通过；新 ZIP 实际生成 |
| Second-round Node 24 audit artifact | Passed | 239,266,900 bytes / SHA-256 4477e944... / arm64 / 0.1.3 / macOS 12.0 / packaged smoke passed |
| Packaged startup | Passed | loopback standalone service ready |
| Packaged conversion | Passed | example.com, browser mode, 270 bytes |
| WeChat blocked-page regression | Passed | false success now explicit 422 |
| Public WeChat article | Passed | browser mode, 1 Data URI, no warnings, 121,801 bytes |
| User long WeChat article | Passed | about 17,643 non-Base64 chars, 30 Data URIs, no warnings, 7,749,363 bytes |
| Harness audit | Passed | 100/100 |
| 0.1.3 real packaged window | Passed | 用户确认当前 Mac 人工测试通过；stop preserved URL、Copy/Download worked、clipboard matched download、long download had 30 embedded images |
| Remediation Node 24.14.1 `desktop:release` | Passed | 93 tests、21 E2E、live、Forge 与 fresh ZIP 校验；Node 24.16.0 无产物路径按预期被阻断 |
| New packaged runtime | Passed | example.com browser mode 270 bytes；long WeChat 17,643 chars / 30 images / 7,749,363 bytes |
| Overall quality audit | Personal release gates closed | dependency upgrades and signing remain open |
| Second-Mac installation | Passed | 首次提示“文件已经损坏”；执行 `xattr -cr` 后应用可正常使用，安装说明已改为更精确的 quarantine 移除命令 |
| Signing/notarization | Pending | 当前为个人测试产物 |

## Artifact

- `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.1.3.zip`
- SHA-256: `66909aa8759ec41fdde875204773958d32b33a2c903e7b4eb0858a50fb1bdf89`
- Size: `239,281,512` bytes; arm64; minimum macOS `12.0`; version `0.1.3`.
- Packaged smoke: example.com browser mode 270 bytes; long WeChat 17,643 non-Base64 chars / 30 images / 7,749,363 bytes.

## Next Session Startup

1. 阅读 `AGENTS.md`、`PROGRESS.md`、`feature_list.json`、`docs/PRODUCT.md`、`docs/ARCHITECTURE.md`、`docs/TESTING.md` 和 `docs/QUALITY-AUDIT.md`。
2. 运行 `./init.sh`。
3. 确认第二台 Mac 验收、`feat-010` 关闭和后续方案取消记录已经提交，工作区为干净的 0.1.3 Mac 基线。
4. 当前没有下一项功能开发；未经用户重新明确授权，不创建 Windows、跨平台迁移或粘贴内容转换事项。
5. 对外分发仍需 Developer ID 签名与 notarization；依赖升级若恢复推进，按 `QA-005` 单独处理。

## Recommended Next Step

提交第二台 Mac 验收、`feat-010` 关闭和方案取消记录，形成干净的 0.1.3 Mac 基线；当前不安排下一项功能开发。
