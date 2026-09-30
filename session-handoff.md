# Session Handoff

## Resume Here

- Current version: **`0.3.8`（本轮发布）**——版本面（`package.json` / `package-lock.json` / `feature_list.currentVersion` / `scripts/release-desktop.mjs` / release-guards fixture）已按 TDD 推到 `0.3.8`，GitHub Release `v0.3.8` 已发布；**产物字节数与 SHA-256 见 `docs/TESTING.md` 的 `## Gated Artifact (0.3.8)`**（本文件不重复记录以免漂移）。上一个已发布版本 `0.3.7`（2026-09-30，239,472,776 bytes / `6986356b…733c`）。未签名/未 notarize（个人测试定位，QA-008 accepted）。
- **本机 `/Applications/MD-Convertor.app` 仍是第二十一轮的本地构建**（0.3.7 的名字 + 修复）；第二十二轮收窄后的构建只在 `out/`，**本轮没有重装**——装不装由用户定。
- Active feature: **无**。`feat-042`（A 桌面端「文档处理」）2026-09-30 置 `done` 并随 `0.3.7` 发布：S1–S4 全绿 + 12 条真机验收由用户签字（阶段文档 `docs/features/app-document-processing/`，逐任务 RED/GREEN 在 `feature_list.json` 的 `feat-042.verification`）。关键不变量：两个 `/api/local-docs/*` **只读不写盘**，**唯一写盘出口是 `outputBridge().saveFile()`**。`feat-040`（B 插件）同日关闭，两者无代码依赖。`0.3.8` 没有新增 feature，内容是第二十一轮修复 + 第二十二轮打包收窄。
- **唯一推荐下一步：等用户裁决三件事**——① 是否把 `0.3.8` 装上本机 `/Applications`（属另一轮）；② 是否让 `extension/` 写方 percent-encode 文件名（B1 只修了读方）；③ 云端 Provider 端到端实测（需真实文章，唯一没被真人走完的主干路径）。**不要重写第二套批量编排或第二条写盘路径**；**再次发布任何版本都要用户单独授权**；**提交门的三条「只报未改」不要顺手修**（见 Recommended Next Action）。
- Pending（无一是阻塞项）：① 产物与 tag 一律不动，缺失项按退役处理；② 签名/notarization 不做；③ UI 评审结论勿重提；④ 打包冒烟第二十一轮已在**新装包**上实测通过，无需重验；⑤ **六条未裁决 flake**（列在 Environment Notes）；⑥ 打包镜像已收窄（第二十二轮，白名单 + 守卫测试）——**真正的价值是包的大小不再取决于工作树**，体积只小 3.24 MB。
- Branch: `main`，本轮把第二十一、二十二轮改动连同版本面一起提交（`6e00474`）并打 tag `v0.3.8`（已 push，Release 为 latest）；tag `v0.3.7` 仍指 `9afbe36`；stash 空。发布历史见 `docs/QUALITY-AUDIT.md`；`v0.1.3` = `ce041c9` 是不可变历史锚点。

- **本文件只写现役状态**（≤150 行 / ≤25KB）：阶段间交接写对应阶段文档的 `## Handoff`，轮次历史压进 `docs/QUALITY-AUDIT.md` 的 `## Archived Round Log`。

## 新会话开工提示词（复制即用）

```
开工 MD-Convertor —— `feat-042` 已随 `0.3.7` 发布，`0.3.8`（第二十一轮修复 + 第二十二轮打包收窄）
刚发布；现在**没有在办事项**，按用户新指令开工。

【建立基线，别跳过】
1. pwd 确认在 /Users/huanghaohai/Desktop/MD-Convertor。
2. 读 AGENTS.md（本项目那份）、PROGRESS.md、feature_list.json、session-handoff.md
   （`## Resume Here` 是权威）；需要背景时再读 docs/PLAN-browser-extension.md 与对应 feature 文档的
   `## Result`，不必通读全部阶段文档。
3. `git status --short` 应当干净；最新提交 = 0.3.8 的发布提交，tag `v0.3.8` 指向它，tag `v0.3.7` = `9afbe36`。
4. NODE_OPTIONS= ./init.sh 建立基线：Node 必须是 24.14.1 或 24.15.0（本机默认 v24.16.0 会让
   electron-forge 空跑却 exit 0）；期望 95 files / 1270 tests 全绿。

【0.3.7 / 0.3.8 都已经发布，别重做】
- 12 条真机人工验收已跑完并签字（S4 文档 §T4.2）；不要再为它们写自动化替代品。
- 再次发布（任何版本）都要用户单独授权。发布门是 `npm run desktop:release`（版本常量、历史 ZIP
  守卫、产物新鲜度/结构/SHA-256 校验都在里面，见 docs/TESTING.md 的「Release Guard」）。
- 装到本机时用发布 ZIP 解压，不要用 `out/` 里活着的 bundle（recipe 见 Environment Notes）；旧安装用 `mv` 归档不要 `rm -rf`。

【硬约束，违反任一条都算做错】
- **版本面是 0.3.8 且已发布**：下一轮若要发版，第一件事是把版本面 + `scripts/release-desktop.mjs` 的
  目标版本一起推到 `0.3.9`（bump 需用户授权）；release-guards 的 fixture 已改为从错误串派生
  （`CURRENT_RELEASE_TARGET`），bump 时不必再改它。只要改桌面代码就得先做这一步，否则发布门禁会用
  0.3.8 的名字打 0.3.8 之后的源码。只改 `extension/` 的轮次不 bump。
- 第二十一轮已落地、不要重复做：表头「全选」只勾未处理行且不带 `force`（逐行手勾＝重做）；`force` 保持
  忽略 sha256 短路（规格已改成与实现一致）；客户端的本地 skip 镜像已删；三处 ponytail 可删项已删/合并
  （`resolveScanDir`、`joinDocPath` 的重复正则、两份目录守卫 → `paths.requireSafeDirectoryPath`）；
  `electron/main.mjs` 的冒烟回灌前会删掉响应专用的 `defaults`。
- 第二十二轮已落地、**不要把它改回整目录 `cp`**：`scripts/prepare-desktop.mjs` 只按
  `scripts/desktop-server-entries.mjs` 的白名单拷贝；新增入口要同步两条守卫
  （`tests/desktop-server-scope.test.mjs` + `scripts/prepare-desktop.test.mjs`）。
- 不要重写第二套批量编排/管线/扫描/去重；A 全程唯一写盘出口仍是 outputBridge().saveFile()
  （/api/local-docs/* 只读）。
- 不要改 extension/src/** 的行为；插件 ZIP 由 prebuild 产出，不要手工造一个进 git。
- 路径校验：`~` 只在路径段**开头**才算家目录简写（com~apple~CloudDocs 里的波浪号是普通字符）
  ——别再写 value.includes("~")；服务端守卫与 preload 契约是两套独立防御，谁都不能删。
- 任何 await bridge.* 都要 .catch()（preload 校验是**抛异常**，不是 resolve { ok:false }），
  否则异常被 void 吞掉、表现为「点了没反应」。
- e2e 写设置用「取真实响应后只改写 input/output 再 fulfill」；A 的 e2e **不得读也不得写真下载目录**。
- 跑 Playwright 前先清代理（unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy
  + NO_PROXY=127.0.0.1,localhost）；test:e2e 是门禁，迭代用 npx playwright test --project=chromium -g "…"。
- 六条未裁决 flake（见 Environment Notes）**不要顺手修**；判某条失败是不是本轮造成的用干净 worktree，
  不许谎报全绿。
- 点入口卡片 / 控件前先等 hydration（e2e/entry.ts 的 gotoHydrated 等页面自己的 /api/settings GET），
  否则 firefox 上点击被静默丢弃；首页是**入口画面**，要进二级画面用 gotoConverter / openLocalDocs。
- firefox 在视口底部窄带（当前布局 y≈672）会丢掉合成鼠标点击；要点的控件落在那一带就用
  click({ position: … }) 偏上瞄，**不要改产品代码，也不要换 toPass 重试**（实测无效）。

【收尾，别漏】
- 若改了任何代码/文档：`NODE_OPTIONS= ./init.sh` 全绿 + `npm run test:e2e`（flake 口径见上）；
  同步对应阶段文档的 `## Result` / `## Handoff`、feature_list.json、PROGRESS.md、session-handoff.md、
  docs/QUALITY-AUDIT.md 的 `## Archived Round Log`（每条 ≤10 行）、CHANGELOG.md / CHANGELOG.zh.md。
- 做完停下来汇报：结论、改了哪些文件、门禁结果。**commit 等另行指示**。
```

## Latest Change

**本轮（2026-09-30 第二十三轮）**：用户「commit、push 加提交 release 到 GitHub」⇒ 先走提交门（ponytail / code-review 双轴 / neat-freak 四路只读评审，**0 硬违规**），按评审只改台账与版本面（生产代码一行未动，与第二十轮先例一致），再发布。① **版本面 bump（TDD）**：`release-guards.test.mjs` 期望改 `0.3.8` ⇒ RED（`expected 'Release version must be 0.3.7.' to contain '0.3.8'`）⇒ 改 `package.json` / `package-lock.json`(2) / `feature_list.currentVersion` / `release-desktop.mjs`(2) ⇒ 又暴出 fixture 默认版本写死（5 failed）⇒ **把 fixture 默认值改为从 `RELEASE_VERSION_ERROR` 派生**（`CURRENT_RELEASE_TARGET`）⇒ GREEN **30 passed**。② `CHANGELOG.md`/`.zh.md` 的 `[Unreleased]` 改名 `[0.3.8] - 2026-09-30`（zh 的 `### Fixed` 一并正名为 `### 修复`）并补打包收窄条目。③ `./init.sh` 95 files / 1270 tests 全绿 ⇒ 清 `out/` + `.desktop/` 后跑 `desktop:release` **exit 0**（e2e 312 passed / 6 skipped、live 2 passed、产物 236,224,675 bytes / SHA-256 `94624625…b2ea`）⇒ 提交 `6e00474` → push → tag `v0.3.8` → `gh release create … --latest`（非草稿非预发布、服务端 digest 一致）。**未**把 ZIP 拷进归档目录（release guard 会拒）。④ **提交门的三条「只报未改」**：`withoutTrailingSlash` 丢掉 `"/"` 分支（根目录 → `""`，无测试）、`tests/desktop-server-scope.test.mjs` 两条近同义反复断言 + `if (!prepared) return;`、`tests/secrets-smoke-payload.test.ts` 的文本级 `indexOf` 守卫；另有 ponytail 的 3 处装饰性可删项。

**上一轮（第二十二轮）**：**打包镜像收窄为白名单** —— `scripts/prepare-desktop.mjs` 不再整目录 `cp` `.next/standalone` 那份仓库镜像，改按 `scripts/desktop-server-entries.mjs` 的白名单逐项拷贝；`tests/desktop-server-scope.test.mjs`（真产物）+ `scripts/prepare-desktop.test.mjs`（fixture）钉住。**省的是卫生与确定性，不是体积**（镜像里那批仓库目录只有 ~8 MB；真正价值＝ build 时 `out/` 829 M 在场、`.next/standalone` 镜像到 1.17 GB 而 `.desktop/server` 仍稳定 288 MiB）。可移植性已在本机实测：空 HOME / 无 playwright 缓存 / **把仓库目录改名**后冒烟仍通过。第二十一轮（全选不改已处理行、`force` 口径按实现定稿、删死分支与 3 处可删项、修打包冒烟 `defaults` 回灌）与第二十轮（0.3.7 发布）逐条见 `docs/QUALITY-AUDIT.md` 的 `## Archived Round Log`。

- **归档位置**：逐轮叙述见 `docs/QUALITY-AUDIT.md` 的 `## Archived Round Log`（含 2026-09-24 起各轮）；S1–S4 逐任务证据见 `feature_list.json` 的 `feat-042.verification`；B 插件见 `feat-040.verification`。

## Important Boundaries

- Node.js 24, Next.js 16, Electron, npm, TypeScript strict.
- TDD is mandatory for every code change.
- Only `darwin/arm64` is supported.
- `v0.1.3` remains an immutable historical tag at `ce041c9`.
- Release guards hash-check every historical ZIP still present in the external archive, and report a missing entry as retired (2026-09-18, see `PROGRESS.md`).
- The app is unsigned and not notarized, so it is a personal-test build rather than a frictionless public distribution.
- Never store or print webpage bodies, clipboard content, cookies, tokens, or private URLs in tests or logs.
- 0.3.0 新增边界：翻译请求的正文与密钥同样不得写入日志或落盘；Provider 端点校验（放开 loopback/私网、禁跨主机重定向）与网页抓取 SSRF 策略是两套独立实现，不得互相放宽。
- 2026-09-24 新增边界（浏览器插件）：`darwin/arm64` 只限**桌面产物**，扩展验收于 Chromium；只改 `extension/` 的轮次**不 bump 桌面版本、不跑 `desktop:release`**（插件版本由 `extension/manifest.json` 自管）；扩展只读当前页 DOM、只写下载目录下的相对路径，不读 cookie/凭据、不把页面内容或 URL 写进日志。
- S2 新增边界：四个新路由的日志仅 `{requestId,status,code,durationMs}`；`/api/runtime/secrets` 请求体一律不持久化、不记录；本地 CLI 子进程环境必须剔除 `MD_CONVERTOR_*`（含 `MD_CONVERTOR_SESSION_TOKEN`、`MD_CONVERTOR_SECRETS`）。
- 翻译线（0.3.0，已完成，边界仍生效）：两个翻译端点的请求体与模型输出都不落盘、不记日志；prompt 只含待翻译块；CLI stdout/stderr 永不回显；错误消息不回显正文、密钥或 URL query；同时只允许一个翻译任务在跑；页面只把用户勾选后的正文发给 `/api/translate/*`；确认框只展示占比与目标语言名；e2e 不把真实正文或密钥写进仓库（占比用改写 analyze 响应构造）。
- `feat-025` 边界：自定义语言入口已从设置页隐藏，但 `languages.custom` 字段 / `addCustomLanguage()` / 单测保留（存量标签仍出现在目标语言下拉）；恢复入口只需还原 `settings/page.tsx` 那段 JSX 与 `setNote("language", …)`。

## Next Stage Entry

- 当前 `activeFeature` = **无**。`feat-042`（A 桌面端「文档处理」）2026-09-30 已 `done` 并随 `0.3.7` 发布（S1–S4 全绿 + 12 条真机验收签字）；`feat-024` – `feat-041` 均 done。版本面 `0.3.8`（**本轮已发布**）。
- 下一轮入口：**由用户指定**。候选（均需单独授权）：把 `0.3.8` 装到本机、`extension/` 写方 percent-encode、云端 Provider 实文实测、提交门的三条「只报未改」。**没有强制项**；别再为已关闭的验收写自动化替代品。
- 每轮开头固定读：`PROGRESS.md` → `session-handoff.md` → `feature_list.json` → 相关 `docs/`（涉及翻译行为时先读 `docs/PRD-translation.md`），然后跑 `./init.sh` 建立基线。
- 全部阶段文档（已完成入口）：`docs/features/translation/S1-settings-infra.md` 至 `S6-release-and-docs.md`；各文档的 Handoff 已写入下一阶段所需的真实接口与边界。

## Environment Notes

- 网络：`github.com` / `api.github.com` 可用，但 GitHub releases 上 0.1.x 的历史 ZIP 取不回来。若 `node_modules/electron/dist` 缺失，用 `ELECTRON_MIRROR=https://registry.npmmirror.com/-/binary/electron/ npx install-electron`。
- 代理（2026-09-20 实测）：本机 `ALL_PROXY` / `HTTPS_PROXY` 指向 `127.0.0.1:7897` 且转发已坏——`gh` / `curl` 报 `EOF` / `SSL_ERROR_SYSCALL`，`git fetch|push` 同样失败，**直连正常**（`git -c http.proxy= -c https.proxy= …`）。遇到 `EOF` 先试直连。
- Playwright 浏览器：缺就 `npx playwright install chromium firefox webkit`。
- `MD_CONVERTOR_TEST_PROVIDER=1` 是测试/e2e 专用开关（内置伪模型，不联网）；生产未设置时该分支不可达。生产路径的环境变量仍是 `MD_CONVERTOR_USER_DATA` / `MD_CONVERTOR_SECRETS` / `MD_CONVERTOR_SESSION_TOKEN` / `PATH`。
- **Firefox e2e 需要 `MOZ_DISABLE_CONTENT_SANDBOX=1`（已固化在 `playwright.config.ts` 顶部，`??=` 可关）**：macOS 禁嵌套沙箱——已在沙箱里的进程再 `sandbox_init()` 得 `Operation not permitted`，表现为每个用例 30s 超时。**只需这一个变量**（其余同名开关无效）；**不要用** `firefoxUserPrefs: { "security.sandbox.content.level": 0 }`（实测 SIGKILL / exit 137）。三引擎数字：**312 passed / 6 skipped / 0 failed（2026-09-30 实测）**。
- **firefox 在视口底部窄带会丢掉合成鼠标点击（2026-09-29 查实，不是产品缺陷也不是 flake）**：修法是点偏上位置（`click({ position: { x: 30, y: 6 } })`，仍是真实鼠标点击；`toPass` 重试包装 5/5 全红）。探针数据与机制见 `docs/TESTING.md`。
- **六条未裁决的 flake**：`e2e/home.spec.ts:305`、`e2e/paste.spec.ts:212`、`e2e/settings.spec.ts:544`（firefox 设置页未渲染完就查 radio）、`e2e/settings.spec.ts:731` 与 `e2e/local-docs.spec.ts:404`（`gotoHydrated` 等 `/api/settings` GET 30s 超时）、`e2e/home.spec.ts:201`（firefox 代理错误，清了代理仍偶发）——均隔离重跑全绿。看着它红先比对干净 worktree；要碰先问用户。
- **判「一条 e2e 失败是不是本轮造成的」用干净 worktree，不要靠记忆**（`git worktree add` + `cp -Rc node_modules`，**不要 symlink**）+ `npm run build`；recipe 见 `docs/TESTING.md`。
- **点客户端状态控件前先等 hydration、并统一走 `e2e/entry.ts`（2026-09-29）**：入口画面 / 模式 / 内层 tab 都是客户端 state，SSR 页上的点击会在监听器接上之前被静默丢弃——firefox 是够慢的那个引擎。等一拍 `/api/settings` 的 GET（页面自己的挂载副作用）就稳；修的是**测例**，因为这是 SSR 固有的窗口。看到「点了没反应」先查这条，别先当产品缺陷。
- **名字互为子串的可访问名要 `exact: true`（2026-09-30 更新）**：入口卡片现在是 `role="button"`、「粘贴URL/富文本转换」（非 tab），所以内层 tab 「链接转换」不再与它冲突；但同屏可达的 「富文本转换」 仍与它互为子串，断言内层 tab 时仍要 `exact: true`；`<td>` 里带 checkbox 时单元格名字会吸到 checkbox 的 `aria-label="选择 …"`，也要 `exact: true`。
- **`vitest.config.ts` 的 `test.exclude` 必须保留 `.next/**` + `.desktop/**` + `out/**`**：`next build`（`output: "standalone"`）把整个仓库镜像进 `.next/standalone`（含测试文件），`.desktop/server` 与 `out/…/Resources/server` 是同一份副本；少了它们，跟在一次 build / e2e / `desktop:make` 之后的 `./init.sh` 会收进几百份重复用例并报红。**收窄（第二十二轮）没有取消这条**——`.desktop/server` 仍会存在，只是不再含仓库副本。
- **代理会污染 Playwright（2026-09-22）**：环境注入的 `HTTP_PROXY` 会被 Playwright 继承（`connectOverCDP` 报 `Unexpected status 502`），跑命令前先 `unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy` + `NO_PROXY=127.0.0.1,localhost`；系统代理是 Clash `127.0.0.1:7897`（Firefox 跟随、Chromium 不跟随）。
- **打包应用在本 shell 里的启动姿势（2026-09-22）**：注入的 `ELECTRON_RUN_AS_NODE=1` 会让 Electron 当纯 Node 跑（像卡死，不像报错）；取消后 Chromium 自己的沙箱又被宿主 seatbelt 拒（`Operation not permitted` → GPU 进程崩溃）。探针用 `unset ELECTRON_RUN_AS_NODE` + `--no-sandbox --disable-gpu --remote-debugging-port=9222`（**`--no-sandbox` 仅探针用**，双击启动不受影响）。后台 `&` 起的进程会在该次 Bash 调用结束时被回收，启动与探针放进同一条命令；`rm -f dir/*` 无匹配会中断 `&&` 链，改用 `find dir -type f -delete`。
- **本机安装的稳妥 recipe（2026-09-22）**：安装源用**发布 ZIP 解压**（`ditto -x -k out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-<ver>.zip /tmp/<dir>`）而不是 `out/` 里的 `.app` bundle——不碰正在运行的构建、不需要先 Cmd+Q、还能证明「装上的就是发布的那一个」；旧安装用 `mv` 移到 `~/Downloads/MD-Convertor-archive/installed-apps/`，不要 `rm -rf`。
- **`MD_CONVERTOR_USER_DATA` 不能隔离打包应用（2026-09-22 实测）**：`electron/env.mjs` 的 `buildServerEnv()` 无条件用主进程算出的 `userDataDir` 覆盖它。真机探针必然读写真实 `settings.json` 并写进开关指向的真实目录（曾写进 iCloud）。必须五步收尾：备份 → 跑 → 逐字段比对（页面 PUT 是整份替换）→ 还原 `defaultPath`/`useDefaultPath` → 删除探针文件。
- **`ditto` 打 ZIP 必须带 `--norsrc --noextattr`（2026-09-29）**：不带会带出 4 个 `._*` AppleDouble 伴生条目（ZIP 从 5 条变 9 条）；且 ditto **不写 ZIP 的 UTF-8 标志位**——`unzip -Z1` 对 `使用说明.md` 显示乱码（`ditto -x -k` / `unzip` 解压其实是对的）。**因此测试要解压后读字节，不要对非 ASCII 条目名做字节比对**。
- **`public/md-convertor-extension.zip` 由 `prebuild` 保证（2026-09-29）**：任何 `next build` 都先跑 `build:extension` 产出它；**该脚本必须保持对并发调用安全**（暂存目录带 `process.pid`、ZIP 先写 `pack.zip` 再 `rename`）——**别把 `<pid>` 或 `rename` 改回去**，细节见 `docs/TESTING.md`。
- **发布门只建产物，不建 tag/release（2026-09-30）**：`npm run desktop:release` 校验完就结束；`git tag v<ver>` 要指向「构建所用源码」那条提交（0.3.8 = 含版本面与 CHANGELOG 的那条提交），然后用 `gh release create v<ver> <zip> --title … --notes-file … --latest`（`--target <短 SHA>` 会被 API 拒，要写分支名或先自己推 tag）。发布后再另起一次「簿记提交」（TESTING.md 产物记录 + 已发布状态 + AGENTS.md 版本句），与历史做法一致。
- **「另一台机器能不能用」的边界（2026-09-30 实测）**：除签名与 arm64 外，本机能证的全部已证（白名单收窄 + 无仓库 / 空 HOME / 无 playwright 缓存冒烟通过）；**唯一测不出的是「不同 macOS 版本 / 不同 Apple Silicon 代际」**。产物未签名 ⇒ 资源封条不完整（`codesign --verify --deep --strict` 报 `code has no resources but signature indicates they must be present`），下载后大概率被 Gatekeeper 拦，放行需 `xattr -cr /Applications/MD-Convertor.app` 或 系统设置 → 隐私与安全性 → 仍要打开；用户已明确接受（「那就无所谓」）。

## Recommended Next Action

**`feat-042` 已随 `0.3.7` 发布，`0.3.8`（第二十一轮修复 + 第二十二轮打包收窄）本轮已发布。桌面线下一轮没有强制项。**

**待用户裁决（都可以否决）**：

1. **提交门的三条「只报未改」**（本轮评审提出，**不要顺手修**）：① `src/lib/local-docs/batch.ts` 的 `withoutTrailingSlash` 丢掉了 `|| "/"` 分支 ⇒ 根目录 `/` 变成 `""`（行为变化、无测试，Standards 与 Spec 两轴都提）；② `tests/desktop-server-scope.test.mjs` 有两条近同义反复的「never allows」断言 + `if (!prepared) return;` 会静默通过而不是 skip；③ `tests/secrets-smoke-payload.test.ts` 是文本级 `indexOf` 源码守卫（弱、脆）；④ ponytail 的 3 处装饰性可删项（`scripts/desktop-server-entries.mjs` 里 3 个只被测试用的导出、`client.ts:56` 的 `joinDocPath` 单调用包装、`e2e/local-docs.spec.ts` 里重复的 marker JSON 模板）。
2. **`extension/` 写方 percent-encode 文件名**（B1 只修了读方，需单独授权）。
3. **云端 Provider 端到端实测**（真实文章走一遍「拉取模型 → 选模型 → 翻译」，唯一没被真人走完的主干路径）。
4. **在 Terminal 里跑一次规范打包冒烟**（`ELECTRON_SMOKE_TEST=1 ELECTRON_SMOKE_TEST_SECRETS=1`，沙箱开启；agent 沙箱内只能 `--no-sandbox --disable-gpu` 取证）。
5. **把 `0.3.8` 装到本机 `/Applications`**（`out/` 已有产物；属另一轮）。

**已裁决/已完成，不要重开**：预发布评审的行为存疑项与 3 处 ponytail 可删（第二十一轮全落地）；`vitest.config.ts` 的 `.next/**` 排除与 `settings/page.tsx` 的 `.catch()`（V1/V2）；A1 的 `images.ts` 提取导出；S3 的五处任务表外选择 / S4 的四处偏差；真机反馈历轮 16 + 5 + 1 + 6 条；首页入口画面（用户裁定为最初设计意图）；打包镜像收窄（第二十二轮已完成）。

**约束提醒**：不要重做 `feat-024` – `feat-042` 里任何已完成 feature。**不要移除 `feat-041` 已固化的四条语义**：`isAbsoluteDirPath` 不要收紧回 `value.includes("~")`（iCloud 目录会被全拒）；`await bridge.*` 不要去掉 `.catch()`（preload 拒非法参数是**抛异常**）；`OUTPUT_CODE_MESSAGES` 六个真实 fs 码不要换回笼统文案；下载分叉不要扩成「另存为」对话框（FSD 非目标）。也不要放宽端点/密钥/归档守卫，不要删 `PROTECTED_HISTORICAL_ZIP_MANIFEST` 里已退役的条目，不要动 `0.1.3` – `0.3.8` 的任何 tag 与仍存在的受保护 ZIP。

**其余固定口径**：签名/notarization 不做（QA-008 accepted；恢复需证书 + notarytool 凭据，签名后必须重跑门禁更新哈希）；UI 评审结论勿重提（`docs/UI-REVIEW-2026-09-20.md` 的 P0×6 + P1×10 全部不改；主页像素级断言是刻意锁定，要改先改断言）；`extension/` 的「上架商店」（PRD 非目标）与「popup/设置页」（PRD §3 不做）不要再动。

## 历史（已退役，不需要读）

- 旧轮次叙述已退役：原文见 `git show ab1d653:session-handoff.md`，结论见 QUALITY-AUDIT 的 `## Archived Round Log`，门禁计数见 `docs/TESTING.md`。
