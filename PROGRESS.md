# Project Progress

## Current State

- Last updated: 2026-09-24（第十轮：**`feat-042`（A 桌面端「文档处理」）规划完成**——PRD §3 六条逐条裁定 + 新增 R8 首页模式选择器 / R9 插件下载 ZIP；`docs/features/app-document-processing/{FSD.md,S1,S2,S3,S4}` 就绪；**零代码、零版本变动**）
- Current version: `0.3.6`，**已发布**为 GitHub Release `v0.3.6`（`package.json`、`package-lock.json`、`feature_list.json`、`scripts/release-desktop.mjs` 均为 `0.3.6`；产物 235,956,668 bytes / SHA-256 `9b89d55c…f351`；已装到本机 `/Applications`）。**本轮不动桌面代码，所以不 bump 到 `0.3.7`**（bump 只由桌面代码改动触发；插件版本自管，`extension/manifest.json` 仍是 `0.1.0`）
- Active feature: **`feat-042`（A 桌面端「文档处理」），`in-progress`，代码一行未动**。规划于 2026-09-24 定稿：阶段划分 S1（目录与设置）→ S2（单文件加工管线）→ S3（首页模式与批量编排）→ S4（插件分发包与验收），各阶段文档在 `docs/features/app-document-processing/`。`feat-040`（B 浏览器插件）已于同日关闭（S1/S2/S3 完成、T3.4 人工验收 6 条全过）；两者无顺序、无代码依赖。（`feat-041` 已完成、已发布、已关闭）
- Next step: **开工 S1**（`docs/features/app-document-processing/S1-directory-and-settings.md`），第一件事 T1.0：bump `0.3.6 → 0.3.7` 并同步 6 处版本面（`package.json`、`package-lock.json`、`feature_list.json`、`scripts/release-desktop.mjs`、`scripts/release-guards.test.mjs`、`AGENTS.md` 的 Verification 版本句）。只读该 feature 的 `FSD.md`（§2 的 7 条可否决默认必读）与本阶段文档即可。另有一条陈旧待办：云端 Provider 端到端实测仍需用户用真实文章走一遍（与 feat-041 无关）。**发布 `0.3.7` 未获授权**（`desktop:release` 当前只允许 `0.3.6`）。
- Branch: `main`，**本地领先 `origin/main` 1 个提交**（第十轮 A 规划定稿，已提交未 push；自指的 commit hash 故意不写——每次 amend 都会变）——上一个推送点是 B 插件整条线路（已推 `24bf00f` → `335e0d4`，16 个提交）；stash@{0} 是 2026-09-21 拉取前的文档备份、与当前工作无关
- Scope: unsigned Apple Silicon Mac personal-test application; macOS 12.0+（桌面产物）；浏览器插件另行验收于 Chromium，不进桌面发布门禁

## 本轮（2026-09-24 第十轮：`feat-042` 规划定稿）已完成

- **与用户逐条对齐 PRD §3 六条**：① 图片 **base64 内嵌**（不产 `<标题>.images/`）；② 设置页新增「输入目录」设置项，**默认系统下载目录** + 「恢复默认」按钮；③ 去重 **跳过并提示**；④ 反馈 = **逐条状态列表 + 收尾汇总**；⑤ **不自动打开**输出目录，只给输出路径 + 「打开目录」；⑥ 源目录 = 输出目录时 **拒绝**，一键改用 `<输入目录>/processed/`。
- **新增需求**：R8 首页顶部模式选择器（「转换既有文档」/「粘贴 · 链接转换」；选前者自动按默认目录扫描并列 `.md`，可单选/多选/全选、一键转化；翻译开关沿用现有逻辑、**不新增设置项**；可另选目录并自动重扫）；R9 选择器下方的插件下载按钮（下载含使用说明的 ZIP）。
- **产出阶段文档**：`docs/features/app-document-processing/` 的 `FSD.md`（五条前提、需求拆解、§2 七条「替用户落的默认（可否决）」+ A1/A2 两条需点头的既有文件改动、架构 §4.1–§4.9、四阶段划分、验收、风险）+ `S1-directory-and-settings.md`（含 T1.0 版本 bump）/ `S2-document-pipeline.md` / `S3-home-modes-and-batch.md` / `S4-extension-package-and-acceptance.md`（含 12 条人工验收清单）。每个任务都有 RED 列与完成条件。
- **两处关键取舍**：图片在 **Markdown 层**内联（新增 `src/lib/local-docs/inline-images.ts`），否掉 md→HTML→`embedImages`→Turndown 回环（要新依赖且重排全文）；去重标记写成产物首行的 HTML 注释 JSON（**不建索引文件**）。插件 ZIP 由现有 `build:extension` 追加产出到 `public/md-convertor-extension.zip`，并加 `prebuild` 钩子保证 `next build` 前总已产出。
- **同步**：`docs/PRD-app-document-processing.md`（§3 改裁定表、§3.1 R8/R9、§4 三条非目标、头状态）、`docs/PLAN-browser-extension.md`（§2/§3/§6.4）、`AGENTS.md`（当前阶段段 + features 在册列表）、`feature_list.json`（feat-042 → `in-progress`、`activeFeature = "feat-042"`、scope/acceptance/verification 补本轮事实）、`docs/QUALITY-AUDIT.md` Archived Round Log。
- **门禁**：`NODE_OPTIONS= ./init.sh` **exit 0**（Node 24.15.0，79 files / 1067 tests）。**零桌面代码改动、零版本变动**（`currentVersion` 仍 `0.3.6`，bump 是 S1 T1.0），未跑 `desktop:release`、未跑 `test:e2e`、未 push。

## 上一轮（2026-09-24 第九轮：T3.4 全部通过，`feat-040` 关闭）已完成

- 用户回报 T3.4 第 5 条（40 图长文 / MV3 休眠）通过 ⇒ **6 条全过**；`feat-040` 置 `done`、`activeFeature` 置 `null`。第 5 条没被打断 ⇒ FSD §6 预留的 20s 心跳保活**未落地**，`worker-run.ts` 未动，并发上限仍 4。
- 补上第八轮推迟的文档：`docs/PRODUCT.md` / `.zh.md`（支持范围 + 隐私段一句）、`README.md` / `.zh.md`（主要能力一行）。零代码、零版本变动；`./init.sh` exit 0。

> 2026-09-24 第五至八轮（S2 内容脚本与下载编排 / S2 收尾 / S3 端到端集成 / T3.4 部分通过）的逐轮叙述已压进 `docs/QUALITY-AUDIT.md` 的 `## Archived Round Log`；实施细节的权威位置是 `docs/features/browser-extension/S2-*.md` 与 `S3-e2e-and-acceptance.md` 的 `## Result` / `## Handoff`，逐任务证据在 `feature_list.json` 的 `feat-040.verification`（35 条）。本节不再重复，以免每次会话都把已归档的轮次带进上下文。

## 三条已固化的教训（都已写进约束清单）
- **范围蔓延**：用户的需求只是「加一个默认下载目录」，我却顺手把打包收窄、firefox 解锁、既有 flake 修复、自建 skill 都塞进了同一轮收尾，被用户明确指出「我只是搞一个文档下载路径，你为什么要搞这么多有的没的」。**后续遇到范围外问题（发现缺陷、flaky 用例、基建改进），先单独提出来问，不要顺手做。**
- **「私有文档」的定性是错的**：T3.0 最初的理由写成「私有工作文档会随发布物公开」。核实后发现仓库是 public，`PROGRESS.md` / `session-handoff.md` / `feature_list.json` / `AGENTS.md` / `docs/**` 早已在 `origin/main` 上公开，打包不构成新增暴露；唯一真正非公开的是 `.workbuddy/memory/*.md`。收窄仍然正确，理由已就地更正。
- **把「我试过的一次失败」当成「不可能」是懒惰归因**（firefox）：我先宣布 firefox 在沙箱内不可跑并让用户补跑，用户追问后才发现官方开关 `MOZ_DISABLE_CONTENT_SANDBOX=1` 一直就在那里。看到底层错误码时，先查被启动的程序有没有为这种情况准备的官方开关。

## 仍然生效的约束

- **`session-handoff.md` 只写现役（≤150 行 / ≤25KB）**：阶段间交接写对应阶段文档的 `## Handoff`，轮次历史每条 ≤10 行进 `docs/QUALITY-AUDIT.md` 的 `## Archived Round Log`；需要旧叙述时用 `git show ab1d653:session-handoff.md`，不把历史搬回本文件。
- 跑门禁必须用 Node **24.14.1 或 24.15.0**——本机默认 v24.16.0 解压 electron zip 时静默卡死，`electron-forge make` 空跑却 exit 0。
- 所有代码开发遵循 TDD（RED → GREEN → REFACTOR），证据写入 `feature_list.json`。
- `output` 缺失宽容读入是严格校验的唯一放宽点（仅新增字段、仅缺失时）；不得扩散到其他字段。
- filename 穿越校验在 preload 与 main 双层都要做——两层是独立防御，谁也不能删。
- 路径校验里 `~` **只在路径段开头**才算家目录简写；`com~apple~CloudDocs`（iCloud 云盘）里的波浪号是普通字符。别再写 `value.includes("~")`，那会把真实用户最常用的目录全部拒掉。
- preload 的校验函数是**抛异常**（`TypeError`）而不是 resolve `{ ok: false }`，所以任何 `await bridge.*` 都必须带 `.catch()`；否则异常会被 `void xxx()` 吞掉，表现为「点了没反应」。mock 桥接的 e2e 抓不到这类问题——桩要能抛。
- 真机探针的目录必须包含**真实用户会选的路径形态**（至少一条 iCloud 路径），只用 `/tmp/...` 的探针等于没测路径校验。
- `forge.config.cjs` 的 `ignore` 是**保留清单**（「只留 `package.json` + `electron/`」的反向正则），不是黑名单。新增仓库顶层文件/目录时不需要改它；**但要新增运行时模块，必须放在 `electron/` 下**，否则不会进包 —— `tests/forge-package-scope.test.ts` 会从 `main.mjs` 的 import 反推并拦下。
- 该 `ignore` 必须保持**数组**形式：`@electron/packager` 只在数组形式下追加 `DEFAULT_IGNORES`（`.git`、锁文件、`*.o`、`node_modules/.bin`）；换成文档推荐的 `IgnoreFunction` 会静默丢掉这些默认项。
- 判断「某个包带没带某项修复」，不要只看字符串命中：asar 收窄前会命中文档文本。正确做法是 grep 新包 `static/chunks/` 得到指纹 chunk 名，再 `curl` 运行中实例的该路径（404 = 仍是旧构建）。
- **`MD_CONVERTOR_USER_DATA` 不能用来隔离打包应用**：`electron/env.mjs` 的 `buildServerEnv()` 无条件用主进程算出的 `userDataDir` 覆盖它。真机探针一定会碰到用户真实的 `settings.json` 与开关指向的真实目录，必须走「备份 → 跑 → 比对 → 还原 → 删产物」五步（详见 `feature_list.json` 的 T2.8 environment trap）。
- 下载分叉是**三重条件**（开关 && 目录 && 桥接），且失败路径必须降级浏览器下载并告知原因，不得吞错。
- e2e 写设置必须用「取真实响应后只改写 `output` 再 fulfill」，不要 PUT 真设置——e2e 设置目录是全 project 共享的，泄漏会连坐其他引擎。
- **Firefox 在受限沙箱内靠 `MOZ_DISABLE_CONTENT_SANDBOX=1` 才能启动**（已固化进 `playwright.config.ts` 顶部，`??=` 形式所以调用方可用 `=0` 关掉）。原因：macOS 禁止嵌套沙箱，Firefox 给 content process 套 Seatbelt 时 `sandbox_init()` 返回 EPERM。**别改用 `firefoxUserPrefs: { "security.sandbox.content.level": 0 }`** —— 实测进程被 SIGKILL（exit 137）。只需这一个变量，GMP/RDD/Socket 三个同名开关各自都无效。
- 跑 `npm run test:e2e` 前**清掉代理环境变量**（`unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy`，并设 `NO_PROXY=127.0.0.1,localhost`）：Playwright 继承它们，而 Firefox 还会读系统代理，历史上出现过 `NS_ERROR_PROXY_CONNECTION_REFUSED` 的偶发失败。
- **比较布局矩形必须用 `e2e/geometry.ts` 的 `rectsInOneFrame`，不要连着调两次 `boundingBox()`**：每次调用都是独立往返，两次之间的滚动会被量成「布局错位」（Base URL 行在 firefox 上 15% 概率假报 131px 错位，`scrollY` 132 精确解释差值）。等 `document.fonts.ready` 解决不了它——那跑在触发滚动的 `fill()` 之前。
- **`npm run test:e2e` 是门禁不是内循环**（约两分钟，`workers: 1` 是翻译任务锁要求的）。迭代用 `npx playwright test`（复用 `.next/standalone` 现有构建、跳过重建）+ `--project=chromium` + `-g` 收窄；验证时序竞态用 `--repeat-each=20` 量级即可。**源码改动后不要跳过重建直接跑**，那会测到旧构建。
- 中途被杀掉的 e2e 运行会在 3000 端口留下服务；`reuseExistingServer: false` 是刻意的（保证每轮从本轮构建起服务），处置办法是核实 PID 后按精确 PID 结束，**不能按模式盲杀**。
- **在 agent shell 里启动打包应用要先 `env -u ELECTRON_RUN_AS_NODE`**：Electron 宿主（WorkBuddy、VS Code 等）会把 `ELECTRON_RUN_AS_NODE=1` 传给子 shell，Electron 二进制读到它会以纯 Node 启动——症状是日志里出现 `Welcome to Node.js v24.x` 与 `>` 提示符并卡在 stdin，像卡死而不像报错。同时加 `NODE_OPTIONS=` 清掉宿主注入的 `--require`。
- **外层已有沙箱时 Chromium 无法再给自己套沙箱**（`sandbox initialization failed: Operation not permitted` → GPU 进程 exit 6 → `FATAL: GPU process isn't usable. Goodbye.`，exit 133）。这与 Playwright Firefox 是同一根因，属环境限制而非产物缺陷：同一 bundle 从 Finder 启动一切正常。沙箱内可用 `--no-sandbox --disable-gpu` 拿功能证据，但**规范的那一次必须在 Terminal 里跑**。
- 装本机时**安装源用发布 ZIP 解压，不要用正在运行的 `out/` bundle**——既避免复制活着的 bundle，也让「装上的就是发布的那一个」可证。旧安装先 `mv` 到归档目录（可恢复），不要 `rm -rf`。
- **扩展轮次不动桌面**：只改 `extension/` 的轮次不改 `src/` `electron/` `forge.config.cjs` `playwright.config.ts`，不跑 `desktop:release`，也不把 `0.3.6` bump 到 `0.3.7`（bump 只由桌面代码改动触发）；插件版本由 `extension/manifest.json` 自管。详见 `AGENTS.md` 的 Working Rules 与 Verification。
- **扩展测试两层进 `./init.sh`、构建与集成不进**：① 纯函数单测（vitest + jsdom）② `chrome.*` 打桩编排单测（依赖注入，不装 sinon）随 `npm test` 进 `init.sh`；③ 浏览器内冒烟 ④ 真实 MV3 扩展集成走 `npm run test:extension`（自带 `playwright.extension.config.ts`，不碰桌面 e2e 项目与 `run-e2e.mjs`）；⑤ 工具栏点击与 `activeTab` 授权只能人工验收。
- **插件核心只收 DOM、不收 HTML 字符串**：`turndown` 的 `package.json` 有 `"browser": { "@mixmark-io/domino": false }`，esbuild 会把 domino 映射为空 stub（这正是浏览器产物零 Node 残留的机制）；喂字符串会拿到空 stub 而不是解析器。净化实例与时间戳一律**注入**（Node `createDOMPurify(window)`、浏览器 `DOMPurify` 本身）。因此在类型上也收 `HTMLElement`，不留一个字符串重载。
- **Readability 会丢掉所有 `data-*`**：惰性图必须在 `cloneNode(true)` 之后、`new Readability(...)` **之前**提升 `data-src`/`data-lazy-src` 到 `src`，否则正文里留的是占位图（桌面端只有微信分支做提升，插件两条分支都做）。
- **Readability 会把导航栏当正文返回**：两条提取分支都要跑 `MIN_TEXT_LENGTH = 50` 的字符下限，挑不出正文就返回 `null`（插件不做整页兜底，这是刻意与桌面端不同）。
- **`playwright.extension.config.ts` 的 `testMatch` 必须是 `**/*.spec.ts`**：`extension/tests/` 里同时住着 vitest 单测（`extension-build.test.mjs`），默认匹配会被 Playwright 收走并报 `Vitest failed to access its internal state`。同理，spec 里的 fixture 路径用 `path.resolve(__dirname, "../..")`（`__dirname` 是 spec 所在目录，不是项目根）。
- **`esbuild` 必须精确锁 `0.28.1`**：写 `^0.28.1` 会解析到 0.28.2 并重写约 215 行 lock（本轮已踩过）。
- **扩展的可测逻辑一律放 `worker-run.ts`（或更小的纯函数模块），不放 `content.ts` / `worker.ts`**：后两者是浏览器专用入口、不进 vitest 覆盖率，塞进去等于没有门禁。角标与失败原因映射就是这么放进去的（`ChromeDeps` 因此多一个 `action` 成员）。
- **payload 等待用的是全局 `setTimeout`，不受注入的 `timers` 影响**：测 `TIMEOUT` 分支必须 `vi.useFakeTimers()` + `advanceTimersByTimeAsync(10_000)`，用完还原；`timers` 只推进图片轮询与角标清空。
- **扩展的三处覆盖率阈值取「实测值之下一点」**（`worker-run.ts` 95/85/85/95、`references.ts` 100/90/100/100、`write.ts` 全 100）：阈值只用来拦回归，不假装已经测满；要抬阈值先补测试。
- **`npm run test:extension` 会先跑 `build:extension`；扩展套件实测不需要沙箱开关**（裸跑 15 passed / 4.2s）。`MD_CONVERTOR_EXTENSION_CHROMIUM_ARGS` 只是逃生舱；**需要 `--no-sandbox --disable-gpu` 的是打包后的 Electron，不是 Playwright 自带的 Chromium**，别把桌面那条环境限制套到扩展测试上（§ 上面的 Electron 沙箱条目另算）。
- **`chrome.downloads.download()` 在下载「开始」时就 resolve，`run()` 不等它写完**（`worker-run.ts` 的 `writeMarkdown()` 之后直接返回）：读落盘 md 前必须等 `chrome.downloads.search()` 里 `state === "complete"`，否则约 1/10 的概率读到空/截断内容（这正是 T3.1–T3.3 那两次不可复现的 flake）。装置已固化在 `extension/tests/harness.ts` 的 `waitForDownloadComplete()`；图片不受影响（`waitForImage` 在 `run()` 返回前就等到了）。
- **整篇图片全失败会留下一个空 `<标题>.images/` 目录**：Chrome 先建目标目录再发请求，中断只删半成品文件，而 `chrome.downloads` 删不了目录。断言按「不存在或为空」，不要去调 `removeFile` 硬删 —— 这是接受的已知行为，不是缺陷。
- **`activeTab` 授权只能来自真实点击**，Playwright 点不到浏览器 chrome：集成测试走 `copyExtensionWithHostPermission()`（把 `extension/dist` 拷到临时目录给那一份副本加 `host_permissions`）后直接调 service worker；没有这一手，无手势注入会报 `Cannot access contents of the page…`（S2 探针 1 已实测）。
- **fixture 站用 `node:http` + 临时端口（0），不引入框架、不用固定端口**：`extension/tests/fixtures/server.ts` 把 `origin` 交回调用方，并行/重复跑都不会撞端口；它自己的单测 `server.test.ts` 属第 1 层，随 `init.sh` 跑。fixture 写成 `.ts` 而非 `.mjs`（`.mjs` 导入在 TS program 里是 `TS7016`；vitest 收 `.test.ts`、Playwright 的 `testMatch` 只收 `*.spec.ts`，两者不会打架）。
- **插件与桌面端的引用口径**：md 里先写 `md-convertor-image-<n>` 占位符（纯词，不含 `:` `/`，Turndown 不会改写），落盘后用 `chrome.downloads.search()` 的**真实 basename** 回写引用（浏览器可能自己补扩展名）；真实父目录名 ≠ 请求的 `<标题>.images` 时按失败处理，退回原 URL，不写指向找不到的文件的引用。
- **Playwright 跑扩展时下载会被改名（S2 探针实测）**：Playwright 对 persistent context 一律先发 CDP `Browser.setDownloadBehavior{behavior:"allowAndName"}`，每个下载都被写成 `<guid>`（无扩展名、丢掉请求的子目录）——不修装置就测不出「文件名是否被补扩展名」「相对子目录路径」「同名覆盖」这三条。修法两步：profile 里预写 `Default/Preferences` 的 `download.default_directory`，启动后自己再发一次 `behavior:"default"`；**`downloadsPath` 选项不能碰**（它就是 `allowAndName` 的入口），`acceptDownloads` 传什么都被归一成 `accept`。
- **TS 6 不再自动收 `@types`**：`node_modules/@types/*` 不会自动进 program（本项目的 `@types/node` 是被 `next-env.d.ts` → `next` 间接带进来的），所以 `@types/chrome` 必须显式引用 —— 靠 `extension/src/chrome-types.d.ts` 里一行 `/// <reference types="chrome" />`（零 import）覆盖扩展全部文件；新增用 `chrome.*` 的文件不要再逐个加指令。
- **同名用 `overwrite` 而不是 `uniquify`**：`uniquify` 只改 md 名（`标题 (1).md`）、目录名不变，一次重复导出就把文件对拆散；这也是不加时间戳的理由。
- 签名/notarization 不做（QA-008 accepted，2026-09-20 用户决定）；UI 评审结论勿重提（2026-09-20 全部不整改）。
- **A 块（`feat-042`）已定稿、未动工**：阶段文档在 `docs/features/app-document-processing/`，实施从 `S1` 开始且 **T1.0 第一件事就是 bump `0.3.7` + 同步 6 处版本面**（漏一处 `desktop:release` 就拒跑；发布 `0.3.7` 需用户单独授权）。三条已定约束：图片内联在 **Markdown 层**复用 `src/lib/images.ts`（不另写一套 sharp/尺寸判断，提为导出是行为不变的 A1 重构）；**服务端路由只读、写盘只经既有 `outputBridge().saveFile()`**；A 的 e2e **不得读真实下载目录**（默认目录的解析只在路由单测里注入环境变量验证），桥接桩必须能抛。
- 云端 Provider 端到端实测仍待用户用真实文章走一遍（与 feat-041 无关的遗留项）。

> 历史轮次的完成记录（feat-018 – feat-039 及更早）已归档：逐 feature 的验证证据见 `feature_list.json` 对应条目的 `verification` 字段；发布产物、门禁计数与风险登记见 `docs/QUALITY-AUDIT.md`（含 `## Archived Round Log`）；测试口径与产物哈希见 `docs/TESTING.md`；Git 提交历史保留全部实现细节。
