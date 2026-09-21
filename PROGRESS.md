# Project Progress

## Current State

- Last updated: 2026-09-21
- Current version: `0.3.3`（`package.json`、`package-lock.json`、`feature_list.json` 与发布门禁均为 `0.3.3`）。**`0.3.3` 门禁已于 2026-09-20 跑通（exit 0）**：`out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.3.zip`（`232,947,408` bytes，SHA-256 `1bf807df…7a72`），已安装到 `/Applications`（未压缩 539 MB），**已提交（`3897cd1`）并作为 `v0.3.3` 发布**。上一版 `0.3.2`（`358,726,788` bytes，`8fb7a93f…f1ba`）已发布为 GitHub Release `v0.3.2`（tag `1c3ed80`）；`0.3.0` 的 ZIP（`358,562,540` bytes，`2a0e236e…1147`）是修复**前**的构建，仅作历史
- Active feature: none（`feat-024` – `feat-037` 已 done）
- Next release step: `0.3.3` 已提交（`3897cd1`）并发布为 GitHub Release `v0.3.3`（tag `3897cd1`，资产 `232,947,408` bytes / SHA-256 `1bf807df…7a72`）。`feat-035` 改了 `next.config.ts`，因此源码已与已发布的 `0.3.3` 构建不再逐字节对应（打包产物功能等价：那一份 `browsers.json` 原本就被 prepare-desktop 的整包拷贝覆盖进去）。是否 bump `0.3.4` 并重跑 `npm run desktop:release` 待用户决定；无论哪种选择都不要移动已发布的 tag 与产物。**用户已选 B（2026-09-21）：保持 `0.3.3`，只把修复提交在 tag 之上，不重跑门禁、不动发布物**；因此本机 `main` 会领先 `v0.3.3` 一个提交，这是刻意接受的状态
- Branch: `main`；`feat-031` + `feat-032` 已提交（`af7f6db`）并作为 `v0.3.1` 发布；`feat-033` 已提交（`1c3ed80`）并作为 `v0.3.2` 发布；本轮 `feat-034`（去掉重复的 Electron 运行时 + 版本 `0.3.3`）已提交（`3897cd1`）并作为 `v0.3.3` 发布
- Scope: unsigned Apple Silicon Mac personal-test application; macOS 12.0+

## 已完成 in 0.3.3 之后（standalone 可加载 + 真实转换处理器回归，feat-035 done，2026-09-21）

- 来源：本机同步到 `0.3.3` 时复核 `feat-034` 的裁剪，顺带发现一个**早于 0.3.3** 的缺口：`.next/standalone` 里没有 `node_modules/playwright-core/browsers.json`（Next.js 输出追踪跟到了 `playwright-core` 的静态 require，却漏掉它运行时读的那个数据文件），因此 standalone 服务对任何链接都返回 500（本机实测 `Failed to load external module playwright-…: Cannot find module …/playwright-core/browsers.json`）。`scripts/prepare-desktop.mjs` 的「整包重拷」把这个问题从发布物里盖住了。
- 附带发现：`e2e/home.spec.ts` 全局拦截 `**/api/convert`，`paste.spec.ts` / `translate.spec.ts` 只 mock `convert-paste`，所以**没有任何 e2e 用例触达真实转换处理器** —— 这正是该缺口能连过两次门禁（178 passed）的原因。
- 修复（TDD，先红后绿）：新增 `e2e/convert-api.spec.ts`（用 `request` fixture，不经浏览器拦截）—— 提交回环链接必须得到 403 `PRIVATE_TARGET`（离线，但只有路由成功加载 Playwright 依赖后才可能返回），并通过真实 paste 路由提取一次真实粘贴内容。RED：在未修构建上 `Expected: 403 / Received: 500`；GREEN：`next.config.ts` 加 `outputFileTracingIncludes: { "/api/convert": ["node_modules/playwright-core/browsers.json"] }`（只加这一个文件、只对这一个路由）后通过。
- 实证（修复后）：`.next/standalone/node_modules/playwright-core/browsers.json` 存在（1,939 bytes）；standalone 的 playwright 能 `chromium.launch()` + `setContent`；用 production standalone（`scripts/start-e2e-server.mjs`）对真实公网页发 `POST /api/convert` ⇒ **HTTP 200 / 3.06s / `extractionMode=browser` / textChars 3812 / 内嵌图 1 / 无 warning**，说明追踪到的那一个文件对动态渲染路径也够用。
- 决定（用户 2026-09-21 选 B）：保持 `0.3.3`，不改版本号、不重跑 `npm run desktop:release`，只把修复提交在 `v0.3.3` 之上；源码与已发布的 `0.3.3` ZIP 不再逐字节对应（打包产物文件级等价：`prepare-desktop` 的整包拷贝本来就提供 `browsers.json`；实测本机新包 2725 文件 vs 已装 0.3.3 的 2716，差异只有 3 个 build-hash 静态文件与 `@emnapi/runtime` / `@img/sharp-wasm32` 这两个可选 wasm 回退包）。
- 全量验证（Node.js 24.15.0）：`./init.sh` **exit 0**（62 files / **859 tests**，statements 95.28%）；`npm run test:e2e` **exit 0，184 passed / 2 skipped**（较 178 增 6 = 新增 2 用例 × 3 引擎）；`npm run desktop:package` **exit 0**，产物版本 `0.3.3`、`server/node_modules/electron` 不存在、`playwright-core/browsers.json` 在（1,939 bytes）。
- 已知残余：真实公网 URL 的抓取 + 浏览器渲染无法做离线 e2e（SSRF 策略按设计拒绝回环地址），只能由 `tests/live` 与上面那次手工 200 验证覆盖。

## 已完成 in 0.3.3 之后（云端卡片的清除变为整卡重置，feat-037 done，2026-09-21）

- 来源：用户提出「云端 Provider 设置里的『清除』只是清除 API Key，应该上移到卡片右上角（和保存并列），并且变成清除所有已填入/选择的信息」。按 AGENTS.md 先做需求分析（读码取证 + 两问）；用户选 **Q1①**（连密钥库与 `settings.json` 里的这条 Provider 一起清掉，回到全新未配置状态）与 **Q2②**（头部只留一个「清除」，要换密钥就清掉后重填整张卡片）。
- 实现（TDD，先红后绿）：`src/app/settings/page.tsx` 的 `clearCloudKey()` 改为 `clearCloudProvider()` —— `bridge.clear(provider.id)` 删密钥库 → `setCloudForm(EMPTY_CLOUD_DRAFT)` 把整张表单（含未保存的输入）清空 → `save({cloud: {providers: [], activeProviderId: null}})`，提示「已清除云端配置。」；`providers: []` + `activeProviderId: null` 就是契约的默认值（**未升 `SETTINGS_VERSION`、无迁移、不新增键**），引擎遇到空列表走已有 409 `TRANSLATE_NOT_CONFIGURED`「尚未选择云端 Provider。」。按钮移入卡片头部 `[清除][保存]`（清除在左），密钥行里的按钮删除，占位文案改为「••••••••（已保存，清除后可重新填写）」。按钮只要卡片渲染就显示（未配置时它同时充当「重置输入」），`saving` 时禁用。
- RED：重写「清除」用例 + 扩展头部布局用例 ⇒ 未改动构建上 **2 failed / 22 passed**（新用例停在 `getByRole("button", {name: "清除", exact: true}).click()`）；GREEN 同文件 chromium **24 passed**；`./init.sh` exit 0（62 files / **859 tests**、statements 95.28%）；三浏览器 `npm run test:e2e` exit 0 ⇒ **187 passed / 2 skipped**。
- 手工探针（production standalone + 路由 mock 的 settings API，1180×900 / 2x）：头部按钮 `清除 x=852 y=471` / `保存 x=919 y=471`（都在「名称」上方）、密钥行按钮 0 个；点击后 PUT body `{providers: [], activeProviderId: null}`、`secretCalls ["clear", "ollama"]`、徽标「未配置」、四个字段全空、密钥框恢复可编辑；截图 `/tmp/clear-card-before.png` / `/tmp/clear-card-after.png`。
- 已知上限：没有 preload 桥时无法删密钥库条目，因此「桌面应用保存过密钥 + 用无桥页面清除」会留下一个没人引用的密钥（与保存失败时的孤立密钥同一类，本轮不变差）；「清除」不区分有没有东西可清，未配置时也照样写一次空设置。

## 已完成 in 0.3.3 之后（抓取失败时提示改用粘贴，feat-036 done，2026-09-21）

- 来源：用户反馈「一旦 URL 抓取不到就直接报错，是不是应该提醒可以改用粘贴富文本」。范围按原话收窄到**服务端抓取失败**（需要登录、被反爬拦截、拒绝访问、超时等），不触碰接口、契约、引擎与设置。
- 实现（TDD，先红后绿）：`src/app/page.tsx` 新增 `linkFetchFailed` 状态（在 `runConversion` 的 `catch` 里按 `conversionMode === "link"` 置位，每次新尝试与取消路径都不保留），仅在 `mode === "link" && requestState === "error" && linkFetchFailed` 时于错误卡片下方渲染一行提示与「改用富文本粘贴」按钮；处理器 `switchToPasteMode()` 复用已有 `switchPasteMode`，并按页面既有惯例把焦点移到 `paste-tab`（不新增 IPC、不加新请求）。样式新增 `.errorHint` / `.errorHintAction`（`text-decoration: underline` 的纯文字按钮，`--accent-dark`），未改动 `.errorCard`（翻译失败卡片仍共用它）。
- RED：新增用例在改动前超时等待 `getByRole("button", { name: "改用富文本粘贴" })`，同文件 13 passed；GREEN：同文件 chromium 14 passed，全量 `npm run test:e2e` **187 passed / 2 skipped**（较 feat-035 的 184 多 3 = 新用例 × 3 引擎）。`./init.sh` exit 0（62 files / **859 tests**、statements 95.28%）。
- 真机探针（production standalone，1180×900 / 2x）：提示按钮 `x=636 y=613`、`color rgb(15, 81, 71)`；点击后 `富文本转换` tab `aria-selected=true`、`document.activeElement.id === "paste-tab"`；截图 `/tmp/hint-error.png`。重跑 `npm run desktop:package` 与 `npm run desktop:release` **未做**（本轮不发布）。
- 已知上限：提示按「服务端失败」判定，不区分错误码，因此对粘贴也救不回来的失败（如 413 源过大）同样会显示；页面本来就不可达的 `convertLink` 客户端校验分支不会显示（`convert` 按钮在 URL 非法时禁用）。

## 已完成 in 0.3.3（去掉重复的 Electron 运行时，feat-034 done）

- 现象与根因：用户报告「跑得好慢」，实测发现 `electron-forge make` 在本机**经常空跑**：直接运行它既不产出 ZIP 也不报错（退出码 0），而发布脚本本身有产物校验（缺 ZIP 会抛 `Expected ZIP was not generated`），所以空跑/卡住的是 Forge 这一层。根因分两层：① 应用被装了**两份** Electron —— `next build` 的输出追踪跟着 `playwright-core` 里那句 `require("electron")` 把整个 `electron` npm 包（下载包约 276 MB，解压后目录实测 295 MB）拷进了 `.next/standalone`，而应用自己的服务端代码**零处**引用 electron；② 本机默认 Node **v24.16.0** 在解压 electron zip 时卡死在 204727/272259 字节（yauzl 管道回归），换 nvm 里的 **v24.14.1** 后 forge 一次通过（另一台机器是 24.15.0，因此从未遇到）。
- 修复（TDD，先红后绿）：`scripts/prepare-desktop.mjs` 在 `cp(sourceRoot, targetRoot, …)` 之后加一句 `rm(targetRoot/node_modules/electron)`（含 4 行注释说明这份是多余的）；`scripts/prepare-desktop.test.mjs` 新增集成回归，要求最终 server 不含 `node_modules/electron`，同时保留 Playwright、Playwright Core、Sharp arm64 包与内置 Chromium Headless Shell —— RED 时该用例失败，GREEN 后通过。
- 版本 `0.3.3`（TDD）：`scripts/release-guards.test.mjs` 先把 fixture 从 `0.3.2` 改到 `0.3.3` ⇒ RED **5 failed / 24 passed**（报错正是 `Release version must be 0.3.2.`），再改 `scripts/release-desktop.mjs`、`package.json`、`package-lock.json`、`feature_list.json` ⇒ 全部通过。
- 门禁：`npm run desktop:release`（Node.js **24.14.1**）在 2026-09-20 **exit 0**（日志 `/tmp/s18b-release.log`）—— `./init.sh` 62 files / **859 tests**、statements 95.28%、三浏览器 e2e **178 passed / 2 skipped**、live **2/2**、`electron-forge make` 与产物校验通过。
- 产物与体积：`out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.3.zip`，`232,947,408` bytes，SHA-256 `1bf807dfe294860c24345efe5caf2b0fcbd54f88476df7085c9bd03b47b37a72`；对比 `0.3.2` 的 `358,726,788` bytes 少 **125,779,380 bytes ≈ 120 MiB（−35%）**，未压缩应用 843 MB → **539 MB**（与早前记录过的 `538.86 MiB` 一致，说明裁剪结果可复现）。
- 独立复核：ZIP 内 `server/node_modules/electron` 条目数 = **0**，而 `playwright` / `playwright-core` / `next` / `chrome-headless-shell` 都还在。
- 安装与冒烟：`/Applications/MD-Convertor.app` 由 `0.3.2` 替换为 `0.3.3`（旧版备份 `/tmp/s18-old-0.3.2.app`），安装后以 `ELECTRON_SMOKE_TEST=1 ELECTRON_SMOKE_TEST_SECRETS=1` 跑安装后的应用 **exit 0**（日志 `/tmp/s18-smoke.log`）：`Preload bridge smoke passed: secrets.set function, encryptionAvailable true`、`Runtime secret smoke passed: TRANSLATE_NOT_CONFIGURED → TRANSLATE_PROVIDER_ERROR → TRANSLATE_NOT_CONFIGURED`。
- 已知误报：pi-lens 对 `scripts/prepare-desktop.mjs` 的 L10 / L22 报「`JSON.parse` 未包 try/catch」。这两行是**改动前就有的**（HEAD 逐字节相同，属顶层读依赖 `package.json` 的既有写法），本轮 diff 只动了第 38 行附近 4 行；且该建议在此场景下是错的——构建准备脚本读不到自己的依赖就该立刻失败，包起来只会把装坏的依赖藏住。未改动。
- 未做：不改打包配置与图标素材，不动依赖、端点策略、翻译引擎；`0.3.2` 的产物与已发布 tag 一律不动；签名/notarization 仍按用户决定不做。

## 已完成 in 0.3.2（程序坞幽灵图标，feat-033 done）

- 现象与根因：打包应用运行期间，程序坞会出现第二个通用黑色可执行文件图标，一直跳动不停。根因在 `electron/main.mjs` 的 `spawn(process.execPath, [serverEntry], …)` —— `process.execPath` 是应用包自己的主可执行文件，LaunchServices 因此把 Node 子进程当成「第二次启动 MD-Convertor」，为它建了一个 Foreground/APPL 的 Dock 项；而该子进程从不连接 WindowServer，于是图标永远跳不完。
- 修复（TDD，先红后绿）：新增纯模块 `electron/server-binary.mjs`，导出 `resolveServerBinary(execPath)` ⇒ `Contents/Frameworks/<基名> Helper.app/Contents/MacOS/<基名> Helper`；`electron/main.mjs` 改用它启服务（仍是同一个 Electron 二进制，靠 `ELECTRON_RUN_AS_NODE=1` 以 Node 运行）。helper bundle 声明了 `LSUIElement`，因此不再占程序坞；helper 缺失时抛 `Desktop helper runtime is missing: <path>`，不会静默回退。无需改打包配置、无需新增素材。
- 版本 `0.3.2`（TDD）：`scripts/release-guards.test.mjs` 先把 8 处 fixture 从 `0.3.1` 改到 `0.3.2` ⇒ RED **5 failed / 24 passed**（其中 3 个来自新模块 `server-binary.test.mjs`），再把 `scripts/release-desktop.mjs`、`package.json`、`package-lock.json`、`feature_list.json` 改为 `0.3.2` ⇒ **32 passed**。
- 真机证据（打包应用与安装后应用均验）：修复前 `lsappinfo` 里子进程 `next-server … bundle path=…/MD-Convertor.app … type="Foreground" parentASN="MD-Convertor"`；修复后为 `bundle path=…/Contents/Frameworks/MD-Convertor Helper.app … type="UIElement" Version="0.3.2"`。程序坞截图 `/tmp/icontest/pair-before.png`（应用图标 + 黑色 exec）与 `pair-after.png` / `pair-installed.png`（只剩应用图标）。
- 门禁：`npm run desktop:release`（Node.js 24.15.0）在 2026-09-20 **exit 0**（日志 `/tmp/s17-release.log`）—— `./init.sh` 62 files / **858 tests**、statements 95.28%、三浏览器 e2e **178 passed / 2 skipped**、live **2/2**、`electron-forge make` 与产物校验通过；产物 `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.2.zip`，`358,726,788` bytes，SHA-256 `8fb7a93f33a07bb03b0b8558df4ff0c2abe40a14eee13fd9dc0348fedcc7f1ba`。
- 独立复核：`unzip -t` 无错、`CFBundleShortVersionString` = `0.3.2`、`file` = Mach-O arm64、asar 内含 `/electron/server-binary.mjs`、包内 Michroma woff2 与仓库文件同哈希。
- 安装与验证：`/Applications/MD-Convertor.app` 由 `0.3.1` 替换为 `0.3.2`（旧版备份 `/tmp/s17-old-0.3.1.app`），启动后子进程 `pid 39494` 挂在 `Contents/Frameworks/MD-Convertor Helper.app` 上、`type="UIElement"`，程序坞无额外图标；`settings.json` SHA-256 未变（`93204f32…30b4`）。
- 未做：不改打包配置与图标素材，不动依赖、端点策略、翻译引擎；签名/notarization 仍按用户决定不做。

## Completed in 0.2.1

- Fixed WeChat-style code blocks in which one `<pre>` contains multiple sibling `<code>` nodes. All lines, blank lines, `<br>` breaks, indentation, entities, nested text, and code punctuation are preserved.
- Added redacted unit regressions and an in-memory per-code-block comparison for the user-supplied WeChat article. No webpage body is saved or printed.
- Moved completed plans, task records, prior state snapshots, WorkBuddy data, and release ZIPs through 0.2.0 to `~/Downloads/MD-Convertor-archive/`.
- Changed release guards to verify the immutable historical ZIP manifest from the external archive instead of retaining old builds in the repository workspace.
- Removed completed PLAN/TASK documents from the current working tree; Git history remains intact.

## 已完成 in 0.3.0 S1（设置基建，feat-018 done）

- 设置契约与校验：`src/types/settings.ts`（严格白名单校验，`SettingsValidationError` 只报字段路径）。
- 设置存储：`src/lib/settings/paths.ts` / `store.ts`，`settings.json` 临时文件 + rename 原子写入且权限 0600；目录由 `MD_CONVERTOR_USER_DATA` 决定，缺省 `~/.md-convertor`。
- 本地 API：`src/app/api/settings/route.ts` 的 `GET/PUT /api/settings`，受 `validateConvertApiCaller` 保护；PUT 体积上限 64 KiB（超限 413 `REQUEST_TOO_LARGE`），错误码 `INVALID_SETTINGS`(400) / `SETTINGS_STORE_ERROR`(409) / `SETTINGS_UNAVAILABLE`(500)，日志只含 `{requestId,status,code,durationMs}`。
- 主进程环境注入：`electron/env.mjs`（PATH 合并、登录 shell PATH、`.env` 解析、`buildServerEnv` 注入 `MD_CONVERTOR_USER_DATA`/`MD_CONVERTOR_SECRETS`）。
- 密钥库：`electron/secrets.mjs` 用 `safeStorage` 加密，`secrets.json` 同样 0600 原子写入；`secrets.json` 不可解析时拒绝覆写（`SECRETS_FILE_INVALID`）。
- preload 桥与 IPC：`electron/preload.cjs`（自包含）+ `electron/preload-contract.cjs`（通道契约，主进程共用）；通道 `md-convertor:secrets:{set,clear,status}`，IPC 失败只返回 `{ok:false,code:"IPC_FAILED"}`，不回传 message。
- 设置页：`src/app/settings/page.tsx` + `page.module.css`，页头齿轮入口；密钥面板仅在 `window.mdConvertor` 存在时渲染。
- 验证登记：`feature_list.json` 中 `feat-018` 置为 `done` 并附证据；`e2e/settings.spec.ts` 新增 7 个用例。

## 已完成 in 0.3.0 S2（Provider / 模型与语言设置，feat-019 done）

- Provider 端点策略：`src/lib/provider/endpoint.ts`——允许 unicast/loopback/private/uniqueLocal/carrierGradeNat，单独拉黑云元数据地址（`169.254.169.254`、`fd00:ec2::254`、`100.100.100.200`，含 IPv4-mapped IPv6 归一化）；重定向只允许同协议同主机，最多 3 跳。**与网页抓取 SSRF 策略 `src/lib/security/url.ts` 是两套独立实现**：抓取保持公网限定，翻译端点必须可达本机/私网，两边不互相放宽。
- 密钥解析：`src/lib/provider/credentials.ts`——`resolveProviderKey({id, apiKeyEnv})` 同步返回 `{key, source: "env" | "runtime"} | null`，顺序为 `process.env[apiKeyEnv]` → 运行时密钥表（由 `MD_CONVERTOR_SECRETS` 惰性播种）；`setRuntimeSecret` / `resetRuntimeSecrets`（测试钩子）。`<userData>/.env` 通过主进程环境注入进入第 1 步。
- 模型拉取：`src/lib/provider/models.ts`——`listProviderModels` 以 `authorization: Bearer` 请求 `{base}/models`，空密钥返回 409 `TRANSLATE_NOT_CONFIGURED`，失败返回 502 `TRANSLATE_PROVIDER_ERROR`（消息只含状态码与主机名）。
- 本地 CLI：`src/lib/local-cli/registry.ts`（`pi` 用 `--list-models`，`claude` 无列表命令 ⇒ `listModelsArgs: null`）、`scan.ts`（按 `PATH` 探测）、`models.ts`（`parseCliModelList` 解析表格、`runCliCommand` 以 `shell:false`、1 MiB 上限、超时 SIGKILL 执行，子进程环境剔除所有 `MD_CONVERTOR_*`）。
- 语言：`src/lib/settings/languages.ts`——11 个预置目标语言 + `addCustomLanguage`（BCP-47 校验失败只报字段路径，不回显值）。
- 四个本地 API：`/api/provider/models`、`/api/local-clis/scan`、`/api/local-clis/models`、`/api/runtime/secrets`，共用 `src/lib/local-api.ts`（`handleLocalApi` / `readJsonBody` / `readField`，体积上限 64 KiB，日志只含 `{requestId,status,code,durationMs}`）；错误码 `INVALID_PROVIDER_ID`/`INVALID_CLI_ID`/`INVALID_SECRET_VALUE`(400)、`TRANSLATE_NOT_CONFIGURED`(409)、`TRANSLATE_PROVIDER_ERROR`(502)。S1 的 `/api/settings` 路由未改动。
- 设置页四节（`src/app/settings/page.tsx` + `client.ts` + `page.module.css`）：Provider 增删改选/模型拉取与手填/密钥保存与清除、本地 CLI 扫描与启停、目标语言与自定义标签、默认翻译开关；无 preload 时只显示「密钥只能通过桌面应用保存」提示。
- 密钥即时生效：`electron/runtime-secrets.mjs` 把已保存/已删除的密钥推送到运行中的本地服务（`POST /api/runtime/secrets`），`electron/main.mjs` 在 `secrets.set`/`secrets.clear` 后 await 该推送，因此无需重启；删除后回退到环境变量/`.env`。推送失败只告警不抛出（密钥已安全落盘，下次启动生效）。

## 已完成 in 0.3.0 S3（翻译引擎，feat-020 done）

- 分段与重组：`src/lib/translate/segment.ts`——A 层按行结构分类（标题/列表/引用/表格/围栏代码/HTML 块/元信息行），B 层把行内受保护片段（代码 span、链接、图片、自动链接、HTML 标签、裸 URL）切成 `kind:"skip"` 段，URL 与标签原文放在 `prefix`/`suffix`。**逐字节一致由构造保证**：每段是有序的原始字符区间，重组只是按序拼接 + 替换 `text` 段，不依赖模型守约。表格行按单元格切分（管道永不进入 `text`，转义 `\|` 不算分隔符）；`> 转换时间：`/`> 来源：` 两行均跳过。`assertBlockAlignment(segments, blocks)` 块数不一致时抛 409 `TRANSLATE_ANALYSIS_STALE`。
- 契约与解析：`src/lib/translate/prompt.ts`——`buildAnalyzeMessages` / `buildTranslateMessages`（翻译调用比判定调用多一行前缀 `Target language: <tag>`）、`readEnvelope`（剥最外层围栏、取最外层 `{…}`）、`readEntries`（编号集合必须完全相等、不得重复、数量一致、值必须是字符串）、`parseAnalyzeResponse`（校验 BCP-47）、`parseTranslateResponse`（拒绝空串与 trim 后为空、拒绝被围栏包裹的 `t`）；`requestWithRetry` 只对 `TRANSLATE_INVALID_RESPONSE` 重试一次；所有解析失败统一 502。
- 限额：`src/lib/translate/limits.ts`——200,000 散文字符、批次 ≤20 块且 ≤8,000 字符（超长单块自成一批，绝不切块）、单次调用 60s、任务总 120s、请求体 40 MiB（markdown 含 base64 图片，故不能用 64 KiB 的本地 API 上限）。
- Provider 解析与调用：`src/lib/translate/provider/provider.ts`——`resolveEffectiveModel(settings, env)` 依次判定 `MD_CONVERTOR_TEST_PROVIDER` → cloud（active Provider + `selectedModel`）→ local（active CLI + `enabled` + `detectedPath`），失败一律 409；`createModelCaller(config, {deps, signal, timeoutMs})` 把信号与超时绑定进 `ModelCaller`（`(messages) => Promise<string>`），cloud 档在建 caller 时提前解析密钥（缺失 409）。HTTP 适配器 `openai-compatible.ts` 走 `fetchProviderEndpoint`（S2 端点策略原样复用，未放宽抓取侧 SSRF 策略），Bearer + `stream:false`，非 2xx 只报主机名与状态码；CLI 适配器 `local-cli.ts` 参数取自 T3.1 探针结论（pi：`-p --no-tools --no-session --no-extensions --no-skills --no-context-files --mode text`；claude：`-p --tools "" --output-format text`），prompt 只走 stdin，cwd 为一次性临时目录，非零退出/空 stdout ⇒ 502，超时 ⇒ 504，取消 ⇒ 499，CLI 输出永不回显。
- 引擎：`src/lib/translate/run.ts`——`analyzeTranslation` / `runTranslation` 共用一个进程内任务锁（并发 ⇒ 429 `TRANSLATE_BUSY`）；任务总超时用 `AbortSignal.timeout` 与调用方 `AbortSignal` 合并，超时映射 504、调用方取消映射 499；`scope:"non-target"` 只翻译标记为 `other`/`unknown` 的块，无可译块时原文返回并给出警告「没有需要翻译的段落。」；`batchBlocks` 导出以便测试。
- 判定统计：`src/lib/translate/analysis.ts` + `src/types/translation.ts`——占比按字符数（`skipped` 为 0 字符并计入块列表，`totalChars`/`targetChars` 只统计非 skipped 块），语言比较用 BCP-47 主标签。
- 端点：`src/app/api/translate/analyze/route.ts`、`run/route.ts` 共用 `src/lib/translate/request.ts`（`readAnalyzeBody` / `readRunBody`），全部经 `validateConvertApiCaller`；请求体上限 40 MiB；错误码 `INVALID_REQUEST_BODY`/`INVALID_TARGET_LANGUAGE`/`INVALID_ANALYSIS`/`INVALID_SCOPE`(400) 与引擎错误码原样透传；响应与日志都不含正文、密钥或 CLI 输出。
- 测试桩：`MD_CONVERTOR_TEST_PROVIDER=1` 时 `resolveEffectiveModel` 直接返回 `kind:"test"`（连 settings 都不读），判定按块内是否含 CJK 返回 `zh-Hans`/`en`，翻译返回 `[<lang>] <text>`；未设置时该分支不可达。生产路径不依赖它。
- 未改动 `currentVersion`（仍为 `0.2.1`），未启动任何 UI（S4 负责），未运行 `npm run desktop:release`。本轮无用户可见变化，故未改 `CHANGELOG.md`（翻译 UI 属 S4/S5；`[Unreleased]` 里「翻译尚未可用」的说明仍然成立）。

## 已完成 in 0.3.0 S4（前端翻译交互，feat-021 done）

- 纯函数与客户端：`src/lib/translate/filename.ts`（`languageSuffix` / `translatedFilename`，译文下载名形如 `文章-en.md`）、`src/lib/translate/client.ts`（`analyzeDocument` / `translateDocument` / `TranslationError` / `isCancelled` / `TRANSLATE_CANCELLED`；abort ⇒ 499 `TRANSLATE_CANCELLED`，fetch 失败 ⇒ 0 `TRANSLATE_NETWORK_ERROR`，错误文案优先用服务端 `error.message`）。两者已在 `vitest.config.ts` 设逐文件 coverage 门槛。
- 页面（`src/app/page.tsx` + `page.module.css`）：链接与富文本两个面板共用同一个「翻译为 <目标语言>」勾选框（初始值取 settings 的 `translation.defaultEnabled`，读取失败时不显示勾选框，不在本机持久化）；转换成功且勾选时自动翻译；结果区在翻译任务开始时出现「原文 / 译文」双 Tab（方向键/Home/End 可切换），未启用翻译时结果区 DOM 与 0.2.1 一致。
- 复制与下载跟随当前 Tab：译文 Tab 复制译文、下载名带语言后缀；译文未就绪时静默回落原文。
- 进度/取消/失败重试：`analyzing` 与 `translating` 各有文案与「取消」按钮（`AbortController` 中断在途请求）；失败显示 `role="alert"` 与「重试」（复用已有 `analysis`，不重新判定）；未配置翻译模型（409 `TRANSLATE_NOT_CONFIGURED`）时不出现 Tab，只显示提示与 `设置` 链接。
- 未做（属 S5）：占比弹窗、≥97% 提示（S5 已完成，见下节；阈值开关最终未纳入 S5 范围）；`decideTranslationScope()` 当时恒返回 `"all"`，是 S5 的唯一接入点，S5 已用 `decideTranslation()` + `translationScopeRef` 取代它。
- 测试接入：`scripts/start-e2e-server.mjs` 增设 `MD_CONVERTOR_TEST_PROVIDER=1`（测试桩唯一开关）；新增 `e2e/translate.spec.ts` 8 个用例 × 3 浏览器；`playwright.config.ts` 设 `workers: 1`（进程级翻译锁会被并行用例撞出 429）。
- 未改动 `currentVersion`（仍为 `0.2.1`），未运行 `npm run desktop:release`。

## 已完成 in 0.3.0 S5（语言占比判定与局部翻译，feat-022 done）

- 决策纯函数：`src/lib/translate/decision.ts`——导出 `SKIP_RATIO = 0.97`、`CONFIRM_RATIO = 0.7` 与 `decideTranslation(analysis)`；先判 `totalChars === 0`（⇒ `{action:"skip",reason:"empty"}`），再 `ratio >= 0.97`（⇒ `skip` / `target-language`），再 `ratio >= 0.70`（⇒ `confirm`），否则 `translate-all`；比较用原始 `ratio`，展示用 `Math.round(ratio*100)`（0.9699 ⇒ confirm 97%，0.97 ⇒ skip 97%）。逐文件 coverage 门槛 95/90/100/95，实测 100%。
- 局部翻译保真由 golden 用例锁定（`src/lib/translate/run.test.ts`）：测试用 Provider 把每个被翻译块包成 `«…»`，断言（a）标记后的输出逐字符等于预期文本，（b）去掉标记后与输入逐字节一致，（c）全部 5 个目标语言分段原样保留且从未被包裹，（d）其余 11 个分段都被包裹，（e）`meta` 为 `scope: "non-target"`、`translatedBlocks: 11`。fixture 覆盖标题、行内代码、链接、同行的中英表格单元格、粗体、列表、引用、围栏代码与尾段。
- 页面接入（`src/app/page.tsx`）：删除 S4 的 `decideTranslationScope()` 占位函数，改调 `decideTranslation()`；翻译状态机新增 `{status:"confirming",analysis,percent}` 与 `{status:"skipped",reason:"target-language"|"empty"|"declined"}`，`showResultTabs` 同时排除这两个状态（因此不会留下空译文 Tab）。
- 确认框：原生 `<dialog>`（`useEffect` 里 `showModal()`/`close()`，Esc ⇒ 按「不翻译」处理，`aria-labelledby` 指向提示文案），两个按钮「不翻译」与「只翻译非目标语言部分」（后者 ⇒ `scope="non-target"`）；选择结果存在 `translationScopeRef`（每次新转换重置为 `"all"`），重试复用该选择，**不再二次弹窗**。
- 提示行：≥97% ⇒「正文已是<目标语言>，无需翻译」；空散文 ⇒「正文没有可翻译的段落，无需翻译。」；选择「不翻译」⇒「已选择不翻译，结果保留原文。」。三条路径都**不发起 `run` 请求**。
- 样式：`src/app/page.module.css` 新增 `.confirmDialog`（含 `::backdrop`）、`.confirmText`、`.confirmActions`。
- e2e 占比构造方式：只 mock `/api/translate/analyze`（`route.fetch()` 后改写 `totalChars`/`targetChars`/`ratio` 与 `blocks[].language`，fixture 为 10 个等长段落，故 N/10 为精确占比），`/api/translate/run` 走真实端点——这正是端到端证伪不了局部翻译保真的原因。
- 未改动 `currentVersion`（仍为 `0.2.1`），未运行 `npm run desktop:release`。

## 已完成 in 0.3.0 S6（发布门禁与文档，feat-023 done）

- T6.1（done）：`scripts/release-guards.test.mjs` 先改到 RED（4 failed / 21 passed，日志 `/tmp/s6-t61-red.log`），再把 `scripts/release-desktop.mjs` 的目标版本与 `package.json`/`package-lock.json` 版本字段改为 `0.3.0`，`npm test -- release-guards` 25 passed。
- T6.2（done，无需改动）：`vitest.config.ts` 早已把 `src/lib/**/*.ts` 纳入 `include` 并对每个 `src/lib/translate/**` 模块设了逐文件门槛，无缺口可补。
- T6.3（done）：六份文档及其 `.zh.md` 镜像已按 PRD §5 与实现更新（PRODUCT 删除「不使用 AI API/密钥」非目标并改写隐私段；ARCHITECTURE 补本地 API 与密钥存储、两套地址策略的差异、CLI 进程边界；TESTING 补翻译验证面与测试桩开关；QUALITY-AUDIT 补 QA-009/010/011 与复验清单；README 中英说明翻译前置；AGENTS 补规划文档读取时机并同步版本号）。`grep` 复核无残留冲突表述。
- T6.4（done，经用户授权改门禁语义）：用户选择方案 A，即「历史归档缺失不再阻断发布，但存在的归档照旧校验」。守卫改动仍走 TDD：`release-guards.test.mjs` → RED 6 failed / 23 passed（`/tmp/s6-t64a-red.log`），把 0.2.1 加入 `PROTECTED_HISTORICAL_ZIP_MANIFEST` 又是一轮 RED（1 failed / 28 passed），最终 29 passed。`assertProtectedArchive` 缺文件返回 `{status:"retired"}`，`captureHistoricalZipSnapshot` 只对存在的条目校验哈希、缺失项记为 retired，新增 `listRetiredHistoricalZips()` 与 `HISTORICAL_ARCHIVE_RETIRED_NOTICE`，`release-desktop.mjs` 在结尾打印退役公告；被改动/可写的归档、未登记的发布 ZIP、`v0.1.3` 标签仍会硬失败。
- T6.4 锚点恢复：`MD-Convertor-darwin-arm64-0.2.1.zip` 从 GitHub `v0.2.1` release 重下到 `~/Downloads/MD-Convertor-archive/releases/`，SHA-256 `32c1d96a…463e` 与记录逐字节一致（354,635,067 bytes，`unzip -t` 无错），因此该条目重新被强制校验。
- T6.4 门禁通过：`npm run desktop:release`（Node.js 24.15.0）在 2026-09-18 exit 0，依次跑完 `./init.sh`、`npm run test:e2e`、`npm run test:live`、`electron-forge make` 与产物校验，输出 `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.0.zip`、版本 `0.3.0`、arm64、`358,562,540` bytes、SHA-256 `2a0e236e…1147`，并列出 5 个退役 ZIP 与退役的 0.1.3 副本（日志 `/tmp/s6-release-3.log`，0 条 ERROR）。
- T6.5（done）：`./init.sh` 58 files / 835 tests、statements 95.25%、lint/tsc/build 全绿；`npm run test:e2e` 三浏览器 142 passed / 2 skipped 且 tracked-file 检查通过；`npm run test:live` 2/2 passed；打包应用冒烟 exit 0，打印 `Preload bridge smoke passed: secrets.set function, encryptionAvailable true` 与 `Runtime secret smoke passed: TRANSLATE_NOT_CONFIGURED → TRANSLATE_PROVIDER_ERROR → TRANSLATE_NOT_CONFIGURED, env fallback TRANSLATE_PROVIDER_ERROR`。
- T6.6（done）：`CHANGELOG.md`(+zh) 的 `[Unreleased]` → `[0.3.0] - 2026-09-18`（含个人测试与归档退役说明），TESTING/QUALITY-AUDIT/README/AGENTS 对齐产物数字与新的守卫语义，`feature_list.json` 的 `feat-023` 置 `done`、`activeFeature` 置 `null`，`session-handoff.md` 同步。
- 本轮新开风险 **QA-012**：`npm audit --omit=dev` 报 1 critical（`next` 16.0.0–16.3.2 的未认证 RCE 公告）、1 high（`sharp` < 0.35.4 libheif）、1 moderate（`baseline-browser-mapping`）；实装 `next@16.3.0`、`sharp@0.35.3`。升依赖不属于 S6 范围，只记录在 `docs/QUALITY-AUDIT.md` 并给出修复路径，等单独授权的一轮处理。

## 已完成 in 0.3.0 之后（长文翻译超时修复，feat-024 done）

- 现象与根因：真机用 `pi` + `deepseek-flash` 翻译一篇 9,100 字文章时，界面报「翻译任务超时」，服务端日志 `{"status":504,"code":"TRANSLATE_TIMEOUT","durationMs":120006}` —— 恰好撞上 `TRANSLATE_TASK_TIMEOUT_MS = 120_000` 这个**固定**总预算。实测 `pi` 本身不慢（同一参数、同一模型：小 prompt 1–2s，8,000 字符批次 7s），因此问题在预算而非 CLI。分批规则是「≤20 块 **且** ≤8,000 字符」，段数多的长文批次数会远超按字符数的直觉估计，固定 120s 必然不够。
- 修复（TDD，先红后绿）：`src/lib/translate/limits.ts` 新增 `TRANSLATE_TASK_BASE_TIMEOUT_MS = 30_000` 与 `translateTaskTimeoutMs(batchCount) = max(120s, 批次数 × 60s + 30s)`；`TRANSLATE_TASK_TIMEOUT_MS` 语义改为「下限」。`src/lib/translate/run.ts` 把分段/分批（纯计算）移到任务锁之外，`analyzeTranslation` 与 `runTranslation` 都用**真实批次数**决定 `AbortSignal.timeout` 预算（`withTask` 新增第 4 个参数，优先级 `deps.taskTimeoutMs`（测试钩子）→ 计算值 → 常量）。单批 60s 上限、200,000 字符上限、429 单任务锁、499 取消映射、504 超时映射全部不变。
- RED/GREEN：新建 `src/lib/translate/limits.test.ts`（3 用例，RED：`translateTaskTimeoutMs` 未定义）；`run.test.ts` 新增「deadline 按批次数放大」（21 个短段落 = 2 批 ⇒ 期望 `120000 + …` 实收 `NaN`，RED）→ 实现后两文件 **27 passed**。
- 文档同步：`docs/PRD-translation.md` Q6.4 与「大文档耗时与成本」、`docs/features/translation/FSD.md` §5 契约表、`docs/features/translation/S3-translation-engine.md` 限额表与错误码表、`CHANGELOG.md`/`CHANGELOG.zh.md` 的 `[Unreleased] → 修复/Fixed`。顺带修掉 T6.6 遗留的 CHANGELOG 结构错误（`[Unreleased]` 与 `[0.3.0]` 重复标题把 0.3.0 内容挂在 Unreleased 下）。
- 真机验证：重新 `npm run desktop:package` 后从 `out/MD-Convertor-darwin-arm64/MD-Convertor.app` 启动（PID 24236），用户用同一篇文章重测**成功**（转换 200 / 1244ms；无 `TRANSLATE_TIMEOUT` 行）。`app.asar` 内已确认含新逻辑 `Math.max(12e4, 6e4 × 批次数 + 3e4)`（13 处引用）。
- 未做（留待决定）：版本号与发布门禁。修复后的构建与 `docs/TESTING.md` 记录的 0.3.0 ZIP 哈希不再对应，需要用户选择 bump `0.3.1` 还是就地重打 `0.3.0`；两者都必须重跑 `npm run desktop:release`。

## 已完成 in 0.3.0 之后（设置页 UI 反馈与页头清理，feat-025 done）

- 来源：用户提出 6 个 UI/UX 问题（云端 Provider 尚未实测，先处理界面）。按 AGENTS.md 先走需求分析：读码 + 截图取证据 → 列逐条方案与 Q1/Q2/Q3 → 用户选 **Q1②**（齿轮改带文字的「⚙ 设置」胶囊）、**Q2①**（只用「入口藏起来」，不动其它）、**Q3①**（「返回转换」改按钮 + 保存状态胶囊，并在离开前等待在途保存）。
- 主页（`src/app/page.tsx` + `page.module.css`）：删除右上角「本机处理 · 不保存内容」（连同 `.privacy` / `.privacyDot` 与窄屏下的 `display: none` 规则），齿轮图标改为带文字的「⚙ 设置」链接（38px 高胶囊、`--ink` 文字、`aria-label`/可见文字均为「设置」）。
- 设置页模式区（`src/app/settings/page.tsx`）：`fieldset` + `legend` 换成标题卡片 `section.card` + `h2`「翻译服务提供方」，`role="radiogroup"` + `aria-label`；根因是 `fieldset{display:flex}` 会把 `legend` 当 flex 项，浏览器便把它画在上边框上、看起来和选项重叠。“当前生效”改为挂在选中项文字右侧偏上的胶囊（`.activeBadge`，`margin-top:-6px` 的 in-flow flex 项，不脱离文档流，因此不会侵入相邻选项）。radio 补 `disabled={saving}`（原 `fieldset disabled` 的语义不再自动生效）。
- 自定义语言入口：删掉输入框 + 「添加语言」按钮及 `customLanguage` state、`addCustomTargetLanguage`，并移除页面里已不可达的 `notes.language` 渲染。**`languages.custom` 字段与 `addCustomLanguage()` 及其单测保留**，存量自定义标签仍出现在目标语言下拉里（e2e 锁定）。
- 保存反馈：`save()` 记录在途 Promise（`pendingSave` ref）并维护 `saveStatus`（`idle`/`saving`/`saved`/`error`）；成功不再写页首 message（`message` 只留错误与备注），改为页头状态胶囊「保存中…」/「已保存」，失败显示「未保存」+ 页首错误文案。「返回转换」由 `Link` 改为 `button` + `router.push("/")`，点击会 await 在途保存，**保存失败则不离开**。
- 测试：`e2e/settings.spec.ts` 重写语言相关用例（新 `模式卡片`、`保存反馈` 两个 describe，`语言与默认开关` 只留切换与「已保存的自定义标签仍可选中、入口不再渲染」），15 处保存断言改用 `getByText("已保存", { exact: true })`，章节标题断言加 `exact: true`（否则「翻译」也会匹配「翻译服务提供方」）；`e2e/home.spec.ts` 新增 `页头` 用例。
- 未做（不属于本次范围）：不改设置契约/校验、不改翻译引擎与限额、不动 `addCustomLanguage` 及其单测、不做依赖升级与版本号决定。

## 已完成 in 0.3.0 之后（云端 Provider 配置体验，feat-026 done）

- 来源：用户实测云端 Provider 配置后提出的 7 个界面问题。按 AGENTS.md 先走需求分析（读码 + 截图 + curl → 逐条方案 + 4 个问题），用户确认：环境变量名与「添加 Provider」都不要；保存后保留输入框；保留「清除密钥」。
- 契约层：`src/types/settings.ts` 删除 `ENV_NAME_PATTERN`/`ENV_NAME` 与 `CloudProviderSettings.apiKeyEnv`，新增 `RETIRED_PROVIDER_KEYS = ["apiKeyEnv"]`，`readFields(value, path, allowed, retired = [])` 容忍退役键 → 旧 `settings.json` 仍可加载、写出时自动丢弃（**未升 `SETTINGS_VERSION`**）。`src/lib/provider/credentials.ts` 删除 `ProviderKeySource` 与 `source`，`resolveProviderKey({ id })` 只读运行时密钥表；`src/lib/translate/provider/provider.ts` 与 `/api/provider/models` 的调用同步收窄。
- 界面层：`src/app/settings/page.tsx` 删除 `addProvider` / `saveProviderFields` / `saveProviderKey`，改为 `saveProvider(provider)`（一个「保存」写名称 + Base URL + 有值时写密钥，失败不部分写入）、`createProvider()`（常驻空卡片 → 列表项，密钥跟到新卡片）、`pullProviderModels()`（先 `saveProvider` 再拉取，用草稿值覆盖写入）、`clearProviderKey()`（清空输入框 + 清库），`removeProvider()` 现在先 `bridge.clear(id)` 再保存列表。
- 卡片结构：`<article aria-label="Provider <名称>">`，头部 = radio + 名称 + 「已配置/未配置」徽标 + 「当前使用」徽标 + `[保存][删除]`；Base URL 与「拉取模型」同一行（`.urlRow`）；模型行与密钥行保持原样。新增常驻 `<article aria-label="新建 Provider">`（字段标签统一用「新建 Provider …」前缀，避免与列表卡片标签重名）。
- 「拉取模型」的保存语义：端点从 `settings.json` 读取 baseUrl 与密钥，所以必须先落盘再拉取；保存失败则不发请求。（**已被 feat-029 推翻**：拉取改为只读端点，草稿模式见 feat-029 一节。）
- 真机验证：重新 `npm run desktop:package` 后启动（端口 50925），CDP 截图确认 Base URL 输入框与「拉取模型」同一行（y=558.47，按钮 x=892 > 输入框 x=596），「环境变量名」「添加 Provider」「保存密钥」均已消失。
- 顺带清理：用户此前删除的 Provider 在 `secrets.json` 中残留一条密钥（`cc3df153-…`），已手工移除；当前只剩活跃 Provider 一条。

## 已完成 in 0.3.0 之后（云端翻译超时与模式标签，feat-027 / feat-028 done）

- 来源：用户实测云端 Provider 报「Provider token-plan-cn.xiaomimimo.com 返回了无法识别的回答」。按 AGENTS.md 先走诊断：真机探针（自撰文本）复现后确认**两个叠加缺陷**——① 单次调用 60s 上限对云端推理模型太短（`reasoning_content` 2,417–4,885 字符 vs `content` 92–246 字符，实测单批 38–60s）；② 在读响应体途中发生的 abort 被 `catch { payload = null }` 吞掉，误报成 502「无法识别的回答」。诊断用一次性回环 shape 代理（只记响应形状、不记正文），`settings.json` 已按字节还原、代理已停。
- 用户选 **A**：单次上限 60s → 180s；`translateTaskTimeoutMs(batchCount) = max(120s, batchCount × 180s + 30s)` 公式不变、只跟常量走，所以任务预算自动跟着放大。
- 误报修复（TDD RED→GREEN）：`src/lib/translate/provider/openai-compatible.ts` 读体 catch 改为 `if (combined.aborted) throw failedCall(error, endpoint.host, signal);`，超时/取消分别映射 504 `TRANSLATE_TIMEOUT` / 499 `TRANSLATE_CANCELLED`；非 abort 的解析失败仍报 502。
- 限额层（TDD RED→GREEN）：`TRANSLATE_CALL_TIMEOUT_MS = 180_000`；`limits.test.ts` 新增「leaves room for the thinking tokens of a reasoning model」，并把「never drops below the base budget」的 1 批断言改为 `上限 + 30s`（1 批现在必然高于 120s 下限）。
- `feat-028`：设置页「当前生效」标签整体删除（切换时会挤动两个选项）——`page.tsx` 去掉 `.activeBadge` span、`page.module.css` 删掉该规则；e2e `模式卡片` 用例改为断言 `当前生效` 计数恒为 0（切换前后）且仍 PUT 新 mode。
- 真机端到端（打包应用，端口 63338 / CDP 9222，自撰探针）：3 段文档 `ANALYZE 200 @ 16.0s`、**`RUN 200 @ 26.8s`**（修复前同一探针恒为 `502 @ 60.0s`）；60 段 / 121 块（用户原始失败场景）`ANALYZE 200 @ 78.9s`、**`RUN 200 @ 284.4s`** 且译文正确，日志无 `TRANSLATE_TIMEOUT`、无正文泄漏。模式单选位置在三次切换前后完全一致（`x/y` 逐项相等）。
- 新开 **QA-013**（`docs/QUALITY-AUDIT.md`）：单次上限变长 ⇒ 卡死的 Provider 会把任务占住更久（任务总预算与「取消」仍兜底），属已接受的取舍。
- 未做：不改批次大小（20 块 / 8,000 字符）、不改 200,000 字符上限与错误码集合、不加「单次上限」设置项、不改端点地址策略。

## 已完成 in 0.3.0 之后（云端 Provider 保存规则与密钥占位，feat-029 done）

- 来源：用户反馈两点 ——（1）每次进 `/settings`，API 密钥输入框都是空的，担心密钥丢了；（2）云端 Provider 需要校验必填项。需求分析中定下的规则：**保存时名称、URL、API 密钥、模型四项必填，缺一项即拒绝保存并提示**；密钥输入框接受「黑点占位」方案（不可选中、不可复制、不参与提交）。
- 提示色：校验不通过、密钥库不可用、拉取失败、模型名为空等**问题类**提示统一用警告色（`page.module.css` 新增 `.warning { color: var(--warning) }`，必须排在 `.status` 之后 —— 同特异性靠源码顺序决胜），进度「正在获取模型…」与成功「已保存。」仍用 `--muted`。`notes` 的取值从字符串改为 `Note = { text, warn? }`，`setNote(key, text, warn = false)` 与 `save(..., {key, text, warn})` 透传，「端点没有返回模型。」也归为警告。
- 表单规则（纯函数 `src/lib/settings/provider-form.ts`）：`providerFormError({name, baseUrl, keyStored, keyInput, selectedModel})` 按表单顺序返回第一条缺失提示 ——「请填写 Provider 名称。」/「请填写完整的 http(s) 接口地址。」（用 `isHttpUrl` 校验 trim 后的值）/「请先填写 API 密钥。」（`!keyStored && !keyInput.trim()`，即库里没有且本次也没填）/「请先拉取或选择模型。」，齐全返回 `null`。`saveProvider()` 与 `createProvider()` 都先过这道闸；不齐全时不写 settings、不写密钥库。
- 死结与解法：卡片填不满就存不了，而「拉取模型」原本必须已有保存过的 Provider（端点按 `providerId` 读 settings + 密钥库）⇒ 新建卡片永远拉不到模型。因此 `POST /api/provider/models` 新增草稿模式：`{baseUrl, apiKey}` 可直接探测（新建卡片），缺的一半回退到已保存的 Provider（已保存卡片改地址或只换密钥时用），仍兼容旧的 `{providerId}`；草稿请求**不写 settings**，用户输入的密钥不回显、不记日志，地址仍走 `parseProviderUrl` 与 Provider 端点策略（非法协议 ⇒ 400 `INVALID_PROVIDER_URL`，无可用密钥 ⇒ 409 `TRANSLATE_NOT_CONFIGURED`「请先填写 API 密钥。」）。
- 拉取不再写盘：`pullProviderModels()`（已保存卡片）与 `pullNewProviderModels()`（新建卡片）都把结果放进本地草稿态（`ProviderDraft.models` / `newProvider.models`），**settings.json 只在用户选模型或点保存时改变**，因此不再有「拉取顺手把半成品写进去」的路径。
- 新建卡片新增模型字段：一个 `<input list>` + `<datalist>`（拉取结果作为候选，同时允许手填，端点不可达时仍能保存），紧邻一个「拉取模型」按钮，用刚填的地址与密钥探测。
- 密钥显示：已配置的 Provider 输入框 `value` 恒为空（页面依旧不读回密钥库），placeholder 为八个黑点加「（已保存，留空不修改）」；未配置时为「请输入 API 密钥」。占位符不可选中/复制/提交，从不写入密钥库。**未新增任何 IPC 通道**，`electron/preload*.cjs` 未改动。
- 测试：`src/lib/settings/provider-form.test.ts`（8 用例，RED 为模块不存在）、`src/app/api/provider/models/route.test.ts` 新增 6 个草稿用例（RED 6 failed / 14 passed → GREEN 20 passed）、`e2e/settings.spec.ts` 新增 3 个用例并改写 3 个旧用例（拉取不再是「先保存草稿」）。
- 真机验证（打包应用，服务端口 52057 / CDP 9222；只走查看与失败路径，未写盘）：用户真实 Provider 的密钥框 `value` 为空且 placeholder 为八个黑点、新建卡片模型字段存在、四个缺失提示按序出现；`settings.json` 内容与 mtime 均未变。
- 未做（非本次范围）：不改设置契约/密钥存储/端点策略/翻译引擎，不改「清除密钥」语义，不做依赖升级与版本号决定。

## 已完成 in 0.3.0 之后（云端配置收敛为单条 + 保存按钮位置，feat-030 done）

- 来源与需求分析：用户改向 ——「只保留一个云端模型录入，不需要可以追加多个模型」，并去掉「当前使用」标签。按 AGENTS.md 先做需求分析，提出三问，用户选 **Q1=A**（单条云端配置，取消多条并存与 active 选择）、**Q2=留**（保留名称字段）、**Q3=不留**（删掉删除按钮）。
- 契约层刻意不动：`cloud.providers[] + activeProviderId` 保持不变，页面只读写「当前生效的那条」（`editingProvider(cloud) = providers.find(id === activeProviderId) ?? providers[0] ?? null`），`保存` 写出单条目列表并把该 id 设为 active。因此**未升 `SETTINGS_VERSION`、不加退役键、无迁移**；用户文件里本来就只有一条 Provider（`Mimo`），无丢失风险。
- 页面（`src/app/settings/page.tsx`）：删除 `drafts` / `newProvider` / `ProviderDraft` / `providerDraft()` / `EMPTY_NEW_PROVIDER` / `NEW_PROVIDER_NOTE` / `patchProvider()` / `removeProvider()` / `createProvider()` / `addManualModel()`，改为单一 `cloudForm: CloudDraft`（`{name, baseUrl, keyInput, selectedModel, models}`）+ `patchCloudForm()` + `saveCloudProvider()` + `pullCloudModels()` + `clearCloudKey()`。JSX 只剩一张 `<article aria-label="云端 Provider">`：头部 `[已配置/未配置] + 保存`（`.providerHead .actions` 右对齐，沿用上一轮的位置约定），字段 名称 / Base URL + 拉取模型 / 模型 / API 密钥 + 清除密钥，note 为卡片最后一个元素。
- 模型字段：`<input list="cloud-models">` + `<datalist>`（候选 = 已保存的 `models` ∪ 本次拉取结果），既可下拉选也可手填，**模型不再随输入即时落盘**，只随「保存」写入；`mergeModels()` 保留。
- 顺带修掉两个可见问题：① `.grid` 从 `repeat(auto-fit, minmax(220px,1fr))` 改为 `minmax(150px,1fr) minmax(300px,3fr)`（`≤640px` 退回单列），Base URL 在默认窗口宽度下不再被截断；② 模型字段的占位文案按 `cloudModels.length` 判断，已有模型时不再误报「先拉取模型」。
- 上一轮同类问题的收尾：新建卡片的「保存」原本在卡片底部左侧（与已保存卡片的右上角不一致），已移入卡片头部；该卡片随本轮改造一并消失。
- 测试：`e2e/settings.spec.ts` 的云端 describe 重写为 10 个用例，RED **11 failed / 12 passed**（10 个云端用例 + 「密钥」里仍指向旧卡片选择器的那一例），实现后 chromium **23 passed**；`./init.sh` exit 0（60 files / **853 tests**、statements **95.28%**，lint/tsc/build 干净）；三浏览器 e2e **169 passed / 2 skipped**（`/tmp/s11-e2e.log`）。本轮为纯前端改动，`src/lib` 无新增模块（故无新单测与覆盖率门槛条目）。
- 真机验证（打包应用，服务端口 62389 / CDP 9222；只做读取与截图，未点「保存」）：卡片 1 张、旧「新建 Provider」卡片 0、按钮 `[保存, 拉取模型, 清除密钥]`、`保存` 位于卡片头部、`当前使用`/`设为当前`/`手填模型`/`添加模型`/`删除` 全部不存在；真实配置回填为 `Mimo` + 完整 Base URL + `mimo-v2.5-pro` + 八个黑点占位；截图 `/tmp/s11-cloud-card.png`。**未跑发布门禁**（版本决策仍未定）。
- 未做（非本次范围）：不动设置契约/密钥存储/端点策略/翻译引擎，不动本地 CLI 分区与「云端 / 本地」模式单选，不删「清除密钥」，不做依赖升级与版本号决定。
- 观察（未能归因，非本轮改动引入）：`~/Library/Application Support/MD-Convertor/settings.json` 的 mtime 在本轮某次打包应用启动后变为 `9月18 17:02`，但**大小仍为 1484 bytes、内容与预期配置逐字一致**（本轮探针只读、日志无 PUT、优雅退出不再改写、e2e 用的是临时目录）。已备份为 `/tmp/settings-before-s11.json`（SHA-256 `7f1bdbeb0a12b8cd…`）供后续比对。

## 已完成 in 0.3.0 之后（feat-031：版本 0.3.1、依赖升级与界面微调）

- 来源：用户一次提出 9 项（版本号、依赖升级、发布到 GitHub、密钥框与「清除密钥」语义、真机小点、Apple 签名问题、去掉齿轮图标、「转换为 MD」改名、把转换按钮移入「来源 URL」行）。**发布到 GitHub Releases** 与**真机小点**用户明确「稍后」；**签名/notarization** 属问答（需 Apple Developer 付费会员 + Developer ID Application 证书 + notarytool 凭据，`forge.config.cjs` 加 `osxSign`/`osxNotarize`，凭据走环境变量，签名后哈希必然变化故必须重跑门禁）；**密钥框**用户确认「清除密钥」语义不变、已保存时输入框限制为不可编辑。
- 版本 `0.3.1`（TDD）：`scripts/release-guards.test.mjs` 先改到 RED，再把 `scripts/release-desktop.mjs`（`RELEASE_VERSION_ERROR` + `version !== "0.3.1"`）、`package.json`、`package-lock.json`（root 与 `packages[""]`）与 `feature_list.json` 的 `currentVersion` 改为 `0.3.1` ⇒ `npm test -- release-guards` **29 passed**。**踩到的坑**：整文件替换 `0.3.0`→`0.3.1` 会把「旧版本必须被拒」的 fixture 一起改掉，断言因此恒真；该 fixture 已固定为互不相同的 `{ version: "0.2.1" }`。
- 依赖升级（用户单独授权）：`next` 16.3.0 → **16.3.5**、`sharp` 0.35.3 → **0.35.4**（连带 `@img/sharp-*` → 0.35.4、`@img/sharp-libvips-*` → 1.3.3）；`npm audit --omit=dev` 由 1 critical / 1 high / 1 moderate 变为 **0 漏洞**（剩余 28 条只在 electron-forge 构建链的开发依赖里）。**QA-012 就此关闭**。
- 界面三项：① 页头去掉 ⚙ 图标，只留文字「设置」（`.settingsLink` 去掉 `gap` 并补回 `:hover`，删除 `.settingsIcon`）；② 两个面板的「转换为 MD」→「转换」；③ 富文本面板的转换/停止按钮从 `.pasteActions` 移入 `.sourceRow`（跟在 `sourceInput` 之后），`.sourceInput` 由 `flex: 0 1 360px` 改为 `flex: 1 1 auto`，使按钮右边缘与上方粘贴框右边缘对齐（「清空」仍留在 `.pasteActions`）。
- 密钥框限制（用户选的方案）：已保存密钥时输入框 `readOnly`（可聚焦、屏幕阅读器可达，**不用 `disabled`**），占位文案改为「••••••••（已保存，先清除密钥再更换）」；「清除密钥」语义不变（删除密钥库条目 + `keyStored:false` ⇒ 输入框恢复可编辑）。
- 测试：`e2e/home.spec.ts` —— 页头断言 `toHaveText("设置")`、`富文本转换表单` 用例改为断言按钮右边缘与粘贴框右边缘差值 `< 4px`（RED 实测 `210.4375`）；`e2e/settings.spec.ts` —— 「已保存的密钥以黑点占位显示」加 `not.toBeEditable()`、「清除密钥」后加 `toBeEditable()`（RED 1 failed / 22 passed）。`./init.sh` exit 0（60 files / **853 tests**、statements **95.28%**）；`npm run test:e2e` **172 passed / 2 skipped**；`npm run test:live` 首跑因 DNS 瞬时失败（`curl` exit 6），重跑 **2/2 passed**。
- 真机：`npm run desktop:package` 产物 `CFBundleShortVersionString = 0.3.1`、包内 `sharp 0.35.4`；CDP 量测 `textarea.right = 990`、`submit.right = 990`（`rightEdgeDelta = 0`，URL 框宽 570.4px），截图 `/tmp/s13-paste-row.png`；用户真机测试通过。
- 未做（非本次范围）：不跑发布门禁、不发布到 GitHub、不改阈值/契约/端点策略、不碰历史归档与标签。

## 已完成 in 0.3.1 之后（页头品牌字：去掉 MD 方块 + Michroma）

- 来源：用户要求「去掉左上角 MD 图标、只留标题文字」，并把品牌字换成 Google Fonts 的 **Michroma**。
- 关键约束与选择：应用是**离线单机**，因此不用 Google CDN 的 `<link>`（那是运行时外链，断网就回退 Arial）。第一版用 `next/font/google`（构建期下载一次、产物自托管在 `/_next/static/media/*.woff2`）；用户随后问「字体能否直接嵌入产品代码」，于是改为**仓库内自带**：`public/fonts/Michroma-Regular.woff2` + 同目录 `public/fonts/OFL.txt`（OFL 1.1 许可证），用 `next/font/local` 加载 —— 构建期是本地文件读取，**整个构建不再需要联网**。Michroma 只有 400 字重、无中文字形 ⇒ 只用在纯拉丁的品牌字上，`font-weight` 760→400、去掉 `-0.03em` 负字距（Michroma 本身宽，负字距会挤），字号 15px。
- 只 vendored **latin** 子集：`next/font/local` 不产出 `unicode-range`，把 latin 与 latin-ext 一起传进去会生成两条描述符相同的 `@font-face`，后者对所有字形生效，而 latin-ext 没有 ASCII ⇒ 品牌字会回退到 Arial。因此只放一个文件（latin 覆盖 Latin-1，含 é/ü/ñ）。
- 改动：`src/app/layout.tsx` 用 `localFont({ src: "../../public/fonts/Michroma-Regular.woff2", weight: "400", variable: "--font-brand" })` 并挂到 `<html className>`；两个页面删掉 `<span className={styles.brandMark}>MD</span>`，两处 `.brand` 改用 `var(--font-brand)` 并删除 `.brandMark` 规则；未触碰 hero 大标题、eyebrow 与设置按钮。许可证不需要改打包脚本：`prepare-desktop.mjs` 已经把 `public/` 整体拷进 `Contents/Resources/server/public/`。
- 测试（TDD）：`e2e/home.spec.ts` 新增「品牌只有文字，且用仓库内自托管的 Michroma」（断言文本等于 `MD-Convertor`、无 `MD` span、computed family 命中 `/michroma/i`、有 loaded 的人脸、**页面实际加载的 woff2 与仓库文件 SHA-256 逐字节相同**、且没有 Google 请求）、`e2e/settings.spec.ts` 新增同款精简用例；RED **2 failed / 35 passed**（实收 `"MDMD-Convertor"`）。新增 `tests/brand-font.test.ts` 守住「字体与许可证都在仓库里」：先 RED（两个文件 ENOENT）再加文件 ⇒ 2 passed。切到 `next/font/local` 后，族名由 layout.tsx 里的绑定名生成（`"michroma"` / `"michroma Fallback"`），故断言从字面 `"Michroma"` 改为 `/michroma/i`，并用 SHA-256 相等补强（比原来更强）。
- 全量证据：`./init.sh` exit 0（61 files / **855 tests**、statements 95.28%；`/tmp/s15-init.log`）；`npm run test:e2e` exit 0 ⇒ **178 passed / 2 skipped**（三浏览器，`/tmp/s15-e2e2.log`）。首跑有 1 个 firefox 用例 `NS_ERROR_PROXY_CONNECTION_REFUSED`（e2e server 中途掉线的已知偶发），单跑 firefox **59 passed / 1 skipped**（`/tmp/s15-ff.log`），整跑重来即全绿。
- 断网构建实证：`sandbox-exec -p '(version 1)(allow default)(deny network*)' npm run build` exit 0；先量了沙箱本身有效（同一沙箱里 `fetch('https://fonts.gstatic.com/...')` 报 ENOTFOUND），因此这次通过是**真的不需要网络**，不是沙箱没生效。
- 真机：`npm run desktop:package` exit 0；包内 `Contents/Resources/server/.next/static/media/Michroma_Regular-s.p.*.woff2` 与仓库文件 SHA-256 相同，且 `Contents/Resources/server/public/fonts/{Michroma-Regular.woff2,OFL.txt}` 都在（`/fonts/OFL.txt` 由运行中的应用直接可访问）。重启打包应用后 CDP 探针（`/tmp/brand/probe-app.mjs`）实测：族名 `michroma, "michroma Fallback", …`、品牌框仍 143×21、只有一个 loaded 人脸、唯一的字体请求是应用自身的 `/_next/static/media/…`、SHA-256 与仓库一致、**0 个 Google 请求**；截图 `/tmp/brand/app-header.png`；`settings.json` SHA-256 仍为 `93204f32…30b4`。
- 未做（非本次范围）：不改 hero 标题字体（Michroma 无中文字形，中文会整体回退）、不改字号以外的排版。
- 后续一轮已完成：提交（`af7f6db`）→ 门禁 → 发布 `v0.3.1` → 安装到本机（见下节）。

## 已完成 in 0.3.1（发布与安装）

- 提交：`af7f6db`（`feat-031` + `feat-032` + UI 评审归档 + 自带字体，16 个文件）已推送到 `origin main`；提交门 ponytail → code-review → neat-freak 已跑完（自审）。顺手把 `src/app/page.tsx` 里一处属性顺序的无意义改动还原，使该文件的差异只剩删掉「MD」方块那一行。
- 门禁：`npm run desktop:release`（Node.js 24.15.0）**exit 0**，日志 `/tmp/s16-release.log` —— `./init.sh` 61 files / 855 tests、statements 95.28%、三浏览器 e2e **178 passed / 2 skipped**、live **2/2**、`electron-forge make` 与产物校验通过。产物 `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.1.zip`，`358,723,706` bytes，SHA-256 `c7411c587b3842a76f79118ecdc6d061993a0a99c98e4801c14ff947f10e161b`；结尾照旧列出 5 个退役 ZIP 与退役的 0.1.3 副本。
- 独立复核：`shasum -a 256` 与门禁一致、`unzip -t` 无错、包内 `CFBundleShortVersionString = 0.3.1`、`file` = `Mach-O 64-bit executable arm64`、包内 Michroma woff2 与仓库文件同哈希（`b12098180dae…56cf`）、CSS 为 `--font-brand:"michroma", "michroma Fallback"`。
- 发布：`gh release create v0.3.1`（tag 指向 `af7f6db` = 该 ZIP 的源码提交），资产 `MD-Convertor-darwin-arm64-0.3.1.zip` 上传成功且大小为 `358,723,706`；发布说明含变更摘要、验证数字、大小与 SHA-256，并说明未签名、仅供个人测试。
- 安装：`/Applications/MD-Convertor.app` 由 `0.2.1` 替换为 `0.3.1`（替换前先退出运行中的旧进程）；具体步骤与验证见 `session-handoff.md`。
- 文档：`CHANGELOG.md`(+zh) 的 `[Unreleased]` 已归档为 `[0.3.1] - 2026-09-20`；`README.md`(+zh)、`docs/TESTING.md`(+zh)、`docs/QUALITY-AUDIT.md` 的产品数字与测试计数（61 files / 855 tests、178 passed）已对齐。

## 下一轮（建议顺序）

1. **提交与发布 `v0.3.3`**：**已完成** —— 一次提交 `3897cd1`「0.3.3：去掉内置服务里重复的 Electron 运行时」（代码 + 全部文档）已推送 `origin/main`，`gh release create v0.3.3 … --target main` 已发布（tag `3897cd1`，资产 `232,947,408` bytes），`git fetch --tags origin` 后本地 tag 同步；提交前按用户要求跑了提交门（ponytail → code-review → neat-freak）。
2. **跑门禁必须用 Node 24.14.1 或 24.15.0**：本机默认的 **v24.16.0 在解压 electron zip 时静默卡死**（卡在 204727/272259 字节），`electron-forge make` 会空跑并仍返回 exit 0 —— 看起来「跑完了」其实什么都没产出。`nvm use 24.14.1` 后一次通过。
3. **真机小点**：用户提到「稍后把真机测试的一些小点完善了再说」，等清单给出后再评估是否单独一轮。
4. 若有任何代码改动，需要新的版本号（≥ `0.3.4`）并重跑一次 `npm run desktop:release`；`0.3.1`、`0.3.2`、`0.3.3` 的产物与 tag 均已发布（`0.3.3` tag 指向 `3897cd1`），都不要移动或覆盖。
5. 若将来 0.1.x/0.2.0 归档重新出现，守卫会自动恢复严格校验；不要把已退役的条目从 `PROTECTED_HISTORICAL_ZIP_MANIFEST` 中删掉。

## Verification Evidence

### feat-037 云端卡片「清除」改为整卡重置（2026-09-21，已提交 `c568513`，未跑发布门禁）

- RED：`npx playwright test e2e/settings.spec.ts --project=chromium` → **2 failed / 22 passed**——`清除会删掉密钥与整条云端配置，回到未配置状态` 停在 `card.getByRole("button", {name: "清除", exact: true}).click()`（按钮当时不存在，30s 超时）；`清除与保存并列在卡片头部`（原「保存按钮位于卡片头部」）在 `clearBox` 的 `boundingBox()` 抛 `missing layout box`。
- GREEN：同命令 **24 passed（5.7s）**；`./init.sh` **exit 0**（`/tmp/clear-init.log`）—— 62 files / **859 tests**、statements **95.28%**、lint、`tsc --noEmit`、生产构建全绿；`npm run test:e2e` **exit 0 → 187 passed / 2 skipped**（`/tmp/clear-e2e.log`，tracked-file 检查通过）。
- 断言内容：清除用例断言头部按钮存在、密钥行「清除密钥」计数为 0、提示「已清除云端配置。」、徽标回「未配置」、四个字段值为空且密钥框 `toBeEditable()`、`secretCalls` 含 `[clear, ollama]`、最后一条 PUT 的 `cloud` 为 `{providers: [], activeProviderId: null}`；布局用例用 `boundingBox()` 断言 `清除` 与 `保存` 都在「名称」字段上方、都在卡片右半侧，且 `清除.x < 保存.x`。
- 手工探针（`node scripts/start-e2e-server.mjs` + playwright-core + 路由 mock 的 `/api/settings`，1180×900 / 2x）：`清除` `{x:852, y:471, w:57, h:39}`、`保存` `{x:919, y:471, w:57, h:39}`（同一行、都在字段上方）、密钥行按钮 0；点击后 `badge 未配置`、四个字段 `""`、密钥框 `editable true`、PUT `{providers: [], activeProviderId: null}`、`secretCalls [["clear", "ollama"]]`；截图 `/tmp/clear-card-before.png`、`/tmp/clear-card-after.png`。
- 探针踩到的坑（不属于实现问题）：第一版 mock 的 PUT 分支只记录 body 却总是回传原始 settings，于是乐观更新被回包覆盖，徽标读回「已配置」；把 mock 改成合并 body 后行为才正确。e2e 用例里原本就用的 `mockSettingsApi` 是会合并的。
- 未做：不改设置契约（`providers: []` 本来就是默认值）、不改密钥存储与 IPC 通道、不改端点策略、不动翻译引擎与本地 CLI 分区；`electron/preload*.cjs` 未动；未跑 `npm run desktop:release`。

### feat-036 抓取失败时提示改用粘贴（2026-09-21，已提交 `c568513`，未跑发布门禁）

- RED：`npx playwright test e2e/home.spec.ts --project=chromium` → 新用例 `suggests the paste mode when a link cannot be fetched` 在 `getByRole("button", { name: "改用富文本粘贴" }).click()` 处 30s 超时（`1 failed / 13 passed`）。
- GREEN：同命令 **14 passed**；`npm run test:e2e` **exit 0 → 187 passed / 2 skipped**（`/tmp/hint-e2e.log`，tracked-file 检查通过）。
- 基线：`./init.sh` **exit 0**（`/tmp/hint-init.log`）—— 62 files / **859 tests**、statements 95.28%、lint、`tsc --noEmit`、生产构建全绿。
- 真机探针（`node scripts/start-e2e-server.mjs` + playwright-core，`/api/convert` 由浏览器拦截为 502 `UPSTREAM_ERROR`）：提示按钮 `boundingBox { x:636, y:613, w:98, h:22.4 }`、`color rgb(15, 81, 71)`；点击后 `富文本转换` `aria-selected=true`、`document.activeElement.id === "paste-tab"`、提示按钮计数 0；截图 `/tmp/hint-error.png`（错误卡片与提示左边缘对齐）。
- 断言敏感性：新用例的按钮文案在实现前不存在（超时即失败）；既有「rejects invalid pasted content without converting」用例补了一句「提示按钮计数为 0」，锁住客户端校验路径不会出现该建议。
- 未做：不改接口/契约/翻译引擎/打包配置；`electron/preload*.cjs` 未动；未跑 `npm run desktop:release`（版本仍为 `0.3.3`，本机 `main` 现有未提交改动）。

### 0.3.3 去掉重复的 Electron 运行时（本次）

- 现象：同一份代码，`electron-forge make` 在本机**经常空跑**——直接运行时没有产物、退出码却是 0（发布脚本 `scripts/release-desktop.mjs` 自身有产物校验，缺 ZIP 会抛 `Expected ZIP was not generated`，所以空跑/卡住的是 Forge 这一层）。用户的原话是「跑得好慢」。
- 根因①（体积）：应用被装了**两份** Electron。`next build` 的输出追踪跟着 `playwright-core` 里那句 `require("electron")`，把整个 `electron` npm 包拷进了 `.next/standalone`，`prepare-desktop.mjs` 再把它原样搬进应用的 `Contents/Resources/server/node_modules/electron`。而应用的服务端代码**零处**引用 electron：它走 `PLAYWRIGHT_EXECUTABLE_PATH` 驱动自带的 Chromium Headless Shell，外层 Electron 运行时也已经在 `Contents/Frameworks` 里。
- 根因②（卡死）：本机默认 Node **v24.16.0** 在 yauzl 解压 electron zip 时卡死在 204727/272259 字节（管道回归）；nvm 里的 **v24.14.1** 一次通过。另一台机器是 24.15.0，所以从未遇到。这也是「跑得慢」的直接来源。
- RED → GREEN（体积）：`scripts/prepare-desktop.test.mjs` 先加集成回归「最终 server 不含 `node_modules/electron`，同时保留 Playwright、Playwright Core、Sharp arm64 包与内置 Chromium Headless Shell」⇒ 在改动前失败；`scripts/prepare-desktop.mjs` 在 `cp(sourceRoot, targetRoot, …)` 之后补 `rm(targetRoot/node_modules/electron)`（4 行注释说明为什么这份多余）⇒ 通过。
- RED → GREEN（版本）：`scripts/release-guards.test.mjs` fixture `0.3.2`→`0.3.3` ⇒ **5 failed / 24 passed**（`Release version must be 0.3.2.`）；再改 `scripts/release-desktop.mjs`、`package.json`、`package-lock.json`、`feature_list.json` ⇒ **29 passed**（两文件合并 **31 passed**：`prepare-desktop.test.mjs` 2 + `release-guards.test.mjs` 29）。
- 门禁：`npm run desktop:release` **exit 0**（Node.js **24.14.1**，日志 `/tmp/s18b-release.log`）——62 files / **859 tests**、statements 95.28%、三浏览器 e2e **178 passed / 2 skipped**、live **2/2**、`electron-forge make` 与产物校验通过；末尾 `Release Artifact Verified: Version 0.3.3 …`。
- 体积对比：`0.3.2` = `358,726,788` bytes → `0.3.3` = `232,947,408` bytes，少 **125,779,380 bytes ≈ 120 MiB（−35%）**；未压缩应用 843 MB → **539 MB**（与早前记录的 `538.86 MiB` 吻合，裁剪结果可复现）。
- 保留项复核（真跑 `unzip -l`，3501 条）：`server/node_modules/electron/` **0** 条；`playwright/` 75、`playwright-core/` 129、`chrome-headless-shell` 1、`@img/sharp-darwin-arm64` 7、`next/` 1435 —— 都在。
- 产物独立复核：`stat` = `232947408`、`shasum -a 256` = `1bf807dfe294860c24345efe5caf2b0fcbd54f88476df7085c9bd03b47b37a72`（与门禁一致）、`plutil -extract CFBundleShortVersionString` = `0.3.3`、`file` = Mach-O arm64。
- 安装与冒烟：`/Applications/MD-Convertor.app` 由 `0.3.2` 替换为 `0.3.3`（旧版备份 `/tmp/s18-old-0.3.2.app`，实测里面那份多余 electron 目录 `du` = 295 MB；新版已不存在该目录）；安装后 `ELECTRON_SMOKE_TEST=1 ELECTRON_SMOKE_TEST_SECRETS=1` 跑安装后的应用 **exit 0**（日志 `/tmp/s18-smoke.log`）：`Preload bridge smoke passed: secrets.set function, encryptionAvailable true`、`Runtime secret smoke passed: TRANSLATE_NOT_CONFIGURED → TRANSLATE_PROVIDER_ERROR → TRANSLATE_NOT_CONFIGURED`。
- 已知误报（未改动）：pi-lens 对 `scripts/prepare-desktop.mjs` L10/L22 报「`JSON.parse` 未包 try/catch」——这两行改动前就存在（HEAD 逐字节相同），且构建准备脚本读不到自己的依赖本就该立刻失败。
- 未做：不改打包配置与图标素材，不动依赖、端点策略、翻译引擎；`0.3.2` 的产物与已发布 tag 一律不动；**本轮不提交、不发布**（等用户授权）。

### 0.3.2 程序坞幽灵图标修复（历史）

- 门禁：`npm run desktop:release` **exit 0**（Node.js 24.15.0，日志 `/tmp/s17-release.log`）——62 files / **858 tests**、statements 95.28%、`npm run test:e2e` **178 passed / 2 skipped**、`npm run test:live` **2/2**、`electron-forge make` 与产物校验通过；末尾 `Release Artifact Verified: Version 0.3.2, SHA-256 8fb7a93f…f1ba`。
- RED：`electron/server-binary.test.mjs` 3 个用例（helper bundle / 由可执行文件名推导 helper 名 / helper 缺失时抛错）在实现前全红，加上版本 fixture 改动后 `npm test -- release-guards` ⇒ **5 failed / 24 passed**；实现后同一命令 **32 passed**。
- 真机证据（修复前→后，`lsappinfo list`）：子进程从 `bundle path=/Applications/MD-Convertor.app … type="Foreground" fileType="APPL" parentASN="MD-Convertor"` 变为 `bundle path=…/Contents/Frameworks/MD-Convertor Helper.app … type="UIElement" Version="0.3.2" fileType="APPL"`；打包应用与安装后应用都如此。
- 程序坞截图：`/tmp/icontest/pair-before.png`（应用图标 + 黑色 exec 同时存在）、`pair-after.png` 与 `pair-installed.png`（只剩应用图标）。
- 产物独立复核：`stat` = `358726788`、`shasum -a 256` = `8fb7a93f…f1ba`、`unzip -t` 无错、`plutil -extract CFBundleShortVersionString` = `0.3.2`、`file` = Mach-O arm64；asar 内含 `/electron/server-binary.mjs` 与 `/electron/server-binary.test.mjs`，`strings` 能检出 `resolveServerBinary` 与 `helper runtime is missing`。
- 安装：`ditto /tmp/s17-app/MD-Convertor.app /Applications/MD-Convertor.app` exit 0（旧 `0.3.1` 备份在 `/tmp/s17-old-0.3.1.app`），安装后 `defaults read … CFBundleShortVersionString` = `0.3.2`；`settings.json` SHA-256 仍为 `93204f32…30b4`。

### 0.3.1 发布与安装（历史）

- 门禁：`npm run desktop:release` **exit 0**（Node.js 24.15.0，15 分钟上限内完成，日志 `/tmp/s16-release.log`）——61 files / **855 tests**、statements 95.28%、`npm run test:e2e` **178 passed / 2 skipped (1.4m)**、`npm run test:live` **2/2**、`electron-forge make` 成功；末尾打印 `Release Artifact Verified` 与 `Historical Archive Notice`（5 个退役 ZIP + 退役的 0.1.3 副本）。
- 产物独立复核：`stat` = `358723706`、`shasum -a 256` = `c7411c58…161b`（与门禁一致）、`unzip -t` 无错、`plutil -extract CFBundleShortVersionString` = `0.3.1`、`file` = `Mach-O 64-bit executable arm64`；解包后包内 Michroma woff2 SHA-256 = `b12098180dae…56cf`（与仓库文件相同）、CSS `--font-brand:"michroma", "michroma Fallback"`。
- 发布：`gh release create v0.3.1` exit 0；`gh release view v0.3.1` → `publishedAt 2026-09-20T03:32:10Z`、资产 `MD-Convertor-darwin-arm64-0.3.1.zip 358723706 uploaded`；`git ls-remote --tags origin v0.3.1` → tag 指向 `af7f6db`，与该 ZIP 的源码提交一致。
- 安装：`/Applications/MD-Convertor.app` 替换为 `0.3.1`，安装后 `defaults read … CFBundleShortVersionString` = `0.3.1`。
- 顺带：`src/app/page.tsx` 里 `Link` 的属性顺序还原，使该文件差异只剩一行删除（重新跑过受影响用例）。

### feat-031 版本 0.3.1 / 依赖升级 / 界面微调（历史）

- RED（版本门禁）：fixture 已指向 `0.3.1` 而脚本仍要求 `0.3.0` ⇒ `npm test -- release-guards` 失败；GREEN：把 `scripts/release-desktop.mjs` + `package.json` + `package-lock.json` + `feature_list.json` 改为 `0.3.1` 后 → **29 passed**，`RELEASE_VERSION_ERROR = "Release version must be 0.3.1."`。「旧版本必须被拒」的 fixture 已固定为 `{ version: "0.2.1" }`（整文件替换曾把它也改成目标版本，断言会因此恒真）。
- RED（界面）：`npx playwright test e2e/home.spec.ts --project=chromium` 在改动前的构建上 → **9 failed / 3 passed**；GREEN → **12 passed**。右边缘对齐那条先实测 `|按钮右边缘 − 粘贴框右边缘| = 210.4375`（阈值 4px），把 `.sourceInput` 改成 `flex: 1 1 auto` 后为 **0**。
- RED（密钥框）：`e2e/settings.spec.ts:331`「已保存的密钥以黑点占位显示，不回填明文」→ **1 failed / 22 passed**（`readOnly` 未加）；GREEN：加上 `readOnly={Boolean(cloudProvider?.keyStored)}` 后 chromium **23 passed**。
- 依赖：`npm install next@16.3.5 sharp@0.35.4` exit 0；`npm audit --omit=dev` → **0 vulnerabilities**（此前 3）；`npm ls next sharp` → `next@16.3.5`、`sharp@0.35.4`。
- 基线：`./init.sh` **exit 0**（`/tmp/s12b-init.log`）—— 60 files / **853 tests**、statements **95.28%**、lint、`tsc --noEmit`、生产构建全绿。
- 全量 e2e：`npm run test:e2e` exit 0 → **172 passed / 2 skipped**（`/tmp/s12b-e2e.log`），tracked-file 检查通过；live 重跑 **2/2 passed**（`/tmp/s12c-live.log`；首跑 `/tmp/s12b-live.log` 是 DNS 瞬时失败，`curl` exit 6）。
- 打包与真机：`npm run desktop:package` exit 0（`/tmp/s12-package.log`）→ `plutil -extract CFBundleShortVersionString` = `0.3.1`、包内 server 的 `sharp` = `0.35.4`；CDP 量测 `rightEdgeDelta = 0`（`textarea right 990` / `submit right 990`，URL 框宽 570.4px），截图 `/tmp/s13-paste-row.png`；用户真机确认通过。
- **未跑发布门禁**：`out/make/zip/darwin/arm64/` 里的 `0.3.0` ZIP 仍是修复前构建，`0.3.1` 门禁等提交与真机小点确定后再跑。

### feat-030 云端配置收敛为单条（历史）

- RED：`npx playwright test e2e/settings.spec.ts --project=chromium` 在未改动的多 Provider 构建上 → **11 failed / 12 passed**（10 个云端用例全红 + 「密钥 › 密钥库不可用…」因仍指向旧卡片选择器而红）；实现后同命令 → **23 passed (5.4s)**。
- 基线：`./init.sh` **exit 0**（`/tmp/s11-init.log`）—— 60 files / **853 tests**、statements **95.28%**、lint、`tsc --noEmit`、生产构建全绿。
- 全量 e2e：`npm run test:e2e` exit 0 → **169 passed / 2 skipped**（三浏览器，`/tmp/s11-e2e.log`），tracked-file 检查通过。上一轮为 166 passed / 2 skipped（+3 = 上一轮新增的「保存按钮位于卡片头部」×3）。
- 打包与真机：`npm run desktop:package` exit 0（`/tmp/s11b-package.log`）→ 启动 `out/MD-Convertor-darwin-arm64/MD-Convertor.app --remote-debugging-port=9222`（日志 `/tmp/md035.log`，服务端口 **62389**）→ `/tmp/shot-cloud-single.mjs` 实测：`cardCount 1`、`oldCards 0`、`buttons ["保存","拉取模型","清除密钥"]`、`saveInHead true`、`badge "已配置"`、`stale` 五项全 false；字段回填 `Mimo` / `https://token-plan-cn.xiaomimimo.com/v1` / `mimo-v2.5-pro` / 空值 + 八个黑点占位；截图 `/tmp/s11-cloud-card.png`（Base URL 完整可见）、`/tmp/s11-settings.png`（整页）。
- 未跑发布门禁（版本决策仍未定）；`out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.0.zip` 与 `docs/TESTING.md` 记录的哈希仍是修复前构建。
- 占位文案回归用例的敏感性证据：“拉取模型只读取端点” 用例新增 `toHaveAttribute("placeholder", "从下拉选择或直接填写模型名")`；先把源码改回旧逻辑（`cloudForm.models.length`）重新 `npm run build` 后单跑该用例 → **1 failed**（placeholder 为「先拉取模型，或直接填写模型名」），恢复 `cloudModels.length` 重建后 → **23 passed**；随后 `./init.sh` exit 0（853 tests / 95.28%，`/tmp/s11d-init.log`）与三浏览器 `npm run test:e2e` exit 0（**169 passed / 2 skipped**，`/tmp/s11d-e2e.log`）。

### feat-029 Provider 保存规则与密钥占位（上一轮）

- RED：`npx vitest run src/app/api/provider/models/route.test.ts` → **6 failed / 14 passed**（6 个新草稿用例全部失败，路由当时只认 `providerId`）；`src/lib/settings/provider-form.test.ts` 因模块不存在而无法解析导入。
- 警告色敏感性证据：把 `noteClass()` 临时改回恒用 `.status` 后重跑「保存要求四项齐全」用例 → 失败（`Expected "rgb(138, 90, 18)"` / `Received "rgb(101, 112, 109)"`），还原后通过；真机打包探针读取「请填写 Provider 名称。」的 `color` = `rgb(138, 90, 18)`（截图 `/tmp/s10b-warning.png`）。改色后重跑基线 `./init.sh` exit 0（853 tests / 95.28%，`/tmp/s10b-init.log`）与全量 e2e exit 0（166 passed / 2 skipped，`/tmp/s10b-e2e.log`）；`npm run desktop:package` exit 0（`/tmp/s10b-package.log`，服务端口 54907 / CDP 9222）。
- GREEN：`npx vitest run src/app/api/provider/models/route.test.ts` → **20 passed**；`npx playwright test e2e/settings.spec.ts --project=chromium` → **22 passed**（新增 3 个用例：保存要求四项齐全缺一项就提示且不写盘 / 新建卡片先拉取模型只读取端点 / 已保存的密钥以黑点占位显示）。
- 基线：`./init.sh` **exit 0**（`/tmp/s10-init.log`）—— **60 files / 853 tests**、statements **95.28%**、lint、`tsc --noEmit`、生产构建全绿。
- 全量 e2e：`npm run test:e2e` exit 0 → **166 passed / 2 skipped**（三浏览器，`/tmp/s10-e2e.log`），tracked-file 检查通过；上一轮为 157 passed / 2 skipped。
- 打包与真机：`npm run desktop:package` exit 0（`/tmp/s10-package.log`）→ 启动 `out/MD-Convertor-darwin-arm64/MD-Convertor.app --remote-debugging-port=9222`（日志 `/tmp/md032.log`，服务端口 **52057**）→ 用 `/tmp/shot-settings.mjs` 与 `/tmp/probe-validation.mjs` 实测：密钥框 `value` 为空 + 八个黑点占位、新建卡片模型字段 count 1、四个缺失提示按序出现；`settings.json`（1484 bytes，mtime `9月18 16:18`）未被写入；截图 `/tmp/s10-settings.png`。
- 未跑发布门禁（版本决策仍未定）；`out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.0.zip` 与 `docs/TESTING.md` 记录的哈希仍是修复前构建。

### feat-027 云端翻译超时 / feat-028 模式标签（上一轮）

- RED：`openai-compatible.test.ts` 新增「maps a timeout that lands while the body is being read to TRANSLATE_TIMEOUT」→ 1 failed / 10 passed（实收 `{502, TRANSLATE_PROVIDER_ERROR}`，期望 `{504, TRANSLATE_TIMEOUT}`）；`limits.test.ts` 新增「leaves room for the thinking tokens of a reasoning model」→ 1 failed / 3 passed（60000 ≠ 180000）；e2e「翻译服务提供方卡片切换时不再渲染「当前生效」标签」→ 首条 `toHaveCount(0)` 失败。
- GREEN：`npx vitest run src/lib/translate/` → **12 files / 198 tests passed**；`npx playwright test e2e/settings.spec.ts --project=chromium` → **19 passed**。
- 基线：`./init.sh` **exit 0**（`/tmp/s9-init.log`）—— 59 files / **839 tests**、statements **95.26%**、lint、`tsc --noEmit`、生产构建全绿。
- 全量 e2e：`npm run test:e2e` → **157 passed / 2 skipped，exit 0**（`/tmp/s9-e2e.log`），tracked-file 检查通过。
- 打包与真机：`npm run desktop:package` exit 0（`/tmp/s9-package.log`）→ 直接跑 `out/MD-Convertor-darwin-arm64/MD-Convertor.app/Contents/MacOS/MD-Convertor --remote-debugging-port=9222`（PID 65384、服务端口 63338，日志 `/tmp/md031.log`）；产物内容校验：`Contents/Resources/server/.next/server/chunks/src_lib_translate_limits_ts_0a46et0._.js` 含 `Math.max(12e4,18e4*e+3e4)`。
- 探针证据（`/tmp/probe-cloud3.mjs`，自撰文本，密钥不出内存）：3 段 ⇒ `ANALYZE 200 @ 16011ms` / `RUN 200 @ 26834ms`；60 段（121 块）⇒ `ANALYZE 200 @ 78869ms` / `RUN 200 @ 284433ms`；两者修复前分别为 `502 @ 60011ms` 与 `RUN 502 @ 60039ms`。
- 界面证据：`/tmp/shot-mode.mjs` 三次切换前后两个 radio 的 `boundingBox()` 逐项相等（`cloud x=190 y=315.53`、`local x=344.42 y=315.53`），`当前生效` 计数恒为 0；截图 `/tmp/p2-settings-modes.png`。测试后 `settings.json` 已还原为 `mode: cloud` + `mimo-v2.5-pro`（`baseUrl https://token-plan-cn.xiaomimimo.com/v1`）。
- 已知打包事实（预先存在，非本轮引入）：`app.asar` 未排除 `docs/`、`.pi/`、`AGENTS.md`、`CHANGELOG*`（asar 2,240,986 B，其中含文档文本）；运行时服务来自 `Contents/Resources/server/`（`extraResource`），因此以该目录为准核对产物逻辑。

### feat-026 云端 Provider 配置体验（历史）

- RED：`npx playwright test e2e/settings.spec.ts e2e/home.spec.ts --project=chromium` → **4 failed / 27 passed**（`/tmp/s8-red.log`，恰好是四个新 provider 用例）。
- 契约层：`npx vitest run` → **59 files / 837 tests passed**（`/tmp/s8-b1-green2.log`）。
- GREEN：`npx playwright test e2e/settings.spec.ts --project=chromium` → **19 passed**（`/tmp/s8-green3.log`）。中途两个必须修掉的问题：① e2e 选择器写的是 `section[aria-label=…]` 而卡片元素是 `<article>`；② 卡片头部原本用 `.providerHead .button { margin-left:auto }`，两个按钮各占 auto 会被拉开，改为包一层 `.actions`。
- 基线：`./init.sh` **exit 0**（`/tmp/s8-init.log`）—— 59 files / **837 tests** passed，statements **95.26%**，lint、`tsc --noEmit`、生产构建全绿。
- 全量 e2e：`npm run test:e2e` → **157 passed / 2 skipped，exit 0**（`/tmp/s8-e2e.log`），tracked-file 检查通过。
- 打包与真机：`npm run desktop:package` exit 0（`/tmp/s8-package.log`）→ 启动打包应用（CDP 9222 / 服务端口 50925）→ 截图 `/tmp/p1-settings-cloud.png`、`/tmp/p1-new-card.png`；`boundingBox()` 实测 Base URL 输入框 `x=596 y=558.47 w=286 h=39`、拉取模型按钮 `x=892` 同一 y ⇒ 同行且在右侧。
- 密钥库残留：`secrets.json` 原有两条（活跃 `8b14f5d6…` 与已删除 provider 的 `cc3df153-…`），移除后者后只剩活跃条目；备份留在 `/tmp/secrets-backup.json`。

### feat-025 设置页 UI 反馈与页头清理（历史）

- RED：`npx playwright test e2e/home.spec.ts e2e/settings.spec.ts --project=chromium` → **6 failed / 23 passed**（`/tmp/s7-red.log`；含「本机处理」仍在、「翻译服务提供方」标题不存在、无状态胶囊、`添加语言` 仍渲染）。
- GREEN：同命令 → **29 passed**（`/tmp/s7-green3.log`）。中途两个必须修掉的问题：① e2e server 用的是 `.next/standalone`，改完前端要先 `npm run build`，否则页面仍是旧版；② 章节标题断言需 `exact: true`，否则「翻译」同时匹配「翻译服务提供方」触发 strict mode。
- 全量 e2e：`npm run test:e2e` → **154 passed / 2 skipped，exit 0**，tracked-file 检查通过（`/tmp/s7-e2e-final.log`）。前一次全量有 3 个 firefox 用例失败（先是一个下载用例 30s 超时，随后两个 `NS_ERROR_PROXY_CONNECTION_REFUSED` —— e2e server 中途掉线导致的连锁失败）；单跑 firefox **51 passed / 1 skipped** 全绿（`/tmp/s7-ff-rerun.log`），归为偶发。
- 基线：`./init.sh` **exit 0**（`/tmp/s7-init.log`）—— 59 files / **839 tests** passed，statements **95.27%**，lint、`tsc --noEmit`、生产构建全绿。本改动是纯前端，`src/lib` 无新增单测（`addCustomLanguage` 及其单测保留）。
- 真机视觉校验：`npm run desktop:package` exit 0（`/tmp/s7-package3.log`）→ 启动 `out/MD-Convertor-darwin-arm64/MD-Convertor.app`（`--remote-debugging-port=9222`，服务端口 60451）→ 截图 `/tmp/v2-home.png`、`/tmp/v2-settings.png`、`/tmp/v2-settings-local.png`。第一版 badge 用 `position:absolute` 会压到相邻选项（截图发现），改为 in-flow flex 项后才正确；「返回转换」点击后真实导航回 `/`（`http://127.0.0.1:60451/`）。
- 截图副作用已还原：`mode` 点回 `cloud`，`~/Library/Application Support/MD-Convertor/settings.json` 内容与原始一致（`languages.custom` 为空、`target: zh-Hans`、`defaultEnabled: false`）。
- 文档同步：`CHANGELOG.md` + `CHANGELOG.zh.md` 的 `[Unreleased] → Changed/变更`，`docs/PRD-translation.md` R1a 措辞（gear → 「⚙ 设置」按钮），`feature_list.json`（feat-025 → done，activeFeature → null）。

### feat-024 长文翻译超时修复（历史）

- RED：新建 `src/lib/translate/limits.test.ts` 3 用例全部失败（`translateTaskTimeoutMs` 未定义）；`run.test.ts` 新增「scales the task deadline with the batch count」失败（`AbortSignal.timeout` 收到 `NaN`，期望 `2×60000+30000`）。
- GREEN：`npx vitest run src/lib/translate/limits.test.ts src/lib/translate/run.test.ts` → **27 passed**（limits 3 + run 24）。
- 全量：`./init.sh` **exit 0**（`/tmp/s6-dyn-init.log`）—— 59 files / **839 tests** passed，statements **95.27%**，lint、`tsc --noEmit`、生产构建全绿。
- 根因证据（本机实测，均用生产同款参数与 `--model deepseek-flash`）：小 prompt **1–2s**；8,000 字符批次 **7s**（exit 0，输出 9,505 B）⇒ CLI 不慢。
- 真机复现证据：修复前 `open` 启动的 app 日志 `{"requestId":"ba692e5c…","status":504,"code":"TRANSLATE_TIMEOUT","durationMs":120006}`（恰好 120s 上限）；用户确认界面文案为「翻译任务超时」（= 任务级而非单批级）。
- 修复后真机：`npm run desktop:package` exit 0（`/tmp/s6-dyn-package.log`）→ 启动 `out/MD-Convertor-darwin-arm64/MD-Convertor.app`（PID 24236）→ 用户用同一篇文章重测**成功**；服务端日志只有转换 `{"status":200,"durationMs":1244,"outputBytes":10589}`，**无任何 TRANSLATE_TIMEOUT 行**（成功路径按设计不写日志）。
- 产物内容校验：`.next/standalone/.next/server/chunks/src_lib_translate_limits_ts_0a46et0._.js` 含 `Math.max(12e4,6e4*e+3e4)`；`app.asar`（2,193,267 B，mtime `9月18 11:02`）内 `translateTaskTimeoutMs` 出现 **13** 次。

### 0.3.0 S6（历史）

- `npm test -- release-guards`：T6.1 RED 4 failed / 21 passed（`/tmp/s6-t61-red.log`）→ GREEN 25 passed；T6.4 退役改造 RED 6 failed / 23 passed（`/tmp/s6-t64a-red.log`）→ 加 0.2.1 条目再 RED 1 failed / 28 passed → GREEN **29 passed**。
- 守卫真实行为抽样（本机）：`assertProtectedArchive()` → `{"status":"retired"}`；`assertProtectedBaseline()` → verified；`captureHistoricalZipSnapshot()` → 只含 `MD-Convertor-darwin-arm64-0.2.1.zip`（哈希校验通过），`listRetiredHistoricalZips()` → 0.1.0/0.1.1/0.1.2/0.1.3/0.2.0。
- `npm run desktop:release`（Node.js 24.15.0）：**exit 0**，日志 `/tmp/s6-release-3.log`（0 条 ERROR）——`./init.sh` 58 files / 835 tests、statements 95.25%、`npm run test:e2e` 142 passed、`npm run test:live` 2/2、`electron-forge make` 成功；产物 `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.0.zip`，`358,562,540` bytes，SHA-256 `2a0e236e97e51d97fd24c7002a923ef5703ad8245234531f2eb3aa1350c81147`，包内版本 `0.3.0`、arm64。
- 产物独立复核：`stat` 大小一致、`shasum -a 256` 一致、`plutil -extract CFBundleShortVersionString` = `0.3.0`、`file` = `Mach-O 64-bit executable arm64`。
- 打包冒烟：`ELECTRON_SMOKE_TEST=1 ELECTRON_SMOKE_TEST_SECRETS=1` 跑 `out/MD-Convertor-darwin-arm64/MD-Convertor.app/Contents/MacOS/MD-Convertor`，exit 0，preload 桥与运行时密钥往返均通过。
- 0.2.1 锚点恢复证据：GitHub `v0.2.1` 资产 354,635,067 bytes 与记录一致；重下后 `shasum -a 256` = `32c1d96af58a7701e6d2fe0bf619be0f8f224803355c6ef63aad43c85569463e`，`unzip -t` 无错。
- QA-012 证据：`npm audit --omit=dev --json` → `{critical:1, high:1, moderate:1, total:3}`；`npm ls next sharp` → `next@16.3.0`、`sharp@0.35.3`。

### 0.3.0 S5（历史）

- `./init.sh` passed with Node.js `24.15.0`: 58 test files / 830 tests, coverage 95.25% statements, production build OK（lint 干净、`tsc --noEmit` 干净）；`vitest.config.ts` 新增 `src/lib/translate/decision.ts` 逐文件门槛（95/90/100/95）。
- `npm run test:e2e` passed: 142 passed / 2 skipped across Chromium, Firefox and WebKit（`workers: 1`，约 1.3 分钟；S4 基线为 127 passed / 2 skipped，新增 5 个用例 × 3 浏览器）。
- T5.1 测试计数：`src/lib/translate/decision.test.ts` 7 个用例（0 / 0.699 / 0.70 / 0.969 / 0.97 / 1 六个边界 + 空散文 + 展示百分比）。
- T5.2 测试计数：`run.test.ts` 23 个（含新增 golden 用例）、`segment.test.ts` 76 个，共 99 个通过。
- T5.2 测试敏感性证据（回归用例本身不可能是「新增即红」）：临时把 `runTranslation` 里的 `scope` 过滤条件改成恒真后，golden 用例与既有 non-target 用例同时失败（输出变成 `[zh] 中文段落。`），随即还原（`git diff src/lib/translate/run.ts` 为空）。
- T5.3–T5.5 RED 证据（在未改动的 S4 构建上跑新用例，chromium）：4 个用例失败——`getByRole('dialog')` 与 `getByRole('status')` 均未找到，仅「<70% 直译」用例通过（S4 恒用 `scope:"all"`，正是 T5.5 要锁定的行为）；日志 `/tmp/s5-e2e-red.log`。
- T5.3–T5.5 GREEN：同文件 chromium 13 passed；三浏览器全量 142 passed / 2 skipped。
- 新用例覆盖：80% ⇒ 弹窗文案「检测到正文约 80% 已是英语，是否只翻译其余部分？」、选「只翻译非目标语言部分」后仅一次 `run` 且 `scope: "non-target"`、前 8 段不被 `[en] ` 包裹而末 2 段被翻译；「不翻译」⇒ `runs 0` / `analyses 1`、弹窗关闭、无 `转换结果` tablist、原文预览可用、勾选框仍勾选、提示「已选择不翻译」；100% ⇒ 提示「正文已是英语，无需翻译」且 `runs 0`；全 skipped 的 analyze 响应 ⇒ 提示「正文没有可翻译的段落」且 `runs 0`；60% ⇒ 无弹窗、`scopes == ["all"]`、译文 Tab 出现 `[en] ` 前缀。
- 本轮未发现 S3 缺陷，因此未改动 `src/lib/translate/` 的引擎实现（`run.ts` 仅作为临时变异实验被改写并立即还原）。

### 0.3.0 S4（历史）

- `./init.sh` passed with Node.js `24.15.0`: 57 test files / 822 tests, coverage 95.24% statements, production build OK（lint 干净、`tsc --noEmit` 干净）；新增 `src/lib/translate/filename.ts` 与 `client.ts` 的逐文件门槛（95/90/100/95）。
- `npm run test:e2e` passed: 127 passed / 2 skipped across Chromium, Firefox, WebKit（`workers: 1`，约 1.2 分钟）；新增 `e2e/translate.spec.ts` 8 个用例 × 3 浏览器。用例覆盖：默认开关取值与勾选、勾选后自动出现双 Tab 与译文、未勾选时无 Tab 且 DOM 与旧版一致、复制/下载按 Tab 分流（含 `粘贴测试文章-en.md`）、取消后显示「已取消翻译。」且可重试、失败显示错误与重试、未配置模型时只显示提示与设置链接。
- T4.1–T4.6 均先 RED 再 GREEN（每个任务先写失败用例/断言，再最小实现），期间修掉的真实问题：analyze 响应需取 `.analysis`；结果 Tab 的 panel 名由 `aria-labelledby` 决定；非 Tab 场景多包一层 tabpanel 会使 `getByLabel("Markdown 预览")` 触发 strict mode 冲突（已改为不启用翻译时不加包裹层）；复制与翻译完成存在竞态（用例补 `waitForTranslation`）；`e2e/settings.spec.ts` 真实存储未还原导致 firefox/webkit 自动翻译（已用 `try/finally` + `request.put` 还原默认设置）。
- 已知未实现：页面路径上 `409 TRANSLATE_ANALYSIS_STALE` 不可达（analyze 与 run 用同一 markdown），因此未做「重新判定后重试」；译文未就绪时不禁用复制/下载。

### 0.3.0 S3（历史）

- `./init.sh` passed with Node.js `24.15.0`: 55 test files / 805 tests, coverage 95.15% statements, production build OK（lint 干净、`tsc --noEmit` 干净）。`vitest.config.ts` 新增两个端点进 coverage `include`，并为 9 个 `src/lib/translate/**` 模块设定逐文件门槛。
- `npm run test:e2e` passed: 103 passed / 2 skipped across Chromium, Firefox and WebKit（与 S2 基线一致；翻译 UI 属 S4，本阶段不新增 e2e 用例）。
- 真实 HTTP 冒烟（T3.10；临时脚本已删除、不入库，复现方式：`npm run build` 后以 `HOSTNAME=127.0.0.1 NODE_ENV=production PORT=<port> MD_CONVERTOR_USER_DATA=<临时目录> MD_CONVERTOR_SESSION_TOKEN=<令牌> node .next/standalone/server.js` 启动，向 `/api/translate/{analyze,run}` 发 JSON 请求并带 `x-md-convertor-token`）：启动两个实例（3100 带 `MD_CONVERTOR_TEST_PROVIDER=1`、3101 不带），14/14 检查通过——analyze 200（25 块 / targetChars 66 / 围栏代码块标为 skipped）、run(all) 去掉 `[zh-Hans] ` 标记后与输入**逐字节相同**、CRLF 与制表符保留、base64 图片数据未被改动、run(non-target) 不动中文、变更后的文档 ⇒ 409 `TRANSLATE_ANALYSIS_STALE`；未设置标志时同一请求 ⇒ 409 `TRANSLATE_NOT_CONFIGURED`；错误响应体不含正文文本。
- S3 测试计数：`segment.test.ts` 76、`analysis.test.ts` 6、`prompt.test.ts` 23、`run.test.ts` 22、`provider/provider.test.ts` 13、`openai-compatible.test.ts` 10、`local-cli.test.ts` 12、`test-provider.test.ts` 5、`src/app/api/translate/route.test.ts` 29、`src/lib/local-cli/models.test.ts` 16、`registry.test.ts` 3。
- S2 模块扩展（保持既有测试全绿）：`CliRunResult` 增加 `failure`，`runCliCommand` 增加可注入 `input`/`cwd`/`signal`；`LocalCliDefinition` 增加 `printArgs` 与 `modelFlag`。
- 本轮修掉的类型问题：`resolveEffectiveModel` 的 env 参数改为 `ModelEnv = Readonly<Record<string, string | undefined>>`（测试不再需要伪造 `NODE_ENV`）；两处 S2 测试的 CLI mock 补齐 `failure: null`；路由测试的 `it.each` 元组改为显式 `Route` / `RequestBuilder` 类型。

### 0.3.0 S2

- `./init.sh` passed with Node.js `24.15.0`: 46 test files / 605 tests, coverage 94.79% statements, production build OK（lint 干净、`tsc --noEmit` 干净）。
- `npm run test:e2e` passed: 103 passed / 2 skipped across Chromium, Firefox, and WebKit；`e2e/settings.spec.ts` 由 7 个用例扩展到 15 个（真实 API 往返仍为 chromium-only）。
- `npm run desktop:package` succeeded；打包应用冒烟 `ELECTRON_SMOKE_TEST=1 ELECTRON_SMOKE_TEST_SECRETS=1 MD_CONVERTOR_SMOKE_KEY=sk-env-smoke-placeholder out/MD-Convertor-darwin-arm64/MD-Convertor.app/Contents/MacOS/MD-Convertor` 打印 `Preload bridge smoke passed: secrets.set function, encryptionAvailable true` 与 `Runtime secret smoke passed: TRANSLATE_NOT_CONFIGURED → TRANSLATE_PROVIDER_ERROR → TRANSLATE_NOT_CONFIGURED, env fallback TRANSLATE_PROVIDER_ERROR`（保存即时生效 → 删除即时生效 → 环境变量回退，全程未重启；冒烟结束后 `secrets.json` 为 `{}`，settings 已还原，无残留）。
- S2 测试计数：`src/lib/provider/endpoint.test.ts` 42、`credentials.test.ts` 9、`models.test.ts` 12、`src/lib/local-cli/registry.test.ts` 3、`scan.test.ts` 9、`models.test.ts` 12、`src/lib/settings/languages.test.ts` 10、四个路由测试共 47、`electron/runtime-secrets.test.mjs` 6。
- 修复记录：`cliEnvironment()` 改为复制 `process.env` 后删除 `MD_CONVERTOR_*`（同时解决 `NODE_ENV` 必填的类型错误）；`runCliCommand` 的 timeout 变量改为 spawn 之后的 `const` 以通过 lint。
- 0.3.0 未触碰转换/抽取/图片/Mermaid/既有安全限额管线，未改动 `currentVersion`（仍为 `0.2.1`），未运行 `npm run desktop:release`（其版本守卫锁定 `0.2.1`，且历史 ZIP 不可覆写）。

### 0.3.0 S1（历史）

- `./init.sh` passed with Node.js `24.15.0`: 34 test files / 455 tests, coverage 94.46% statements, production build OK.
- `npm run test:e2e` passed twice: 79 passed / 2 skipped across Chromium, Firefox, and WebKit (7 new settings cases; the real-store round trip is chromium-only because all projects share one temporary user data directory).
- `npm run desktop:package` succeeded; packaged app smoke (`ELECTRON_SMOKE_TEST=1 out/MD-Convertor-darwin-arm64/MD-Convertor.app/Contents/MacOS/MD-Convertor`) printed `Preload bridge smoke passed: secrets.set function, encryptionAvailable true`.
- S1 test counts: `src/types/settings.test.ts` 45, `src/lib/settings/store.test.ts` 14, `src/app/api/settings/route.test.ts` 23, `electron/env.test.mjs` 23, `electron/secrets.test.mjs` 11, `electron/preload.test.cjs` 17.
- 0.3.0 未触碰转换/抽取/图片/Mermaid/既有安全限额管线，未改动 `currentVersion`（仍为 `0.2.1`），未运行 `npm run desktop:release`（其版本守卫锁定 `0.2.1`，且历史 ZIP 不可覆写）。

### 0.2.1（历史）

- `npm run desktop:release` passed with Node.js 24.14.1.
- Baseline: lint, typecheck, coverage, production build, 28 test files / 322 tests.
- E2E: Chromium, Firefox, and WebKit, 60/60 checks.
- Stable live gate: WalkingLabs link/paste comparisons, 2/2.
- WeChat diagnostic: supplied article, 12/12 code blocks and 279 source lines matched in memory.
- Artifact: `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.2.1.zip`
- Size: `354,635,067` bytes
- SHA-256: `32c1d96af58a7701e6d2fe0bf619be0f8f224803355c6ef63aad43c85569463e`
- Package: version `0.2.1`, `arm64`, macOS 12.0+
- GitHub Release: https://github.com/haohaiHuang/MD-Convertor/releases/tag/v0.2.1

## Open Constraints

- **feat-030 起云端只能有一条配置**：设置页只渲染一张 `<article aria-label="云端 Provider">`，读写「当前生效的那条」（`activeProviderId` → 否则 `providers[0]`），保存时把 `cloud.providers` 收敛为单条目。契约（`providers[] + activeProviderId`）与 `SETTINGS_VERSION` 未变，但**手工在 `settings.json` 里追加的多条 Provider 会在下次保存时被丢弃**；要做多条并存必须先恢复列表 UI（`feat-026` 的 `drafts`/`newProvider` 版本可从 git 历史取回）。
- **feat-026 / feat-029 / feat-030 之后「保存」是 Provider 记录的唯一写入入口**：`拉取模型` 只读端点（结果先放草稿态），模型与密钥都不再随意落盘，因此改完名称 / Base URL / 密钥 / 模型后必须先点「保存」才生效；密钥来源只有系统密钥库一个（`apiKeyEnv` 已退役）。
- **feat-025 隐藏了自定义语言入口（保留字段与函数）**：`languages.custom` 仍在契约里、`addCustomLanguage()` 与其单测仍在，存量自定义标签仍出现在目标语言下拉里；但新标签暂时只能靠手改 `settings.json` 添加。若将来要恢复入口，只需恢复 `settings/page.tsx` 的那段 JSX 与 `setNote("language", …)` 分支。
- **`0.3.2` 已过门禁并已装本机（2026-09-20）**：ZIP 为 `358,726,788` bytes / SHA-256 `8fb7a93f…f1ba`，已在 `/Applications/MD-Convertor.app`；**已提交（`1c3ed80`）、推送并发布为 GitHub Release `v0.3.2`**（tag `1c3ed80`，资产 `358,726,788` bytes 状态 uploaded）。`0.3.1` 已发布为 GitHub Release `v0.3.1`（tag `af7f6db`，ZIP `358,723,706` bytes / `c7411c58…161b`）；`out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.0.zip` 仍留在本机，只作历史，**不要在后续门禁里把它当成当前产物**；**`0.3.3` 已用掉**（已过门禁、已装本机），下一次发布必须先把版本号升到 `0.3.4` 或更高（门禁硬校验目标版本）。
- **feat-033 起本地服务从包内 Helper 启动**：`electron/main.mjs` 用 `resolveServerBinary(process.execPath)`（`electron/server-binary.mjs`）拿到 `Contents/Frameworks/MD-Convertor Helper.app/Contents/MacOS/MD-Convertor Helper` 再 spawn（仍带 `ELECTRON_RUN_AS_NODE: "1"`）。因该 helper bundle 声明 `LSUIElement`，子进程不再占程序坞。**不要改回 `process.execPath`**（会重新出现跳动的黑色 exec 图标）；helper 缺失时函数会抛 `Desktop helper runtime is missing: <path>`，这是刻意保留的响亮失败。此约束依赖 electron-forge 默认的 helper bundle 布局，若将来换到不带 helper 的打包方式需要同时改这个函数与它的 3 个单测。
- **feat-037 起「清除」是云端卡片的唯一重置入口**：`clearCloudProvider()`（`src/app/settings/page.tsx`）一下删密钥库条目 + 清表单草稿 + 写 `cloud: {providers: [], activeProviderId: null}`，卡片回到「未配置」；密钥行已经没有按钮，**要换密钥只能先「清除」再重填整张卡片**（用户 2026-09-21 选定的语义）。按钮不区分有没有东西可清（未配置时等于重置输入），没有二次确认；无 preload 桥时只能清 settings、删不掉密钥库条目（会留下无人引用的密钥，与保存失败时的孤立密钥同一类）。
- **feat-031 起密钥输入框在已保存时为只读**：`readOnly={Boolean(cloudProvider?.keyStored)}`，占位文案「••••••••（已保存，清除后可重新填写）」。不用 `disabled` 是为了保留可聚焦与屏幕阅读器可达；「清除」（feat-037）会删密钥库条目并把 `providers` 清空，清完输入框自然恢复可编辑。不要把密钥读回页面。
- **批次数由「≤20 块」而非字符数主导**：长文段落多时批次数偏多、`pi` 的固定启动开销被重复支付（实测 8,000 字符批次 7s，含启动）。修复后已能跑完，因此**未**改动 `TRANSLATE_BATCH_MAX_BLOCKS`；若将来同类文章仍然慢，把这个上限提高是第一个候选优化（代价：单批输出更长，解析与质量风险上升，需另开测试）。
- The app is not Developer ID signed or notarized. Gatekeeper may require an explicit Open action or removal of the quarantine attribute after the checksum is verified.
- **Provider 密钥只有一个来源（feat-026 起）**：系统密钥库加密项（`safeStorage` → `secrets.json`）经主进程注入运行时表；`apiKeyEnv` 与 `<userData>/.env` 的环境变量来源已退役（旧键在读取时被容忍、写出时丢弃，未升 `SETTINGS_VERSION`）。因此手工改 `settings.json` 已无法配置密钥，必须通过设置页保存。
- **QA-013（accepted，feat-027 引入）**：单次调用上限 60s → 180s 后，一个不再响应的 Provider 会把任务占住到 `批次数 × 180s + 30s` 才报超时（任务总预算与「取消」仍是兜底）。实测依据：单批推理耗时 38–60s，60s 上限必然在读体途中切断。若将来觉得太慢，候选方案是调小云端批次大小或把上限做成设置项（都属产品决策）。
- **QA-012（已关闭，2026-09-20）**：`next` 升到 16.3.5、`sharp` 升到 0.35.4（连带 `@img/sharp-*` 0.35.4 / `@img/sharp-libvips-*` 1.3.3）后，`npm audit --omit=dev` 为 **0 漏洞**；原先的 1 critical（`next` 16.0.0–16.3.2 未认证 RCE）、1 high（`sharp` < 0.35.4 libheif）与 1 moderate（`baseline-browser-mapping`）都不再出现。剩余 28 条仅在 electron-forge 构建链的开发依赖里。详见 `docs/QUALITY-AUDIT.md`。
- **发布门禁已按用户授权的方案 A 改造（2026-09-18）**：`~/Downloads/MD-Convertor-0.1.3-release/` 与 0.1.0–0.2.0 的 ZIP 在本机已丢失且无法恢复，因此缺失项不再阻断发布：`assertProtectedArchive` 缺文件返回 `{status:"retired"}`，`captureHistoricalZipSnapshot` 只校验仍然存在的条目，`listRetiredHistoricalZips()` + `HISTORICAL_ARCHIVE_RETIRED_NOTICE` 在发布结尾列出退役项。**仍然保留的硬校验**：已存在的归档被改动或可写 → `PROTECTED_ARCHIVE_ERROR`/`HISTORICAL_ZIP_ERROR`；目录中出现未登记的发布 ZIP → 拒绝；`assertProtectedBaseline`（`v0.1.3` 标签 → `ce041c9`）不变。因此门禁不再能举证「发布之后归档被删」——该风险已因归档永久丢失而失效。
- **归档不可恢复证据（已穷尽本机路径，2026-09-18）**：废纸篓为空（Finder 查询无条目）；iCloud Drive（`~/Library/Mobile Documents/com~apple~CloudDocs`）内无 MD-Convertor；`/Volumes` 只有 `Macintosh HD`（无外接盘）；未安装任何备份工具（Arq/Backblaze/Dropbox/Resilio 等均无）；`tmutil` 无本地快照且未配置 Time Machine 目的地；仓库脚本不删除归档（`scripts/` 中只有哈希校验引用）；`~/Downloads` 目录 mtime 为 `9月16 13:28`。GitHub releases：`v0.2.1` 带资产且大小 `354635067` 与本记录完全一致（已重下并验证哈希一致，见下条），`v0.2.0` 无资产，`v0.1.0`–`v0.1.3` 无 release ⇒ 0.1.x 永远取不回。用户确认未移动过这些文件。
- **0.2.1 锚点状态**：`~/Downloads/MD-Convertor-archive/releases/MD-Convertor-darwin-arm64-0.2.1.zip`，354,635,067 bytes，SHA-256 `32c1d96af58a7701e6d2fe0bf619be0f8f224803355c6ef63aad43c85569463e`（与 0.2.1 记录逐字节一致，`unzip -t` 无错），已列入 `PROTECTED_HISTORICAL_ZIP_MANIFEST` 并在每次发布时被强制校验。若将来 0.1.x/0.2.0 归档重新出现，守卫会自动恢复严格校验，**不要从清单中删除已退役条目**。
- 本机网络现状（2026-09-18 实测）：`github.com` 返回 200、`api.github.com` 可用（与 2026-09-17 记录的不可达不同）；`release-assets.githubusercontent.com` 未重测。若 Electron 二进制再次需要下载，仍可用 `ELECTRON_MIRROR=https://registry.npmmirror.com/-/binary/electron/ npx install-electron`。Playwright 浏览器已按 `npx playwright install chromium firefox webkit` 安装（revision 1228/1532/2311），`node_modules/electron/dist` 存在。
- `electron/preload-contract.cjs` 与 `electron/preload.cjs` 中通道名/长度上限是重复的常量：沙箱 preload 不能 require 相对路径，故 `electron/preload.test.cjs` 断言两者一致，改通道名时必须同时改这两处。
- 0.3.0 起内容隐私边界变化：勾选翻译后正文会发送到用户自行配置的端点（本机 CLI 或云端 Provider）。MD-Convertor 自身仍不上传内容、不建历史；`docs/PRODUCT.md`/`PRODUCT.zh.md` 的隐私段与两份 README 已在 S6 T6.3 按 PRD §5 改写。
- 端点策略现状（S2）：`/api/provider/models` 与 `/api/local-clis/models` 会真实访问用户配置的地址（默认仅本机/私网与公网单播地址，除三个云元数据地址外）；`/api/runtime/secrets` 只接受本进程内的密钥推送，不落盘、不记日志，也不会与 settings 里的 Provider 列表交叉校验（因此可在 Provider 保存前先推送密钥）。
- **首页布局有像素级断言**：`e2e/home.spec.ts` 的「富文本转换表单」用例断言转换按钮右边缘与粘贴框右边缘差值 `< 4px`（默认视口），并断言按钮与「来源 URL」输入框同行。改动 `.sourceInput` 的 `flex`、加宽按钮或调整 `.sourceRow` 的 gap 都可能让它转红 —— 这是刻意的（该对齐是用户明确要求的效果）。
- Chromium/Electron 冒烟只覆盖单一平台；`npm run test:live` 仍是联网发布前门禁，不进入日常单元测试。
- 测试规模增大后观察到的偶发（本机负载相关，均为一次性，未复现）：`./init.sh` 有一次 `src/lib/images.test.ts` 单点失败（该文件单跑与随后两次全量/带覆盖率全量均 605/605 通过）；`npm run test:e2e` 有一次 5 个 firefox settings 用例失败（随后两次全量 103 passed / 2 skipped 通过，firefox `--repeat-each=3` 42 passed / 3 skipped 通过）。推测与并行负载下的默认超时有关（未验证）；下次复现时先保留 `playwright-report/` 与失败用例名，再决定是否单独放宽超时。
- `npm run test:live:wechat` remains diagnostic rather than release-blocking because WeChat verification and timeout behavior varies.
- 翻译引擎（S3）只在进程内单任务锁下工作：analyze 与 run 共用一个槽位，同一时刻只允许一个翻译任务；这是「本机单人应用」的刻意选择，不做队列与并发控制。该锁是**进程级**的，因此 e2e 用 `workers: 1` 串行跑（否则同一批用例会互相撞出 429 `TRANSLATE_BUSY`）；若将来恢复并行，需要先让 e2e 服务器与用例隔离翻译锁。
- e2e 的真实设置存储是三个 project 共享的同一个临时目录；任何写真实设置的用例必须还原默认值，否则后续用例会带着 `translation.defaultEnabled: true` 自动翻译（S4 起主页面会读该设置）。
- 页面路径上不会出现 409 `TRANSLATE_ANALYSIS_STALE`（analyze/run 共用同一 markdown 字符串）；当前翻译不带人工编辑，因此仍无该分支与「重新判定」流程。
- 阈值决策的唯一入口是 `decideTranslation()`（`src/lib/translate/decision.ts`，常量 `SKIP_RATIO` / `CONFIRM_RATIO` 同文件）；页面侧不再有占位 seam，选择结果由 `translationScopeRef`（`src/app/page.tsx`）承载，每次新转换重置为 `"all"`。阈值本身没有设置项（S5 范围不含阈值开关）。
- `totalChars === 0` 是防御分支：引擎在 analyze 阶段就会用 400 `TRANSLATE_EMPTY_INPUT` 拒绝没有散文的文档，因此页面只在「analyze 响应自报零散文」时才走到该提示；e2e 用改写 analyze 响应覆盖它。
- 语言判定是**块级**的：一个段落只要含中文就整体判为目标语言，因此「中英混排段落」不会被局部翻译（PRD Q5.5 已确认的上限）。
- e2e 要构造特定占比时必须只改写 `/api/translate/analyze` 的响应（`route.fetch()` + 改 `ratio`/`totalChars`/`targetChars`/`blocks[].language`）；若改为手写整个 analyze 响应，`run` 会因块数不一致返回 409 `TRANSLATE_ANALYSIS_STALE`。fixture 段落等长才能得到精确占比（当前为 10 段，粒度 0.1）。
- 本机 `claude` CLI 账号当前无可用模型（默认 `claude-opus-4-8[1m]` 与 `sonnet`/`opus`/`claude-sonnet-4-5`/`claude-3-5-haiku-latest` 全部拒绝），因此 claude 路径只有注入 mock spawn 的单元测试证据，没有本机端到端证据；选 claude 的用户会看到 502 `TRANSLATE_PROVIDER_ERROR`（消息含退出码，不含 CLI 输出）。
- 语言判定按 BCP-47 主标签比较：`zh-Hant` 与 `zh-Hans` 视为同一目标语言，因此繁体正文在目标语言为 `zh-Hans` 时不会被列入待翻译块（已知上限，S5 的占比阈值 UX 不受影响）。
- No Windows, Intel Mac, hosted service, account, history, or cross-device synchronization is planned.

## Next Step

`feat-037`（云端卡片「清除」改为整卡重置）与 `feat-036`（抓取失败时提示改用粘贴）已实现并验证（`./init.sh` exit 0、三浏览器 e2e 187 passed / 2 skipped），**已提交并推送（`c568513`）、未跑发布门禁**；若要发布，先把版本号升到 ≥ `0.3.4`。`feat-033`（程序坞幽灵图标修复 + 版本 `0.3.2`）与 `feat-034`（`0.3.3`）均已完成、已过门禁、已装本机、已发布为 GitHub Release（`v0.3.2` / `v0.3.3`）。剩余待办：
5. **签名/notarization：用户 2026-09-20 决定不做**（`docs/QUALITY-AUDIT.md` 的 QA-008 已改为 accepted / not planned，判词与 Release Decision 同步）。要恢复需 Apple Developer 付费会员 + **Developer ID Application** 证书 + notarytool 凭据，再在 `forge.config.cjs` 加 `osxSign`/`osxNotarize`（凭据走环境变量）；签名后产物哈希会变，必须重跑门禁并更新记录。在那之前所有产物都只适合个人测试。
6. **UI 评审已完成，用户决定不整改（2026-09-20）**：用 design-references 环节 4 快速通道评审了 `0.3.1` 的网页与桌面 UI（真实截图 + `getBoundingClientRect` 实测 + WCAG 对比度计算 + 键盘 Tab 焦点扫描 + `design_audit`/`design_contrast`），产出 `docs/UI-REVIEW-2026-09-20.md`（P0×6 + P1×10，均附实测数字；配套的现状/改后对照板是临时 HTML，用户看过即删）。用户看过对照板后决定**全部不改**。因此 `e2e/home.spec.ts` 的像素级对齐断言（转换按钮右边缘与粘贴框右边缘差值 < 4px、与「来源 URL」输入框同行）继续是刻意锁定的效果 —— 若将来真要改 `.sourceInput` 的 `flex`、按钮宽度或 `.sourceRow` 的 gap，先改断言。**不要在没有新证据、也没有用户指认具体条目的情况下重提这批发现。** 本轮代码零改动，`settings.json` 在校验探针前后 SHA-256 一致。

不要重做 S1–S6 与 `feat-024` – `feat-037` 已完成的部分；不要放宽端点、密钥或归档守卫；不要把已退役的历史 ZIP 条目从 `PROTECTED_HISTORICAL_ZIP_MANIFEST` 中删除。
