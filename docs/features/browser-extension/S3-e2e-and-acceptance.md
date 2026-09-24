# S3 — 端到端集成、真机验收与文档收口（Spec / Plan / Tasks）

- 上游：`docs/features/browser-extension/FSD.md`（验收标准 §5、风险 §6）
- 前置：S1 + S2 完成（`extension/dist/` 可加载），五条探针结论与 Playwright 下载装置修法已落到 S2 文档
- 状态：**T3.0–T3.3、T3.5、T3.6 已完成（2026-09-24）；T3.4 人工验收进行中（第 1/2/4/6 条已通过，第 3、5 条未测）**
- feature_list id：`feat-040`

## Spec

**目标**：把「真浏览器 + 真扩展 + 真写盘」这一段变成可重复的证据，剩下只有人能测的部分做成一份可签字的人工清单，并把文档面同步到事实。

**关键决定**：

1. **测试配置独立**：新增 `playwright.extension.config.ts`（`testDir: "./extension/tests"`、只 chromium、`workers: 1`、无 `webServer`）。**不动** `playwright.config.ts` 的既有三个项目，也不改 `scripts/run-e2e.mjs`——扩展测试不能拖慢或影响桌面 e2e 门禁。
2. **fixture 站**用 `node:http` 现搭（`extension/tests/fixtures/server.ts`，计划里写 `.mjs`，改 `.ts` 的原因见 §Result 偏差 1）：静态 HTML + 图片；**一个需要 cookie 才返回 200 的图片路径**（用真实浏览器会话证明 PLAN 附录 A.3.1 的 cookie 结论），**一个永远 404 的图片路径**（证明失败标记），一篇中文长标题、一篇含 `/` `:` 的标题。
3. **写盘落点**：**不要用 `launchPersistentContext` 的 `downloadsPath`**（它正是 Playwright 把下载改成 `<guid>` 的 `allowAndName` 入口，会同时丢掉扩展名与请求的子目录 —— S2 T2.0 实测）。按 S2「探针结果」下的修法：① profile 里预写 `Default/Preferences` 的 `download.default_directory` 指向临时目录；② 启动后发一次 CDP `Browser.setDownloadBehavior { behavior: "default" }`。然后断言**真实文件**（不只看 `downloads.search`）。
4. **规范的那一次在 Terminal 里跑**（本机实测：Playwright 自带的 Chromium 在 agent shell 里也能直接跑，不需要 `--no-sandbox --disable-gpu`；`MD_CONVERTOR_EXTENSION_CHROMIUM_ARGS` 作为逃生口保留，只对打包后的 Electron 应用是必需的）。
5. **人工验收由用户签字**：工具栏点击与 `activeTab` 授权是自动化点不到的（Playwright 无法点浏览器工具栏），这一段只能人工。

**非目标**：不发布扩展商店、不做多浏览器（Firefox/Safari）、不做 CI 流水线、不给扩展加图标或 popup。

## Plan

### 1. `extension/tests/fixtures/server.ts`

`node:http` 服务，**端口用 0**（临时端口，与已有 `serveFixtures()` 同口径；实施后偏差见 §Result），路由：`/article`（中文 + 重复图 + 相对路径图）、`/article-cookie`（图片挂在需要 cookie 的路径）、`/article-missing`（含一张 404 图）、`/article-special`（标题含 `/` `:`）、`/no-article`、`/img/*`、`/protected/*`（无 cookie → 403）。启动后返回 `origin`，测试用 `beforeAll` 起、`afterAll` 关。

### 2. `extension/tests/integration.spec.ts`

- 用 `chromium.launchPersistentContext` + `--disable-extensions-except` / `--load-extension` 加载 `extension/dist`；下载目录按上文 §Spec 3 的修法指向临时目录（**不传 `downloadsPath`**）。
- **必须用测试专用的 manifest 变体**：把 `extension/dist` 拷进临时目录后给 `manifest.json` 补 `host_permissions: ["http://127.0.0.1/*"]`（把 fixture 站的实际 origin 写进去）。原因（S2 T2.0 探针 1 实测）：SW **无手势** 调 `chrome.scripting.executeScript` 会被拒（`… must request permission to access the respective host.`），而 Playwright 点不了工具栏、拿不到 `activeTab` 授权。改的是临时目录里的副本，`extension/dist/` 与产品语义不变。
- 通过 `context.serviceWorkers()`（或 `waitForEvent("serviceworker")`）拿 SW，`sw.evaluate((id) => globalThis.__mdConvertorRun(id), tabId)` —— S2 的 `worker.ts` 需为此暴露一个测试用途的内部函数名（**只在 SW 里挂 `globalThis`，不影响生产语义**）。
- 断言矩阵：
  1. `<标题>.md` 与 `<标题>.images/*` 真实出现在 `downloadsPath`；md 内的相对引用与实际文件名逐一对应（朴素正则提取 `](...)` 后逐个 `existsSync`）。
  2. cookie 保护的图片被成功下载（文件存在且非空）。
  3. 404 图：md 里是原始 URL，且下一行有 `<!-- 图片未下载：<url> -->`；`search()`/角标显示 1 张失败。
  4. 同一篇连导两次：文件对仍是同一组（目录里**没有** `标题 (1).md`），md 内容一致。
  5. 中文标题与含 `/` `:` 的标题：文件名干净、`downloadsPath` 里无非法字符、md 可读。

### 3. 人工验收（用户执行，签字）

清单（照 FSD §5 的 5–8 条）：

1. 真机 Chrome → `chrome://extensions` → 开发者模式 → 「加载已解压的扩展程序」→ 选 `extension/dist`。
2. 找一篇普通文章 → 点工具栏图标 → 下载目录出现 `<标题>.md` + `<标题>.images/`，**桌面端未运行**；md 用 Typora/Obsidian 打开图片能显示。
3. 找一篇登录后才可见、图片带会话的文章 → 同样导出；图片应当下得来。
4. 同一篇再点一次 → 文件被覆盖（不出现 `(1)`），文件对仍然成对。
5. 一篇 ≥30 张图的文章 → 观察是否有下载中断（MV3 休眠风险）。
6. 记录浏览器「下载前询问保存位置」是否开启（开着会逐张弹框，行为符合预期即可）。

### 4. 文档收口

- `AGENTS.md`：平台边界加限定（桌面产物只构建/验收 `darwin/arm64`；浏览器扩展不受此限，验收环境为 Chromium）；Verification 段增 `npm run test:extension` 的口径与「构建/集成不进 `init.sh`」的规定。
- `docs/TESTING.md`：新增扩展测试一节（分层、命令、`MD_CONVERTOR_EXTENSION_CHROMIUM_ARGS`、fixture 站、人工验收清单）。
- `CHANGELOG.md`：`[Unreleased]` 加用户可见变化（浏览器插件首个版本：一键把当前页存成 Markdown + 图片）。
- `PROGRESS.md` / `session-handoff.md` / `feature_list.json`：状态、证据、下一步。
- `docs/QUALITY-AUDIT.md`：只追加本轮风险登记（无桌面产物，故不动发布门禁段）。

## Tasks

| id | 任务 | RED（先写失败测试） | 完成条件 | 验证 |
| --- | --- | --- | --- | --- |
| T3.0 | fixture 站（含 cookie 保护图与 404 图） | `extension/tests/fixtures/server.test.ts`：无 cookie 拿 `/protected/*` → 403、带 cookie → 200；`/img/missing.png` → 404 ⇒ 先 failed ✅（`Cannot find module './server'`） | 全绿（8 passed） | `npx vitest run extension/tests/fixtures/server.test.ts` |
| T3.1 | 真实扩展 + 真实写盘断言 | `integration.spec.ts` 用例①②：md 与图片文件真的落进下载目录；md 引用与实际文件名逐一对应 ⇒ 先 failed ⚠️**部分不成立**：首跑确实红了（引用 4 条 vs 期望 3 等），但三处都是**测试自身**的解析/断言缺陷（源链接 `<…>` 形式被算成图片引用等），扩展行为自 S2 起就是对的 —— 属**补证**（见 §Result「RED 诚实记录」） | chromium 全绿（5 passed，整体 15 passed） | `npm run test:extension`（实测 15 passed；迭代时用 `npx playwright test --config=playwright.extension.config.ts -g <用例名>`） |
| T3.2 | cookie 图与 404 图的差别路径 | 用例③：cookie 图成功、404 图退回原 URL + `<!-- 图片未下载：… -->` ⇒ 先 failed ⚠️**不成立**：实现来自 S2，用例首跑即绿，属**补证** | 全绿 | `npm run test:extension`（15 passed） |
| T3.3 | 重复导出与文件名净化 | 用例④⑤：覆盖、无 `(1)`、中文与 `/` `:` 标题文件名干净 ⇒ 先 failed ⚠️**不成立**：同上，属**补证**；中途红的那次是断言把净化后的 H1 当成了原始标题，按实测改正 | 全绿 | `npm run test:extension`（15 passed） |
| T3.4 | 人工验收执行与签字 | — | 用户按 §3 清单跑完 6 条并签字（含 ≥30 图那篇的结论）；结论写进 `feature_list.json` 的 verification | **进行中**：第 1/2/4/6 条已通过（见「人工验收记录」），第 3、5 条待用户执行（Playwright 点不到工具栏，无法自动化） |
| T3.5 | 文档收口 | — | `AGENTS.md` / `docs/TESTING.md` / `CHANGELOG.md` / `PROGRESS.md` / `session-handoff.md` / `feature_list.json` 与事实一致；`init.sh` 与 `test:extension` 均绿 | `NODE_OPTIONS= ./init.sh`（79 files / 1067 tests）+ `npm run test:extension`（15 passed） |
| T3.6 | 阶段收尾 | — | 临时 Downloads / profile / 扩展副本目录已由 spec 的 `afterAll` 删除（`rmSync`），`extension/dist-test/` 与 `extension/dist/` 在 gitignore 内；`git status --short` 只含预期改动 | `git status --short` |

## Result（S3 实施结论，2026-09-24）

### 交付

| 文件 | 内容 | 证据 |
| --- | --- | --- |
| `extension/tests/fixtures/server.ts` | `node:http` fixture 站：`/article`（重复图 + 相对路径图）、`/article-cookie`（图片需 `md-session` cookie）、`/article-missing`（一张 404 图）、`/article-special`（标题含 `/` `:`）、`/no-article`、`/img/*`、`/protected/secret.png`（无 cookie 403） | `server.test.ts` 8 passed |
| `extension/tests/fixtures/server.test.ts` | 上述路由的纯单测（cookie 逻辑、404、`<title>`、正文长度） | 同上 |
| `extension/tests/integration.spec.ts` | 真实构建产物 + 真实 Chromium + 真实落盘的 5 条用例（T3.1 ×1、T3.2 ×2、T3.3 ×2） | `npm run test:extension` 15 passed |
| `extension/tests/harness.ts` | 新增 `waitForDownloadComplete()`；删掉已成死代码的 `waitForFile()` | 见下「下载完成竞态」 |
| `extension/tests/skeleton.spec.ts` | 读 md 前先等下载完成（同一个竞态） | 40 次重复 + 5 轮全量绿 |

断言到的事实（读磁盘，不是读 `downloads.search`）：`示例文章标题.images/001-photo-one.png` + `002-photo-two.png`（各 70 bytes）、`会话图片文章.images/001-secret.png`（70 bytes，**带 cookie 才下得来**）、`缺图文章.images/` 为空目录、md 里 3 处图片引用解析到 2 个真实文件（重复图引用同一文件）、`发布说明-第 1 期- 中文标题.md`（H1 保留原始 `发布说明/第 1 期: 中文标题`）、重复导出后目录里仍只有一对文件、两 md 除 `> 转换时间` 行外逐字节相同。

### RED 诚实记录

T3.0 是真 RED（模块不存在）。T3.1–T3.3 的红**不是产品缺陷**：引用回写、cookie 图片、`overwrite`、文件名净化在 S2 就已正确，首跑失败的三处都在测试自己身上 ——（1）`relativeRefs()` 把源链接的 `<url>` 形式也算成图片引用；（2）404 用例的标记断言写成了 URL 包含而非行匹配；（3）T3.3 误以为 H1 会被净化。按 S2 先例如实标为**补证**，不写成「先写失败测试」。

### 下载完成竞态（本轮唯一一处产品相邻缺陷）

现象：转 `.ts` 之后出现两次瞬时失败（skeleton 的 md 内容、integration 的 404 用例），16+ 轮全量、90 次重复、3 次带负载都复现不了。

根因（读代码得出，不是猜）：`writeMarkdown()` 里的 `downloads.download()` 在下载**开始**时就 resolve，`worker-run.ts` 的 `run()` 随即返回 —— 此时文件名已存在、字节还在写，而测试用的 `waitForFile()` 只等文件名出现就 `readFileSync`。修法：harness 新增 `waitForDownloadComplete()`，轮询 `downloads.search({})` 直到该文件 `state === "complete"` 再读；integration 的 `readMarkdown()` 与 skeleton 都改用它。复验：两条原可疑用例 `--repeat-each=20` 共 40 次全绿（26.9s），随后 5 轮全量 15 passed / 4.0–4.4s。

### 落地偏差（相对本文件 §Spec/§Plan）

1. **`.mjs` → `.ts`**：计划写 `fixtures/server.mjs`；`.mjs` 在 TS program 里是 `TS7016 Could not find a declaration file`。整套扩展测试本来就是 TS，改 `.ts` 后白拿类型检查，且 vitest 默认收 `.test.ts`、Playwright 的 `testMatch` 只收 `*.spec.ts`（两者不打架）。
2. **端口用 0（临时端口）而非固定的 43117**：与其他 spec 的 `serveFixtures()` 一致，并行/重复跑不会撞端口；测试从 `startFixtureServer()` 返回的 `origin` 取地址。
3. **fixture `/article` 不重复 `article.html` 的表格/围栏/惰性图**：那三项已经由 `article.html` 在真实浏览器里证明过两遍 —— `content.spec.ts`（真实 content script 的 payload 含惰性图提升与内嵌 data: 图）与 `core-smoke.spec.ts`（真实 esbuild 产物断言 `| 列A |`、`javascript:` 被摘、`<script` 不出现）。再搭一份不增加信息，所以 `/article` 只放本轮才需要的东西（重复图 + 相对路径图）。
4. **沙箱开关对本套测试不需要**：计划 §Spec 4 与 FSD §3.7 都写「沙箱内要 `MD_CONVERTOR_EXTENSION_CHROMIUM_ARGS=--no-sandbox,--disable-gpu`」；实测**不传也是 15 passed / 4.2s**（外层沙箱限制只卡打包后的 Electron 应用，卡不住 Playwright 自带的 Chromium）。开关保留作逃生口，本文件与 `docs/TESTING.md` 的口径已按实测改。
5. **新增 `waitForDownloadComplete()`**（计划里没有）与**改动既有 `skeleton.spec.ts`**：理由就是上面的竞态，不是重构 —— 只把「读 md」那一步改成先等下载完成。
6. **404 图的空 `缺图文章.images/` 目录保留不删**（见下）。

### 一处产品行为发现（不修，记录）

整篇文章的图片**全部**失败时，磁盘上会留下一个空的 `<标题>.images/` 目录：Chrome 在发请求前就把目标目录建好了，中断的下载会删掉半成品文件但不会删目录，而 `chrome.downloads` API 根本没有删目录的能力（`removeFile` 只删文件）。这不影响正确性（md 里那些图退回原 URL），且代价是一个空目录。测试按「目录不存在**或**为空」断言，不把它当成缺陷；若将来要清，只能在下次导出时顺手 `removeFile` 掉自己写的文件，成本大于收益。

## 人工验收记录（T3.4，进行中 — 2026-09-24）

用户按 `docs/TESTING.md` 的「Browser Extension」清单在真机 Chrome（`extension/dist` 以「加载已解压的扩展程序」载入）执行：

| # | 检查 | 结果 |
| --- | --- | --- |
| 1 | 扩展载入 | ✅ 正常 |
| 2 | 普通文章点工具栏图标 → `<标题>.md` + `<标题>.images/`，桌面端未运行 | ✅ 用户回报正常 |
| 3 | 登录后才可见、图片带会话的文章 | ⏳ **未测**（用户尚未找到合适的页面） |
| 4 | 同一篇连点两次 → 覆盖、不出现 `(1)`、md 与图目录仍成对 | ✅ 用户回报正常 |
| 5 | ≥30 张图的文章 → 观察 MV3 休眠是否打断下载 | ⏳ **未测**（本阶段唯一未验证的风险） |
| 6 | 「下载前询问保存位置」是否开启 | ✅ **关闭**（因此逐图弹框不发生，符合预期；该设置为开启时每图一框亦属预期） |

**观察记录（不是缺陷）**：同一篇文章重复导出时，Chrome 的下载列表每次都会多出条目，而下载目录里的**文件数量不变** —— 这正是 `conflictAction: "overwrite"` 的语义：每条下载都会被记账，文件被原地替换而不是新增。用户可读的证据是工具栏角标（`✓ 已存出「<标题>.md」（含 N 张图）`）与文件 mtime 的变化。本项已记入 FSD §6，供将来做 UI 文案时参考（若要让「覆盖」更显眼，可在角标文案里点明）。

T3.4 在**第 3、5 条**跑完并回报前不算签字；`feat-040` 保持 `in-progress`。第 5 条若真被打断，按 FSD §6 在 `worker-run.ts` 的下载等待处加 20s 心跳保活后复验。

## Handoff（S3 完成态，2026-09-24）

1. **规范运行环境**：`npm run test:extension`（内部先跑 `build:extension`）—— 在 **Terminal 里跑的那一次才算规范证据**；本机 agent shell 里跑同样绿（不需要 `--no-sandbox`），但外层已有沙箱时的绿色只当功能证据。
2. **`activeTab` 授权仍是缺口**：Playwright 点不到浏览器工具栏。集成测试靠 `harness.ts` 的 `copyExtensionWithHostPermission()` 把 `extension/dist` 拷到临时目录并给副本补 `host_permissions`，再从 SW 调 `globalThis.__mdConvertorRun(tabId)`；「点图标 → 拿授权 → 导出」这一段**只能**人工验收（T3.4）。
3. **T3.4 结论待填**：真机 Chrome「加载已解压的扩展程序」指向 `extension/dist`（本地已构建，目录被 gitignore），按 `docs/TESTING.md` 的人验收清单跑 6 条 —— 重点是第 5 条：**≥30 图的长文章会不会被 MV3 休眠打断下载**。真被打断就按 FSD §6 加保活（`worker-run.ts` 的下载等待处 20s 心跳），并在本文件追加结果。
4. **版本面互不影响**：`extension/manifest.json` 是 `0.1.0`（插件自管）；`package.json` 仍是 `0.3.6`，`desktop:release` 只认桌面版本。本阶段零桌面改动（`src/` / `electron/` / `forge.config.cjs` / `playwright.config.ts` 未动），所以没有 bump。
5. **下一阶段**：B（`feat-040`）等 T3.4 签字后即可关；关的时候补两笔手：一是把结论写进 `feature_list.json` 的 `feat-040` 与本文件第 3 条，二是在 `docs/PRODUCT.md` 与 `README.md` 各加一行插件入口（本轮刻意没加：插件尚未经用户验收，且 T3.5 的范围只列了 AGENTS/TESTING/CHANGELOG/PROGRESS/handoff/feature_list/QUALITY-AUDIT）。A 桌面端「文档处理」（`feat-042`）另案起计划，与本阶段无代码依赖。
