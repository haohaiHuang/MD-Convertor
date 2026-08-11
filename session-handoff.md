# Session Handoff

## Current Objective

- Goal: 交付可在 Apple Silicon Mac 本地安装使用的 MD-Convertor；0.1.3 已封版，v0.2 富文本粘贴转换（`feat-012`）已完成，当前分支另完成 `feat-015`，按用户决定暂不合并。
- Active: 无；`feat-015 — Clear Pasted Content Action` 已完成，`feat-013` 保持 planned，`feat-014` 已取消。
- Quality status: 0.1.3 自动发布门禁、本机操作和第二台 Apple Silicon Mac 验收均已通过；v0.2 最小安全升级后生产审计为 0，完整树剩余 1 critical / 26 high / 3 low 且未进入应用包；feat-015 后的完整发布门禁、打包应用冒烟与真实窗口人工验收均已通过；对外分发签名仍待完成。
- Branch: `codex/feat-015-clear-paste`；`main` 固定在 0.1.3 封版提交 `ce041c9`，标签为 `v0.1.3`。v0.2 `feat-012` 在 `codex/feat-012-v0.2` 以提交 `23294e4` 收口，当前分支在其上完成 `feat-015`；新 0.2.0 ZIP 由源码提交 `f1d8ec3` 生成并包含 feat-015，按用户决定暂不合并。

## Current Scope

- 第一阶段只交付 Apple Silicon Mac 单机版，不需要公网服务器、域名或 Docker。
- 不调用 AI API，不需要 API Key。
- Windows 版本和多平台仓库迁移已取消；当前 macOS 根目录是唯一有效应用项目。
- v0.2（feat-012）已批准并完成开工评审：富文本粘贴转换同时保留剪贴板 HTML 与纯文本，编辑后降级纯文本；规划见 `docs/PLAN-V0.2.md`，任务追踪见 `docs/TASKS-V0.2.md`。
- 当前分支的 `feat-015` 已在富文本模式增加一键清空，状态契约、页面 E2E、完整发布门禁、重新打包和真实窗口验收均已完成；当前 0.2.0 候选 ZIP 已包含该变更。
- 登录态、临时签名、Blob 或需要 Cookie 的远程图片可能无法重新获取，届时保留替代文本并警告；本迭代不读取 Cookie。

## Open Discussion Items（后续迭代讨论项）

- **Jina / 第三方代理抓取通道**（用户保留意见，2026-08-07）：v0.2 不引入（隐私冲突 + 对登录墙/付费墙无效 + 破坏图片内嵌）；若后续要覆盖"公开但反爬严格"场景，按 `docs/PLAN-V0.2.md` 第 13 节触发条件重新评估，需用户重新授权修改隐私承诺与非目标。

## Cancelled Future Work

- 2026-07-21，用户取消 `feat-011`、Windows 应用及多平台目录迁移；原 `docs/MULTIPLATFORM-PLAN.md` 已删除，不能再作为后续执行依据。
- 同日取消的「直接粘贴正文转换」方案，已于 2026-08-06 以 v0.2 富文本粘贴转换（`feat-012`）重新授权，范围见 `docs/PLAN-V0.2.md`（仅处理用户主动复制的剪贴板 HTML/纯文本，不绕过登录/付费墙/验证码）。
- 2026-08-10，用户确认现有界面可以接受，取消 `feat-014 — UI Layout and Visual Polish`；不得把该泛化 UI/UX 调整重新混入其他事项。
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
- feat-012 T3 已完成：新增独立粘贴预处理库，提供 DOM 语义门控、安全 body 清洗、标题提取优先级、HTML/text 降级、lazy 图片属性定向保留与 `textLength` 统计；尚未接入 Markdown、API 或 UI。
- feat-012 T4 已完成：新增粘贴 HTML/纯文本 Markdown 渲染与粘贴文件名规则，覆盖可选来源、相对链接、标题去重、MiaoYan 适用语义和纯文本结构转义；既有链接模式函数行为保持不变。
- feat-012 T5 已完成：图片处理新增显式 link/paste 策略，粘贴模式支持 lazy-first 与严格 Data URI 校验/优化，链接模式行为保持不变；AVIF 防 MIME 伪装、SSRF 交接、预算和取消均有测试。
- feat-012 T6A 已完成：新增独立粘贴转换编排与 `paste` 提取类型；来源规范化、HTML/text、纯图片、422/413、末图预算、统计/警告与取消均已覆盖，预算路径使用 marker 定向单次渲染避免高内存循环。
- feat-012 T6B 已完成：新增 5 MiB UTF-8 有界请求体和 `/api/convert-paste`；复用本地鉴权、限流与 45 秒总时限，覆盖 400/403/413/429/499/504、流取消与截止竞态，日志不记录粘贴内容或来源 URL。
- feat-012 T7A 已完成：新增粘贴前端纯状态模块，固化富文本/纯文本/编辑降级提示、payload 与 UTF-8 5 MiB 精确边界、双模式输入保留、转换中禁切换和输出清理；客户端与服务端复用共享限制常量。
- feat-012 T7B 已完成：现有页面新增链接/富文本 Tab，粘贴 textarea、来源 URL、前端预算、双 API、按模式停止提示与共享结果全部接入；审查修复旧 selector、异步状态 ref 竞态和 stop 按钮自动二次提交，旧 Chromium 用例恢复全绿。
- feat-012 T8 已完成：新增 9 组粘贴 E2E，双 MIME、降级/编辑/替换、来源输出头、预算/413、停止 Abort、复制下载与结果统计在三浏览器通过；旧链接用例文件未修改。
- feat-012 T9A 已完成：发布门禁固定保护 `main` / `v0.1.3`、外部只读 0.1.3 归档与 0.1.0–0.1.3 四 ZIP manifest；非 0.2.0 目标或历史产物异常会在任何发布命令前失败，成功及后续失败路径均复核历史清单。
- feat-012 T9B 已完成：同步产品、架构、测试、质检、README、Changelog、任务、进度和交接文档；明确两模式、粘贴 API、安全边界、5 MiB/图片预算、登录态/临时/blob 限制、v0.2 安装条件与 T9A 证据。
- feat-012 T10 已完成：生产审计清零；Node.js 24.14.1 连续通过 282 tests、48 E2E、live、Forge、fresh ZIP 与打包应用启动/长微信 30 图转换冒烟；用户确认真实窗口富文本模式人工验收通过。
- feat-015 已完成：富文本模式新增“清空”，一次移除 HTML、纯文本、来源 URL 和旧结果；转换中禁用。Node.js 24.14.1 基线 287 tests，富文本三引擎 E2E 30/30，用户在当前源码的真实 Electron 窗口人工验收通过。
- T10 人工验收已完成：X Article 样本正文正常但图片为链接；诊断确认其 6 张正文图与封面均来自 `pbs.twimg.com`，本机匿名直连 7/7 `ECONNRESET`，X 页面复跑亦有 502 波动。当前按“不绕过网络/登录限制”降级为外链，用户已接受为 v0.2 已知限制。
- 另一人工样本的缺图已定性为 Mermaid 支持缺口：页面无正文栅格图，只有客户端把空 `.mermaid` 占位渲染成内联 SVG；当前 direct 输出 0 图/0 警告且没有 Mermaid fence。用户已接受为 v0.2 已知限制并决定后续在 `feat-013` 独立开发，不能误记为普通图片异常。

## Verification Evidence

| Check | Result | Notes |
|---|---|---|
| v0.2 pre-development `./init.sh` | Passed | Node.js 24.14.0；lint、typecheck、18 files / 93 tests、coverage gate、Next.js production build；T3 尚未开始 |
| v0.2 plan-review `./init.sh` | Passed | Node.js 24.14.0；评审修订后 18 files / 93 tests、coverage gate、production build；无产品代码改动 |
| feat-012 T3 focused + `./init.sh` | Passed | Node.js 24.14.0；paste 32 tests；完整基线 19 files / 125 tests、lint、typecheck、coverage gate、production build；paste.ts 100% statements/lines/functions |
| feat-012 T4 focused + `./init.sh` | Passed | Node.js 24.14.0；markdown 37 tests；完整基线 19 files / 159 tests、lint、typecheck、coverage gate、production build；markdown.ts 99.15% statements/lines、100% functions |
| feat-012 T5 focused + `./init.sh` | Passed | Node.js 24.14.0；images 46 tests、相关 53 tests；完整基线 19 files / 191 tests、lint、typecheck、coverage gate、production build；images.ts 97.16% statements/lines、100% functions |
| feat-012 T6A focused + `./init.sh` | Passed | Node.js 24.14.0；convert-paste 20 tests；完整基线 20 files / 211 tests、lint、typecheck、coverage gate、production build；convert-paste.ts 96.59% statements/lines、100% functions |
| feat-012 T6B focused + `./init.sh` | Passed | Node.js 24.16.0；paste request + paste route + 旧 convert route 40 tests；完整基线 22 files / 245 tests、lint、typecheck、coverage gate、production build；paste-request.ts 100% statements/lines/functions |
| feat-012 T7A focused | Passed | Node.js 24.16.0；paste-client 17 tests；与 paste request/route 联合 51 tests、typecheck、lint、diff-check 全部通过 |
| feat-012 T7B build + static + old Chromium | Passed | Node.js 24.16.0；typecheck、lint、production build、diff-check；旧 Chromium 7/7；1180px/700px 双模式静态布局与 console 检查通过 |
| feat-012 T8 `./init.sh` + three-engine E2E | Passed | Node.js 24.16.0；22 files / 262 tests、coverage/build；Chromium/Firefox/WebKit 48/48、tracked-file check；未运行 live |
| feat-012 T9A guards + `./init.sh` | Passed | Node.js 24.16.0；release guards 22/22；完整 23 files / 281 tests、coverage/build；真实 refs、外部只读归档及四个 0.1.x ZIP 只读校验通过；未运行 live/make |
| feat-012 T9B docs + static checks | Passed | 9 个授权文档、JSON 解析、关键词/死引用和 `git diff --check` 通过；未运行 live/make |
| feat-012 T10 release gate | Passed | Node.js 24.14.1；24 files / 282 tests、48/48 E2E、live、Forge、fresh ZIP、启动与长微信 30 图冒烟；0.2.0 ZIP 354,594,827 bytes / `ab2a463c...a7b7b4` |
| feat-012 final review remediation | Passed | Node.js 24.14.1；远程伪装格式与 ZIP 包内版本/arm64 均先 RED 后 GREEN；最终 `./init.sh` 24 files / 285 tests、coverage/build；现有 ZIP 包内只读复验通过 |
| feat-015 release gate | Passed | Node.js 24.14.1；24 files / 287 tests、51/51 E2E、live、Forge、fresh ZIP、启动和 `example.com` 转换冒烟；用户确认新打包窗口“一键清空”通过 |
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

- v0.2 candidate: `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.2.0.zip`
- SHA-256: `7f6f39873056a34414706362356cb461d1617cb1cb73c9b76952fe587dd658c6`
- Size: `354,603,624` bytes; arm64; minimum macOS `12.0`; version `0.2.0`; includes feat-015.
- Packaged smoke: startup and `example.com` browser-mode conversion passed; user confirmed the final packaged-window “一键清空” flow passed. The earlier feat-012 package retains the long WeChat 17,643 non-Base64 chars / 30 images evidence.
- 0.1.3 frozen ZIP and external archive remain `239,281,512` bytes / SHA-256 `66909aa8759ec41fdde875204773958d32b33a2c903e7b4eb0858a50fb1bdf89`.

## Next Session Startup

1. 阅读 `AGENTS.md`、`PROGRESS.md`、`feature_list.json`、`docs/PLAN-V0.2.md`、`docs/TASKS-V0.2.md`、`docs/PRODUCT.md`、`docs/ARCHITECTURE.md`、`docs/TESTING.md` 和 `docs/QUALITY-AUDIT.md`。
2. 运行 `./init.sh`（Node.js 24.x）。
3. feat-015 后的自动门禁、live、重新打包、应用冒烟与用户人工验收均已完成；当前 0.2.0 ZIP 包含 feat-015，分支按用户决定暂不合并。
4. 未经用户重新明确授权，不恢复 Windows 与多平台仓库迁移。
5. 对外分发仍需 Developer ID 签名与 notarization；完整开发/构建树的上游告警继续按 `QA-005` 跟踪。

## Version Boundary

- 0.1.3 正式源码：`main` / `ce041c9` / `v0.1.3`。
- 0.1.3 正式 ZIP：`~/Downloads/MD-Convertor-0.1.3-release/MD-Convertor-darwin-arm64-0.1.3.zip`，只读，SHA-256 `66909aa8759ec41fdde875204773958d32b33a2c903e7b4eb0858a50fb1bdf89`。
- v0.2 开发基线：`codex/feat-012-v0.2` / `23294e4`，版本 `0.2.0`；当前工作分支为 `codex/feat-015-clear-paste`，候选包源码提交为 `f1d8ec3`。两者只允许在用户确认后合并。

## Recommended Next Step

等待用户决定下一项；`feat-013 — Mermaid Preservation` 仍为 planned，未经确认不实施。feat-015 已重新打包并验收，但尚未合并。
