# Quality Audit

## Audit Metadata

- Audit date: 2026-07-18; second-round audit: 2026-07-18
- Audited version: `0.1.2`; follow-up validation: `0.1.3`
- Platform: Apple Silicon Mac (`darwin/arm64`)
- Active feature: 无；`feat-010 — Personal Mac Release` 已完成
- Audit type: 文档一致性、代码与安全审查、自动化验证、真实网页门禁、依赖审计和打包产物抽查
- Overall verdict: **Personal-test release validated on two Apple Silicon Macs; dependency upgrades and external-distribution signing remain open**

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
- 仍未放行：`QA-005` 依赖告警，以及正式对外分发所需的签名与 notarization。

## Executive Summary

0.1.3 的 Node.js 24 日常基线、三浏览器 E2E、真实微信文章同轮对照和打包应用转换冒烟均已取得通过证据。真实打包窗口中的停止、系统剪贴板、下载以及长文 30 图文件核验也已完成，`feat-009` 的运行时完成条件满足。

当前开放项是：`QA-005` 依赖告警仍待安全升级；未签名状态仅接受个人测试，不满足对外分发要求。第二台 Mac 验收以及第二轮发现的代理与 Harness 缺口均已关闭。

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
- 依赖审计告警尚未完成运行时与构建时可达性分级和安全升级验证。

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
| Production dependency audit | Needs review | 2 moderate，来自 Next.js 间接依赖 PostCSS |
| Full dependency audit | Needs review | 20 high、2 moderate、3 low；high 主要位于 Electron Forge 构建链 |
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
- Status: Triaged; upgrades remain open

`npm audit --omit=dev` 报告 2 个 moderate，来源是 Next.js 16.2.10 携带的 PostCSS 8.4.31。完整审计报告包含 20 high、2 moderate、3 low；high 主要来自 Electron Forge 构建链中的 `tar`、`tmp` 及其上游包。

第二轮再次确认当前 ZIP 中不存在 `postcss`、`tar`、`tmp` 或 Electron Forge 包。PostCSS 不参与打包应用运行时的远程 CSS 处理，high 告警位于依赖安装和构建链，因此不作为当前个人测试包的运行时阻断项；构建机和供应链仍需处理。npm 当前没有可直接采用的无破坏修复方案。

Required remediation:

- 分别记录运行时可达性和构建时可达性。
- 优先采用上游已修复版本或安全的 lockfile override，并在每次变更后重跑完整发布门禁。
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
- Location: `package.json:27`

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
- `feat-009` 与 `feat-010` 已完成；`feat-011` 已取消，当前没有计划中的功能事项。

第三轮已同步产品、架构、测试、进度、事项和交接文档：代理预算与发布 Harness 均为已完成状态。2026-07-21 用户取消 Windows 与多平台迁移，原 `docs/MULTIPLATFORM-PLAN.md` 已删除；第二台 Mac 验收、`feat-010` 关闭和方案取消记录仍需作为最终 0.1.3 Mac 基线提交。

## Remediation Order

1. 把第二台 Mac 验收、`feat-010` 关闭和后续方案取消记录提交为干净的 0.1.3 Mac 基线。
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
