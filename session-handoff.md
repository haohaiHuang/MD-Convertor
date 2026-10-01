# Session Handoff

## Resume Here

- Current version: **`0.3.10`（已发布：GitHub Release `v0.3.10`，tag 指向 `77703c3`，与源码同一条提交）**——**产物字节数与 SHA-256 见 `docs/TESTING.md` 的 `## Gated Artifact (0.3.10)`**（本文件不重复以免漂移）。未签名/未 notarize（个人测试定位，QA-008 accepted）。
- **多设备约定（2026-09-30 起）**：本文件是**公开仓库**里的跨机共享文档，只记全局客观事实。**`/Applications/<App>.app` 装机版本是各机本地状态，不写进本文件**；各机见自己的 `.workbuddy/memory/DEVICES.md`（不入 git）。装机记录与实测不符时，**先怀疑不是同一台设备，不要先怀疑记录**（2026-09-30 曾因此误改另一台机器的真实记录）。
- Active feature: **无（feat-043「UI 走查整改」已 `done` 并随 `v0.3.10` 发布：11/11 销项、三阶段独立 QA 验收均 PASS、真机反馈追补「特点行同行右对齐」）**。逐任务 RED/GREEN 在 `feature_list.json` 的 `feat-043.verification`（8 条）与 `docs/features/ui-fix/`（S1–S3 阶段文档）。关键不变量（仍生效）：两个 `/api/local-docs/*` **只读不写盘**，**唯一写盘出口是 `outputBridge().saveFile()`**。
- **唯一推荐下一步：无在办事项，等用户下一条指令**。候选（均需单独授权）：`extension/` 写方 percent-encode、云端 Provider 实文实测、P2-3…P2-6（用户锁死推迟）。**feat-043 执行结果**：D1 `--col:880px` ✓、D2 `#6b7484`（4.71:1）✓、D4 P2-3…P2-6 推迟 ✓；**D3 按规格口径实施并获用户真机「OK了」认可**（顶栏 `1fr auto 1fr` + 品牌 `justify-self:center` 落视口中轴）；断言先行四条已全部落位（4/4）。
- Pending（无一是阻塞项）：① 产物与 tag 一律不动，缺失项按退役处理；② 签名/notarization 不做；③ 2026-09-20 旧 UI 评审（`docs/UI-REVIEW-2026-09-20.md`）勿重提（09-30 走查已销项）；④ 六条未裁决 flake（见 Environment Notes）；⑤ **发布任何新版本前先 TDD bump 到 `0.3.11`，bump 与发布均需用户授权**。
- Branch: `main` = **`77703c3`**（feat-043 实现 + 版本面 + CHANGELOG，32 files / +1660 / −247；tag `v0.3.10` 指向它）。发布后簿记为第二提交（docs-only）。`outputs/`（QA 截图/探针）按惯例不入库。stash 空；`v0.3.9` = `9f3642e`、`v0.3.8` = `6e00474`、`v0.3.7` = `9afbe36`、`v0.1.3` = `ce041c9` 不可变。

- **本文件只写现役状态**（≤150 行 / ≤25KB）：阶段间交接写对应阶段文档的 `## Handoff`，轮次历史压进 `docs/QUALITY-AUDIT.md` 的 `## Archived Round Log`。

## 新会话开工提示词（复制即用）

```
开工 MD-Convertor —— 第三十轮已把 feat-043「UI 走查整改」随 `v0.3.10` 发布完毕
（提交 `77703c3`、tag `v0.3.10`、GitHub Release 已上线、发布门禁一次通过）。
本轮做什么由用户指令定；当前无在办事项。

【建立基线，别跳过】
1. pwd 确认在 /Users/huanghaohai/Desktop/MD-Convertor。
2. 读 AGENTS.md、PROGRESS.md、feature_list.json、session-handoff.md（`## Resume Here` 是权威）。
3. `git status --short` 预期只有发布后簿记的 docs 改动（或干净，视第二提交是否已推）。
   HEAD = `77703c3`，tag `v0.3.10` = `77703c3`。
4. NODE_OPTIONS= ./init.sh 建立基线：Node 必须 24.14.1/24.15.0。期望 **95 files / 1274 passed /
   0 skipped**。若 `desktop-server-scope` 报缺文件，读 Environment Notes 的修复 recipe。

【feat-043 已随 v0.3.10 发布，别重做】
- 走查 11 条（9 P1 + P2-1 + P2-2）已全部销项（终验销项表见 `docs/features/ui-fix/
  S3-polish-and-closeout.md` 的 Result）+ 真机反馈追补「特点行同行右对齐」；P2-3…P2-6 是
  **用户锁死推迟**，不是欠账。
- 已落地锚点：三 token `--col:880px`/`--control-h:36px`/`--radius-control:10px`；顶栏三列网格
  `1fr auto 1fr` + 品牌 `justify-self:center`（红线 = `home.spec.ts:540-553` 三屏品牌 x ±0.05px，
  断言原文禁改）；placeholder `#6b7484`；禁用态弃 opacity 换色（primary 5.78:1 / secondary 6.26:1）；
  `.footerRow` 让 `.hintRow` 与勾选框同行、右对齐（2026-10-01 真机反馈取代「左对齐同轴」）；
  `.entryCard` min-height 220px；no-output 四件套；CLI 检测状态。
- 断言先行四条已落位（4/4）；输出「选择目录」按钮 title 是**条件挂载**（禁用态挂、可用态不挂，
  双向锁在 `settings.spec`），别改成恒挂。

【版本面】
- `0.3.10` 已发布（tag `77703c3`）。**发布任何新版本前先 TDD bump 到 `0.3.11`，bump 与发布都要
  用户单独授权**；只改 `extension/` 的轮次不 bump。`desktop:release` 只认当前版本面。

【硬约束（沿用，违反任一条都算做错）】
- 不要重写第二套批量编排或第二条写盘路径（唯一写盘出口 `outputBridge().saveFile()`）。
- 不要改 `extension/src/**` 的行为；插件 ZIP 由 prebuild 产出，不手工造进 git。
- 路径校验 `~` 只在路径段**开头**算家目录简写；服务端守卫与 preload 契约两套独立防御都不能删。
- 任何 `await bridge.*` 都要 `.catch()`（preload 抛异常，不是 resolve `{ok:false}`）。
- e2e 写设置用「取真实响应后只改写再 fulfill」；A 的 e2e 不读不写真下载目录。
- 跑 Playwright 前清代理（unset HTTP_PROXY 等 + NO_PROXY=127.0.0.1,localhost）；firefox 视口
  底部窄带（y≈672）丢点击用 `click({ position })` 偏上，不改产品代码。
- 六条未裁决 flake（见 Environment Notes）不要顺手修；判回归用干净 worktree，不许谎报全绿。
- 二十五/二十一/二十二轮已落地项不要重复（`.hero` 双页标题面、全选只勾未处理、白名单打包收窄）。
- 两份 UI 评审别混淆：09-20 旧评审勿重提；09-30 走查 11 条已销项、P2-3…P2-6 推迟。
- 点客户端状态控件前先等 hydration（`e2e/entry.ts` 的 `gotoHydrated`）；比较布局矩形用
  `e2e/geometry.ts` 的 `rectsInOneFrame`。

【收尾，别漏】
- 若改了任何代码/文档：`NODE_OPTIONS= ./init.sh` 全绿 + `npm run test:e2e`（flake 口径见上）；
  同步对应阶段文档的 `## Result` / `## Handoff`、feature_list.json、PROGRESS.md、session-handoff.md、
  docs/QUALITY-AUDIT.md 的 `## Archived Round Log`（每条 ≤10 行）、CHANGELOG.md / CHANGELOG.zh.md。
- 做完停下来汇报：结论、改了哪些文件、门禁结果。**commit 等另行指示**。
```

## Latest Change

**本轮（2026-10-01 第三十轮：feat-043 提交 + `0.3.10` 发布）**：TDD bump 版本面 0.3.9 → 0.3.10（release-guards 期望先行 RED → GREEN 30 passed）⇒ 提交 `77703c3`（32 files / +1660 / −247）⇒ push + tag `v0.3.10` ⇒ `desktop:release` 门禁**一次通过**（3m38s，lint/typecheck/coverage 全绿、e2e 348/6/0、live 2/2、产物校验过、历史守卫退役通知符合预期）⇒ GitHub Release `v0.3.10` 已发布（236,226,685 bytes / SHA-256 `f25e0ae9…`，服务端 digest 一致、`releases/latest` 已指向）。**大资产上传坑**：`gh release create` 带 236MB 资产一把梭会 `unexpected EOF`（gh 自动回滚无残留），拆两步（先建骨架再 `gh release upload`）53 秒传完。

**上一轮（2026-10-01 第二十九轮：feat-043「UI 走查整改」实施）**：S1 顶栏三列网格 `1fr auto 1fr`（删 `.backSlot`/`.headerLeft`/`.backLink`、品牌居中轴）+ 3 token + 14 处宽度换 `var(--col)` + 控件 36/13.5/10 + 禁用态换色 + `backLabel(from)`；S2 no-output 四件套（警示行上移 + 「去设置」+ `aria-describedby`）/ CLI 检测状态（coerce + 8px 状态点 + `.pathMissing`）/ placeholder `#6b7484` / 删输出卡重复句（按钮条件挂 title）；S3 `.hintRow` 同轴 + `.entryCard` min-height 220px。全程 TDD 断言先行（断言先行四条 4/4 落位），三阶段独立 QA 验收均 PASS，终验 11/11 销项 + Tab 扫描 0 缺环 + 对比度 5.78/6.26/4.71 对上（init.sh 95/1274/0，e2e 348/6/0 三引擎）。**真机确认追补**：用户裁定特点行「无需登录/图片内嵌/随用随走」不再独占一行，改为与翻译勾选框同行、右对齐（RED→GREEN 3/3，取代 P1-6 左缘同轴口径，init 95/1274/0 + e2e 348/6/0）。

**更早（第二十八轮及以前）**：见 `docs/QUALITY-AUDIT.md` 的 `## Archived Round Log`；逐任务证据在 `feature_list.json` 各条 `verification`。

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

- 当前 `activeFeature` = **无（`feat-024` – `feat-043` 均 done）**。版本面 `0.3.9`（**已发布**，tag `9f3642e`）。
- 下一轮入口：**等用户指令**（审阅 + commit feat-043 改动，或授权发布 `0.3.10` / 其它候选）。候选（均需单独授权）：发布 `0.3.10`（先 TDD bump）、`extension/` 写方 percent-encode、云端 Provider 实文实测、Terminal 规范打包冒烟。别再为已关闭的验收写自动化替代品。
- 每轮开头固定读：`PROGRESS.md` → `session-handoff.md` → `feature_list.json` → 相关 `docs/`（涉及翻译行为时先读 `docs/PRD-translation.md`），然后跑 `./init.sh` 建立基线。
- 全部阶段文档（已完成入口）：`docs/features/translation/S1-settings-infra.md` 至 `S6-release-and-docs.md`；各文档的 Handoff 已写入下一阶段所需的真实接口与边界。

## Environment Notes

- 网络：`github.com` / `api.github.com` 可用，但 GitHub releases 上 0.1.x 的历史 ZIP 取不回来。若 `node_modules/electron/dist` 缺失，用 `ELECTRON_MIRROR=https://registry.npmmirror.com/-/binary/electron/ npx install-electron`。
- **`.desktop/server` 陈旧时的修复 recipe（2026-09-30 第二十八轮实测）**：`./init.sh` 红在 `desktop-server-scope`「keeps …」＝`.desktop/server` 比仓库旧（它是 `desktop:prepare` 的产物，裸 `./init.sh` 不重建）。正规修法 `npm run build && npm run desktop:prepare && ./init.sh`；坑：`install-electron` 在 dist 已存在时 exit 0 不下载，而 prepare 还要 `~/Library/Caches/electron` 的 zip（缺失即 `ENOENT scandir`）⇒ 把既有 `.desktop/electron/*.zip` 拷进 `.desktop/electron-cache/` 再 `ELECTRON_CACHE=$PWD/.desktop/electron-cache npm run desktop:prepare`（**不要往 `~/Library` 造目录**）；沙箱内 `PATH=/usr/local/bin`（Node 24）+ `NODE_OPTIONS=`。
- 代理（2026-09-20 / 09-22 实测，Clash `127.0.0.1:7897`）：`ALL_PROXY` / `HTTPS_PROXY` 转发已坏——`gh` / `curl` 报 `EOF` / `SSL_ERROR_SYSCALL`、`git fetch|push` 同样失败，**直连正常**（`git -c http.proxy= -c https.proxy= …`）。跑 Playwright 前同样要先 `unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy` + `NO_PROXY=127.0.0.1,localhost`（否则 `connectOverCDP` 报 `Unexpected status 502`；Firefox 还会跟随系统代理，Chromium 不跟随）。**但 Release 资产下载恰好相反（2026-09-30 实测）：显式 `--proxy 127.0.0.1:7897` 达 3.48 MB/s，`gh release download` 直连仅 ~80 KB/s、裸 `curl` 直连 0 字节——大资产一律显式走代理。**
- **`gh release create` 带 236MB 资产一把梭会 `unexpected EOF`（2026-10-01 实测）**：一次 POST 建 release + 传大资产的组合会在中途断连（gh 会自动回滚，无草稿残留，可安全重试）。**拆两步**：先 `gh release create <tag> --latest --title … --notes-file …`（秒回），再 `gh release upload <tag> <zip>`（53 秒传完）。上传后按惯例校验：非草稿非预发布、asset `state: uploaded`、服务端 `digest` 与本地 `shasum -a 256` 一致、`releases/latest` 指向新 tag。另：`gh release view --json` 不认 `isLatest` 字段，查 latest 用 `gh api repos/…/releases/latest`。
- `MD_CONVERTOR_TEST_PROVIDER=1` 是测试/e2e 专用开关（内置伪模型，不联网）；生产未设置时该分支不可达。生产路径的环境变量仍是 `MD_CONVERTOR_USER_DATA` / `MD_CONVERTOR_SECRETS` / `MD_CONVERTOR_SESSION_TOKEN` / `PATH`。
- **Firefox e2e 需要 `MOZ_DISABLE_CONTENT_SANDBOX=1`（已固化在 `playwright.config.ts` 顶部，`??=` 可关）**：macOS 禁嵌套沙箱——已在沙箱里的进程再 `sandbox_init()` 得 `Operation not permitted`，表现为每个用例 30s 超时。**只需这一个变量**（其余同名开关无效）；**不要用** `firefoxUserPrefs: { "security.sandbox.content.level": 0 }`（实测 SIGKILL / exit 137）。三引擎数字：**315 passed / 6 skipped / 0 failed（2026-09-30 实测）**。
- **firefox 在视口底部窄带会丢掉合成鼠标点击（2026-09-29 查实，不是产品缺陷也不是 flake）**：修法是点偏上位置（`click({ position: { x: 30, y: 6 } })`，仍是真实鼠标点击；`toPass` 重试包装 5/5 全红）。探针数据与机制见 `docs/TESTING.md`。
- **六条未裁决的 flake**：`home.spec.ts:305`、`paste.spec.ts:212`、`settings.spec.ts:544`（firefox 未渲染完就查 radio）、`settings.spec.ts:731` 与 `local-docs.spec.ts:404`（`gotoHydrated` 等 `/api/settings` 30s 超时）、`home.spec.ts:201`（firefox 代理，清了仍偶发）——均隔离重跑全绿；看着它红先比对干净 worktree，要碰先问用户。
- **判「某条 e2e 失败是不是本轮造成的」用干净 worktree**（`git worktree add` + `cp -Rc node_modules`，**不要 symlink**）+ `npm run build`；recipe 见 `docs/TESTING.md`。
- **点客户端状态控件前先等 hydration、统一走 `e2e/entry.ts`（2026-09-29）**：入口画面 / 模式 / 内层 tab 都是客户端 state，SSR 页上的点击会在监听器接上之前被静默丢弃（firefox 最容易）。等一拍 `/api/settings` 的 GET（页面自己的挂载副作用）就稳；修的是**测例**，这是 SSR 固有的窗口。看到「点了没反应」先查这条。
- **名字互为子串的可访问名要 `exact: true`（2026-09-30 更新）**：入口卡片是 `role="button"`、「粘贴URL/富文本转换」，内层 tab「链接转换」不再冲突，但同屏可达的「富文本转换」仍互为子串；`<td>` 里带 checkbox 时单元格名会吸到 `aria-label="选择 …"`，也要 `exact: true`。
- **`vitest.config.ts` 的 `test.exclude` 必须保留 `.next/**` + `.desktop/**` + `out/**`**：`next build`（`output: "standalone"`）把整个仓库镜像进 `.next/standalone`（含测试文件），`.desktop/server` 与 `out/…/Resources/server` 是同一份副本；少了它们，跟在一次 build / e2e / `desktop:make` 之后的 `./init.sh` 会收进几百份重复用例并报红。**收窄（第二十二轮）没有取消这条。**
- **打包应用在本 shell 里的启动姿势（2026-09-22）**：`ELECTRON_RUN_AS_NODE=1` 会让 Electron 当纯 Node 跑（像卡死不像报错）；Chromium 自己的沙箱又被宿主 seatbelt 拒（GPU 崩）。探针用 `unset ELECTRON_RUN_AS_NODE` + `--no-sandbox --disable-gpu --remote-debugging-port=9222`（**仅探针用**，双击启动不受影响）。后台 `&` 起的进程会在该次 Bash 调用结束时被回收，启动与探针放进同一条命令；`rm -f dir/*` 无匹配会中断 `&&` 链，改用 `find dir -type f -delete`。
- **本机安装的稳妥 recipe（2026-09-22）**：安装源用**发布 ZIP 解压**（`ditto -x -k out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-<ver>.zip /tmp/<dir>`）而不是 `out/` 里的 `.app`（不碰活着的构建、可证「装上的就是发布的那一个」）；旧安装 `mv` 到 `~/Downloads/MD-Convertor-archive/installed-apps/`，不要 `rm -rf`。
- **`MD_CONVERTOR_USER_DATA` 不能隔离打包应用（2026-09-22 实测）**：`electron/env.mjs` 的 `buildServerEnv()` 无条件用主进程算出的 `userDataDir` 覆盖它，真机探针必然碰真实 `settings.json`（曾写进 iCloud）。必须五步：备份 → 跑 → 逐字段比对（页面 PUT 是整份替换）→ 还原 `defaultPath`/`useDefaultPath` → 删探针文件。
- **`ditto` 打 ZIP 必须带 `--norsrc --noextattr`（2026-09-29）**：不带会带出 4 个 `._*` AppleDouble 伴生条目（ZIP 从 5 条变 9 条）；且 ditto **不写 ZIP 的 UTF-8 标志位**——`unzip -Z1` 对 `使用说明.md` 显示乱码（`ditto -x -k` / `unzip` 解压其实是对的）。**因此测试要解压后读字节，不要对非 ASCII 条目名做字节比对**。
- **`public/md-convertor-extension.zip` 由 `prebuild` 保证（2026-09-29）**：任何 `next build` 都先跑 `build:extension` 产出它；**该脚本必须保持对并发调用安全**（暂存目录带 `process.pid`、ZIP 先写 `pack.zip` 再 `rename`）——**别把 `<pid>` 或 `rename` 改回去**，细节见 `docs/TESTING.md`。
- **发布门只建产物，不建 tag/release（2026-09-30）**：`npm run desktop:release` 校验完就结束；`git tag v<ver>` 指向「构建所用源码」那条提交，再 `gh release create v<ver> <zip> --title … --notes-file … --latest`（`--target <短 SHA>` 会被 API 拒）。发布后另起一次簿记提交（TESTING.md 产物记录 + 已发布状态 + AGENTS.md 版本句），与历史做法一致。
- **「另一台机器能不能用」的边界（2026-09-30 实测）**：除签名与 arm64 外，本机能证的全部已证（白名单收窄 + 无仓库 / 空 HOME / 无 playwright 缓存冒烟通过）；**唯一测不出的是「不同 macOS 版本 / 不同 Apple Silicon 代际」**。产物未签名 ⇒ 资源封条不完整（`codesign --verify --deep --strict` 报 `code has no resources but signature indicates they must be present`），下载后大概率被 Gatekeeper 拦，放行需 `xattr -cr /Applications/MD-Convertor.app` 或 系统设置 → 隐私与安全性 → 仍要打开；用户已明确接受（「那就无所谓」）。

## Recommended Next Action

**等用户审阅 feat-043 改动并指示 commit**（改动清单见 `PROGRESS.md` 本轮章节；门禁已全绿：`init.sh` 95 files / 1274 passed / 0 skipped，e2e **348 passed / 6 skipped / 0 failed** 三引擎，终验 11/11 销项 + Tab 焦点 0 缺环 + 对比度复核全对上）。**一处待用户确认**：D3 品牌对齐——实施按规格口径（品牌居中轴），若要左对齐只切 `.brand` 的 `justify-self` 一行。

**commit 之后的候选（均需单独授权）**：发布 `0.3.10`（发布前才 TDD bump）；`extension/` 写方 percent-encode 文件名（B1 只修了读方）；云端 Provider 端到端实测（唯一没被真人走完的主干路径）；Terminal 里跑一次规范打包冒烟（agent 沙箱内只能 `--no-sandbox --disable-gpu` 取证）。

**已裁决/已完成，不要重开**：feat-043 UI 走查整改 11 条（第二十九轮，S1–S3 全部销项）；把 `0.3.9` 装本机（第二十七轮）；提交门四条「只报未改」（第二十四轮：1 修 / 3 判不改，依据在 `docs/QUALITY-AUDIT.md`）；预发布评审存疑项与 3 处 ponytail 可删（第二十一轮落地）；V1/V2（`.next/**` 排除、`settings/page.tsx` 的 `.catch()`）；真机反馈历轮 16+5+1+6 条；首页入口画面（用户裁定为最初设计意图）；打包镜像收窄（第二十二轮）；本地文档页页级标题（第二十五轮，用户选 A）。

**约束提醒（`feat-041` 四条语义 + 守卫）**：`isAbsoluteDirPath` 不要收紧回 `value.includes("~")`（iCloud 目录会被全拒）；`await bridge.*` 不要去掉 `.catch()`（preload 拒非法参数是**抛异常**）；`OUTPUT_CODE_MESSAGES` 六个真实 fs 码不要换回笼统文案；下载分叉不要扩成「另存为」对话框。也不要放宽端点/密钥/归档守卫，不要删 `PROTECTED_HISTORICAL_ZIP_MANIFEST` 里已退役的条目，不要动 `0.1.3` – `0.3.8` 的 tag 与仍存在的受保护 ZIP，不要重做 `feat-024` – `feat-042`。

**其余固定口径**：签名/notarization 不做（QA-008 accepted）；**两份 UI 评审别混淆**——`docs/UI-REVIEW-2026-09-20.md`（旧，P0×6+P1×10，全部不改）勿重提，`docs/UI-REVIEW-2026-09-30.md` 的 11 条已随 feat-043 销项（P2-3…P2-6 用户锁死推迟，不算欠账）；主页像素级断言是刻意锁定，要改先改断言；`extension/` 的「上架商店」（PRD 非目标）与「popup/设置页」（PRD §3 不做）不要再动。

## 历史（已退役，不需要读）

- 原文见 `git show ab1d653:session-handoff.md`；结论见 QUALITY-AUDIT 的 `## Archived Round Log`；门禁计数见 `docs/TESTING.md`。