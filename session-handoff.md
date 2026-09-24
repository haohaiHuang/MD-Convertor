# Session Handoff

## Resume Here

- Current version: `0.3.6`，**已发布为 GitHub Release `v0.3.6`（2026-09-22）**，已装到 `/Applications/MD-Convertor.app`。未签名、未 notarize，产物定位是个人测试用。全部 RED/GREEN 与门禁证据在 `feature_list.json` 的 `feat-041.verification`。**插件线路的轮次不碰桌面代码，因此不需要把版本 bump 到 `0.3.7`**（仅改动 `src/` / `electron/` / 打包配置时才需要，清单见下方开工提示词）
- Active feature: **无** —— `feat-040` 浏览器插件（B）已于 2026-09-24 **置 `done` 并关闭**：S1（转换核心）、S2（扩展外壳与写盘，T2.0–T2.8）、S3（端到端集成与文档收口，T3.0–T3.6）全部完成，**T3.4 真机人工验收 6 条全过**（含第 5 条：40 图长文未被 MV3 休眠打断，故 FSD §6 预留的 20s 心跳保活**未落地**，`worker-run.ts` 未动，并发上限仍是 4）。已交付：`extension/src/convert/` 六个纯函数模块 + `extension/src/{messages,content,write,worker-run,worker,references}.ts` + `extension/manifest.json` + `extension/tests/fixtures/{server.ts,server.test.ts}` + `extension/tests/integration.spec.ts`（5 条，读磁盘真实文件），`npm run build:extension` 产出 `extension/dist/` 恰好三份（`manifest.json` / `content.js` / `worker.js`），`npm run test:extension` 15 passed。阶段文档在册：`docs/features/browser-extension/`（`FSD.md` + `S1`/`S2`/`S3`）。`feat-042`（A 桌面端文档处理）仍为 `planned`，**已与本块解耦：无顺序依赖、无代码依赖**
- **唯一推荐下一步**：给 A 桌面端「文档处理」（`feat-042`）**先走一轮规划**（它的 PRD 是 `docs/PRD-app-document-processing.md`，尚无阶段文档；`docs/PLAN-browser-extension.md` §6 的四组规则已于 2026-09-24 裁定，可直接引用）。插件线已关闭，除非用户明确要求，不必再碰 `extension/`。RED/GREEN 与门禁证据在 `feature_list.json` 的 `feat-040.verification`（35 条）。**不要**顺手改桌面端、**不要**把 0.3.6 bump 到 0.3.7、**不要**跑 `desktop:release`、**不要** push
- Pending（无一是阻塞项）：① 云端 Provider 端到端实测（用户真实文章走一遍「拉取模型 → 选模型 → 翻译」）；② 真机小点清单（等用户给）；③ `0.3.1`–`0.3.6` 的产物与 tag 一律不动，缺失项按退役处理；④ 签名/notarization 不做（QA-008 accepted）；⑤ UI 评审结论勿重提（全部不整改）；⑥ `stash@{0}` 是 2026-09-21 拉取前的文档备份、与当前工作无关；⑦ 可选：在 Terminal 里跑一次**规范**的打包冒烟（Chromium 沙箱开启）—— 本 agent 沙箱内只能以 `--no-sandbox --disable-gpu` 取证，属环境限制；⑧ ~~PROGRESS.md 瘦身~~ **已完成（2026-09-24，提交 `934e979`）**
- Branch: `main`；**本地提交后不 push** —— 用户明确要求 GitHub 等大阶段完成再推（S1 提交止于本地）；发布历史：`v0.3.6` = `3578822`（feat-041 默认 MD 保存路径，asar 253 → 10 条目，Latest）、`v0.3.5` = `5f98307`（feat-039 + 清空按钮归位）、`v0.3.4` = `e251267`（图标 v2）、`v0.3.3` = `3897cd1`（feat-034）、`v0.3.2` = `1c3ed80`（feat-033）、`v0.3.1` = `af7f6db`（feat-031/032）；`v0.1.3` = `ce041c9`（不可变历史锚点）

- **本文件只写现役状态**（目标 ≤150 行 / ≤25KB，2026-09-24 起）：阶段之间的交接写对应阶段文档的 `## Handoff`（如 `docs/features/browser-extension/S1-convert-core.md`），轮次历史压进 `docs/QUALITY-AUDIT.md` 的 `## Archived Round Log`，不再留在本文件。

## 新会话开工提示词（复制即用）

```
继续 MD-Convertor 的下一轮工作：插件线（B，feat-040）已于 2026-09-24 全部关闭；下一件是给
A 桌面端「文档处理」（feat-042）**走一轮规划**——先读它的 PRD 与 PLAN 再决定要不要动手。

先按 Startup Workflow 读 AGENTS.md、PROGRESS.md、feature_list.json、session-handoff.md（本文件），
再读 docs/PRD-app-document-processing.md 与 docs/PLAN-browser-extension.md（§6 四组规则已裁定、
§7 是未验证与风险），然后跑 NODE_OPTIONS= ./init.sh 建立基线（Node 必须是 24.14.1 或 24.15.0）。

当前状态（2026-09-24 第九轮末；本文件 `## Resume Here` 是权威）：
- 版本 0.3.6，已发布为 GitHub Release v0.3.6，已装到 /Applications；未签名、个人测试用。
- feature_list.json 的 activeFeature = null，已无 in-progress 项：feat-024 – feat-041 全 done，
  feat-040 本轮关闭，feat-042（A 桌面端文档处理）仍是 planned、无顺序与代码依赖。
- 桌面端自 0.3.6 后一行未改 —— 因此一动 src/ / electron/ / 打包配置就必须先 bump 到 0.3.7
  并同步版本面（package.json、package-lock.json、feature_list.json、scripts/release-desktop.mjs）。
- 本地有未 push 的提交（origin/main 停在 24bf00f）；用户明说 GitHub 等大阶段完成再推。

硬约束：
- **只提交到本地、不 push**。
- **TDD 与诚实标注**：每个任务先 RED 再实现；先实现后补测的必须标「补证」，不许谎报 RED
  （S2、S3 都有先例，照它们的写法）。
- **只动当前 feature 需要的文件**：用户两轮都明确要求过不要顺手做范围外的事
  （原话：「我只是搞一个文档下载路径，你为什么要搞这么多有的没的」）。
- **扩展侧的固化约束**（playwright.extension.config.ts 的 testMatch 必须是 **/*.spec.ts、
  读落盘 md 前先用 waitForDownloadComplete、不用 launchPersistentContext 的 downloadsPath、
  esbuild 精确锁 0.28.1、扩展测试第 1–2 层进 init.sh 而集成走 npm run test:extension 等）
  已写进 PROGRESS.md 的「仍然生效的约束」；真要再碰 extension/ 时先读那一节，别重新踩。

不要把已固化的桌面试题语义改回去（默认 MD 保存路径相关，详见 docs/features/default-save-path/ 的
S2「决策记录」与 FSD「安全边界」）：isAbsoluteDirPath 不要收紧回 value.includes("~")（iCloud 云盘
目录会被全部拒掉）；不要去掉任何 await bridge.* 的 .catch()；不要把六个真实 fs 码换回笼统文案。
插件侧同源的语义：文件名净化照抄 src/lib/markdown.ts:46（无时间戳）、同名一律 overwrite（uniquify
会把 标题 (1).md 与 标题.images/ 拆散）、抓不到的图保留原 URL + 下一行 <!-- 图片未下载：<url> -->。
```

## Latest Change

**本轮（2026-09-24 第九轮：T3.4 全部通过，`feat-040` 关闭）**：用户回报 T3.4 第 5 条（≥30 图长文 / MV3 休眠）通过——用本机 40 图页跑，40 张全部落盘、无中断。至此 6 条全过，`feat-040` 在 `feature_list.json` 置 **`done`**、`activeFeature` 置 `null`（已无 in-progress 项）。第 5 条没被打断 ⇒ FSD §6 预留的 20s 心跳保活**没有落地**，`extension/src/worker-run.ts` 未动。补上第八轮刻意推迟的两笔手：`docs/PRODUCT.md` / `.zh.md` 各加一条插件支持范围 + 隐私段一句（只在点击图标时读当前标签页，不读取或存储 Cookie／登录态），`README.md` / `.zh.md` 各加一行主要能力。**零桌面代码改动、零版本变动**（桌面仍 0.3.6、插件仍 0.1.0），本轮只改文档与 `feature_list.json`；`NODE_OPTIONS= ./init.sh` exit 0（79 files / 1067 tests）。

- **上几轮的结论已归档**：`docs/QUALITY-AUDIT.md` 的 `## Archived Round Log` 有 2026-09-24 第一至第九轮条目（规划定稿 / 文档结构收口 / S1 / S2 外壳与探针 / S2 内容脚本与下载编排 / S2 收尾 / S3 端到端集成 / T3.4 部分通过 / 本轮）。S3 实施细节与六处落地偏差见 `docs/features/browser-extension/S3-e2e-and-acceptance.md` 的 `## Result`，给下一阶段的事实清单见其 `## Handoff`。

## Important Boundaries

- Node.js 24, Next.js 16, Electron, npm, TypeScript strict.
- TDD is mandatory for every code change.
- Only `darwin/arm64` is supported.
- `v0.1.3` remains an immutable historical tag at `ce041c9`.
- Old builds are not kept in the current repository workspace; release guards hash-check every historical ZIP that still exists in the external archive and report a missing entry as retired (user-authorized change on 2026-09-18, see `PROGRESS.md`).
- The app is unsigned and not notarized, so it is a personal-test build rather than a frictionless public distribution.
- Never store or print webpage bodies, clipboard content, cookies, tokens, or private URLs in tests or logs.
- 0.3.0 新增边界：翻译请求的正文与密钥同样不得写入日志或落盘；Provider 端点校验（放开 loopback/私网、禁跨主机重定向）与网页抓取 SSRF 策略是两套独立实现，不得互相放宽。
- 2026-09-24 新增边界（浏览器插件）：`darwin/arm64` 这条只限**桌面产物**，扩展验收于 Chromium；只改 `extension/` 的轮次**不 bump 桌面版本、不跑 `desktop:release`**（插件版本由 `extension/manifest.json` 自管）；扩展只读当前页 DOM、只写下载目录下的相对路径，不读 cookie/凭据、不把页面内容或 URL 写进日志。
- S2 新增边界：四个新路由的日志仅 `{requestId,status,code,durationMs}`；`/api/runtime/secrets` 请求体一律不持久化、不记录；本地 CLI 子进程环境必须剔除 `MD_CONVERTOR_*`（含 `MD_CONVERTOR_SESSION_TOKEN`、`MD_CONVERTOR_SECRETS`）。
- 翻译线（0.3.0，已完成，边界仍生效）：两个翻译端点的请求体（正文、analysis）与模型输出都不落盘、不记日志；prompt 只含待翻译块（`skip` 段与元信息行不进 prompt）；CLI 的 stdout/stderr 永不回显；错误消息不回显正文、密钥或 URL query；同时只允许一个翻译任务在跑；页面只把用户勾选后的正文发给 `/api/translate/*`，「不翻译」路径不发请求；确认框只展示占比百分比与目标语言名；e2e 绝不把真实网页正文或密钥写进仓库（占比用改写 analyze 响应构造）。
- `feat-025` 新增边界：自定义语言入口已从设置页隐藏，但 `languages.custom` 字段与 `addCustomLanguage()` 及单测保留（存量自定义标签仍出现在目标语言下拉里）；要恢复入口只需恢复 `settings/page.tsx` 的那段 JSX 与 `setNote("language", …)` 分支。

## Next Stage Entry

- 当前 `activeFeature` = **无**：`feat-024` – `feat-041` 均 done，**`feat-040`（B 浏览器插件）已于 2026-09-24 关闭**（S1/S2/S3 全部完成，T3.4 人工验收 6 条全过）。`feat-041`（默认 MD 保存路径）随 `0.3.6` 发布并关闭。下一个待办是 `feat-042`（A 桌面端「文档处理」）。
- 下一轮入口：**`feat-042`（A 桌面端「文档处理」）先走一轮规划** —— 读 `docs/PRD-app-document-processing.md`（§3 尚有待对齐项）与 `docs/PLAN-browser-extension.md`（§6 四组规则已于 2026-09-24 裁定、§7 是未验证与风险），规划定稿后再开工；它与已关闭的 B（`feat-040`）无顺序、无代码依赖。桌面端自 `0.3.6` 后未改，**一动 `src/` / `electron/` / 打包配置就要先 bump 到 `0.3.7` 并同步版本面**（清单见本文件顶部开工提示词），否则 `desktop:release` 会拒跑。
- 每轮开头固定读：`PROGRESS.md` → `session-handoff.md` → `feature_list.json` → 相关 `docs/`（涉及翻译行为时先读 `docs/PRD-translation.md`），然后跑 `./init.sh` 建立基线。
- 全部阶段文档（已完成入口）：`docs/features/translation/S1-settings-infra.md` 至 `S6-release-and-docs.md`；各文档的 Handoff 已写入下一阶段所需的真实接口与边界。
## Environment Notes

- 网络（2026-09-18 实测）：`github.com` 返回 200、`api.github.com` 可用（2026-09-17 记录的不可达已不成立）；GitHub releases 上只有 `v0.2.1` 带资源、`v0.2.0` 无资源，因此 0.1.x 历史 ZIP 无法从 GitHub 取回。若 `node_modules/electron/dist` 再次缺失，用 `ELECTRON_MIRROR=https://registry.npmmirror.com/-/binary/electron/ npx install-electron`。
- 代理（2026-09-20 实测）：本机 `ALL_PROXY` / `HTTPS_PROXY` 指向 `127.0.0.1:7897`，当时客户端在监听但转发已坏 —— `gh`、`curl` 报 `EOF` / `SSL_ERROR_SYSCALL`，`git fetch` / `git push` 同样失败，**直连正常**。发布 `v0.3.3` 时用直连绕过：`git -c http.proxy= -c https.proxy= push|fetch origin`，`gh` 则先 `unset ALL_PROXY HTTPS_PROXY HTTP_PROXY`。下次再遇到 `EOF` 先试直连，不要以为是 GitHub 挂了。
- Playwright 浏览器：`npx playwright install chromium firefox webkit`（当前 revision 1228 / 1532 / 2311），缺浏览器时 `npm run test:e2e` 会直接报缺可执行文件。
- `MD_CONVERTOR_TEST_PROVIDER=1` 是测试/e2e 专用开关（内置伪模型，不联网）；生产未设置时该分支不可达。生产路径的环境变量仍是 `MD_CONVERTOR_USER_DATA` / `MD_CONVERTOR_SECRETS` / `MD_CONVERTOR_SESSION_TOKEN` / `PATH`。
- **Firefox e2e 在本 agent 环境需要 `MOZ_DISABLE_CONTENT_SANDBOX=1`（2026-09-22 修正）**：此前记的「无法运行、必须由用户补跑」是**错误结论**，现已在 `playwright.config.ts` 顶部固化，三引擎可自足跑通。**根因**：Firefox 在 macOS 上给 content process 套自己的 Seatbelt profile，而 macOS 禁止嵌套沙箱 —— 已在沙箱里的进程无法再次 `sandbox_init()`，报 `Sandbox error: sandbox_init() failed with error "Operation not permitted"` 后进程退出，表现为每个用例 30s 超时。**只需 `MOZ_DISABLE_CONTENT_SANDBOX=1` 这一个变量**（逐项实测：GMP / RDD / Socket 三个同名开关各自都 1 failed，只有它 1 passed）。**不要用** `firefoxUserPrefs: { "security.sandbox.content.level": 0 }`（实测 exit 137 / SIGKILL）。三引擎数字：**239 passed / 4 skipped / exit 0**。Chromium / WebKit 从来不受影响。
- **代理会污染 Playwright（2026-09-22）**：环境注入 `HTTP_PROXY=http://127.0.0.1:50291`，Playwright 会继承它——`connectOverCDP` 报 `Unexpected status 502`。跑任何 Playwright / 网络命令前先 `unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy` 并设 `NO_PROXY=127.0.0.1,localhost no_proxy=...`；系统代理则是 Clash 的 `127.0.0.1:7897`（Firefox 跟随、Chromium 不跟随）。
- **打包应用在本 shell 里的启动姿势（2026-09-22）**：环境注入 `ELECTRON_RUN_AS_NODE=1`，会让 Electron 当纯 Node 跑并报 `bad option: --remote-debugging-port=9222`；取消后 Chromium 自己的沙箱又被宿主 seatbelt 拒（`Failed to initialize sandbox ... Operation not permitted` → GPU 进程崩溃）。探针用 `unset ELECTRON_RUN_AS_NODE` + `--no-sandbox --disable-gpu --remote-debugging-port=9222` 跑通；**`--no-sandbox` 仅为探针用，正常双击启动不受影响**。另注意后台 `&` 起的应用进程会在该次 Bash 调用结束时被回收，启动与探针要放进同一条命令；zsh 下 `rm -f dir/*` 遇无匹配会报错并中断整条 `&&` 链，改用 `find dir -type f -delete`。
- **本机安装的稳妥 recipe（2026-09-22）**：**安装源用发布 ZIP 解压**（`ditto -x -k out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-<ver>.zip /tmp/<dir>`）而不是 `out/` 里的 `.app` bundle。这样既不碰正在运行的构建（`ditto` 与 `xattr` 都不写 userData），**不需要用户先 Cmd+Q**，又能证明「装上的就是发布的那一个」；装完立刻在**已安装副本**上重做一次指纹复核。旧安装用 `mv` 移到 `~/Downloads/MD-Convertor-archive/installed-apps/`（可恢复），不要 `rm -rf`；最后 `lsregister -f /Applications/MD-Convertor.app` 注册到 LaunchServices。注意 `xattr -dr com.apple.quarantine` 对本机自产 ZIP 通常无用武之地（只有 `com.apple.provenance`，没有 quarantine），报错可忽略。
- **`MD_CONVERTOR_USER_DATA` 无法隔离打包应用（2026-09-22 实测）**：`electron/env.mjs` 的 `buildServerEnv()` 无条件写入 `MD_CONVERTOR_USER_DATA: userDataDir`（注释原文「the MD_CONVERTOR_* keys are always authoritative」），主进程算出的目录永远赢，启动前设这个变量**没有任何效果**。因此真机探针必然读写用户真实的 `settings.json`、并把文件写进开关当前指向的真实目录（本次真的写进了用户的 iCloud 云盘）。探针必须五步收尾：备份真实 settings.json → 跑 → 逐字段比对证明 `output` 之外未被改动（页面 PUT 是整份替换）→ 还原 `defaultPath`/`useDefaultPath` → 删除落在真实目录里的探针文件。

## Recommended Next Action

**`feat-040`（B 浏览器插件）已关闭**：S1/S2/S3 全部完成，T3.4 真机人工验收 6 条全过（2026-09-24），`feature_list.json` 已置 `done`，`activeFeature` 现为 `null`。`feat-041` / `0.3.6` 亦已收口（已过门禁、已装本机、已发布为 GitHub Release）。

**唯一推荐下一步：给 `feat-042`（A 桌面端「文档处理」）走一轮规划** —— 读 `docs/PRD-app-document-processing.md` 与 `docs/PLAN-browser-extension.md`，把 Spec/Plan/Tasks 定下来再开工。它与已关闭的 B 无顺序、无代码依赖。

下面按「要不要动代码」分两类，都不要自作主张扩大范围 —— 用户两轮都明确要求过不要顺手搞无关的东西（「我只是搞一个文档下载路径，你为什么要搞这么多有的没的」）：

**A. 不改代码就能做的事**
1. **云端 Provider 端到端实测**：让用户用真实文章在设置页走一遍「拉取模型 → 选模型 → 翻译」。这是唯一还没被真人走完的主干路径（`feat-027` 的自撰探针已绿，但那不是用户验收）。
2. **规范的那一次打包冒烟**：在 Terminal 里跑一次 `ELECTRON_SMOKE_TEST=1 ELECTRON_SMOKE_TEST_SECRETS=1`（Chromium 沙箱开启）。本 agent 沙箱内只能以 `--no-sandbox --disable-gpu` 取证，属环境限制；不跑也不影响 0.3.6 的放行结论。
3. **真机小点清单**：等用户给清单后再评估是否单开一轮。

**B. 要动代码的话**
4. **插件 B（`feat-040`）已关闭**，不必再动；`extension/` 侧仍有未被用户走过的可选路径：上架商店（PRD 非目标，要做得先改 PRD）、popup/设置页（PRD §3 裁定不做）。要恢复任一项先走一轮规划。
5. **插件 A（`feat-042`）是另案**：与 B 无顺序、无代码依赖；要开工得先自己走一轮规划（它的 PRD §3 还有待对齐项），不要因为「顺手」把它拉进 B 的轮次。
6. **若确实要改桌面代码（`src/` / `electron/` / 打包配置）**：先 bump 到 `0.3.7` 并同步版本面（清单见本文件顶部开工提示词），漏一处 `desktop:release` 就拒跑。
7. 签名/notarization 用户 2026-09-20 已决定不做（QA-008 accepted）；要恢复需要 Developer ID Application 证书 + notarytool 凭据，且签名后必须重跑门禁更新哈希。
8. UI 评审结论勿重提：`docs/UI-REVIEW-2026-09-20.md` 的 P0×6 + P1×10 用户已决定全部不改。主页像素级断言（转换按钮右边缘与粘贴框右边缘差值 < 4px、且与「来源 URL」输入框同行）是刻意锁定的效果，要改先改断言。

不要重做 `feat-024` – `feat-041` 里任何已完成 feature。**不要移除 `feat-041` 已固化的四条实现语义**：不要把 `isAbsoluteDirPath` 收紧回 `value.includes("~")`（iCloud 云盘目录会被全部拒掉，那正是真机缺陷的根因）；不要给任何 `await bridge.*` 去掉 `.catch()`（preload 拒非法参数是**抛异常**而非 resolve `{ ok: false }`）；不要把 `OUTPUT_CODE_MESSAGES` 的六个真实 fs 码换回笼统文案；不要把下载分叉扩成「另存为」对话框（FSD 非目标：用户要的是「不再弹」）。也不要放宽端点/密钥/归档守卫，不要把已退役的历史 ZIP 条目从 `PROTECTED_HISTORICAL_ZIP_MANIFEST` 中删除，不要动 `0.1.3` – `0.3.6` 的任何 tag 与仍然存在的受保护 ZIP。


## 历史（已退役，不需要读）

- 2026-09-24 之前的轮次叙述（feat-024 – feat-041、0.3.0 翻译线 S1–S6 的交接接口与偏差）已从本文件退役：原文本见 `git show ab1d653:session-handoff.md`，轮次结论见 `docs/QUALITY-AUDIT.md` 的 `## Archived Round Log`，产物与门禁计数见 `docs/TESTING.md` 及其中的 `## Verified Release` 表，逐 feature 的证据见 `feature_list.json` 的 `verification`。
- 2026-09-24 各轮的叙述都已压成条目进 `docs/QUALITY-AUDIT.md` 的 `## Archived Round Log`；本文件只保留现役状态。
