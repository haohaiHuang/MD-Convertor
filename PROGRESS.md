# Project Progress

## Current State

- Last updated: 2026-09-24（第四轮：PROGRESS 瘦身 + S2 扩展外壳；T2.0 探针已完成）
- Current version: `0.3.6`，**已发布**为 GitHub Release `v0.3.6`（`package.json`、`package-lock.json`、`feature_list.json`、`scripts/release-desktop.mjs` 均为 `0.3.6`；产物 235,956,668 bytes / SHA-256 `9b89d55c…f351`；已装到本机 `/Applications`）。**本轮不动桌面代码，所以不 bump 到 `0.3.7`**（bump 只由桌面代码改动触发；插件版本自管）
- Active feature: **`feat-040` 浏览器插件（B）—— 状态 `in-progress`，S1（转换核心）已完成，S2 进行中（T2.0 探针已完成，T2.1 起待做），提交均在本地未 push**（`feat-042` 桌面端文档处理（A）仍为 `planned`，无顺序与代码依赖；`feat-041` 已完成已发布已关闭）
- Next step: **S2 继续 —— T2.0 事实探针已出结论并入库**（四条设计关键事实 + 一条「绝对路径被拒」见 `S2-extension-shell-and-writes.md` 的「探针结果」表，机器化证据 `extension/tests/probe.spec.ts`）；**接着写 T2.1 起**：`extension/manifest.json`（v0.1.0；只有 `activeTab`+`scripting`+`downloads`、`host_permissions` 空、不声明静态 `content_scripts`）→ 消息契约 → content script → service worker 编排（命名/下载/引用回写/写 md/角标）→ `chrome.*` 打桩单测
- Branch: `main`；stash@{0} 是 2026-09-21 拉取前的文档备份、与当前工作无关
- Scope: unsigned Apple Silicon Mac personal-test application; macOS 12.0+（桌面产物）；浏览器插件另行验收于 Chromium，不进桌面发布门禁

## 本轮（2026-09-24 第四轮：PROGRESS 瘦身 + S2 扩展外壳）进行中

用户先批准「单独一次 doc 清理」，再指示继续 S2；**只写 `extension/` 与文档、零桌面改动，不 bump 版本、不跑 `desktop:release`、不跑 `test:e2e`。**

- **Step 0 文档瘦身已完成**（提交 `934e979`）：四段「上一轮…已完成」历史压进 `docs/QUALITY-AUDIT.md` 的 `## Archived Round Log`，并先补上 2026-09-22 插件线方向定稿那一条；`PROGRESS.md` −51/+3。
- **S2 / T2.0 事实探针已完成并发绿**：新增 `extension/tests/probe.spec.ts`（5 条用例，`npm run test:extension -- -g probe` 5 passed / 3.2s）。它在 `os.tmpdir()` 里现搭一个一次性 MV3 扩展 + 本地 HTTP 页，`afterAll` 全清，不入库任何产物。四条设计关键事实与一条附带事实已填进 `S2-extension-shell-and-writes.md` 的「探针结果」表：① SW **无手势注入不可用**（两个 tab 都报 `Cannot access contents of the page…must request permission`）→ 集成测试要用测试专用 manifest 变体，「工具栏点击 → activeTab 授权」只能人工验收；② 请求的 `filename` 无扩展名时**不补扩展名**（`text/markdown` 与 `image/png` 都原样落盘）→ 引用必须以 `search()` 的真实 basename 为准；③ `search()` 返回**含子目录的绝对路径** → 「父目录名 == `dirName`」核对成立；④ `overwrite` 是**真覆盖**（同一路径、单文件、无 ` (1)` 分身）→ 保留 `overwrite`；⑤ 绝对 `filename` 被拒 `Invalid filename` → 写盘一律相对路径。
- **探针顺手挖出一个装置坑（S3 必须照抄修法）**：Playwright 对 persistent context 一律发 CDP `Browser.setDownloadBehavior{allowAndName}`，于是每次下载都被写成 `<guid>`（无扩展名）且丢掉请求的子目录 —— 第一次跑探针就撞上（期望 `md-convertor-probe-noext`、收到 GUID），②③④ 在这个装置下**根本测不出来**。修法两步缺一不可：profile 里预写 `Default/Preferences` 的 `download.default_directory`，启动后再自己补发 `Browser.setDownloadBehavior{behavior:"default"}`；`downloadsPath` 不能碰（它就是 `allowAndName` 的入口）。
- **又一条事实**：TypeScript 6 **不再自动把 `node_modules/@types` 下所有包拉进 program**（项目的 `@types/node` 其实是被 `next-env.d.ts` → `next` 间接带进来的）。所以 `@types/chrome` 装好也不生效，必须显式引用 —— 新增 `extension/src/chrome-types.d.ts`（一行 `/// <reference types="chrome" />`，零 import），后续 worker/content script 共用这两行。
- **门禁**：`NODE_OPTIONS= ./init.sh` **exit 0**（Node 24.15.0，**75 files / 1035 tests**，statements 95.48%；扩展的浏览器内探针**不进** `init.sh`，按分层只走 `npm run test:extension`）。
- **仍未做**：没有 `manifest.json`、service worker、content script、任何 `chrome.*` 调用、`extension/dist/`；`CHANGELOG.md` 不加条目（无用户可见变化）。

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
- **扩展测试两层进 `./init.sh`、构建与集成不进**：① 纯函数单测（vitest + jsdom）② `chrome.*` 打桩编排单测（依赖注入，不装 sinon）随 `npm test` 进 `init.sh`；③ 浏览器内冒烟 ④ 真实 MV3 扩展集成走 `npm run test:extension`（自带 `playwright.extension.config.ts`，不碰桌面 e2e 项目与 `run-e2e.mjs`）。
- **插件核心只收 DOM、不收 HTML 字符串**：`turndown` 的 `package.json` 有 `"browser": { "@mixmark-io/domino": false }`，esbuild 会把 domino 映射为空 stub（这正是浏览器产物零 Node 残留的机制）；喂字符串会拿到空 stub 而不是解析器。净化实例与时间戳一律**注入**（Node `createDOMPurify(window)`、浏览器 `DOMPurify` 本身）。因此在类型上也收 `HTMLElement`，不留一个字符串重载。
- **Readability 会丢掉所有 `data-*`**：惰性图必须在 `cloneNode(true)` 之后、`new Readability(...)` **之前**提升 `data-src`/`data-lazy-src` 到 `src`，否则正文里留的是占位图（桌面端只有微信分支做提升，插件两条分支都做）。
- **Readability 会把导航栏当正文返回**：两条提取分支都要跑 `MIN_TEXT_LENGTH = 50` 的字符下限，挑不出正文就返回 `null`（插件不做整页兜底，这是刻意与桌面端不同）。
- **`playwright.extension.config.ts` 的 `testMatch` 必须是 `**/*.spec.ts`**：`extension/tests/` 里同时住着 vitest 单测（`extension-build.test.mjs`），默认匹配会被 Playwright 收走并报 `Vitest failed to access its internal state`。同理，spec 里的 fixture 路径用 `path.resolve(__dirname, "../..")`（`__dirname` 是 spec 所在目录，不是项目根）。
- **`esbuild` 必须精确锁 `0.28.1`**：写 `^0.28.1` 会解析到 0.28.2 并重写约 215 行 lock（本轮已踩过）。
- **`npm run test:extension` 会先跑 `build:extension`**；沙箱内需 `MD_CONVERTOR_EXTENSION_CHROMIUM_ARGS=--no-sandbox,--disable-gpu`（与桌面 Playwright 同源限制），没有外层沙箱时不要传。
- **插件与桌面端的引用口径**：md 里先写 `md-convertor-image-<n>` 占位符（纯词，不含 `:` `/`，Turndown 不会改写），落盘后用 `chrome.downloads.search()` 的**真实 basename** 回写引用（浏览器可能自己补扩展名）；真实父目录名 ≠ 请求的 `<标题>.images` 时按失败处理，退回原 URL，不写指向找不到的文件的引用。
- **Playwright 跑扩展时下载会被改名（S2 探针实测）**：Playwright 对 persistent context 一律先发 CDP `Browser.setDownloadBehavior{behavior:"allowAndName"}`，每个下载都被写成 `<guid>`（无扩展名、丢掉请求的子目录）——不修装置就测不出「文件名是否被补扩展名」「相对子目录路径」「同名覆盖」这三条。修法两步：profile 里预写 `Default/Preferences` 的 `download.default_directory`，启动后自己再发一次 `behavior:"default"`；**`downloadsPath` 选项不能碰**（它就是 `allowAndName` 的入口），`acceptDownloads` 传什么都被归一成 `accept`。
- **TS 6 不再自动收 `@types`**：`node_modules/@types/*` 不会自动进 program（本项目的 `@types/node` 是被 `next-env.d.ts` → `next` 间接带进来的），所以 `@types/chrome` 必须显式引用 —— 靠 `extension/src/chrome-types.d.ts` 里一行 `/// <reference types="chrome" />`（零 import）覆盖扩展全部文件；新增用 `chrome.*` 的文件不要再逐个加指令。
- **同名用 `overwrite` 而不是 `uniquify`**：`uniquify` 只改 md 名（`标题 (1).md`）、目录名不变，一次重复导出就把文件对拆散；这也是不加时间戳的理由。
- 签名/notarization 不做（QA-008 accepted，2026-09-20 用户决定）；UI 评审结论勿重提（2026-09-20 全部不整改）。
- 云端 Provider 端到端实测仍待用户用真实文章走一遍（与 feat-041 无关的遗留项）。

> 历史轮次的完成记录（feat-018 – feat-039 及更早）已归档：逐 feature 的验证证据见 `feature_list.json` 对应条目的 `verification` 字段；发布产物、门禁计数与风险登记见 `docs/QUALITY-AUDIT.md`（含 `## Archived Round Log`）；测试口径与产物哈希见 `docs/TESTING.md`；Git 提交历史保留全部实现细节。
