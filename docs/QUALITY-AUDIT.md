# Quality Audit

## Audit Metadata

- Audit date: 2026-07-18
- Audited version: `0.1.2`; follow-up validation: `0.1.3`
- Platform: Apple Silicon Mac (`darwin/arm64`)
- Active feature: `feat-010 — Personal Mac Release`
- Audit type: 文档一致性、代码与安全审查、自动化验证、真实网页门禁、依赖审计和打包产物抽查
- Overall verdict: **Personal-test package validated locally; second-Mac and Node.js 24 release evidence remain open**

## Remediation Update — 2026-07-18

- `QA-001`: 已修复并完成新包冒烟。Chromium 改经一次性回环代理；HTTP 请求使用固定 lookup，HTTPS CONNECT 直接连接逐次校验所得 IP。DNS 重绑定回归测试、打包应用 `browser` 模式转换和内网拒绝均通过。
- `QA-002`: 已修复并完成新包冒烟。Electron 每次生产启动生成 256 位随机令牌并由网络层附加；API 校验回环 Host、同源来源、JSON Content-Type 和令牌。
- `QA-003`: 已修复。`TimeoutError` 返回 `504 CONVERSION_TIMEOUT`，客户端主动停止内部记录为 `499 CLIENT_ABORTED`。
- `QA-004`: 关键缺口已修复。新增 API、限流、动态浏览器、代理 DNS 固定、逐跳重定向和完整转换编排测试；覆盖范围只包含项目源代码，并为安全关键文件设置阈值。
- `QA-006`: Node.js 24.16.0 下已执行 `npm ci`、`./init.sh`、三浏览器 E2E、真实网页门禁、Next 构建和桌面资源准备；Forge 7.11.2 在 Node 24 finalizing 阶段无错误提前退出，最终封装临时使用 Node 23.11.1，此项保持部分开放。
- `QA-007`: 已在 0.1.3 真实打包窗口完成。停止后链接保留且可编辑；“复制”“下载”和“已复制”反馈通过；剪贴板与下载内容一致；下载的长微信 Markdown 含 17,643 个非 Base64 字符和 30 张内嵌图，共 7,749,363 bytes。
- 新产物：arm64 / macOS 12.0+ / 0.1.3，ZIP `239,266,746` bytes，SHA-256 `d5cd5bac1323827766c2a6bd94bde472b42bec2b790d52a276abed5d124c8a3e`。上一版 0.1.2 哈希保留为 `fbb645e1ad55b28373bc94f3974c85ca3a9aa3de58f73ce2530b9628ac84baf5`。
- 仍未放行：第二台 Apple Silicon Mac 安装验收、`QA-005` 依赖告警和 `QA-006` Forge Node 24 兼容问题仍需处理。

## Executive Summary

0.1.3 的 Node.js 24 日常基线、三浏览器 E2E、真实微信文章同轮对照和打包应用转换冒烟均已取得通过证据。真实打包窗口中的停止、系统剪贴板、下载以及长文 30 图文件核验也已完成，`feat-009` 的运行时完成条件满足。

当前开放项是：尚未在第二台 Apple Silicon Mac 上完成解压、首次安全放行和转换验收；`QA-006` 的 Electron Forge 7.11.2 在 Node.js 24 finalizing 阶段无产物退出，最终 ZIP 暂由 Node 23 封装；`QA-005` 依赖告警仍待可达性分级处理。未签名状态仅接受个人测试，不满足对外分发要求。

因此 `feat-009` 已完成，`feat-010` 进入 `in-progress`。现有 ZIP 可用于本机和第二台 Mac 的个人验收，但不能宣称跨电脑实测、完整 Node.js 24 发布门禁或正式外部分发已经通过。

## Scope

### Included

- 全部人类维护的项目文档和状态文件。
- Electron 主进程、本地 Next.js API、转换管线、动态浏览器、SSRF 防护、图片处理和 Markdown 输出。
- 单元、安全、金标准、跨浏览器 E2E 和真实网页门禁。
- 0.1.3 `.app` 与 ZIP 的架构、最低系统、版本、大小、哈希、签名状态、转换冒烟和真实窗口操作。
- npm 锁文件对应的生产与完整依赖树安全审计。

### Not Completed

- 未在另一台全新 Apple Silicon Mac 上执行安装与首次启动验收。
- 未配置或验证 Developer ID 签名与 notarization。
- Electron Forge 7.11.2 尚未在 Node.js 24 下稳定生成最终产物；现有 ZIP 使用 Node.js 24 构建和准备资源、Node.js 23 执行 Forge 封装。
- 依赖审计告警尚未完成运行时与构建时可达性分级和安全升级验证。

## Verification Results

| Check | Result | Evidence |
|---|---|---|
| Node.js 24 `./init.sh` | Passed | lint、typecheck、17 files / 82 tests、覆盖率门禁、Next.js production build |
| `npm run test:e2e` | Passed | Chromium、Firefox、WebKit 共 21 项 |
| Node.js 24 `npm run test:live` | Passed with upstream variability | 真实微信文章同轮对照通过；曾出现一次 86.49% 和短时上游超时，阈值未降低 |
| Node.js 24 `npm run desktop:release` | Partial | 基线、E2E 通过；真实网页阶段遇到上游超时，未进入封装 |
| Node.js 24 `npm run desktop:make` | Partial | 构建与资源准备通过；Forge 7.11.2 在 finalizing 无产物退出 |
| Node.js 23 Forge packaging | Passed with evidence gap | 对 Node.js 24 已构建和准备的资源完成 App/ZIP 封装 |
| Packaged short-page smoke | Passed | `https://example.com`；browser mode；270 bytes；无警告 |
| Packaged long-article smoke | Passed | 17,643 non-Base64 chars；30 images；7,749,363 bytes；无警告 |
| Private-target packaged smoke | Passed | `localhost` 返回 `403 PRIVATE_TARGET`，应用以非零状态退出 |
| Real packaged window | Passed | 停止保留链接；复制与下载内容一致；长文下载含 30 张内嵌图且小于 20 MiB |
| Security-critical coverage gate | Passed | 17 个测试文件、82 项测试；API、鉴权、浏览器、限流、超时和转换编排均有直接门禁 |
| Production dependency audit | Needs review | 2 moderate，来自 Next.js 间接依赖 PostCSS |
| Full dependency audit | Needs review | 20 high、2 moderate、3 low；high 主要位于 Electron Forge 构建链 |
| Artifact architecture | Passed | Mach-O 64-bit arm64 |
| Artifact version | Passed | `CFBundleShortVersionString` 和 `CFBundleVersion` 均为 0.1.3；最低 macOS 12.0 |
| ZIP size | Passed | 239,266,746 bytes |
| ZIP SHA-256 | Passed | `d5cd5bac1323827766c2a6bd94bde472b42bec2b790d52a276abed5d124c8a3e` |
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
- Status: Resolved for critical paths
- Location: `vitest.config.ts` 及相关测试目录

Original finding: 原 45 个测试没有直接覆盖 API 路由和限流，动态浏览器及完整转换编排覆盖也不足；模拟 `/api/convert` 的 E2E 无法补足服务器回归证据。

Resolution evidence:

- 当前共有 17 个测试文件、82 项测试，直接覆盖逐跳重定向、动态浏览器安全代理、API 输入与鉴权、限流释放、超时和完整转换编排。
- 覆盖范围已限制为项目源代码，并对安全关键模块设置文件级门禁。

### QA-005 — Dependency Advisories Require Triage

- Severity: **P2 — Build and supply-chain risk**
- Status: Open

`npm audit --omit=dev` 报告 2 个 moderate，来源是 Next.js 16.2.10 携带的 PostCSS 8.4.31。完整审计报告包含 20 high、2 moderate、3 low；high 主要来自 Electron Forge 构建链中的 `tar`、`tmp` 及其上游包。

产物抽查确认 standalone 中不存在 `postcss` 和 `tar`，因此这些报告不能直接等同于已打包应用的运行时可利用漏洞；构建机、依赖安装和打包供应链仍需处理。npm 当前给出的 Forge 降级建议不应直接执行。

Required remediation:

- 分别记录运行时可达性和构建时可达性。
- 优先采用上游已修复版本或安全的 lockfile override，并在每次变更后重跑完整发布门禁。
- 不执行未经评估的 `npm audit fix --force`，也不为清零审计数字而回退框架版本。

### QA-006 — Verification Runtime Does Not Match the Target

- Severity: **P2 — Release evidence gap**
- Status: Partially resolved; Forge packaging still requires Node 23 workaround
- Related configuration: `package.json` requires Node.js `>=24.0.0`

Node.js 24.16.0 已完成 `npm ci`、基线、三浏览器 E2E、真实网页门禁、Next.js 构建和桌面资源准备。Electron Forge 7.11.2 随后在 finalizing 阶段无错误退出且未生成产物；现有 ZIP 由 Node.js 23.11.1 对上述 Node.js 24 资源执行最终 Forge 封装。

Required remediation:

- 复现并定位 Forge 7.11.2 在 Node.js 24 finalizing 阶段的提前退出，或升级到兼容版本。
- 修复后必须在 Node.js 24 下完整运行 `npm run desktop:release` 并重新记录产物哈希；不能仅以现有 Node.js 23 封装产物关闭此项。

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

## Documentation Consistency

产品范围、架构、测试手册、README、进度、事项列表和交接文档对以下事实描述一致：

- 第一阶段仅支持 Apple Silicon Mac 单机版。
- 不使用 AI API、账号、云端数据库或转换历史。
- 支持 30 张图片、8 MiB 单图、20 MiB 最终文件和正文优先降级。
- 当前产物未完成 Developer ID 签名与 notarization。
- `feat-009` 已完成，`feat-010` 因第二台 Mac 安装验收未完成而保持 `in-progress`。

当前文档一致记录：安全和真实窗口阻断项已经修复，剩余个人发布门禁为第二台 Mac 安装验收、Node.js 24 Forge 封装证据和依赖告警处理；外部分发另需签名与 notarization。

## Remediation Order

1. 在第二台 Apple Silicon、macOS 12.0+ 的 Mac 上完成解压、首次安全放行、转换、复制和下载验收。
2. 定位或升级 Electron Forge，在 Node.js 24 下完整生成产物并关闭 `QA-006`。
3. 分级处理 `QA-005` 的运行时与构建时依赖告警，避免未经评估的强制降级。
4. 重新运行完整发布门禁并记录新产物哈希，完成 `feat-010`。
5. 只有需要对外分发时，再以 Developer ID 签名和 notarization 关闭 `QA-008`。

## Re-Audit Checklist

- [x] `QA-001` 已修复，DNS 重绑定测试通过。
- [x] 动态页面的主请求、重定向和子资源均使用固定的已验证公网地址。
- [x] API 会拒绝非应用来源、缺少令牌和错误 Content-Type 的请求。
- [x] 45 秒服务端超时返回 `504 CONVERSION_TIMEOUT`。
- [x] 关键安全模块具备直接测试和覆盖率门禁。
- [x] Node.js 24 下 `./init.sh` 通过。
- [x] Node.js 24 下 `npm run test:e2e` 通过。
- [x] Node.js 24 下 `npm run test:live` 通过。
- [x] 新产物的打包转换冒烟通过。
- [x] 新产物版本、arm64 架构和 SHA-256 已重新记录。
- [x] 真实 `.app` 窗口停止、复制和保存验收通过。
- [ ] 第二台 Apple Silicon Mac 安装和首次启动验收通过。
- [x] `feature_list.json`、`PROGRESS.md`、`session-handoff.md` 和必要的变更记录已更新。
