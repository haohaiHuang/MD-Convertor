# Session Handoff

## Resume Here

- Current version: **`0.3.7`（开发中，未发布）**；最后一个已发布版是 `0.3.6`（`v0.3.6`，2026-09-22 GitHub Release，已装到 `/Applications`）。**发布 `0.3.7` 未获授权**（`desktop:release` 目标版本已是 `0.3.7`，发布与否由用户单独下指令）；未签名/未 notarize（个人测试定位）。
- Active feature: **无**。`feat-042`（A 桌面端「文档处理」）**已于 2026-09-30 置 `done` 并关闭**：S1–S4 全绿，12 条真机验收由用户签字（阶段文档在 `docs/features/app-document-processing/`，逐任务 RED/GREEN 在 `feature_list.json` 的 `feat-042.verification`，**39 条**）。关键不变量：两个 `/api/local-docs/*` **只读不写盘**，**唯一写盘出口是 `outputBridge().saveFile()`**。`feat-040`（B 插件）同日关闭，两者无代码依赖。
- **唯一推荐下一步：无现役事项，等用户指令**。候选（均需单独授权）：① 发布 `0.3.7`（`desktop:release` 目标版本已是 `0.3.7`，发布前重跑门禁）；② 收窄打包镜像（`scripts/prepare-desktop.mjs` 只拷 `server.js` / `.next` / `node_modules` / `public` / `browser` + 守卫测试）；③ `extension/` 写方 percent-encode 文件名；④ 云端 Provider 端到端实测（需真实文章）。**不要再 bump 版本**（已是 `0.3.7`）、**不要重写第二套批量编排或第二条写盘路径**。
- Pending（无一是阻塞项）：① **S4 的 12 条人工验收已于 2026-09-30 全部签字，`feat-042` 置 `done`**（真机反馈 16 条 + 第二至五轮共 12 条亦全部落地，见 `## Recommended Next Action`）；② 云端 Provider 端到端实测（真实文章走一遍「拉取模型 → 选模型 → 翻译」）；③ 真机小点清单（等用户给）；④ 产物与 tag 一律不动，缺失项按退役处理；⑤ 签名/notarization 不做；⑥ UI 评审结论勿重提；⑦ 可选：Terminal 里跑一次规范打包冒烟；⑧ 五条 load flake 未修。
- Branch: `main`，**本地领先 `origin/main` 1 个提交**（第十轮 A 规划文档定稿，已提交未 push）；**S1、S2、S3、S4 的全部改动均未提交**（用户指示「commit 等另行指示」）。上一个推送点是 B 插件整条线路（已推 `24bf00f` → `335e0d4`，16 个提交）；**stash 列表实测为空**（那条「2026-09-21 文档备份」在本轮之前就已不在）。发布历史（tag → commit 与产物哈希）见 `docs/QUALITY-AUDIT.md`；`v0.3.6` = `3578822` 是最新已发布，`v0.1.3` = `ce041c9` 是不可变历史锚点

- **本文件只写现役状态**（≤150 行 / ≤25KB）：阶段间交接写对应阶段文档的 `## Handoff`，轮次历史压进 `docs/QUALITY-AUDIT.md` 的 `## Archived Round Log`。

## 新会话开工提示词（复制即用）

```
开工 MD-Convertor —— A 桌面端「文档处理」（feat-042，含 S4 的 12 条真机验收）已于 2026-09-30 关闭；现在**没有在办事项**，按用户新指令开工。

【建立基线，别跳过】
1. pwd 确认在 /Users/huanghaohai/Desktop/MD-Convertor。
2. 读 AGENTS.md（本项目那份）、PROGRESS.md、feature_list.json、session-handoff.md（`## Resume Here` 是权威）；
   再读 docs/features/app-document-processing/S4-...-acceptance.md 的 `## Result`（12 条表在那里）与 FSD.md §6；
   S1–S3 的细节只在需要时再翻。
3. git status --short：S1–S4 的全部改动**尚未提交**（用户指示「commit 等另行指示」）。
4. NODE_OPTIONS= ./init.sh 建立基线：Node 必须是 24.14.1 或 24.15.0（本机默认 v24.16.0 会让
   electron-forge 空跑却 exit 0）；期望 93 files / 1252 tests 全绿。

【本轮要做的只有一件事：那 12 条人工验收】
- 它们在 S4 文档 §T4.2 的表里（与 FSD §6 同源）。逐条真机跑、结论填进该表与 `feat-042.verification`；
  **不要用自动化桩或 S3 的 e2e 冒充，也不要把没跑过的勾上**。
- 第 2 条先从 `public/md-convertor-extension.zip` 解压（任一 `next build` 都会因 `prebuild` 产出它），
  再在 Chrome 里「加载已解压的扩展程序」。
- 第 9（同一批再点一次全跳过；要重做某行就重新勾选它再一键转换，已无单独「重新处理」按钮）与第 12（≥30 图时行状态只说「完成」，未内嵌张数看汇总行，不要期待行内数字）
  是最容易出差的两条，出问题先回 S3 / S2 改，不要在 S4 里加补丁。
- 真机验收若碰真实目录：先备份真实 settings.json → 跑 → 逐字段比对（除 `output` 外不得变）→ 还原 → 删产物。
- 收官已完成（2026-09-30）：12 条全绿 ⇒ `feat-042` 已标 `done`。若以后重新开验，任一条没过就改回 `in-progress` 并报明。

【硬约束，违反任一条都算做错】
- **版本面已经是 0.3.7，不要再 bump**；发布 0.3.7 未获授权：不要跑 desktop:release、不要 push、不要动任何历史 tag 或 ZIP。
- 不要重写第二套批量编排/管线/扫描/去重；A 全程唯一写盘出口仍是 `outputBridge().saveFile()`（`/api/local-docs/*` 只读）。
- 不要改 `extension/src/**` 的行为；ZIP 由 `prebuild` 产出，不要手工造一个进 git。
- 路径校验：`~` 只在路径段**开头**才算家目录简写（com~apple~CloudDocs 里的波浪号是普通字符）——别再写 value.includes("~")；服务端守卫与 preload 契约是两套独立防御，谁都不能删。
- 任何 await bridge.* 都要 .catch()（preload 校验是**抛异常**，不是 resolve { ok:false }），否则异常被 void 吞掉、表现为「点了没反应」。
- e2e 写设置用「取真实响应后只改写 input/output 再 fulfill」；A 的 e2e **不得读也不得写真下载目录**。
- 跑 Playwright 前先清代理（unset 四个 HTTP_PROXY/https_proxy/ALL_PROXY + NO_PROXY=127.0.0.1,localhost）；test:e2e 是门禁，迭代用 npx playwright test --project=chromium -g "…"。
- 三条 firefox `load` flake（`home.spec.ts:305`、`paste.spec.ts:212`、`settings.spec.ts:544`）**不要顺手修**，判新旧用干净 worktree，不许谎报全绿；已修掉的那条（`home.spec.ts:109`）见 Environment Notes。
- 点入口卡片 / 控件前先等 hydration（`e2e/entry.ts` 的 `gotoHydrated` 等页面自己的 `/api/settings` GET），否则 firefox 上点击被静默丢弃。
- 首页现在是**入口画面**，`page.goto("/")` 落在它上面；要进二级画面用 `e2e/entry.ts` 的 `gotoConverter` / `openLocalDocs`，不要再裸写 `goto("/")` 后直接点。
- firefox 在视口底部窄带（当前布局 y≈672）会丢掉合成鼠标点击；要点的控件落在那一带就用 `click({ position: … })` 偏上瞄，**不要改产品代码，也不要换 `toPass` 重试**（实测无效）。

【收尾，别漏】
- 若改了任何代码/文档：`NODE_OPTIONS= ./init.sh` 全绿 + `npm run test:e2e`（见上 flake 口径）；
  同步 S4 阶段文档的 `## Result` / `## Handoff`、`feature_list.json`（`feat-042.verification`）、`PROGRESS.md`、
  `session-handoff.md`、`docs/QUALITY-AUDIT.md` 的 `## Archived Round Log`（每条 ≤10 行）。
- 做完停下来汇报：结论、改了哪些文件、门禁结果。**commit 等另行指示**。
```

## Latest Change

**本轮（2026-09-30 第十九轮）**：转换后每行只报状态 —— `statusLabel` 的 `done` 分支由「完成（内嵌 N 张，保留 M 张）」改成「完成」，张数改由汇总行（`内嵌图片 N 张 · 未内嵌 M 张`）给出；**这推翻了 FSD §4.7/§4.4 原口径**（已同步 FSD、S3、S4 §第六轮 + 验收表第 12 条、CHANGELOG）。RED：两处 e2e 断言改 `{ name: "完成", exact: true }`（**必须 `exact`**，否则子串匹配在旧文案下误绿）→ 1 failed；GREEN：chromium 14 passed。清 `out/` + `.desktop` 后重打 **572 M**（PID 60736），chunk 指纹核实 `完成（内嵌` 已消失。**收尾**：用户在该构建上跑完 12 条人工验收并回「真机测试OK」⇒ `feat-042` 置 **`done`**（verification 39 条，原「ALL 12 PENDING」句已改写）；本步只动台账与文档，无代码变更。
**上一轮（第十八轮，同日）**：R6 设置页长路径 ⇒ `.providerHead .path { flex: 1 1 0 }`（`flex-wrap` 按 max-content 折行，光有省略号不够）；同轮修掉钉住用例自身的 `Response has been disposed` 竞态，并给 `test.exclude` 加 `.desktop/**` + `out/**`（打包会把仓库镜像复制到这两处，见 V8）。第十七轮真机 5 条（3 修 / 2 不复现）见 S4 第四轮节。

- **归档位置**：逐轮叙述见 `docs/QUALITY-AUDIT.md` 的 `## Archived Round Log`（第十七 / 十六 / 十五 / 十四 / 十三轮与 2026-09-24 第一至十二轮）；S1–S4 逐任务证据见 `feature_list.json` 的 `feat-042.verification`（39 条）；B 插件见 `feat-040.verification`（35 条）。

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
- 翻译线（0.3.0，已完成，边界仍生效）：两个翻译端点的请求体与模型输出都不落盘、不记日志；prompt 只含待翻译块；CLI stdout/stderr 永不回显；错误消息不回显正文、密钥或 URL query；同时只允许一个翻译任务在跑；页面只把用户勾选后的正文发给 `/api/translate/*`；确认框只展示占比与目标语言名；e2e 不把真实正文或密钥写进仓库（占比用改写 analyze 响应构造）。
- `feat-025` 边界：自定义语言入口已从设置页隐藏，但 `languages.custom` 字段 / `addCustomLanguage()` / 单测保留（存量标签仍出现在目标语言下拉）；恢复入口只需还原 `settings/page.tsx` 那段 JSX 与 `setNote("language", …)`。

## Next Stage Entry

- 当前 `activeFeature` = **无**。`feat-042`（A 桌面端「文档处理」）**2026-09-30 已 `done` 并关闭**（S1–S4 全绿 + 12 条真机验收签字）；`feat-024` – `feat-041` 均 done，`feat-040`（B 浏览器插件）与 `feat-041`（默认 MD 保存路径，随 `0.3.6` 发布）同日已关闭。版本面 `0.3.7`（未发布）。
- 下一轮入口：**由用户指定**。可选：发布 `0.3.7`（`desktop:release`，需单独授权，发布前重跑门禁）、收窄打包镜像、`extension/` 写方 percent-encode、云端 Provider 实文实测。**没有强制项**；别再为已关闭的验收写自动化替代品。
- 每轮开头固定读：`PROGRESS.md` → `session-handoff.md` → `feature_list.json` → 相关 `docs/`（涉及翻译行为时先读 `docs/PRD-translation.md`），然后跑 `./init.sh` 建立基线。
- 全部阶段文档（已完成入口）：`docs/features/translation/S1-settings-infra.md` 至 `S6-release-and-docs.md`；各文档的 Handoff 已写入下一阶段所需的真实接口与边界。
## Environment Notes

- 网络：`github.com` / `api.github.com` 可用（2026-09-18 实测；09-17 的不可达已不成立），但 GitHub releases 上 0.1.x 的历史 ZIP 取不回来。若 `node_modules/electron/dist` 缺失，用 `ELECTRON_MIRROR=https://registry.npmmirror.com/-/binary/electron/ npx install-electron`。
- 代理（2026-09-20 实测）：本机 `ALL_PROXY` / `HTTPS_PROXY` 指向 `127.0.0.1:7897` 且转发已坏 —— `gh` / `curl` 报 `EOF` / `SSL_ERROR_SYSCALL`，`git fetch|push` 同样失败，**直连正常**（`git -c http.proxy= -c https.proxy= …`，`gh` 先 `unset ALL_PROXY HTTPS_PROXY HTTP_PROXY`）。遇到 `EOF` 先试直连。
- Playwright 浏览器：缺就 `npx playwright install chromium firefox webkit`，否则 `npm run test:e2e` 直接报缺可执行文件。
- `MD_CONVERTOR_TEST_PROVIDER=1` 是测试/e2e 专用开关（内置伪模型，不联网）；生产未设置时该分支不可达。生产路径的环境变量仍是 `MD_CONVERTOR_USER_DATA` / `MD_CONVERTOR_SECRETS` / `MD_CONVERTOR_SESSION_TOKEN` / `PATH`。
- **Firefox e2e 需要 `MOZ_DISABLE_CONTENT_SANDBOX=1`（已固化在 `playwright.config.ts` 顶部，`??=` 可关）**：macOS 禁嵌套沙箱——已在沙箱里的进程再 `sandbox_init()` 得 `Operation not permitted`，表现为每个用例 30s 超时。**只需这一个变量**（GMP / RDD / Socket 同名开关均无效）；**不要用** `firefoxUserPrefs: { "security.sandbox.content.level": 0 }`（实测 SIGKILL / exit 137）。三引擎数字：**306 passed / 6 skipped / 0 failed（2026-09-30 实测）**。
- **firefox 在视口底部窄带会丢掉合成鼠标点击（2026-09-29 查实，不是产品缺陷也不是 flake）**：修法是点偏上位置（`click({ position: { x: 30, y: 6 } })`，仍是真实鼠标点击；`toPass` 重试包装 5/5 全红）。探针数据与机制见 `docs/TESTING.md`。
- **五条未裁决的 load flake**：`e2e/home.spec.ts:305`、`e2e/paste.spec.ts:212`、`e2e/settings.spec.ts:544`（firefox 设置页未渲染完就查 radio）、`e2e/settings.spec.ts:731`（页面停在「正在读取设置…」30s，桩路由未命中）、`e2e/home.spec.ts:201`（firefox `NS_ERROR_PROXY_CONNECTION_REFUSED`，清了代理仍偶发）——均隔离重跑全绿。看着它红先比对干净 worktree；要碰先问用户。
- **判「一条 e2e 失败是不是本轮造成的」用干净 worktree，不要靠记忆**：`git worktree add /tmp/xxx HEAD` + `cp -Rc node_modules /tmp/xxx/`（**不要 symlink**）+ `npm run build`，跑完 `rm -rf` + `git worktree prune`；recipe 见 `docs/TESTING.md`。
- **点客户端状态控件前先等 hydration、并统一走 `e2e/entry.ts`（2026-09-29）**：入口画面 / 模式 / 内层 tab 都是客户端 state，SSR 页上的点击会在监听器接上之前被静默丢弃——firefox 是够慢的那个引擎。等一拍 `/api/settings` 的 GET（页面自己的挂载副作用）就稳；修的是**测例**，因为这是 SSR 固有的窗口。看到「点了没反应」先查这条，别先当产品缺陷。
- **名字互为子串的可访问名要 `exact: true`（2026-09-30 更新）**：入口卡片现在是 `role="button"`、「粘贴URL/富文本转换」（非 tab），所以内层 tab 「链接转换」不再与它冲突；但同屏可达的 「富文本转换」 仍与它互为子串，断言内层 tab 时仍要 `exact: true`；`<td>` 里带 checkbox 时单元格名字会吸到 checkbox 的 `aria-label="选择 …"`，也要 `exact: true`。
- **`vitest.config.ts` 的 `test.exclude` 必须保留 `.next/**` + `.desktop/**` + `out/**`**：`next build`（`output: "standalone"`）把整个仓库镜像进 `.next/standalone`（含测试文件），而 `.desktop/server` 与 `out/…/Resources/server` 是同一份镜像的副本；少了它们，跟在一次 build、e2e 或 `desktop:make` 之后的 `./init.sh` 会收进几百份重复用例并报红。原因与实测见 `docs/TESTING.md`。
- **代理会污染 Playwright（2026-09-22）**：环境注入的 `HTTP_PROXY` 会被 Playwright 继承（`connectOverCDP` 报 `Unexpected status 502`），跑命令前先 `unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy` + `NO_PROXY=127.0.0.1,localhost`；系统代理是 Clash `127.0.0.1:7897`（Firefox 跟随、Chromium 不跟随）。
- **打包应用在本 shell 里的启动姿势（2026-09-22）**：注入的 `ELECTRON_RUN_AS_NODE=1` 会让 Electron 当纯 Node 跑（像卡死，不像报错）；取消后 Chromium 自己的沙箱又被宿主 seatbelt 拒（`Operation not permitted` → GPU 进程崩溃）。探针用 `unset ELECTRON_RUN_AS_NODE` + `--no-sandbox --disable-gpu --remote-debugging-port=9222`（**`--no-sandbox` 仅探针用**，双击启动不受影响）。后台 `&` 起的进程会在该次 Bash 调用结束时被回收，启动与探针放进同一条命令；`rm -f dir/*` 无匹配会中断 `&&` 链，改用 `find dir -type f -delete`。
- **本机安装的稳妥 recipe（2026-09-22）**：安装源用**发布 ZIP 解压**（`ditto -x -k out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-<ver>.zip /tmp/<dir>`）而不是 `out/` 里的 `.app` bundle——不碰正在运行的构建、不需要先 Cmd+Q、还能证明「装上的就是发布的那一个」；旧安装用 `mv` 移到 `~/Downloads/MD-Convertor-archive/installed-apps/`，不要 `rm -rf`。
- **`MD_CONVERTOR_USER_DATA` 不能隔离打包应用（2026-09-22 实测）**：`electron/env.mjs` 的 `buildServerEnv()` 无条件用主进程算出的 `userDataDir` 覆盖它。真机探针必然读写真实 `settings.json` 并写进开关指向的真实目录（曾写进 iCloud）。必须五步收尾：备份 → 跑 → 逐字段比对（页面 PUT 是整份替换）→ 还原 `defaultPath`/`useDefaultPath` → 删除探针文件。**S4 的 12 条人工验收同样适用**。
- **`ditto` 打 ZIP 必须带 `--norsrc --noextattr`（2026-09-29）**：不带会带出 4 个 `._*` AppleDouble 伴生条目（ZIP 从 5 条变 9 条）；且 ditto **不写 ZIP 的 UTF-8 标志位**——`unzip -Z1` 对 `使用说明.md` 显示乱码（`ditto -x -k` / `unzip` 解压其实是对的）。**因此测试要解压后读字节，不要对非 ASCII 条目名做字节比对**。
- **`public/md-convertor-extension.zip` 由 `prebuild` 保证（2026-09-29）**：任何 `next build` 都先跑 `build:extension` 产出它；**该脚本必须保持对并发调用安全**（暂存目录带 `process.pid`、ZIP 先写 `pack.zip` 再 `rename`）——**别把 `<pid>` 或 `rename` 改回去**，细节见 `docs/TESTING.md`。

## Recommended Next Action

**`feat-042`（A 桌面端「文档处理」）S1–S4 已实施完成并已关闭（2026-09-30）**：版本面 `0.3.7`（未发布）。**16 条真机反馈 + 后续 5 + 1 条已于 2026-09-30 全部落地**（B1 只修读方，写方未动）。首页是**入口画面**（两张入口卡 + 插件下载）；「转换既有文档」列出 `.md` → 勾选 → 一键转换（图片内联 + 可选翻译）→ 写进输出目录，输入＝输出会拒绝并改到 `<输入>/processed`；**两个 `/api/local-docs/*` 路由全程只读，唯一写盘出口是 `outputBridge().saveFile()`**；插件 ZIP（含 `使用说明.md`）由 `prebuild` 随构建产出。S1–S4 改动**全部未提交**；B 插件线（`feat-040`）已关闭并推送（`335e0d4`），`feat-041` / `0.3.6` 已收口。

**真机反馈第二轮 5 条（第十七轮）**：3 条面板布局已修；2 条**在浏览器与真实 Electron 下都不复现**（返回设置的来源画面 / 设置页显示「系统下载目录」），只加 2 条钉住用例、**未改导航与取值机制**；第十八/十九轮又修了设置页长路径与行状态，并修掉那两条钉住用例自身的竞态。**仍复现请给精确步骤与所用构建路径**。

**收尾（2026-09-30）**：用户在真机上跑完 S4 §T4.2 的 12 条人工验收并入「真机测试OK」⇒ 12 条全部记为通过，`feature_list.json` 的 `feat-042.status` 改为 **`done`**（verification 39 条；原「ALL 12 PENDING」句已改写）。**本步只动台账与文档，无代码变更**，也**未 commit / 未 push / 未 bump / 未发布**。

**桌面线下一轮没有强制项**，可选（均需单独授权）：① 授权后跑 `desktop:release` 发布 `0.3.7`；② 收窄打包镜像（`Resources/server` 现为整仓副本）；③ `extension/` 写方 percent-encoding；④ 云端 Provider 实文实测。约束同上一节的【硬约束】。

**待用户裁决（范围外，已做过/未做，任一条都可以否决）**：

1. **V1/V2（已做）**：`vitest.config.ts` 的 `test.exclude` 加 `.next/**`（否则 build/e2e 之后的 `./init.sh` 必红）；`src/app/settings/page.tsx` 的 `chooseOutputDirectory()` 补 `.catch()`（与 preload 抛异常的约定对齐）。
2. **V3（已修，2026-09-29）** `e2e/home.spec.ts:109` 的 firefox 失败不是 flake 而是本机 firefox 在 y≈672 丢掉合成点击（确定性）；已用「点偏上位置」修好，机制见 Environment Notes。另两条 `:305` / `paste.spec.ts:212` 仍是未裁 load flake，不要顺手修。
3. **A1 的点头（S2 按「可回滚、行为不变」先做了）**：`images.ts` 的提取导出；要否决就回退提取并把 `inline-images.ts` 的默认 `deps.embed` 改指本地实现。
4. **S3 的五处任务表外选择**（已写进 S3 文档的 `## Result`）：外层 tab 去括注、`paste.spec.ts:261` 补 `exact: true`、`nextPending` 单参、`useSyncExternalStore` 探桥、面板多一个「恢复默认」按钮。
5. **S4 的四处偏差**（已写进 S4 文档的 `## Result`）：`ditto` 加 `--norsrc --noextattr`（否则 ZIP 多 4 个 `._*`）、`使用说明.md` 保留中文名、`eslint.config.mjs` 加 `extension/dist-package/**`、`build-extension.mjs` 暂存每进程唯一 + ZIP 先写 `pack.zip` 再 `rename`（并发互踩，见 Environment Notes）。
6. **真机反馈 16 条 + 后两轮 5 + 1 条（均已于 2026-09-30 落地；用户 7 条决策 + 「其他按你的意见执行」）**：明细见 S4 文档 §「真机点检反馈」各节与 §「汇总与修改建议」。B1 只修读方（`scan-refs.ts` 的 `INLINE_IMAGE` 容许空格/半角括号），写方（插件 percent-encode）需另行授权。
7. **首页入口画面（已做，2026-09-29，用户裁定为最初设计意图）**：外层 tablist 已删、刷新会回入口画面；要否决就回「顶部 tablist + 默认落转换画面」，S3 `## Result` 留有原实现描述。
8. **打包产物带一份整仓副本（第十八轮发现，未修）**：`Resources/server` 就是 `.next/standalone` 的整仓镜像（`src/` `docs/` `e2e/` `tests/` `feature_list.json` 等）；清 `out/` + `.desktop` 再打可把包从 2.3 G 降到 572 M，但副本仍在。收窄需让 `prepare-desktop.mjs` 只拷 `server.js` / `.next` / `node_modules` / `public` / `browser` 并补一条守卫测试 —— **是否另开一轮由用户定**；`/Applications` 的 0.3.6 没有这份副本，机制未查明。

不要重做 `feat-024` – `feat-041` 里任何已完成 feature。**不要移除 `feat-041` 已固化的四条语义**：`isAbsoluteDirPath` 不要收紧回 `value.includes("~")`（iCloud 目录会被全拒）；`await bridge.*` 不要去掉 `.catch()`（preload 拒非法参数是**抛异常**）；`OUTPUT_CODE_MESSAGES` 六个真实 fs 码不要换回笼统文案；下载分叉不要扩成「另存为」对话框（FSD 非目标）。也不要放宽端点/密钥/归档守卫，不要删 `PROTECTED_HISTORICAL_ZIP_MANIFEST` 里已退役的条目，不要动 `0.1.3` – `0.3.6` 的任何 tag 与仍存在的受保护 ZIP。

**不改代码就能做的三件（都等用户，别自作主张开工）**：① 云端 Provider 端到端实测（真实文章走一遍「拉取模型 → 选模型 → 翻译」，唯一没被真人走完的主干路径）；② 在 Terminal 里跑一次**规范**打包冒烟（`ELECTRON_SMOKE_TEST=1 ELECTRON_SMOKE_TEST_SECRETS=1`，沙箱开启；agent 沙箱内只能 `--no-sandbox --disable-gpu` 取证）；③ 真机小点清单等用户给。

**其余固定口径**：签名/notarization 不做（QA-008 accepted；恢复需证书 + notarytool 凭据，签名后必须重跑门禁更新哈希）；UI 评审结论勿重提（`docs/UI-REVIEW-2026-09-20.md` 的 P0×6 + P1×10 全部不改；主页像素级断言是刻意锁定，要改先改断言）；`extension/` 的「上架商店」（PRD 非目标）与「popup/设置页」（PRD §3 不做）不要再动，要恢复先走一轮规划；别把 `feat-042` 与 `extension/` 的轮次混在一起。

## 历史（已退役，不需要读）

- 2026-09-29 之前的轮次叙述（含 2026-09-24 各轮）已退役：原文见 `git show ab1d653:session-handoff.md`，结论见 QUALITY-AUDIT 的 `## Archived Round Log`，门禁计数见 `docs/TESTING.md`，逐 feature 证据见 `feature_list.json`。
