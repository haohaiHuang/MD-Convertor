# Project Progress

## Current State

- Last updated: 2026-09-24（第六轮：S2 收尾 —— T2.5 写盘单测、T2.6 角标反馈、T2.7 失败路径矩阵与覆盖率阈值、T2.8 产物范围收口；**S2 已完成**）
- Current version: `0.3.6`，**已发布**为 GitHub Release `v0.3.6`（`package.json`、`package-lock.json`、`feature_list.json`、`scripts/release-desktop.mjs` 均为 `0.3.6`；产物 235,956,668 bytes / SHA-256 `9b89d55c…f351`；已装到本机 `/Applications`）。**本轮不动桌面代码，所以不 bump 到 `0.3.7`**（bump 只由桌面代码改动触发；插件版本自管，`extension/manifest.json` 仍是 `0.1.0`）
- Active feature: **`feat-040` 浏览器插件（B）—— 状态 `in-progress`，S1（转换核心）与 S2（扩展外壳与写盘）均已完成，下一步 S3（端到端集成 + 真机人工验收），提交均在本地未 push**（`feat-042` 桌面端文档处理（A）仍为 `planned`，无顺序与代码依赖；`feat-041` 已完成已发布已关闭）
- Next step: **S3 起（先读 `docs/features/browser-extension/S3-e2e-and-acceptance.md`）**：① T3.0 端到端集成 —— 加载真实 MV3 扩展打 fixture 站，证明「带 cookie 的图片能下」「404 图退回原 URL 且带 `<!-- 图片未下载：… -->`」「同篇文章导出两次覆盖成对」；**必须照抄 S2 文档里那段 Playwright 下载装置修法**（预写 profile `Default/Preferences` 的 `download.default_directory` + 启动后补发 CDP `Browser.setDownloadBehavior {behavior:"default"}`），否则收到的文件名是 GUID、子目录也丢；② 真机 Chrome「加载已解压的扩展程序」指向 `extension/dist` 跑人工验收清单（含工具栏点击这一段 —— `activeTab` 授权只在真实点击时存在）；③ 收口 `docs/TESTING.md`（补扩展测试两层与产物范围）与 `CHANGELOG.md`（插件发布前仍不加条目）。
- Branch: `main`；stash@{0} 是 2026-09-21 拉取前的文档备份、与当前工作无关
- Scope: unsigned Apple Silicon Mac personal-test application; macOS 12.0+（桌面产物）；浏览器插件另行验收于 Chromium，不进桌面发布门禁

## 本轮（2026-09-24 第六轮：S2 收尾，T2.5–T2.8）已完成

用户指令：继续 S2。**只写 `extension/` 与文档、零桌面改动，不 bump 版本、不跑 `desktop:release`、不跑 `test:e2e`。**

- **T2.5 写盘单测（补证）**：`extension/src/write.test.ts` 4 passed —— `filename` 只能是相对路径（无前导 `/`、无盘符、无 `../`）；URL 能被 `new URL()` 解析且 `data:text/markdown;charset=utf-8,` 之后 `decodeURIComponent` 逐字节等于原文（中文、半/全角括号、两种引号、emoji、空行都过）；`overwrite` + `saveAs:false` 未被动过；`markdownDataUrl` 会把 `%` `#` `&` `,` 编码掉（`#` 不编码会截断 data URL）。**`write.ts` 是 T2.1 为跑通骨架写的，首跑即绿 = 补证而非先写的失败测试**，已写进阶段文档与 `feature_list.json`。
- **T2.6 角标反馈（真 RED）**：新增 4 条全 failed（`TypeError: (0 , runWithFeedback) is not a function`）→ 实现后 8 passed。`badgeFor` 三态：成功 `✓` +「已存出「<md>.md」（含 N 张图）」；有失败图 `!` +「…N 张图未下载」；run 失败 `!` +「转换失败：<人话>」；`BADGE_CLEAR_MS = 4_000` 后清空并还原 `DEFAULT_TITLE`（用注入时钟，不真等 4 秒）。失败原因过一张小映射表（`INJECT_FAILED` →「这个页面不允许扩展读取」等），英文原文只留在 `RunResult.message` 给日志。角标逻辑刻意放 `worker-run.ts`（`worker.ts` 不进 `init.sh`），`worker.ts` 里 `.then(() => clearBadgeLater(deps)).catch(...)` 两个 promise：4 秒等待不吊住本次点击。
- **T2.7 失败路径矩阵（补证）**：`worker-run.test.ts` 8 → **12 passed**。四条用例钉住：特权页 `UNSUPPORTED_PAGE` / 无正文 `NO_ARTICLE` ⇒ 三个下载请求**一个都不发**、角标给内容脚本自己的中文消息；注入成功但无回应 ⇒ **`vi.useFakeTimers()` 推进 10 秒**真跑到 `TIMEOUT`（payload 等待用的是全局 `setTimeout`，不受注入 `timers` 影响，所以这里只能用假计时器）；md 写盘被拒 ⇒ `DOWNLOAD_FAILED` 且 `markdownWrites()` 为空、`message` 留浏览器原文 `SERVER_ERROR` 而角标说人话。四条首跑即绿（实现在前）= 补证。覆盖率阈值已加进 `vitest.config.ts`：`worker-run.ts` 95/85/85/95（实测 100 / 91.37 / 87.5 / 100）、`references.ts` 100/90/100/100、`write.ts` 全 100 —— **阈值只用来拦回归，不假装测满**。
- **T2.8 阶段收尾（补证）**：`extension/tests/extension-build.test.mjs` 1 → 4 passed，`extension/dist/` **恰好**三份（`manifest.json` / `content.js` / `worker.js`）、两个入口非空且无 Node 残留、manifest 只有 `activeTab`+`scripting`+`downloads` 且**没有** `host_permissions`、**没有**静态 `content_scripts`、`action.default_title` 与 `DEFAULT_TITLE` 逐字相等；`buildOnce()` 让四条断言读同一份产物。S2 文档的 `## Handoff` 已改写成完成态（消息契约、`run(tabId, deps)` 形状、角标语义、`overwrite` 理由、探针五条 + 装置坑修法）。
- **门禁**：`NODE_OPTIONS= ./init.sh` **exit 0**（Node 24.15.0，**78 files / 1059 tests**，`extension/src` 语句 100% / 分支 93.1%）；`MD_CONVERTOR_EXTENSION_CHROMIUM_ARGS=--no-sandbox,--disable-gpu npm run test:extension` → **10 passed / 10.0s**。
- **仍未做**：S3 的全部内容（端到端集成、真机人工验收、`docs/TESTING.md` 收口）；`CHANGELOG.md` 不加条目（插件尚未发布，无用户可见变化）。

## 上一轮（2026-09-24 第五轮：S2 内容脚本可读化 + 图片下载编排，T2.2–T2.4）已完成

- **T2.2** `content.spec.ts` 3 条：`article.html` payload 逐字段核（`images` 深等价 —— 惰性图进下载计划、内联 `data:` 图留在 md 不产生无谓下载）；`no-article` → `NO_ARTICLE`；`file://` 页 → `INJECT_FAILED` 可读。RED 只有第三条是真的（`tabs.query()` 对无 host 权限的标签页给 `url: undefined`），前两条是补证。
- **T2.3** `worker-run.test.ts` 4 条：7 图并发峰值 ≤ 4（假对象里实测）；1 张抛错 + 1 张永不结束 ⇒ `{saved:3, failed:2}` 且 md 仍恰好写一次；引用用浏览器真实 basename；落到别的目录按失败处理。两处刻意偏离：**轮询 `search({id})` 而非监听 `onChanged`**（探针 2：下载可能在 `download()` resolve 前已结束）、成功臂多回 `images`（skeleton 断言收窄为 `toMatchObject`）。
- **T2.4** `references.ts` 的 `rewriteImageReferences`：成功回写真实文件名、失败退原 URL + 下一行 HTML 注释；RED 首跑 5 条全 failed，第一版前瞻写反拿到真断言失败后改正；接入 `run()` 时 `worker-run.test.ts` 2/4 failed → 改后 9 passed。
- **收尾清理（ponytail 门）**：删掉自加的 `pollMs` 旋钮与 `waitForImage` 里一个永不成立的分支。
- **门禁**：`test:extension` 10 passed / 9.6s；`NODE_OPTIONS= ./init.sh` exit 0（76 files / 1039 tests，95.27%）。

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
- **扩展的可测逻辑一律放 `worker-run.ts`（或更小的纯函数模块），不放 `content.ts` / `worker.ts`**：后两者是浏览器专用入口、不进 vitest 覆盖率，塞进去等于没有门禁。角标与失败原因映射就是这么放进去的（`ChromeDeps` 因此多一个 `action` 成员）。
- **payload 等待用的是全局 `setTimeout`，不受注入的 `timers` 影响**：测 `TIMEOUT` 分支必须 `vi.useFakeTimers()` + `advanceTimersByTimeAsync(10_000)`，用完还原；`timers` 只推进图片轮询与角标清空。
- **扩展的三处覆盖率阈值取「实测值之下一点」**（`worker-run.ts` 95/85/85/95、`references.ts` 100/90/100/100、`write.ts` 全 100）：阈值只用来拦回归，不假装已经测满；要抬阈值先补测试。
- **`npm run test:extension` 会先跑 `build:extension`**；沙箱内需 `MD_CONVERTOR_EXTENSION_CHROMIUM_ARGS=--no-sandbox,--disable-gpu`（与桌面 Playwright 同源限制），没有外层沙箱时不要传。
- **插件与桌面端的引用口径**：md 里先写 `md-convertor-image-<n>` 占位符（纯词，不含 `:` `/`，Turndown 不会改写），落盘后用 `chrome.downloads.search()` 的**真实 basename** 回写引用（浏览器可能自己补扩展名）；真实父目录名 ≠ 请求的 `<标题>.images` 时按失败处理，退回原 URL，不写指向找不到的文件的引用。
- **Playwright 跑扩展时下载会被改名（S2 探针实测）**：Playwright 对 persistent context 一律先发 CDP `Browser.setDownloadBehavior{behavior:"allowAndName"}`，每个下载都被写成 `<guid>`（无扩展名、丢掉请求的子目录）——不修装置就测不出「文件名是否被补扩展名」「相对子目录路径」「同名覆盖」这三条。修法两步：profile 里预写 `Default/Preferences` 的 `download.default_directory`，启动后自己再发一次 `behavior:"default"`；**`downloadsPath` 选项不能碰**（它就是 `allowAndName` 的入口），`acceptDownloads` 传什么都被归一成 `accept`。
- **TS 6 不再自动收 `@types`**：`node_modules/@types/*` 不会自动进 program（本项目的 `@types/node` 是被 `next-env.d.ts` → `next` 间接带进来的），所以 `@types/chrome` 必须显式引用 —— 靠 `extension/src/chrome-types.d.ts` 里一行 `/// <reference types="chrome" />`（零 import）覆盖扩展全部文件；新增用 `chrome.*` 的文件不要再逐个加指令。
- **同名用 `overwrite` 而不是 `uniquify`**：`uniquify` 只改 md 名（`标题 (1).md`）、目录名不变，一次重复导出就把文件对拆散；这也是不加时间戳的理由。
- 签名/notarization 不做（QA-008 accepted，2026-09-20 用户决定）；UI 评审结论勿重提（2026-09-20 全部不整改）。
- 云端 Provider 端到端实测仍待用户用真实文章走一遍（与 feat-041 无关的遗留项）。

> 历史轮次的完成记录（feat-018 – feat-039 及更早）已归档：逐 feature 的验证证据见 `feature_list.json` 对应条目的 `verification` 字段；发布产物、门禁计数与风险登记见 `docs/QUALITY-AUDIT.md`（含 `## Archived Round Log`）；测试口径与产物哈希见 `docs/TESTING.md`；Git 提交历史保留全部实现细节。
