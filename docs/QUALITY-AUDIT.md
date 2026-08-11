# Quality Audit

## Audit Metadata

- Audit date: 2026-07-18; second-round audit: 2026-07-18; consistency reviews: 2026-08-10 and 2026-08-11
- Audited version: `0.1.2`; follow-up validation: `0.1.3`; current development version: `0.2.0`
- Platform: Apple Silicon Mac (`darwin/arm64`)
- Historical active feature: 无；`feat-010 — Personal Mac Release` 已完成
- Current review scope: `feat-013 — Mermaid Diagram Preservation` 的源码、测试、安全边界、人工验收与发布收口；`feat-012`、`feat-015` 保留为已完成回归基线
- Audit type: 文档一致性、代码与安全审查、自动化验证、真实网页门禁、依赖审计和打包产物抽查
- Overall verdict: **0.1.3 personal release remains frozen; feat-013 remediation, real-window acceptance and fresh 0.2.0 arm64 ZIP release gate pass; external distribution remains unsigned**

## Sixth-Round Mermaid Release Closeout — 2026-08-11

- 用户确认微信公众号固定样本的 504 属于可接受的上游波动；微信完整对照保留为 `npm run test:live:wechat` 非阻断诊断，正式 `npm run test:live` 继续以 WalkingLabs 链接/粘贴 Mermaid 2 项稳定真实样本阻断发布。
- 公开命令配置测试按 TDD 先 RED 后 GREEN，release guards 25/25；Node.js 24.14.1 `desktop:release` 通过 27 files / 315 tests、coverage/build、三引擎 51/51、WalkingLabs live 2/2、Forge、fresh ZIP 与包内版本/arm64 校验。
- 当前 0.2.0 arm64 ZIP 为 `354,631,314` bytes，SHA-256 `b212b359405e53f1a0cc924b51c48c986335a3f74b4520f06f9fb825357d505c`。结合此前最新整改应用的 WalkingLabs 真实窗口验收，`feat-013` 完成；分支仍未合并，Developer ID 签名与 notarization 仍未配置。

## Fifth-Round Release Closeout — 2026-08-11

- 当前 `codex/feat-015-clear-paste` 以源码提交 `f1d8ec3` 重新运行 Node.js 24.14.1 完整 `desktop:release`：24 files / 287 tests、coverage、三引擎 51/51、真实微信门禁、Forge 与 fresh ZIP 校验全部通过。
- 新 ZIP 为 0.2.0 / arm64 / macOS 12.0+，大小 `354,603,624` bytes，SHA-256 `7f6f39873056a34414706362356cb461d1617cb1cb73c9b76952fe587dd658c6`；包内版本与 arm64 可执行文件已由门禁解压复核，0.1.x 历史产物保护未变化。
- 打包应用启动冒烟和 `https://example.com` browser-mode 转换通过（270 bytes、无警告）；包内静态 chunk 包含 feat-015 清空状态逻辑，用户随后确认真实打包窗口“一键清空”无问题。

当前结论：feat-015 已从 source-accepted 推进到 packaged-and-accepted；现役 0.2.0 候选 ZIP 已包含该功能。分支仍未合并，Developer ID 签名与 notarization 仍未配置。

## Fourth-Round Consistency Update — 2026-08-10

- 本节是 2026-08-10 的发布前快照，已被上方第五轮发布收口取代：当时工作分支为 `codex/feat-015-clear-paste`，HEAD 为 `df6ed31`；`feat-012` 的发布基线为 `codex/feat-012-v0.2` / `23294e4`，`main` 与 `v0.1.3^{}` 固定在 `ce041c9`。
- 当时 `feature_list.json`、`PROGRESS.md`、`session-handoff.md`、`docs/TASKS-FEAT-015.md` 与 `CHANGELOG.md` 已把 `feat-015` 统一为完成；源码通过 Node.js 24.14.1 `./init.sh`（24 files / 287 tests）、富文本三引擎 30/30，以及完整三引擎 E2E 51/51。
- 当时的 0.2.0 ZIP（354,594,827 bytes，SHA-256 `ab2a463cf0a98a51cacdcad3a2cab5ed34b458b47b504ac644d56b7914a7b7b4`）来自 2026-08-09 的 feat-012 T10，不包含“一键清空”；该差异已由 2026-08-11 新包关闭。
- 依赖审计在该时点为生产依赖 0；完整依赖树为 1 critical / 26 high / 3 low，剩余项位于开发/构建链。旧的 5 high / 1 moderate 与 1 critical / 30 high / 1 moderate / 3 low 仅保留为历史审计证据。

当时的一致性结论要求区分源码与旧 ZIP；2026-08-11 重新发布后，该差异不再是现役限制。

## Second-Round Audit Update — 2026-07-18

第二轮在当前 `main` 基线和未提交的多平台规划文档之上独立复验。第一轮的 `QA-001`、`QA-002`、`QA-003` 和 `QA-007` 未出现回归；真实 Chromium loopback 子资源探针命中本地目标次数为 0，证明 Playwright 当前会强制把 loopback 请求送入固定 IP 代理。

Node.js 24.14.1 / npm 11.11.0 下，工作区基线、21 项三浏览器 E2E、真实微信文章门禁均通过。随后在 `/private/tmp` 的干净隔离副本中完整运行 `npm run desktop:release`，Forge 7.11.2 成功生成新 ZIP；新包为 arm64、0.1.3、最低 macOS 12.0，大小 `239,266,900` bytes，SHA-256 `4477e94473063ec417341837e3b61beabc327d05e1f1983938f96c3b29be6181`，`example.com` 打包应用冒烟通过。该隔离产物只用于质检，已删除，没有替换当前正式记录的个人测试包。

第二轮新增或重新打开以下问题：

- `QA-004` 部分重新打开：`browser-proxy.ts` 只有约 22.47% 行覆盖和 14.28% 函数覆盖，门禁却仅要求 20% / 10%；实际 HTTP 转发、CONNECT 生命周期、取消、WebSocket 拒绝和关闭路径没有直接自动化覆盖。
- `QA-009`：动态代理对 HTTPS 隧道和子资源没有累计传输预算或请求数量上限，5 MiB 动态 HTML 检查发生在 Chromium 完成加载和序列化 DOM 之后，恶意页面仍可先消耗大量网络与内存。
- `QA-010`：`./init.sh` 和 `package.json` 不会强制当前进程使用 Node.js 24；默认 Node.js 23.11.1 仍可完整通过基线。
- `QA-011`：`desktop:release` 只串联命令，不验证目标 ZIP 是本轮新生成；Forge 若无产物退出，脚本本身无法阻断错误放行。
- `QA-012`：`npm run test:e2e` 使用 `next dev`，会把已跟踪的 `next-env.d.ts` 从 production types 改为 dev types，测试后留下脏工作区。

第二轮结论：0.1.3 仍可继续用于受控个人测试，`QA-006` 关闭；在新包最终放行和第二台 Mac 验收前，应先处理 `QA-009` 至 `QA-012` 以及 `QA-004` 的代理集成测试缺口。

## Third-Round Remediation Update — 2026-07-18

- `QA-004` 与 `QA-009`：动态代理新增每次回退 100 个请求、累计 50 MiB 和单 CONNECT 隧道 25 MiB 的共享预算。10 个代理测试覆盖真实 HTTP 双向传输、声明/流式超限、并发子资源、CONNECT、取消与 WebSocket；`browser-proxy.ts` 达到 91.27% lines / 81.31% branches / 95% functions，门禁提高到 85% / 75% / 90%。
- `QA-010`：`engines` 固定为 Node.js 24 主版本，`init.sh` 在其他检查前拒绝非 24 版本；Node.js 23.11.1 负向验证按预期失败。
- `QA-011`：专用发布脚本记录开始时间与旧 ZIP 修改时间，Forge 后校验 fresh ZIP、0.1.3 版本、arm64 可执行文件和 ZIP 包结构，并输出大小和 SHA-256。Node.js 24.16.0 的无产物 finalizing 路径被正确判定为失败。
- `QA-012`：E2E 改用 production standalone 服务，执行器比较测试前后 tracked diff；三引擎 21 项通过并输出 clean check passed。
- Node.js 24.14.1 / npm 11.11.0 完整 `desktop:release` 通过，正式 ZIP 为 `239,281,512` bytes，SHA-256 `66909aa8759ec41fdde875204773958d32b33a2c903e7b4eb0858a50fb1bdf89`。新 `.app` 的 `example.com` browser-mode 冒烟和长微信 17,643 字符 / 30 图冒烟均通过。

## Second-Mac Acceptance Update — 2026-07-20

- 第二台 Apple Silicon Mac 已完成 0.1.3 验收，`feat-010` 的跨电脑完成条件满足。
- 首次打开时 Gatekeeper 提示“文件已经损坏，只能放入废纸篓”。验收中执行 `xattr -cr /Applications/MD-Convertor.app` 后应用可正常使用；现象与未签名应用的系统隔离校验一致，未发现应用包运行依赖缺失。
- 面向用户的说明改为优先使用范围更小的 `xattr -dr com.apple.quarantine "/Applications/MD-Convertor.app"`，并要求先核对 ZIP SHA-256；`xattr -cr` 只作为实际验收证据保留。
- 该结果放行个人跨电脑使用，不改变 `QA-008`：未经 Developer ID 签名和 notarization 的包仍不适合公开分发。

## Remediation Update — 2026-07-18

- `QA-001`: 已修复并完成新包冒烟。Chromium 改经一次性回环代理；HTTP 请求使用固定 lookup，HTTPS CONNECT 直接连接逐次校验所得 IP。DNS 重绑定回归测试、打包应用 `browser` 模式转换和内网拒绝均通过。
- `QA-002`: 已修复并完成新包冒烟。Electron 每次生产启动生成 256 位随机令牌并由网络层附加；API 校验回环 Host、同源来源、JSON Content-Type 和令牌。
- `QA-003`: 已修复。`TimeoutError` 返回 `504 CONVERSION_TIMEOUT`，客户端主动停止内部记录为 `499 CLIENT_ABORTED`。
- `QA-004`: 第三轮已补真实代理 I/O 与超限路径，覆盖率和门禁均提升，此项关闭。
- `QA-006`: 第二轮在 Node.js 24.14.1 干净隔离副本中完整运行 `desktop:release`，新 ZIP 实际生成且打包应用冒烟通过；24.16.0 的历史异常未复现，此项关闭。
- `QA-007`: 已在 0.1.3 真实打包窗口完成。停止后链接保留且可编辑；“复制”“下载”和“已复制”反馈通过；剪贴板与下载内容一致；下载的长微信 Markdown 含 17,643 个非 Base64 字符和 30 张内嵌图，共 7,749,363 bytes。
- 第一轮整改产物：arm64 / macOS 12.0+ / 0.1.3，ZIP `239,266,746` bytes，SHA-256 `d5cd5bac1323827766c2a6bd94bde472b42bec2b790d52a276abed5d124c8a3e`。上一版 0.1.2 哈希保留为 `fbb645e1ad55b28373bc94f3974c85ca3a9aa3de58f73ce2530b9628ac84baf5`；当前正式产物以第三轮记录为准。
- 仍未放行：完整开发/构建依赖树的上游告警，以及正式对外分发所需的签名与 notarization。

## Executive Summary

0.1.3 的 Node.js 24 日常基线、三浏览器 E2E、真实微信文章同轮对照和打包应用转换冒烟均已取得通过证据。真实打包窗口中的停止、系统剪贴板、下载以及长文 30 图文件核验也已完成，`feat-009` 的运行时完成条件满足。

`QA-005` 的生产运行时阻断已在 2026-08-09 通过最小安全升级关闭；完整开发/构建树仍有 Forge 上游告警，但确认不会进入打包应用。未签名状态仅接受个人测试，不满足对外分发要求。第二台 Mac 验收以及第二轮发现的代理与 Harness 缺口均已关闭。

因此 `feat-009` 与 `feat-010` 均已完成。当前正式 ZIP 已通过自动门禁、本机操作和第二台 Mac 实测，可以用于受控个人使用；正式外部分发仍未放行。

## Scope

### Included

- 全部人类维护的项目文档和状态文件。
- Electron 主进程、本地 Next.js API、转换管线、动态浏览器、SSRF 防护、图片处理和 Markdown 输出。
- 单元、安全、金标准、跨浏览器 E2E 和真实网页门禁。
- 0.1.3 `.app` 与 ZIP 的架构、最低系统、版本、大小、哈希、签名状态、转换冒烟和真实窗口操作。
- npm 锁文件对应的生产与完整依赖树安全审计。

### Not Completed

- 未配置或验证 Developer ID 签名与 notarization。
- 完整开发/构建依赖树仍有上游告警；生产运行时依赖审计已清零，打包应用未包含 Forge、concurrently 或 tar。

## Verification Results

| Check | Result | Evidence |
|---|---|---|
| Node.js 24 `./init.sh` | Passed | lint、typecheck、18 files / 93 tests、覆盖率门禁、Next.js production build |
| `npm run test:e2e` | Passed | Chromium、Firefox、WebKit 共 21 项 |
| Node.js 24 `npm run test:live` | Passed with upstream variability | 真实微信文章同轮对照通过；曾出现一次 86.49% 和短时上游超时，阈值未降低 |
| Node.js 24.14.1 `npm run desktop:release` | Passed in current workspace | 基线、93 tests、21 E2E、live、构建、Forge 和 fresh artifact 校验全部通过 |
| Node.js 24 isolated artifact smoke | Passed | arm64 / 0.1.3 / macOS 12.0；239,266,900 bytes；`example.com` browser mode 270 bytes |
| Packaged short-page smoke | Passed | `https://example.com`；browser mode；270 bytes；无警告 |
| Packaged long-article smoke | Passed | 当前正式包为 17,643 non-Base64 chars；30 images；7,749,363 bytes；无警告 |
| Private-target packaged smoke | Passed | `localhost` 返回 `403 PRIVATE_TARGET`，应用以非零状态退出 |
| Real packaged window | Passed | 用户确认当前 Mac 人工测试通过；停止保留链接；复制与下载内容一致；长文下载含 30 张内嵌图且小于 20 MiB |
| Second-Mac installation | Passed with Gatekeeper workaround | 首次提示文件损坏；移除 quarantine 属性后应用可正常使用 |
| Security-critical coverage gate | Passed | 总体 91.26%；代理 91.27% lines / 81.31% branches / 95% functions，阈值 85% / 75% / 90% |
| Production dependency audit (pre-remediation) | Historical evidence | 2026-08-09 初次复核为 5 high、1 moderate；之后已授权升级并复核为 0 |
| Full dependency audit | Residual build-chain risk | 当前复核为 1 critical、26 high、3 low；主要集中在 Electron Forge 构建链 |
| Artifact architecture | Passed | Mach-O 64-bit arm64 |
| Artifact version | Passed | `CFBundleShortVersionString` 和 `CFBundleVersion` 均为 0.1.3；最低 macOS 12.0 |
| ZIP size | Passed | 239,281,512 bytes |
| ZIP SHA-256 | Passed | `66909aa8759ec41fdde875204773958d32b33a2c903e7b4eb0858a50fb1bdf89` |
| Code signing | Expected limitation | 仅临时/链接器签名，严格签名校验失败 |
| Packaged copy/save acceptance | Passed | `feat-009` 完成条件已满足 |

## Findings Register

### QA-001 — Dynamic Browser Requests Were Not IP-Pinned

- Severity: **P1 — Release blocker**
- Status: Resolved and packaged revalidation passed
- Location: `src/lib/browser.ts:22-36`
- Related contract: `docs/ARCHITECTURE.md` 的本地安全边界

Original finding: 动态浏览器的路由拦截器曾先调用 `resolvePublicTarget()` 检查域名，再由 Chromium 独立解析并连接，未复用 Node 已验证的 IP。

攻击者控制目标域名和 DNS 响应时，可以先向 Node 返回公网地址以通过检查，再向 Chromium 返回本机、私网、链路本地或云元数据地址。这会破坏“页面、重定向和动态子资源均执行相同 SSRF 防护”的架构承诺。直连抓取已经使用固定 DNS lookup，不存在相同的实现方式缺口。

Resolution evidence:

- Chromium 的 HTTP/HTTPS 请求现在经过一次性回环代理，逐请求校验并直接连接已验证 IP；WebSocket 被拒绝。
- DNS 重绑定回归、完整基线、三浏览器 E2E、真实网页门禁和打包应用长文章冒烟均已通过。

### QA-002 — Local API Had No Caller-Origin Authentication

- Severity: **P2 — High priority hardening**
- Status: Resolved and packaged revalidation passed
- Location: `src/app/api/convert/route.ts:11-30`

Original finding: 本地 API 曾不校验 `Origin`、`Sec-Fetch-Site`、JSON Content-Type 或应用级随机令牌，随机回环端口本身不能充当调用者鉴权。

Resolution evidence:

- Electron 每次生产启动生成随机令牌并由网络层附加，页面脚本不接触令牌。
- API 校验回环 Host、同源来源、Content-Type 和令牌；错误来源、缺失/错误令牌及正确请求均有直接测试。

### QA-003 — Timeout Was Reported as Upstream Failure

- Severity: **P2 — Contract defect**
- Status: Resolved
- Location: `src/lib/errors.ts:12-17`

Original finding: `toAppError()` 曾只识别 `AbortError`，导致 `AbortSignal.timeout()` 产生的 `TimeoutError` 落入 `502 UPSTREAM_ERROR`。

Resolution evidence:

- `TimeoutError` 已映射为 `504 CONVERSION_TIMEOUT`，客户端主动停止内部记录为 `499 CLIENT_ABORTED`。
- 错误映射和 API 总超时均有回归测试。

### QA-004 — Critical Orchestration Paths Lacked Direct Tests

- Severity: **P2 — Quality gate weakness**
- Status: Resolved in third-round remediation
- Location: `vitest.config.ts` 及相关测试目录

Original finding: 原 45 个测试没有直接覆盖 API 路由和限流，动态浏览器及完整转换编排覆盖也不足；模拟 `/api/convert` 的 E2E 无法补足服务器回归证据。

Resolution evidence:

- 当前共有 18 个测试文件、93 项测试，直接覆盖逐跳重定向、浏览器入口、API 鉴权、限流、超时、完整转换编排及代理实际 I/O。
- `browser-proxy.test.ts` 的 10 项测试覆盖真实 HTTP 双向传输、声明/流式超限、并发共享请求预算、CONNECT 超限、取消关闭和 WebSocket 拒绝。
- `browser-proxy.ts` 达到 91.27% lines / 81.31% branches / 95% functions，门禁提高到 85% / 75% / 90%。

### QA-005 — Dependency Advisories Require Triage

- Severity: **P2 — Build and supply-chain risk**
- Status: Production blocker resolved on 2026-08-09; residual build-chain risk accepted only for personal testing

2026-08-09 初次只读审计报告生产依赖 5 high、1 moderate，完整树 1 critical、30 high、1 moderate、3 low。经用户授权后，Next.js 升级至 16.3.0、Undici 至 8.10.0、DOMPurify 至 3.4.13、Electron 至 43.3.0，并在 PostCSS 既有兼容范围内把 Nano ID 锁定至 3.3.18。升级后 `npm audit --omit=dev --json` 为 0；完整 `npm audit --json` 为 1 critical、26 high、3 low。

完整树剩余项位于开发/构建工具链，主要来自 Electron Forge 7.11.2 的 `tar`、`tmp` 及其上游包；Forge 7.11.2 仍是当前同系列最新版本。0.2.0 打包应用抽查未发现 `@electron-forge`、`concurrently` 或 `tar`，生产运行包不携带这些构建依赖。该结论只放行个人测试，不代表开发机供应链风险消失；后续继续跟踪上游修复，禁止使用 `npm audit fix --force` 或未验证降级清零数字。已封版的 0.1.3 ZIP 和历史验收结论保持不变。

Required remediation:

- 保持生产依赖审计为 0，并在依赖更新时重新检查打包内容。
- 跟踪 Electron Forge 上游修复；完整树告警在公开分发前重新评估。
- 不执行未经评估的 `npm audit fix --force`，也不为清零审计数字而回退框架版本。

### QA-006 — Verification Runtime Does Not Match the Target

- Severity: **P2 — Release evidence gap**
- Status: Resolved in second-round Node.js 24.14.1 clean-clone release
- Related configuration: `package.json` now requires Node.js `>=24.0.0 <25.0.0`

历史证据中，Node.js 24.16.0 的 Forge 7.11.2 曾在 finalizing 无产物退出。第二轮改用本机现有 Node.js 24.14.1 / npm 11.11.0，在干净隔离副本中原样运行 `npm run desktop:release`，基线、E2E、live 和 Forge make 全部通过，并生成新 ZIP。

Resolution evidence:

- 新 ZIP：`239,266,900` bytes；SHA-256 `4477e94473063ec417341837e3b61beabc327d05e1f1983938f96c3b29be6181`。
- 新 `.app` 为 Mach-O arm64、版本 0.1.3、最低 macOS 12.0，`example.com` browser-mode 冒烟通过。
- 第三轮再次复现 24.16.0 的无产物异常，fresh ZIP 门禁按预期阻断；当前发布组合固定记录为已验证的 24.14.1。

### QA-007 — Manual Desktop Acceptance Was Incomplete

- Severity: **Release gate**
- Status: Resolved in 0.1.3
- Source of truth: `docs/TESTING.md` 与 `feature_list.json`

Original finding: 自动化 E2E 已覆盖浏览器中的停止、复制模拟和下载，但没有在最终 `.app` 中验证真实系统剪贴板和文件保存。

Resolution evidence:

- 0.1.3 真实打包窗口验证了停止、链接保留、剪贴板复制、下载文件及两者内容一致。
- 长微信文章通过真实窗口下载，文件为 7,749,363 bytes，含 17,643 个非 Base64 字符和 30 张内嵌图片。

### QA-008 — Distribution Is Unsigned

- Severity: **Known release constraint**
- Status: Accepted for personal testing; open for external distribution

现有应用只有临时/链接器签名，`codesign --verify --deep --strict` 失败。该结果和项目文档“只适合个人测试”的描述一致，不阻止受控的本机验收，但阻止正式对外分发。

### QA-009 — Dynamic Browser Traffic Had No Transfer Budget

- Severity: **P2 — Local resource exhaustion risk**
- Status: Resolved in third-round remediation
- Location: `src/lib/browser-proxy.ts:91-209`、`src/lib/convert.ts:85-90`

Original finding: 安全代理会直接转发 HTTP 响应或建立不解析内容的 HTTPS 隧道，没有累计接收字节、请求数量或单隧道流量限制。动态页面的 5 MiB 检查只作用于加载完成后的 `page.content()`，无法阻止页面在此之前下载大型脚本、图片或 fetch 响应。

Resolution evidence:

- 每次浏览器回退最多 100 个 HTTP/CONNECT 请求，代理累计 50 MiB，单 CONNECT 隧道 25 MiB；HTTP 请求体和响应、CONNECT 双向流量及并发子资源共享同一状态。
- 已声明超限 `Content-Length` 的 HTTP 响应返回 413；未知长度流和 CONNECT 在累计超限时关闭。
- 架构文档已明确区分序列化 DOM 的 5 MiB 限制与浏览器网络预算。

### QA-010 — Baseline Did Not Enforce Node.js 24

- Severity: **P2 — Verification integrity gap**
- Status: Resolved in third-round remediation
- Location: `init.sh:1-34`、`package.json:7-8`

Original finding: 项目明确要求 Node.js 24，但默认终端为 23.11.1，`./init.sh` 仍完整通过。原 `engines: >=24.0.0` 只在安装阶段产生警告，也允许未来更高主版本；基线本身没有检查当前 Node 主版本。

Resolution evidence:

- `package.json` 与锁文件使用 `>=24.0.0 <25.0.0`；项目文档固定 Node.js 24.x。
- `init.sh` 在其他验证前检查主版本；默认 Node.js 23.11.1 负向运行立即以非零状态退出并报告当前版本。

### QA-011 — Release Command Did Not Assert a Fresh ZIP

- Severity: **P2 — Release integrity gap**
- Status: Resolved in third-round remediation
- Location: `package.json:28`

Original finding: `desktop:release` 只依次运行四个命令，没有记录开始时间，也没有验证目标 ZIP 的存在、mtime、版本和架构。历史上 Forge 曾无产物退出，因此仅依赖子命令退出状态可能把旧 ZIP 或无新产物误记为本轮发布成功。

Resolution evidence:

- `scripts/release-desktop.mjs` 记录开始时间与旧 ZIP mtime，要求新 ZIP 的时间推进，并检查应用版本、arm64 可执行文件和 ZIP 包结构。
- Node.js 24.16.0 的 Forge 无产物路径被脚本按失败阻断；Node.js 24.14.1 完整门禁成功输出新 ZIP 大小和 SHA-256。
- freshness guard 另有新旧时间戳的正向与负向测试。

### QA-012 — E2E Left a Tracked File Modified

- Severity: **P3 — Harness cleanliness**
- Status: Resolved in third-round remediation
- Location: `playwright.config.ts:12-16`、`next-env.d.ts:3`

Original finding: `npm run test:e2e` 启动 `next dev`，Next.js 会把 `next-env.d.ts` 的引用从 `.next/types/routes.d.ts` 改为 `.next/dev/types/routes.d.ts`。第二轮实际观察到测试后 `git status` 出现该已跟踪文件修改。

Resolution evidence:

- E2E 改用 production standalone 服务，不再运行 `next dev`。
- 执行器对测试前后的 tracked diff 计算 SHA-256；三引擎 21 项通过并明确输出 tracked-file check passed，`next-env.d.ts` 未变化。

## Documentation Consistency

产品范围、架构、测试手册、README、进度、事项列表和交接文档对以下事实描述一致：

- 第一阶段仅支持 Apple Silicon Mac 单机版。
- 不使用 AI API、账号、云端数据库或转换历史。
- 支持 30 张图片、8 MiB 单图、20 MiB 最终文件和正文优先降级。
- 当前产物未完成 Developer ID 签名与 notarization。
- `feat-009` 与 `feat-010` 已完成；`feat-011` 已取消。0.1.3 收口后，2026-08-06 启动 v0.2 `feat-012`（富文本粘贴转换，规划见 `docs/PLAN-V0.2.md`，任务追踪见 `docs/TASKS-V0.2.md`）。

第三轮已同步产品、架构、测试、进度、事项和交接文档：代理预算与发布 Harness 均为已完成状态。2026-07-21 用户取消 Windows 与多平台迁移，原 `docs/MULTIPLATFORM-PLAN.md` 已删除；第二台 Mac 验收、`feat-010` 关闭和方案取消记录已提交为 0.1.3 Mac 基线（`ce041c9`）。

## Remediation Order

1. 0.1.3 Mac 基线已提交（`ce041c9`：第二台 Mac 验收、`feat-010` 关闭和后续方案取消）。
2. 分级处理 `QA-005` 的可安全升级项。
3. 只有需要对外分发时，再以 Developer ID 签名和 notarization 关闭 `QA-008`。

## Re-Audit Checklist

- [x] `QA-001` 已修复，DNS 重绑定测试通过。
- [x] 动态页面的主请求、重定向和子资源均使用固定的已验证公网地址。
- [x] API 会拒绝非应用来源、缺少令牌和错误 Content-Type 的请求。
- [x] 45 秒服务端超时返回 `504 CONVERSION_TIMEOUT`。
- [x] 关键安全模块具备直接测试和覆盖率门禁。
- [x] Node.js 24 下 `./init.sh` 通过。
- [x] Node.js 24 下 `npm run test:e2e` 通过。
- [x] Node.js 24 下 `npm run test:live` 通过。
- [x] Node.js 24 下完整 `npm run desktop:release` 生成新 ZIP。
- [x] 新产物的打包转换冒烟通过。
- [x] 新产物版本、arm64 架构和 SHA-256 已重新记录。
- [x] 真实 `.app` 窗口停止、复制和保存验收通过。
- [x] 第二台 Apple Silicon Mac 安装和首次启动验收通过；quarantine 处理方式已记录。
- [x] 动态浏览器代理具备累计传输预算和超限集成测试。
- [x] `browser-proxy.ts` 实际 HTTP/CONNECT I/O 路径达到合理覆盖率。
- [x] `./init.sh` 会拒绝不符合项目策略的 Node 版本。
- [x] 发布脚本验证 ZIP 为本轮新产物并输出版本、架构和 SHA-256。
- [x] E2E 完成后不会修改 tracked 文件。
- [x] `feature_list.json`、`PROGRESS.md`、`session-handoff.md` 和必要的变更记录已更新。

## v0.2 T3–T9B Documentation and Guard Audit — 2026-08-09

本轮只审查 v0.2 已实现范围、文档一致性和 T9A 封版保护，不把 T10 发布门禁或人工验收写成完成。审查结果如下：

- 富文本模式事实已在产品、架构、测试和 README 中对齐：双 MIME 剪贴板、DOM 语义门控、HTML/纯文本降级、编辑后纯文本、再次粘贴替换和可选 `sourceUrl`。
- 粘贴安全边界已对齐：5 MiB UTF-8 JSON 上限、回环/同源/令牌鉴权、有界流读取、45 秒总时限、SSRF 图片校验、严格 `data:` 图片处理，以及登录态、临时签名、`blob:` 和 Cookie 图片限制。
- 图片和输出预算已对齐：`data-src`/`data-lazy-src` lazy-first、JPEG/PNG/WebP/GIF/AVIF、单图 8 MiB、最多 30 图、最终 20 MiB，正文优先并从末图开始降级。
- T9A 已完成：`main`/`v0.1.3^{}` 固定提交、外部只读归档、0.1.0–0.1.3 固定 ZIP manifest 和非 `0.2.0` 目标保护；历史清单在成功与后续失败路径复核，错误保持稳定且不泄露路径/哈希。

### v0.2 verification evidence

- Node.js v24.16.0 `./init.sh`：lint、typecheck、coverage gate、Next.js production build，通过 23 个测试文件 / 281 tests。
- `npx vitest run scripts/release-guards.test.mjs`：22/22；真实四个历史 ZIP 哈希与固定 manifest 一致。
- T8 三浏览器 E2E：48/48；既有 0.1.3 链接模式用例保持通过。
- T10 已在 Node.js 24.14.1 / npm 11.11.0 连续运行 `npm run desktop:release`：24 files / 282 tests、三引擎 48/48、真实微信门禁、Forge 和 fresh ZIP 校验全部通过。
- 新 ZIP 为 0.2.0 / arm64 / macOS 12.0+，`354,594,827` bytes，SHA-256 `ab2a463cf0a98a51cacdcad3a2cab5ed34b458b47b504ac644d56b7914a7b7b4`；启动和长微信转换冒烟通过，用户已确认真实窗口富文本模式人工验收通过。
- 提交前双轴审查以失败测试复现远程 SVG 伪装栅格图和 ZIP 只校验旁路 app 两项风险；整改后远程声明/实际格式不匹配会降级为替代文本，发布门禁会解压核验 ZIP 内版本与 arm64。Node.js 24.14.1 最终 `./init.sh` 为 24 files / 285 tests，现有 ZIP 包内只读复验通过。

### v0.2 release status

`T9A`、`T9B` 与 `T10` 已完成，`feat-012` 无剩余任务。自动门禁、live、Forge fresh ZIP、启动、链接转换冒烟和真实窗口富文本模式人工验收均已通过；X 图片匿名直连失败时保留外链，以及客户端 Mermaid/SVG 图表缺失，均已由用户接受为 v0.2 已知限制。Mermaid 保留转入后续 `feat-013`；泛化 UI/UX 调整 `feat-014` 已取消；`feat-015` 已完成一键清空并进入当前 0.2.0 ZIP，通过 287 tests、51/51 E2E、live、打包冒烟和真实窗口验收。Apple Developer ID 签名与 notarization 仍是对外分发前的独立开放项。

2026-08-09 的 QA-005 阻断经授权整改：生产审计从 6 项降至 0，完整树降至 1 critical / 26 high / 3 low；剩余项确认属于未进入应用包的开发/构建链。Node.js 24.16.0 的 Forge 无产物路径再次被 fresh ZIP 门禁正确阻断，随后 Node.js 24.14.1 的连续发布门禁成功生成并校验 0.2.0 ZIP。该过程未改变任何 0.1.x 哈希或外部归档。

## feat-013 Mermaid Safety and Conversion Audit — 2026-08-11

- Mermaid 源码在正文提取/净化前规范化，并经内部 marker 穿过 Readability，最终只输出 fenced `mermaid`；普通代码块行为不变。
- 粘贴模式不在浏览器执行 SVG/Canvas。Mermaid SVG 经专用白名单清洗后由 Sharp 转为 PNG：脚本、事件、外部资源和危险属性被移除，`foreignObject` 只提取纯文本并改写为 SVG `text`；原始 SVG 不进入 Markdown。无法安全栅格化或 Canvas 输出占位与 `MERMAID_RENDER_UNAVAILABLE`。
- 前两轮分别尝试不透明白底和继承安全根文字色，但真实窗口仍显示黑图，因此未把自动 fixture 结果当成人工问题关闭证据。用户随后提供实际下载 Markdown；只提取其中唯一 Data URI PNG 检查，确认其为 1170×266、全不透明白底，但节点、连线为黑色且文字同样接近黑色，问题不在预览、透明度、缓存或旧二进制。
- 最终根因是剪贴板 SVG 依赖来源网页 CSS；独立安全栅格化时这些样式不能可靠保留，未显式设置的 SVG presentation 属性按规范回退为黑色。修复改为移除来源 `<style>`，对节点、连线、marker 和文字写入固定浅色配色后再由 Sharp 栅格化，不再推断或继承网页主题。深色 fixture 节点像素先 RED（31，预期大于 220）后 GREEN；同一真实 WalkingLabs 页面生成图已目视确认节点、箭头和文字可读。
- Node.js 24.14.1 `./init.sh` 仍通过 27 files / 311 tests、coverage 与 build；重新 `desktop:package` 后，用户在真实应用窗口重新粘贴、转换并确认问题解决。该证据关闭黑图人工验收，但不替代仍被微信上游 504 阻断的正式发布门禁。
- 人工验收后的双轴质检又确认三项真实缺口：动态 Locator 边递增遍历边替换会跳过多图；元素内联 `style` 可覆盖 canonical presentation attributes；第 31 张粘贴 Mermaid 会降级但未进入来源/省略统计。另确认纯源码 `.mermaid` 不应进入浏览器截图集合。四项均先以失败测试复现，再分别改为倒序替换、只选择含 SVG/Canvas 的容器、移除内联样式、回传遗漏计数和专用 `MERMAID_COUNT_LIMIT`。
- 31 张小型 fixture 同时暴露应用生成的低于 1 KiB PNG 会被通用占位检测误删；新增只在内部管线存活的生成标记以绕过该启发式，图片仍执行严格 PNG 校验，标记在输出前移除。聚焦浏览器/粘贴/图片回归为 123/123；Node.js 24.14.1 `./init.sh` 通过 27 files / 314 tests、coverage 与 build。
- 质检整改后重新运行 `desktop:package`，产物只生成未压缩本机 `.app`，确认为 0.2.0 / arm64 / macOS 12.0+；用户在该新应用中复测 WalkingLabs 富文本转换正常。该人工证据覆盖最新整改，但仍不等价于 `desktop:release` 的 live 与 fresh ZIP 门禁。
- 随后重跑完整 `desktop:release`：314 tests、coverage/build、三引擎 51/51、WalkingLabs live 2/2 均通过；固定微信样本在转换阶段约 28 秒后 504，发布在 Forge 前停止。旧 ZIP 的大小与 SHA-256 保持 `354,619,347` bytes / `e84ce4bd...e81328c0`，证明失败路径没有把历史产物误报或覆盖为新发布。用户同日手动转换另一篇微信文章成功，下一步应先把该 URL 作为临时 live 输入验证，而不是删除真实网页门禁。
- 用户随后确认微信 504 属于可接受的上游波动并授权忽略其发布阻断作用。整改采用分层门禁：`test:live` 只保留 WalkingLabs 链接/粘贴 Mermaid 两项稳定真实样本，微信公众号同轮对照完整保留为 `test:live:wechat` 非阻断诊断命令；未删除覆盖率、标题、图片或 20 MiB 断言。公开命令配置测试先 RED 后 GREEN，release guards 25/25。
- 最终 Node.js 24.14.1 `desktop:release` 通过 27 files / 315 tests、coverage/build、三引擎 51/51、WalkingLabs live 2/2、Forge、fresh ZIP、包内 0.2.0 与 arm64 校验。新 ZIP 为 `354,631,314` bytes，SHA-256 `b212b359405e53f1a0cc924b51c48c986335a3f74b4520f06f9fb825357d505c`；0.1.x 固定产物保护复核通过。结合此前最新 `.app` 的 WalkingLabs 真实窗口验收，feat-013 发布条件关闭。
- 链接模式仅在受控 Chromium 中截图可见图表，使用不可预测的请求内占位映射；PNG 仍经 Sharp 实际格式校验、30 图、8 MiB 单图与 20 MiB 最终预算。网页自行提供的链接模式 Data URI 仍被拒绝。
- 真实 WalkingLabs 门禁发现 `fonts.googleapis.com` 样式表会在固定代理中悬挂并阻塞 `DOMContentLoaded`；修复只阻断该字体样式表及既有字体/媒体资源，保留页面自身 CSS。未采用“导航超时但已提交即放行”的宽松方案，避免浏览器错误空壳被当作正文。
- 链接版曾完成 Node.js 24.14.1 `desktop:release`：306 tests、三引擎 51/51、live 2/2、Forge 和 fresh ZIP。用户随后发现同一 WalkingLabs 页面经富文本粘贴仍缺图；固定浅色配色与质检整改后的本机 `.app` 已通过真实窗口验收，最终完整发布门禁及 fresh ZIP 也已通过，feat-013 标记为 done。
