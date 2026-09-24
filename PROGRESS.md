# Project Progress

## Current State

- Last updated: 2026-09-24
- Current version: `0.3.6`，**已发布**为 GitHub Release `v0.3.6`（`package.json`、`package-lock.json`、`feature_list.json`、`scripts/release-desktop.mjs` 均为 `0.3.6`；产物 235,956,668 bytes / SHA-256 `9b89d55c…f351`；已装到本机 `/Applications`）。**本轮不改桌面代码，所以不 bump 到 `0.3.7`**（AGENTS.md 的 bump 要求只针对桌面代码改动）
- Active feature: **`feat-040` 浏览器插件（B）—— 状态 `planned`，实施规划已完成，待开工**（`feat-042` 桌面端文档处理（A）仍为 `planned`，已与本块解耦，无顺序与代码依赖；`feat-041` 已完成已发布已关闭）
- Next step: **按 `docs/features/browser-extension/FSD.md` + `S1-convert-core.md` 开工 S1**（TDD RED 先行，纯函数，不碰桌面端、不 bump 版本）；S2 的第一个任务是事实探针（S2 文档「探针结果」表未填前不得写 SW 编排）
- Branch: `main`；stash@{0} 是 2026-09-21 拉取前的文档备份、与当前工作无关
- Scope: unsigned Apple Silicon Mac personal-test application; macOS 12.0+（桌面产物）；浏览器插件另行验收于 Chromium，不进桌面发布门禁

## 本轮（2026-09-24 浏览器插件线 B：实施规划定稿）已完成

用户先明确「**先把插件（B）做掉，A 拆开**」，再把待对齐项一次性拍板（原话「明白了，那都按照你的意见来」）。**本轮只写文档，零应用代码、零测试、未 bump 版本、未跑 `desktop:release`。**

- **用户裁定**：① 顺序反转为 **B 先做**，A（`feat-042`）变另案（无顺序、无代码依赖）；② **不共享代码**——B 自带转换核心 `extension/src/convert/`，不改桌面端任何文件（将来统一只是搬家，不是重写）；③ PRD §3 六条全部裁定：仅工具栏按钮 / 不做预览 / 同名**覆盖**（`uniquify` 会把 `标题 (1).md` 与 `标题.images/` 拆散）/ 标题净化照抄 `src/lib/markdown.ts:46` / 不允许改文件名 / 图片全失败仍写 md；④ 新增裁定：抓不到的图保留原 URL + 下一行 `<!-- 图片未下载：<url> -->`，角标 `✓`/`!` 反馈，不做 popup/通知/整页兜底。
- **新增施工文档**：`docs/features/browser-extension/`——`FSD.md`（三个前提、架构决定、五层测试、验收与风险）+ 三份阶段文档（`S1-convert-core.md` / `S2-extension-shell-and-writes.md` / `S3-e2e-and-acceptance.md`，每份 Spec / Plan / Tasks 含 RED 列 / Handoff）。
- **关键设计（已写进 FSD）**：权限只有 `activeTab`+`scripting`+`downloads`、零 `host_permissions`；点击时 `chrome.scripting.executeScript` 注入（不声明静态 `content_scripts`）；转换在 content script（SW 无 `DOMParser`）；SW 负责命名/下载编排/引用回写/写 md；md 里写 `md-convertor-image-<n>` 占位符，落盘后用 `chrome.downloads.search()` 的真实 basename 回写引用；`overwrite` + 不做时间戳；不做保活（并发上限 4 + 60s 超时，真被打断再加）。
- **测试分层定案**：① 纯函数单测（vitest + jsdom）② `chrome.*` 打桩编排单测（依赖注入，不装 sinon）→ 这两层**进 `init.sh`**；③ 浏览器内冒烟 ④ 真实 MV3 扩展 + 本地 fixture 站集成（自带 `playwright.extension.config.ts`，不动桌面 e2e）⑤ 真机人工验收 → **不进 `init.sh`**，走 `npm run test:extension`。
- **规则冲突已就地解掉**（PLAN §6 四条）：`AGENTS.md` 平台边界限定为桌面产物 + 版本 bump 只由桌面代码触发 + Verification 段加入扩展测试两层；单 `in-progress` 约束保留且次序反转。
- **验证**：`./init.sh` **exit 0**（Node 24.14.1，68 files / 999 tests，statements 95.28%）—— 本轮零代码改动，用它只证明文档与状态回写没弄坏基线。
- **未做（刻意）**：未 bump 版本、未碰 `src/` `electron/` `forge.config.cjs` `playwright.config.ts`、未写 `extension/` 任何代码、未提交（用户未要求）。

## 上一轮（2026-09-22 浏览器插件线：方向定稿 + 文档分层重整）

> 本节的「A 先、B 后」与「抽一段共享模块」两条已被 2026-09-24 推翻（B 先做、A 另案；B 自带核心不共享代码），保留原因：探针事实与文档分层结论仍然有效。

用户先定「目前只做方向评估，不写文档，先把技术探查做扎实」；方向定稿后又指出这其实是**一条新线、两个产品**（插件 + 桌面端），共用一个仓库也必须按项目既有分层做事，于是做了一次文档重整。**未写阶段文档、未动代码，`feat-042`（A）与 `feat-040`（B）均为 `planned`。**

- **三问全部有结论**：① 同仓库（理由是共享「提取 + 转 md」以保证两边输出一致，不是为了共享整条管线）；② 密钥问题消失（插件不做翻译，翻译留在桌面端）；③ 抽一段无 Node 依赖的共享模块。
- **探针实测**（Playwright 加载临时 MV3 扩展，产物只在 `/tmp`、未入库）：写盘机制 10 项、提取管线 8 项全部通过。关键发现：扩展**只能写下载目录下的相对路径**（绝对路径报 `Invalid filename`）；`chrome.downloads.download()` 对 HTTP(S) 会带上该 host 的 cookie，所以图片**不需要 fetch、不需要跨域权限**；Markdown 用 data URL 写盘，2 MiB 无问题；Readability + Turndown + GFM + DOMPurify 打包仅 **76 KB**，domino/jsdom 残留为 0；批量下载与危险文件判定均正常。
- **由此确认的简化**：不需要常驻服务、不需要 offscreen document、不需要 `host_permissions`。
- **文档分层重整**：原 `docs/features/browser-extension/FSD.md` 被**删除**——它装的内容是产品决策（产物落哪、抓不到的图怎么办、去重规则、触发方式、非目标），该进 PRD 而不是技术方案，等于「装错了柜子」。改为三层：`docs/PLAN-browser-extension.md`（**统领层**，唯一写「两个产品怎么配合」的地方：交接契约、顺序依赖、共同边界、线上工程决定、四组待解规则冲突；探针结论作附录 A）+ `docs/PRD-app-document-processing.md`（A）+ `docs/PRD-browser-extension.md`（B）。两份 PRD 不重复交接契约，避免三份文件互相打架。
- **交付切分为两块，串行推进**：A 桌面端「文档处理」能力（`feat-042`，先，可用现成 `.md` 独立验收）、B 浏览器插件（`feat-040`，依赖 `feat-042`，后）。串行是硬约束——单 `feature_list.json` + `init.sh` 只允许一个 `in-progress`。
- **`docs/PLAN-next-phase.md` 已归档**：它实际是 0.3.5 视觉刷新那一阶段的路线图（0.3.5 / 0.3.6 均已发布），整份过期，不能当统领层；已标注「已完成、已归档」并把文档地图指到 `PLAN-browser-extension.md`。
- 未验证项与已知风险见 `docs/PLAN-browser-extension.md` §7，实施前必须先解掉的四组规则冲突见 §6，探针结论见附录 A。

## 上一轮（0.3.6 / feat-041 默认 MD 保存路径）已完成

用户原话：「我想在设置里面增加一个默认的MD保存路径管理……如果选择默认目录，则不需要弹出保存位置选择」。设置页新增「输出」卡片（选目录 + 「使用默认目录」开关），主页面「下载」按三重条件（开关 && 目录 && 桥接）分叉为「桥接直写」或「浏览器下载」，直写被拒时说明原因并降级。

- **S1**（`ac8f91a`）设置契约 `output: { defaultPath, useDefaultPath }` + 两个 IPC 通道；**S2**（`f9b7534`）下载分叉与 fs 错误码映射；真机缺陷修复（`dde369e`，iCloud 路径里的 `~` 被误判 + preload 拒绝被吞）；反馈修复（`867aa2a`，直写成功改为按钮「已保存」+ 带 ✓ 状态卡片）；**S3/T3.0**（`7cf1111`）asar 收窄 253 → 10 条目；既有 e2e flake 修复（`14e9684`，几何断言改单帧读取 + firefox 沙箱开关固化）；证据提交 `4dc9cd6` / `5fce96c` / `9fb8c6b`。
- **门禁**：`npm run desktop:release` exit 0（Node 24.14.1，2m54s）—— `init.sh` 68 files / 999 tests、statements 95.28%、三引擎 e2e 239 passed / 4 skipped、live 2 passed；独立复核 `unzip -t` 3511 条目、包内版本 0.3.6、Mach-O arm64、asar 恰 10 条目。
- **本机安装与冒烟**：旧 `0.3.5` 移入 `~/Downloads/MD-Convertor-archive/installed-apps/`；安装源用发布 ZIP 本身解压；冒烟 exit 0 且两条断言都真跑；用户 `settings.json` / `secrets.json` md5 前后逐字节一致。
- **用户验收**：2026-09-22 22:17 签字「两态都过了」（开默认目录：不弹框、文件落盘、看得到「已保存」；关默认目录：弹框）。
- 逐条证据见 `feature_list.json` 的 `feat-041.verification`（39 条）；本轮归档见 `docs/QUALITY-AUDIT.md` 的 `## Archived Round Log` 2026-09-22 条；测试口径与产物哈希见 `docs/TESTING.md`。

## 上一轮的三条教训（都已写进约束清单）

- **范围蔓延**：用户的需求只是「加一个默认下载目录」，我却顺手把打包收窄、firefox 解锁、既有 flake 修复、自建 skill 都塞进了同一轮收尾，被用户明确指出「我只是搞一个文档下载路径，你为什么要搞这么多有的没的」。**后续遇到范围外问题（发现缺陷、flaky 用例、基建改进），先单独提出来问，不要顺手做。**
- **「私有文档」的定性是错的**：T3.0 最初的理由写成「私有工作文档会随发布物公开」。核实后发现仓库是 public，`PROGRESS.md` / `session-handoff.md` / `feature_list.json` / `AGENTS.md` / `docs/**` 早已在 `origin/main` 上公开，打包不构成新增暴露；唯一真正非公开的是 `.workbuddy/memory/*.md`。收窄仍然正确，理由已就地更正。
- **把「我试过的一次失败」当成「不可能」是懒惰归因**（firefox）：我先宣布 firefox 在沙箱内不可跑并让用户补跑，用户追问后才发现官方开关 `MOZ_DISABLE_CONTENT_SANDBOX=1` 一直就在那里。看到底层错误码时，先查被启动的程序有没有为这种情况准备的官方开关。

## 仍然生效的约束

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
- **插件核心只收 DOM、不收 HTML 字符串**：`turndown` 的 `package.json` 有 `"browser": { "@mixmark-io/domino": false }`，esbuild 会把 domino 映射为空 stub（这正是浏览器产物零 Node 残留的机制）；喂字符串会拿到空 stub 而不是解析器。净化实例与时间戳一律**注入**（Node `createDOMPurify(window)`、浏览器 `DOMPurify` 本身）。
- **插件与桌面端的引用口径**：md 里先写 `md-convertor-image-<n>` 占位符（纯词，不含 `:` `/`，Turndown 不会改写），落盘后用 `chrome.downloads.search()` 的**真实 basename** 回写引用（浏览器可能自己补扩展名）；真实父目录名 ≠ 请求的 `<标题>.images` 时按失败处理，退回原 URL，不写指向找不到的文件的引用。
- **同名用 `overwrite` 而不是 `uniquify`**：`uniquify` 只改 md 名（`标题 (1).md`）、目录名不变，一次重复导出就把文件对拆散；这也是不加时间戳的理由。
- 签名/notarization 不做（QA-008 accepted，2026-09-20 用户决定）；UI 评审结论勿重提（2026-09-20 全部不整改）。
- 云端 Provider 端到端实测仍待用户用真实文章走一遍（与 feat-041 无关的遗留项）。

> 历史轮次的完成记录（feat-018 – feat-039 及更早）已归档：逐 feature 的验证证据见 `feature_list.json` 对应条目的 `verification` 字段；发布产物、门禁计数与风险登记见 `docs/QUALITY-AUDIT.md`（含 `## Archived Round Log`）；测试口径与产物哈希见 `docs/TESTING.md`；Git 提交历史保留全部实现细节。
