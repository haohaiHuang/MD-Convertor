# Session Handoff

## Current Objective

- Goal: 交付可在 Apple Silicon Mac 本地安装使用的 MD-Convertor；0.1.3 已交付验收，当前推进 v0.2 富文本粘贴转换（`feat-012`）。
- Active: `feat-012 — Paste Rich-Text Conversion (v0.2)`，`in-progress`；规划批准见 `docs/PLAN-V0.2.md`，任务追踪见 `docs/TASKS-V0.2.md`，下一步 T3（`src/lib/paste.ts`，TDD）。
- Quality status: 0.1.3 自动发布门禁、本机操作和第二台 Apple Silicon Mac 验收均已通过；依赖升级和对外分发签名仍待完成。
- Branch: `codex/feat-012-v0.2`；`main` 固定在 0.1.3 封版提交 `ce041c9`，标签为 `v0.1.3`。v0.2 当前版本为 `0.2.0`，完成 T10 并经用户确认前不得合并。

## Current Scope

- 第一阶段只交付 Apple Silicon Mac 单机版，不需要公网服务器、域名或 Docker。
- 不调用 AI API，不需要 API Key。
- Windows 版本和多平台仓库迁移已取消；当前 macOS 根目录是唯一有效应用项目。
- v0.2（feat-012）已批准：富文本粘贴转换，规划见 `docs/PLAN-V0.2.md`，任务追踪见 `docs/TASKS-V0.2.md`。

## Open Discussion Items（后续迭代讨论项）

- **Jina / 第三方代理抓取通道**（用户保留意见，2026-08-07）：v0.2 不引入（隐私冲突 + 对登录墙/付费墙无效 + 破坏图片内嵌）；若后续要覆盖"公开但反爬严格"场景，按 `docs/PLAN-V0.2.md` 第 13 节触发条件重新评估，需用户重新授权修改隐私承诺与非目标。

## Cancelled Future Work

- 2026-07-21，用户取消 `feat-011`、Windows 应用及多平台目录迁移；原 `docs/MULTIPLATFORM-PLAN.md` 已删除，不能再作为后续执行依据。
- 同日取消的「直接粘贴正文转换」方案，已于 2026-08-06 以 v0.2 富文本粘贴转换（`feat-012`）重新授权，范围见 `docs/PLAN-V0.2.md`（仅处理用户主动复制的剪贴板 HTML，不绕过登录/付费墙/验证码）。
- 除非用户以后重新明确授权，不恢复 Windows 与多平台仓库迁移。

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
| v0.2 pre-development `./init.sh` | Passed | Node.js 24.14.0；lint、typecheck、18 files / 93 tests、coverage gate、Next.js production build；T3 尚未开始 |
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

1. 阅读 `AGENTS.md`、`PROGRESS.md`、`feature_list.json`、`docs/PLAN-V0.2.md`、`docs/TASKS-V0.2.md`、`docs/PRODUCT.md`、`docs/ARCHITECTURE.md`、`docs/TESTING.md` 和 `docs/QUALITY-AUDIT.md`。
2. 运行 `./init.sh`（Node.js 24.x）。
3. 继续 `feat-012`（v0.2）当前 `in-progress` 任务；一次只推进一个任务，代码任务遵循 TDD（先写失败测试再实现）。
4. 未经用户重新明确授权，不恢复 Windows 与多平台仓库迁移。
5. 对外分发仍需 Developer ID 签名与 notarization；依赖升级若恢复推进，按 `QA-005` 单独处理。

## Version Boundary

- 0.1.3 正式源码：`main` / `ce041c9` / `v0.1.3`。
- 0.1.3 正式 ZIP：`~/Downloads/MD-Convertor-0.1.3-release/MD-Convertor-darwin-arm64-0.1.3.zip`，只读，SHA-256 `66909aa8759ec41fdde875204773958d32b33a2c903e7b4eb0858a50fb1bdf89`。
- v0.2 开发：`codex/feat-012-v0.2`，版本 `0.2.0`；只允许在通过 T10 和用户验收后合并。

## Recommended Next Step

实施 `feat-012`（v0.2 富文本粘贴转换）的 T3：`src/lib/paste.ts` 预处理（结构门控/清洗/标题提取），TDD 先行——先写 `paste.test.ts` 失败测试再实现。任务边界与验证方式见 `docs/TASKS-V0.2.md`。
