# Session Handoff

## Resume Here

- Current version: `0.3.6`（源码与门禁均为 0.3.6，**尚未发布**；`v0.3.5` 仍是最新已发布版本，tag `5f98307`）。S1 与 S2 的逐任务 RED/GREEN 证据在 `feature_list.json` 的 `feat-041.verification`
- Active feature: **`feat-041` 默认 MD 保存路径——S1、S2 已完成并提交（`867aa2a`）；用户真机两态验收已签字通过；S3 进行中，T3.0（asar 收窄）已完成，剩 T3.1–T3.7**。文档链：`docs/features/default-save-path/FSD.md` + `S1-settings-and-ipc.md`（已完成）+ `S2-download-flow.md`（已完成，含决策记录）+ `S3-release.md`（**进行中**）
- **唯一推荐下一步**：① **用户在自己的终端补跑 `npm run test:e2e` 的 firefox 引擎** —— 这是 S3 发布门禁 `npm run desktop:release` 的**唯一阻塞**（本沙箱 Playwright Firefox 起不来，见下）；② firefox 全绿后按 `docs/features/default-save-path/S3-release.md` 跑 T3.1–T3.7 收口发布
- Pending: ① **firefox e2e**（唯一阻塞项）；② `npm run desktop:release`（Node **24.14.1 / 24.15.0**，v24.16.0 静默卡死）；③ `0.3.1`–`0.3.5` 的产物与 tag 一律不动；④ 真机小点（等用户清单）；⑤ 云端 Provider 端到端实测（用户真实文章走一遍）；⑥ ~~收窄 asar~~ **已完成（T3.0）**：253 → 10 条目；⑦ UI 评审结论勿重提（全部不整改）；⑧ 签名/notarization 不做（QA-008 accepted）；⑨ stash@{0} 是 2026-09-21 拉取前的文档备份、与 feat-041 无关
- Branch: `main`；发布历史：`v0.3.5` = `5f98307`（feat-039 + 清空按钮归位）、`v0.3.4` = `e251267`（图标 v2）、`v0.3.3` = `3897cd1`（feat-034）、`v0.3.2` = `1c3ed80`（feat-033）、`v0.3.1` = `af7f6db`（feat-031/032）

## 新会话开工提示词（复制即用）

```
继续 MD-Convertor 的 feat-041「默认 MD 保存路径」S3（发布收口）。

先按 Startup Workflow 读 AGENTS.md、PROGRESS.md、feature_list.json（feat-041.verification 有
S1+S2+真机缺陷修复的全部证据）、session-handoff.md，然后读 docs/features/default-save-path/FSD.md 与
docs/features/default-save-path/S3-release.md。S1 已提交（ac8f91a），S2 已提交（f9b7534），
真机缺陷修复已单独提交，**不要回头改 S1/S2 的实现语义**。

S2 交付的真实行为（S3 只需发不重做）：
- 主页面下载按三重条件分叉：settings.output.useDefaultPath && settings.output.defaultPath &&
  outputBridge() 三者全真 → bridge.saveFile 直写；成功反馈 role=status「已保存到 <完整路径>」并 return；
  失败反馈「直接保存失败：<用户可读原因>已改为浏览器下载。」**并继续落到原有 Blob/anchor 下载**（不吞错）。
- 其余情况（含无桥接的 Web/浏览器）→ 现有浏览器下载一字未动。反馈在 runConversion() 开头清除。
- OUTPUT_CODE_MESSAGES 现已含 EACCES / EPERM / ENOENT / ENOTDIR / ENOSPC / EROFS 六个真实 fs 码。
- 页面用 settingsState 留住整份 Settings；按钮是 onClick={() => void downloadMarkdown()}。

**真机缺陷（已修复、已重新打包、已真机复验通过）+ 反馈缺失（已修复、已打包；只剩用户自己签字）**：用户在真机上撞到
「配好 iCloud 目录 + 开关打开 → 点下载毫无反应」，两个叠加原因都已修：① `isAbsoluteDirPath` 把路径里任何 `~` 都当家目录简写拒掉，
而 iCloud 云盘落在 `com~apple~CloudDocs` 下（现在 `~` 只在路径段开头才算简写）；② preload 的校验是**抛异常**
而非 resolve `{ ok: false }`，`page.tsx` 里裸 `await bridge.saveFile(...)` 没有 `.catch()`，异常被
`onClick={() => void downloadMarkdown()}` 吞掉（现在拒绝并入既有失败分支，仍降级浏览器下载）。
修完用户复测：「能下载」了，但**没有任何可感知的确认**，会误以为没下载成功 —— 同样已修：
「下载」按钮直写成功后变**「已保存」**1800ms，结果区给出**带 ✓ 的成功卡片**（失败改用警告色，与成功明确区分）。
**`out/MD-Convertor-darwin-arm64/MD-Convertor.app` 已是 21:12 构建**（`867aa2a` 之后的重新打包，指纹 chunk
`/_next/static/chunks/2-_s5mj5mt1x0.js` 含 `data-tone` 与 `已保存`），并且已用 CDP 驱动真实渲染层
复验过 20:37 那一版：开关能持久化（`useDefaultPath` 真的翻成 `true`）；开关开 + 目录为真实的 iCloud `…/未归档` 时，
点下载 → 反馈「已保存到 …」、零 download 事件、文件真的落盘（134 B）。
**注意：重新打包只换磁盘文件，不换已运行的进程。** 沙箱内关不掉旧实例（`osascript quit` → `-10004` 权限违例），
所以「重启应用」这一步必须由用户 Cmd+Q。安全列实例：`lsof -nP -iTCP -sTCP:LISTEN | awk '$1 ~ /^MD-Conv/'`。

S3 开工前必须由用户做掉的两件事：
- 亲手过一遍真机两态：**重启应用后**，开开关 → 下载不弹框、文件落进 iCloud 目标目录，且「下载」按钮变「已保存」+
  结果区出现带 ✓ 的确认卡片；关开关 → 弹保存框。
  （开关当前是关的，`defaultPath` 已指向 iCloud 的 `Note/未归档`，开开关即可测。）
- firefox 引擎 e2e 从未跑过：Playwright Firefox 在本 agent 环境**完全无法启动**
  （`Sandbox error: sandbox_init() failed with error "Operation not permitted"`，每个用例 30s 超时）。
  必须由用户在普通终端跑 `npm run test:e2e` 补齐。

另外两件 S3 的活：
- 收窄 `forge.config.cjs` 的 asar ignore：当前会把 `.workbuddy/`、`PROGRESS.md`、`session-handoff.md`、
  `feature_list.json`、`docs/` 一并打进应用包，而应用运行时只读 `Resources/server/`。
- 真机探针注意：**`MD_CONVERTOR_USER_DATA` 无法隔离打包应用**（`buildServerEnv()` 无条件覆盖它），
  探针必然读写用户真实 `settings.json` 并把文件写进开关指向的真实目录。必须走
  「备份 → 跑 → 逐字段比对 → 还原 → 删产物」，recipe 见 `docs/features/default-save-path/S2-download-flow.md`。

S3 要求：
1. 用户终端 `npm run test:e2e` 三引擎全绿后，再跑 `npm run desktop:release`
   （Node 只能用 24.14.1 或 24.15.0；v24.16.0 解压 electron zip 静默卡死）。
2. `0.3.1`–`0.3.5` 的产物与 tag 一律不动；历史 ZIP 缺失项按退役处理。
3. 签名/notarization 不做，产物只能标注为个人测试用。
4. 收尾按 State File Discipline 更新 PROGRESS.md / session-handoff.md / CHANGELOG(+zh)，S3 单独提交。

环境注意（省得重新踩）：
- 打包应用在本 shell 里启动必须 `unset ELECTRON_RUN_AS_NODE`（它被注入为 1，会让 Electron 当纯 Node 跑，
  报 `bad option: --remote-debugging-port=9222`）并加 `--no-sandbox`（Chromium 自己的沙箱被宿主
  seatbelt 拒：`Failed to initialize sandbox ... Operation not permitted`）。
- Playwright 会继承 `HTTP_PROXY`，跑任何 Playwright/Bash 网络命令前建议
  `unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy` + `NO_PROXY=127.0.0.1,localhost`。
- zsh 下 `rm -f dir/*` 在无匹配时会报错并中断整条 `&&` 链，用 `find dir -type f -delete`。
- 本沙箱**关不掉已运行的应用**：`osascript -e 'quit app "MD-Convertor"'` 报
  `execution error: … 发生权限违例。 (-10004)`；`open <路径>` 对已运行实例只做激活，不会换成新构建；
  `open -n` 会让两个实例共用同一 userData 目录。所以「重新打包 → 重启复测」必须由用户 Cmd+Q。
  列实例的安全写法：`lsof -nP -iTCP -sTCP:LISTEN | awk '$1 ~ /^MD-Conv/'`（只读，永远安全）；
  **绝不要** `lsof | grep … | awk '{print $2}' | xargs kill` —— 会命中宿主 WorkBuddy 进程并把自己杀掉。
- `rm -rf out/MD-Convertor-darwin-arm64` 会让整条链式命令直接中止（后续步骤看不到任何输出）；
  Forge 自己会替换该目录，打包前**不需要**先删。
```

## Latest Change

**本轮（feat-041 S3 T3.0：asar 收窄，2026-09-22）**：把打包产物从「整个仓库根」收窄到「运行时真正会读的东西」。**最硬的理由是安全而非体积**：收窄前 `app.asar` 有 **253 个条目**，里面装着 `.workbuddy/memory/*.md`（跨会话工作日志）、`session-handoff.md`、`PROGRESS.md`、`docs/`、`src/`、`e2e/`、`tests/`、`scripts/` 与全部明文配置 —— 而本版本的交付形态正是 GitHub Release 的 ZIP，**等于把这些私有工作文档一起发布出去**。附带两条：残留的 6 处 `value.includes("~")` 全来自这些文档文本（让「这包带没带修复」的判定含混）；仓库根的 `public/` 是 `prepare-desktop.mjs` 已复制进 `.desktop/server/public` 的死副本。**读代码确认真实依赖**（不猜）：`process.resourcesPath/server`（`extraResource`，不在 asar 内）+ `path.join(import.meta.dirname, "preload.cjs")` 及 `main.mjs` 同级导入的 8 个模块。**实现**：11 条黑名单换成**两条保留清单正则**（一条反向正则保留 `package.json` 与 `electron/`，一条排除 Electron 侧测试文件）—— 刻意用反向形式，因为**列「要丢什么」的规则必须在仓库每次长大时同步扩写、新文件默认进包；列「要留什么」的规则不会悄悄退化**。**两个来自 `@electron/packager` 18.4.4 `dist/copy-filter.js` 的事实决定了写法**（官方文档没说准）：① 规则匹配 `"/" + 相对打包目录的路径`，不是绝对路径；② `DEFAULT_IGNORES`（`.git`、锁文件、`*.o`、`node_modules/.bin`）**只在 `ignore` 是数组时**追加 —— 换成文档推荐的 `IgnoreFunction` 会静默丢掉这些。**TDD**：RED 26 failed / 18 passed → GREEN 44 passed；守卫 `tests/forge-package-scope.test.ts` **调用真实 Packager 过滤器**（经共享 helper `tests/packaged-app-scope.ts`，不是复刻语义），且必需清单**从 `main.mjs` 自己的 import 反推**。**修好一条被带红的既有回归**：`tests/app-icon.test.ts` 原本 grep `forge.config.cjs` 的源文本找 `/^\/assets($|\/)/` —— 测的是措辞不是契约，已改成行为断言 `isPackaged("assets/icon.icns") === false`。**结果与验证**：asar **253 → 10 条目**、**2670300 → 35261 字节**，剩下正好 `/package.json`、`/electron` 与 8 个运行时模块；`./init.sh` exit 0 → **68 files / 999 tests**、statements 95.28%；双引擎 e2e exit 0 → **160 passed / 2 skipped**（与 S2 基线一致，且是在新守卫落地**之后**复现的）；`desktop:package` exit 0；**打包冒烟 exit 0 且两个断言都真跑了**；用户 `settings.json` / `secrets.json` 跑前备份、跑后 md5 逐字节一致；重启后 `/` 与指纹 chunk 均 200（反馈修复仍在包里）。**途中两个操作陷阱**：三引擎首跑 7m23s 未结束、停掉后遗留 e2e 服务占着 3000 端口，重试 4 秒即报 `health is already used`（先 `lsof -p <pid> -a -d txt,cwd` 核实 cwd 是 `.next/standalone` 再 kill，不按模式盲杀）；`scripts/run-e2e.mjs` 会透传 argv 给 Playwright，故用 `--project=...` 选引擎时 build 与 tracked-file 守卫仍在。

**（接上一轮）用户真机两态验收已签字**（2026-09-22 22:17，原话「两态都过了」）：开关开 → 不弹框、文件落进 iCloud 目录、且看到「下载」变**「已保存」**+ 带 ✓ 的卡片；开关关 → 弹保存框。跑的是 21:12 构建，交付前用 chunk 指纹反证过（`2-_s5mj5mt1x0.js` 在该实例返回 200，修复前实例是 404）。

**本轮（feat-041 S2 反馈缺失修复：成功提示不可辨识，2026-09-22）**：用户真机复测后报障 —— 直写已经能下载了（iCloud 缺陷确认修复），但**没有任何可感知的确认**，会误以为没下载成功。**先查事实再动手**：提示并非没渲染（e2e 的 `已保存到` 断言一直绿，且直写分支是唯一会写文件的路径，`setSaveNotice` 在用户那次必然执行），是**呈现缺陷**，三个成因：① 成功提示是裸说明文字（`var(--muted)`、14px、无背景无边框无标记），与正文说明同貌；② **成功与失败共用同一套样式**，连警告都像成功；③ 注意力所在的「下载」按钮毫无反馈 —— 旁边「复制」会变「已复制」，而默认目录这套功能**故意不弹保存框**，等于同时关掉两条反馈渠道。RED：`e2e/home.spec.ts` 加「直写成功时给出醒目确认」+ 既有失败用例加 tone 断言 ⇒ chromium 2 failed / 4 passed（失败输出打印出当时的裸 `<p role="status" class="…saveNotice">`，无 tone，也没有「已保存」按钮）。GREEN：`saveNotice` 改为 `{ tone, text }` 并以 `data-tone` + `aria-live="polite"` 渲染；「下载」成功后就地显示「已保存」1800ms（照搬「已复制」做法，ref 持有计时器保证新闪烁胜过旧，`runConversion()` 同时清两者）；`.saveNotice` 从说明文字改为填充卡片（成功 `accent-soft` + ✓；失败 `warning-soft`），只复用本页既有语汇与已白名单字面量。验证：chromium 21 passed；`NODE_OPTIONS= ./init.sh` exit 0 → 67 files / 955 tests、95.28%；双引擎 e2e exit 0 → **160 passed / 2 skipped**（+2 = 新用例 × 2 引擎）；`git status` 无额外 tracked-file 漂移。

**本轮收尾（提交 + 重新打包 + 指纹校验，2026-09-22）**：修复提交 `867aa2a`（8 个文件：`page.tsx`、`page.module.css`、`e2e/home.spec.ts`、`CHANGELOG.md`、`CHANGELOG.zh.md`、`PROGRESS.md`、`session-handoff.md`、`feature_list.json`），提交后工作区干净。`NODE_OPTIONS= npm run desktop:package`（Node 24.14.1）**exit 0**（日志 `/tmp/s2-t29-package.log`）→ 新包 `out/MD-Convertor-darwin-arm64/MD-Convertor.app` **21:12 构建**、`CFBundleShortVersionString` 0.3.6、`Mach-O 64-bit executable arm64`、566 MB。指纹逐项校验通过：客户端 chunk `2-_s5mj5mt1x0.js` 同时含 `data-tone` 与 `已保存`；`24e5_kwf_p1ai.css` 含 `✓`；`.next/static/**` 里 `includes("~")` 已消失；`asar extract-file app.asar electron/preload.cjs` 仍能 grep 到 `segment.startsWith("~")`（说明 T2.7 的路径修复也还在）。**唯一卡点是重启**：旧实例（pid 38187，T2.8 构建，仍在 51812 监听）在沙箱内关不掉 —— `osascript quit` 报 `权限违例 (-10004)`，`open` 只激活不换构建，所以必须由用户 Cmd+Q。附带记了一条踩坑：`rm -rf out/MD-Convertor-darwin-arm64` 会让整条链式命令中止且不产出任何日志，而 Forge 自己会替换目录，本来就不必删。

**（接上一轮）**：用户真机实测报障——设置页「输出」卡片的勾选能力正常，但**配好 iCloud 目录 + 打开开关后点「下载」完全没有反应**（不直写、不浏览器下载、不报错）。定位到**两个叠加缺陷**，全程 TDD 修复。① **根因 1**：`isAbsoluteDirPath`（`electron/preload-contract.cjs` 及其在 `electron/preload.cjs` 的等价副本）原实现 `value.includes("~") → false`，即路径里出现任何 `~` 都判非法；而用户选的目录是 `/Users/huanghaohai/Library/Mobile Documents/com~apple~CloudDocs/Note/未归档` —— 于是**所有 iCloud 云盘目录都不可用**。这是 S1 T1.2 的设计被字面执行的结果：`~` 只在**路径段开头**才是家目录简写。改为 `!value.split("/").some((s) => s === ".." || s.startsWith("~"))`，并把 iCloud 场景写进注释防止被收紧回去。② **根因 2**：preload 的 `assert*` 是**抛 `TypeError`** 而不是 resolve `{ ok: false }`，`page.tsx` 里是裸 `await bridge.saveFile(...)`，异常冒泡后被 `onClick={() => void downloadMarkdown()}` 吞掉 → 无声；浏览器 e2e 抓不到，因为桩永远 resolve。修法是把拒绝并入既有失败分支（`.catch(() => null)` + `result?.ok` + 三元取原因），失败仍降级浏览器下载。③ **RED→GREEN**：`preload-contract.test.cjs` +2 accept（真实 iCloud 路径、`/Users/someone/My~Backup`）/+1 reject（`/Users/someone/~/notes`），`preload.test.cjs` 同步 dirCases，`output.test.mjs` 加同名拒绝用例 + 一条真的写进 `com~apple~CloudDocs/Note` 的测试，`e2e/home.spec.ts` 加「桥接层拒绝时给出反馈并降级为浏览器下载」（桩改为可抛异常）。RED 模块 4 failed / 86 passed、e2e chromium 3 failed / 16 passed ⇒ GREEN 模块 89 passed（1 条为既有环境噪声 `CODEBUDDY_BROKER_DENY`，干净版代码同样复现）、e2e chromium+webkit **158 passed / 2 skipped** 且 tracked-file 守卫干净、`tsc --noEmit` + `eslint .` 全绿。④ **文档与状态**：`CHANGELOG.md`(+zh) `[Unreleased]` 增 `Fixed`；`feature_list.json` 增 T2.7 证据与一条 open observation；PROGRESS.md 新增本轮小节并补三条硬约束（`~` 语义 / preload 抛异常必须 `.catch()` / 探针必须包含真实用户路径形态）。⑤ **仍未签字**：真机两态验收，且 `out/` 里的包是修复前构建的，**必须先重新打包**。

**一个未诊断的观察（不是结论）**：用户实测后留下的 `settings.json` 里 `output.defaultPath` 已是 iCloud 目录（说明「选择目录」持久化正常），但 `output.useDefaultPath: false` —— 盘上是关的，而用户说开关打开了。`toggleUseDefaultPath` 是乐观更新（先改 state、PUT 失败再回滚），PUT 失败会显示「设置保存失败」并把开关拨回去；而**开关若是关的，页面根本不会进入桥接分支**，这本身也足以解释「点了没反应」。**T2.8 复验后判定为「非可复现缺陷」**：在打包应用里点开关，真实 `PUT /api/settings` 把 `useDefaultPath` 从 `false` 翻成了 `true`，机制本身是好的；用户那次为什么留下 `false` 仍未查明。

**T2.8 重新打包 + 真机复验（本轮后半，两项全过）**：`npm run desktop:package` exit 0（Node 24.14.1）→ 新包 20:37:51 构建，并逐项确认**真的带上了修复**：`Contents/Resources/server/.next/**` 里有 `默认保存设置不可用`、没有 `value.includes("~")`；`Contents/Resources/app.asar` 里 `segment.startsWith("~")` 出现 2 次（preload-contract + preload），而残留的 6 处 `value.includes("~")` 全部来自被打进包的文档（`PROGRESS.md` / `session-handoff.md` / `S2-download-flow.md` / `.workbuddy/memory/*.md`），不是代码。随后 CDP 驱动打包应用的真实渲染层复验两件事：① **开关持久化正常**（见上段）；② **直写落到带 `~` 的真实目录**——开关开 + 目录 `…/com~apple~CloudDocs/Note/未归档` → 转换 → 点「下载」→ 反馈条 `已保存到 /Users/…/未归档/# 真机探针.md`、`download` 事件 0、`createObjectURL` 0、文件真的落盘（134 B）。这正是修复前必然失败的路径。**同时踩到一个硬约束**：`MD_CONVERTOR_USER_DATA` **无法隔离打包应用**（`electron/env.mjs` 的 `buildServerEnv()` 无条件用它算出的 `userDataDir` 覆盖），所以探针实际读写的是用户真实的 `settings.json`、文件也落进了用户真实的 iCloud 云盘。已按「备份 → 跑 → 逐字段比对（`output` 之外完全一致）→ 还原 `useDefaultPath` → 删掉探针文件」收尾，用户设置与目录回到探针前状态；探针脚本留在 `/tmp/s2t27-probe.cjs`，用户的 app 实例（pid 18465）全程未被触碰。

## Archived Change Log

**上一轮（feat-041 S2 完成：主页面下载分叉 + 真机两态探针，2026-09-22，S2 单独提交）**：按 `docs/features/default-save-path/S2-download-flow.md` 执行 T2.1–T2.6，全程 TDD。① **T2.1 三态 e2e**：`e2e/home.spec.ts` 新增 describe「下载分叉（默认保存目录）」三例——桥接 + 开关 + 目录 → `saveFile` 直写、`role=status` 反馈「已保存到 …」、**零** download 事件 + **零** `createObjectURL`；`saveFile` 失败（EACCES）→ 反馈含「没有写入权限」并降级浏览器下载（`createObjectURL` 计到 1）；无桥接 → 忽略设置走旧路径。RED 2 failed / 16 passed ⇒ GREEN 18 passed。**e2e 定式**（踩出来的）：桥接用 `addInitScript` 且必须在 `goto` 之前；设置用 `route.fetch()` 拿真实响应后只改写 `output` 再 `fulfill`（**不要 PUT**，e2e 设置是全 project 共享的）；负向断言用 `page.on("download")` 计数器 + 包裹 `URL.createObjectURL` 计数，**不要** `waitForEvent` 超时；断言前先等一次 `/api/settings` 响应避免与首屏 fetch 竞态。② **决策：S2 §4 与实现冲突，取方案 (a)**——文档原称 `EACCES → 没有写入权限`、`ENOENT → 目录不存在`，但 S1 只交付了业务码而 `electron/output.mjs` 原样回传 fs 的 `error.code`，§4 当时不成立。选择补映射并另补 `EPERM`/`ENOTDIR`/`ENOSPC`/`EROFS`（否决「改文档用笼统文案」：直写失败时页面已降级，反馈条里「为什么没直写」是唯一信息量；归一化放主进程会把展示口径下沉进 IPC 契约）。连接词由括号改冒号，因为映射表每条都是带句号的完整句（设置页整句展示），`（没有写入权限。）` 会嵌套标点。③ **T2.2 实现**：`page.tsx` 用 `settingsState` 留住整份 `Settings`（`translateEnabled`/`targetLanguage` 行为不变、同一响应、不额外发请求）；`downloadMarkdown()` 改 `async`，按**三重条件**分叉，成功直接 `return`，失败设反馈后**继续落到原有 Blob/anchor 逻辑**；按钮改 `onClick={() => void downloadMarkdown()}`；`.saveNotice` 落在 stats 之前。新增 `src/app/settings/client.test.ts`（RED 4 failed / 2 passed ⇒ GREEN 6 passed）。④ **T2.3 生命周期**：新用例先跑出**真实 RED**（`Expected: 0, Received: 1`，陈旧提示残留——T2.2 的编辑当时确实没写下清除语句），再补 `runConversion()` 开头的 `setSaveNotice(null)` ⇒ 19 passed。⑤ **T2.4**：`./init.sh` exit 0 —— 67 files / **950 tests**（基线 66 / 944）；双引擎 e2e **156 passed / 2 skipped** 且 tracked-file 守卫干净。⑥ **T2.5 真机两态探针通过**：`npm run desktop:package` exit 0（Node 24.14.1）→ 打包应用 + CDP 驱动真实渲染层。**开开关**：桥接存在、反馈 `已保存到 /tmp/s2-probe-out/# 真机探针.md`、`download events: 0`、文件真实落盘（128 B）；**关开关**：无反馈、`download events: 1`、目标目录保持空。探针脚本已删，用户真实 `settings.json` 已从备份逐字节还原（该文件正好是无 `output` 的旧版本，顺带覆盖了宽容读入的真实场景）。⑦ 文档与状态：`S2-download-flow.md` 标完成并加「决策记录」与 e2e 定式；`FSD.md` 状态更新；`CHANGELOG.md`(+zh) 新增 `[Unreleased]`（覆盖 S1 的输出卡片与 S2 的下载分叉）；`feature_list.json` 写入 9 条 S2 证据。
**两个未完成项（S3 开工前必须由用户处理）**：① **firefox 引擎 e2e 从未跑过且本环境跑不了**——Playwright Firefox 启动时要再套一层 macOS seatbelt，报 `Sandbox error: sandbox_init() failed with error "Operation not permitted"` 后退出，表现为每个用例 30s 超时；同用例 chromium 与 webkit 均绿，属环境限制而非代码缺陷（另：首轮全量还撞上继承的 `HTTP_PROXY`，Firefox 跟随系统代理、Chromium 不跟随）。**S2 因此不宣称 firefox 覆盖**，需用户在普通终端补 `npm run test:e2e`。② acceptance 里「用户确认」的真机两态签字未完成——探针是我方机器证据，不是用户确认。
**一个偶发（未修，已记录）**：既有用例 `supports keyboard submission and download` 在 webkit 上偶发 `getByText('转换完成')` 5s 内未出现（疑似 `press("Enter")` 撞上 React 水合未完成），单跑 3/3 绿、随后全量立即复绿；该断言与下载无关，S2 未触碰转换路径，故按 out-of-scope 记录而不修改。

## Archived Change Log

**本轮（feat-041 S1 完成：契约 + IPC + 输出卡片，2026-09-21，S1 单独提交）**：按 `docs/features/default-save-path/S1-settings-and-ipc.md` 执行 T1.0–T1.6，全程 TDD。① **T1.0 版本 0.3.5→0.3.6**：fixture 先 RED（7 failed / 22 passed——比文档预估多 2：`verifyFreshArtifact` 两例也依赖 fixture 版本，且 fresh-artifact fixture 的 ZIP 文件名是版本派生的，改版本时必须跟着改），再改 `release-desktop.mjs` 两处 + `package.json` + `package-lock.json` 两处 + `feature_list.json` ⇒ 29 passed（坑：lock 里 `for-each`/`magicast` 恰好也是 0.3.5，不能误改）。② **T1.1 契约**：`src/types/settings.ts` 增 `OutputSettings`/`OUTPUT_KEYS`/默认值/ROOT_KEYS；`validateSettings` 的 `output` 缺失宽容分支（唯一放宽点）+ 规范化 `useDefaultPath:true && defaultPath:null` → 全默认；`SETTINGS_VERSION` 保持 1 有专项测试锁定；`/api/settings` 的 `sanitizeSettings` 同步转发 output。RED 9 failed ⇒ GREEN 55 passed，全量 vitest 876 passed。③ **T1.2 contract**：`preload-contract.cjs` 增两通道名 + `isValidOutputFilename`（无 `/`、`\`、`..`，1–255 字符）+ `isAbsoluteDirPath`（`/` 开头、拒 `~` 与 `..` 段）；新 `preload-contract.test.cjs` RED 25 failed ⇒ GREEN 26 passed。④ **T1.3 preload**：`preload.cjs` 自包含复制通道名与校验逻辑（沙箱 preload 不能 require 相对文件），暴露 `window.mdConvertor.output`；非法参数同步抛 TypeError；与 contract 一致性有属性测试。RED 20 failed / 16 passed ⇒ GREEN 62 passed（两文件合计）。⑤ **T1.4 main IPC**：新纯模块 `electron/output.mjs`（`createOutputChannels({ipcMain, dialog, warn})`，依赖注入便于测试）；select-directory 带 `openDirectory+createDirectory`、取消 → `CANCELLED`；save-file **主进程独立重新校验**（双层防御）+ `mkdir -p` + 写入；失败映射 `error.code`、warn 日志只记 code；`main.mjs` `app.whenReady()` 注册。测试 RED（模块不存在）⇒ GREEN 23 passed。⑥ **T1.5 输出卡片**：`client.ts` 增 `outputBridge()`/`OUTPUT_CODE_MESSAGES`（CANCELLED 不算错误）；`page.tsx` 在翻译卡片前插输出卡片（路径展示/未设置、选择目录按钮——无桥接禁用并提示、开关——开着无目录时警告「请先选择目录。」且不落盘）。e2e RED 5 failed / 24 passed ⇒ GREEN 29 passed。**重要发现**：settings/theme/translate 三个 spec 的共享 settings mock 必须补 `output` 字段（真实 API 经 `sanitizeSettings` 总是返回它），否则输出卡片读 `settings.output.defaultPath` 崩掉整页——21 个既有用例因此连坐失败，已修。⑦ **T1.6 收尾**：`./init.sh` exit 0——66 files / **944 tests**、statements 95.28%、lint + tsc + build 全绿；全量 chromium e2e **75 passed**（主页面行为不变，下载逻辑零改动）；三引擎 e2e 与打包门禁留给 S2/S3。⑧ 基线注意：本机默认 Node 22.22.2，`./init.sh` 要求 24.x——用 `export PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH"` 前置。

## Archived Change Log

**（feat-041 规划完成，2026-09-21，纯文档，已随 S1 提交）**：用户要求「设置里增加默认 MD 保存路径管理：可选目录 + 开关；开=不弹保存框直写，关=弹框」，并要求按 Harness 落 TDD 驱动的升级 Plan、为新会话做好 HANDOFF。① 代码侦察（全部有出处）：`src/app/page.tsx` 的 `downloadMarkdown()` 是纯浏览器下载（Blob + anchor.download，行 534–549）⇒ Electron 里的「每次都选位置」就是这个，分叉点定为「桥接直写 vs 浏览器下载」；`src/lib/settings/store.ts` 的 `readSettings()` 对校验失败整份改名备份并重置默认 ⇒ 直接加必填 `output` 会把旧 `settings.json` 判为损坏、用户丢全部 Provider/语言配置，因此 `SETTINGS_VERSION` 保持 1、`output` 缺失宽容读入（唯一放宽点）；`electron/preload.cjs` 自包含（沙箱不能 require 相对文件，`feat-018` 教训）⇒ 新桥接复制通道名常量、由 `preload.test.cjs` 断言与 contract 一致；`electron/main.mjs` 的 `registerSecretsIpc()` 是 handler 注册模板。② 产物：`docs/features/default-save-path/` 四份文档——`FSD.md`（需求拆解 2 条可验证行为、目标/非目标、架构决定 §3.1–3.4、安全边界 4 条、验证策略表、S0 并入 S1 的三阶段划分、验收 5 条、取舍 6 条）、`S1-settings-and-ipc.md`（契约+校验+规范化、IPC 双通道、preload 暴露、设置页输出卡片；T1.0–T1.6 每个任务带 RED 列）、`S2-download-flow.md`（三重分叉条件、settingsState 改造、反馈条与降级、真机两态探针；T2.1–T2.6）、`S3-release.md`（门禁 Node 版本、独立复核、安装、gh release、文档收口；T3.1–T3.7）。③ 状态文件：`feature_list.json` 登记 `feat-041`（planned、依赖 feat-039、scope/acceptance/verification 齐）并修正 `feat-039` in-progress → done（实际已随 0.3.5 发布）、`activeFeature` → feat-041；复刻 `init.sh` 的内联校验器通过（25 features、in-progress=0、依赖无悬空）。`AGENTS.md` 版本行 0.3.4 → 0.3.5、门禁目标版本行同步（发现它停在 0.3.4 是上一轮漏改）。`PROGRESS.md` 按 State File Discipline 重写为干净态。

## Archived Change Log

**（`feat-039` S2 字重收敛 + 抗锯齿完成，2026-09-21，已随 0.3.5 提交）**：按 `docs/features/ui-refresh/S2-weight.md` 只动字重与渲染平滑（配色、结构、间距、圆角、边框、阴影形状、字体族/字号、文案全部冻结；预览区按 Q6 只接受「渲染平滑」变化）。① TDD 先红：`e2e/theme.spec.ts` 从 2 用例扩到 6 用例 —— 界面字重、品牌字重回归锁（刻意先绿，防把只有 400 面的 Michroma 推向合成字重）、正文/预览级联守卫、抗锯齿（`test.skip(browserName !== "chromium")`，因为只有 Chromium 暴露 `webkitFontSmoothing`）—— 在**未改动**的构建上 `npx playwright test e2e/theme.spec.ts --project=chromium` **3 failed / 3 passed**（`.submit` 实收 `700` 期望 `400`；`.stats dt` 实收 `400` 期望 `300`；`webkitFontSmoothing` 实收 `auto` 期望 `antialiased`；日志 `/tmp/s2-t21-red.log`）。② 实现：`globals.css` 加 `--weight-body: 300` / `--weight-ui: 400` 两个 token 与 `body { font-weight: var(--weight-body) }`；`page.module.css` 16 处 + `settings/page.module.css` 3 处手调字重（400/500/560/680/700/720/730/750/760/780）一次性换成 `var(--weight-ui)`（`perl -pi` 单次替换，替换后字面量 0 处）。此时重建再跑 ⇒ **4 passed / 2 failed**，失败即 `.preview` 与 `.preview p` 实收 `300` 期望 `400`（日志 `/tmp/s2-t25-red.log`）—— 这正是守卫自己的 RED，证明不挡的话细体会真的灌进 Markdown 阅读区。③ 守卫与抗锯齿：`.preview` 规则加 `font-weight: var(--weight-ui)`（**不给 `.preview h1–h4 / strong / th` 补规则**，保留浏览器默认粗体，实测 `.preview h2` 仍 `700`）；`globals.css` 新增 `body, button, input, select, textarea { -webkit-font-smoothing: antialiased }`（Q6；全局开关，预览区渲染平滑跟着变，Q4 已在方向确认阶段显式修订为「冻结字号/字族/字重，不含渲染平滑」）。GREEN：同命令 **6 passed (1.7s)**（`/tmp/s2-t25-green.log`）。④ 回归与全量：`e2e/home.spec.ts` + `e2e/settings.spec.ts --project=chromium` **38 passed (13.9s)**（像素级对齐断言与 `rgb(138, 90, 18)` 警告色断言都没被字重变化带红，无需改断言）；`npm run test:e2e` **exit 0 ⇒ 203 passed / 4 skipped**（`/tmp/s2-e2e.log`；S1 基线 193/2，差额 +10 passed / +2 skipped = 4 用例 × 3 引擎，抗锯齿用例在 firefox/webkit 各跳 1 次）；`./init.sh` **exit 0**（`/tmp/s2-init-green.log`）—— 64 files / **866 tests**、statements 95.28%、lint/`tsc --noEmit`/生产构建全绿（与改动前 `/tmp/s2-init-baseline.log` 同为 64 / 866）。⑤ 真机目视：`npm run desktop:package` exit 0（Node.js 24.15.0，`/tmp/s2-package.log`）→ 打开 `out/MD-Convertor-darwin-arm64/MD-Convertor.app --remote-debugging-port=9222`，一次性探针（`./probe-s2.tmp.mjs`，**已删除**）经 CDP 读 computed：`body` 字重 `300` / `-webkit-font-smoothing: antialiased`、`--weight-body` `300`、`--weight-ui` `400`、「转换」按钮 `400`、统计 `dt` `300`、粘贴 `textarea` `300`、品牌 `400` + `michroma`、`.preview` 与 `.preview p` `400`、`.preview h2` `700`，截图 `/tmp/s2-weight-app.png`；包内 `server/.next/static/chunks/*.css` 含 `weight-body:300` / `weight-ui:400` / `font-smoothing:antialiased`，残留的 `font-weight:400` 只有 2 处且都是 `next/font` 生成的 Michroma `@font-face` 与 `__className`。**踩到的坑**：探针第一次先 `page.goto("about:blank")` 再把应用窗口当普通浏览器页导航，结果主窗口被留在 `about:blank`、`new URL(page.url()).origin` 得到 `null`；正确做法是重启应用、用它自己加载的 URL 作基准（或 `chromium.connectOverCDP` 接现成窗口而不是 `launch`）；另外 `e2e/theme.spec.ts` 读 `webkitFontSmoothing` 需要类型断言（`CSSStyleDeclaration` 类型里没这个属性）。⑥ 文档：`CHANGELOG.md` / `CHANGELOG.zh.md` 的 S2 内容**续写在 S1 那条 bullet 的同段末尾**（不新起条目，归档 `[0.3.5]` 留给 S3）；`S2-weight.md` 状态行改为「S2 已实施（未提交）」。⑦ **真机驱动的两次回修（2026-09-21，均在 S2 实施后、提交前）**：正文细体 `--weight-body` 300 → **400** —— 用户真机反馈「细体的识别度真的不行，回到 Regular」，TDD 先把 `e2e/theme.spec.ts` 的 `BODY_WEIGHT` 改成 `"400"` ⇒ **1 failed / 5 passed**（`.stats dt` 实收 `300` 期望 `400`，`/tmp/muted2-t-red.log`），再把 `globals.css` 的 `--weight-body` 改为 `400` ⇒ `npm run build` + chromium **6 passed (1.8s)**（`/tmp/muted2-build.log` / `/tmp/muted2-t-green.log`）；采 Option A（保留两个 token 与 `.preview` 守卫，只改一个值），因此 S2 不再改变正文字重。另一次是 S1 范围的 `--muted` 加深（见上一段）。**未做**：没升版本（仍 `0.3.4`）、没跑 `npm run desktop:release`、没提交。

**本轮（`feat-039` S1 真机目视通过，2026-09-21，S2 交给新会话）**：`npm run desktop:package` **exit 0**（Node.js 24.15.0，`/tmp/s1-package.log`）→ 打开 `out/MD-Convertor-darwin-arm64/MD-Convertor.app`，CDP 读打包应用的 computed：`html` 背景 `rgb(249, 250, 251)`、body 渐变 `radial-gradient(… rgba(42, 57, 92, 0.09) …)` + 线性起点 `#fbfbfd`、「转换」按钮底 `rgb(42, 57, 92)` / 字白、正文 `rgb(28, 34, 48)`；设置页云端卡片底 `rgb(249, 250, 251)`、徽标「未配置」底 `rgb(238, 241, 246)`；`--accent #2a395c` / `--accent-soft #eef1f6` / `--paper #f9fafb`；`--weight-body` / `--weight-ui` 读回为空 ⇒ **证明确实还没进 S2**。包内 `Contents/Resources/server/.next/static/chunks/*.css` 能搜到 `2a395c`，旧墨绿 `#176b5d` / `#0f5147` / `#dcece7` **零命中**。用户看完确认方向无误，**S2 在新会话开工**（提示词由上一会话给出）。注意：`out/` 那份是**未提交的工作区构建**，`CFBundleShortVersionString` 仍为 `0.3.4`，`/Applications` 里已发布的正式 `0.3.4` **未被覆盖**；一次性探针脚本 `s1-probe.tmp.mjs` / `s1-probe2.tmp.mjs` 用完即删。

**上一轮（`feat-039` S1 色彩系统完成，2026-09-21，未提交）**：按 `docs/features/ui-refresh/S1-color-system.md` 只换色相（间距/圆角/边框宽度/阴影形状/字体族字号字重/文案/语义色全部冻结）。TDD 先红：新建 `tests/palette.test.ts`（3 用例）在改动前 **3 failed**，逐条列出 **33 个**白名单外字面量（末条 `globals.css still contains #176b5d`，日志 `/tmp/s1-t11-red.log`）；新建 `e2e/theme.spec.ts`（2 用例）在改动前 **2 failed**（`html` 背景实收 `rgb(247, 245, 239)`、期望 `rgb(249, 250, 251)`；云端卡片徽标实收 `rgb(220, 236, 231)`、期望 `rgb(238, 241, 246)`，日志 `/tmp/s1-t12-red.log`）。再变绿：35 处字面量一次性替换（`git diff --stat` = `globals.css` 12 行 / `page.module.css` 20 行 / `settings/page.module.css` 2 行 / `icon.svg` 1 行，35 插入 35 删除，逐行对过映射表）。终值：`--paper #f9fafb`、`--surface #ffffff`、`--ink #1c2230`、`--muted #565e6b`（真机复核后从 `#6A7280` 加深一档，见下文对比度）、`--line #dbdfe7`、`--accent #2a395c`、`--accent-dark #232f4e`、`--accent-soft #eef1f6`、`--shadow 0 22px 60px rgb(30 35 50 / 10%)`、`::selection var(--accent-soft)`、`body` 径向 `rgb(42 57 92 / 9%)` + 线性起点 `#fbfbfd`；`settings/page.module.css` 里那个从未定义的 `var(--surface-muted, #fbfbfa)` 改为 `var(--paper)`（不新增变量）；深色代码块 `#202a28`/`#edf4f1` → `#1E222B`/`#EDEFF4`（Q2）；favicon `#176b5d` → `#2A395C`（Q5）；每个半透明值的 alpha 未动。语义色 `--warning*` / `--danger*` / `#dfaaa3` / `#edc8c2` / `#eed79c` / `#fbe9e7` / `#8d3b2f` 一字未动。GREEN 证据：palette 守卫 **3 passed**；**先 `npm run build`**（e2e server 吃 `.next/standalone`，不重建就量旧 CSS）再 `e2e/theme.spec.ts --project=chromium` **2 passed**；`home.spec.ts` + `settings.spec.ts` + `theme.spec.ts` chromium **40 passed (15.0s)**（像素级对齐断言与 `rgb(138, 90, 18)` 警告色断言保持绿）；`npm run test:e2e` **exit 0 → 193 passed / 2 skipped**（`/tmp/s1-e2e.log`；上轮 187/2，+6 = 2 用例 × 3 引擎，三引擎的渐变序列化差异靠 `evaluate` + 容差正则兜住）；`./init.sh` **exit 0**（`/tmp/s1-init-green.log`）—— 64 files / **866 tests**、statements 95.28%、lint/`tsc --noEmit`/生产构建全绿（改动前基线 63 files / 863 tests，`/tmp/s1-init-baseline.log`）。对比度：`design_contrast src/app` 只报 gate 40（`globals.css` 的 `::selection` 声明了 `color` 却无可配对 `background`，机器无法验证）；手算 WCAG 配对 正文/页面 **15.21:1**、次要灰/页面 **6.26:1**（卡片 6.54:1；真机复核后从 `#6A7280` 的 4.64:1 加深一档到 `#565E6B`）、白字/主色 **11.42:1**、代码文字/深底 **13.84:1**、占位符/白底 **2.80:1**（旧 2.83:1，已知豁免）。文档：`CHANGELOG.md` / `CHANGELOG.zh.md` 新增 `[Unreleased] → 变更` 一条（S2 往同一段续写，归档留给 S3）。**未做**：没升版本（`currentVersion` 仍 `0.3.4`，升 `0.3.5` 是 S3 的事）、没跑 `npm run desktop:release`、没提交。

**上一轮（视觉刷新方向锁定，2026-09-21，纯文档，未提交）**：用户定调「所有功能结构不变，间距圆角等都不调，只调色调、字重」，并要求「做成 HTML 形式的对比」先看效果、**结论落文档后才开工**。① 对比不是设计稿而是**真实构建的像素对照**：跑 `0.3.4` 的 production standalone（`node scripts/start-e2e-server.mjs`，端口 3000 / token `md-convertor-e2e-token`），在同一页 `addStyleTag` 注入 5 态（① 现状 ② 只换色调 ③ 只换字重 ④ 色调+字重 ⑤ ④+抗锯齿），1180×1000 视口 1× 截 2 页 × 5 态 + hero 局部放大三连；产物 `/tmp/ui-refresh-compare.html`（已 `open`）、`/tmp/ui-refresh-compare.png`（1.55 MB）、`/tmp/ui-refresh-home-*.png`、`/tmp/ui-refresh-settings-*.png`、`/tmp/hero-3up.png`，驱动脚本是一次性的 `./shot-compare.tmp.mjs`（**尚未删除**）。探针实测 computed：① title `780` / body `400` / button `700` → ④⑤ title `400` / body `300` / button `400`。② **新发现（本轮最有价值的一条）**：应用**没设** `-webkit-font-smoothing`（`globals.css` 只有 `text-rendering: optimizeLegibility`）⇒ macOS 上 Chromium 走次像素抗锯齿，笔画被加粗一档，**780→400 的观感差异比预期小得多**；补 `body, button, input, textarea, select { -webkit-font-smoothing: antialiased }` 后细体才读得出来（hero 三连第 2 行 vs 第 3 行可辨）。代价：**全局开关，Markdown 预览区的渲染也会变**，与 Q4 直接冲突。③ 用户决定：**按「色调 + 字重 + 抗锯齿」执行（新增 Q6 = 是）**并接受代价，hero 标题取 **400**；**Q4 据此显式修订为「冻结预览区的字号 / 字族 / 字重，不含渲染平滑」**。④ 文档已同步：`docs/PLAN-next-phase.md`（§2 新增 Q6 行 + Q4 修订口径 + §3 做/不做 + §7 取舍）；`docs/features/ui-refresh/FSD.md`（§1 目标与非目标、**新增 §2.4 抗锯齿开关（Q6）**、原 §2.4 验证策略顺延为 §2.5、§3 阶段表 S2 行、§5 新增两条取舍）；`S2-weight.md`（Spec 第 7 条、**新增 §6 抗锯齿段**、非目标措辞、Tasks 新增 **T2.6** 并把原 T2.6/T2.7 顺延为 T2.7/T2.8、Handoff 回退顺序改为「先拿掉抗锯齿」）；四份 ui-refresh 文档状态行统一改为 **方向已确认（2026-09-21），待实施**；`feature_list.json` 的 `feat-039`（scope + acceptance 第 5 条 + verification 第 2 条 = 方向确认证据）。⑤ 机器门：复刻 `init.sh` 的 `feature_list.json` 内联校验器 —— 24 条 feature、依赖无悬空、`in-progress` 为 0、`currentVersion` 仍 `0.3.4`；`git diff --stat feature_list.json` 只有 `feat-039` 新增块（38 行插入），格式未被 `json.dump` 改动。**未做**：没改任何 CSS / SVG / TSX、没写 `tests/palette.test.ts` 与 `e2e/theme.spec.ts`、没跑 `./init.sh`、没升版本、没提交。

**上一轮（下一阶段规划：把两份作废文档换成路线图 + 独立 feature 文档，2026-09-21，纯文档，未提交）**：用户定下主色与背景遵循 UI 文档（`#2A395C` / `#f9fafb`）、字体细体但**不含 Michroma**，并明确 `docs/PRD-upgrade-v2.md` 与 `docs/UI-DESIGN-SPEC.md` 作废（**两份已于本轮按用户确认删除**）；同时要求「整体升级方案只描述规划方向」「插件必须单独规划」「每个方向各自按 Harness 管理文档」。产物：`docs/PLAN-next-phase.md`（路线图 9 章，含 Q1–Q5 已定决策表）、`docs/features/ui-refresh/`（`FSD.md` + `S1-color-system.md` + `S2-weight.md` + `S3-release.md` + `design/ui-refresh.html`）、`docs/features/browser-extension/FSD.md`（三问未决，刻意不写阶段文档）；`AGENTS.md` 新增两行（路线图 + 作废声明），`feature_list.json` 新增 `feat-039`（视觉刷新）/`feat-040`（插件方向），两者均为 `planned`（合法 status，`in-progress` 仍为 0）。关键证据：TSX 无颜色/字重字面量 ⇒ 只改 CSS；`.preview` 已是衬线且标题靠 UA bold；`--surface-muted` 是未定义 token。设计稿过了机器门（首轮 BLOCK 3 个 error → 修完 PASS-WITH-WAIVER，`design_contrast` 通过，Chromium 实机渲染无报错）。**本轮没有改任何 CSS、没有写应用测试、没有跑门禁、没有升版本、没有提交。**

**上一轮（`feat-038`：应用图标换成用户提供的版本 + 版本 `0.3.4` + 发布与安装，已提交 `e251267`，tag `v0.3.4` 指向该提交）**：用户先给了 v1 图标、随后给出替换版 v2，并明确此前用照片抽取图标是「无用功」—— 改用直接提供的 icns。改动：`forge.config.cjs` 增加 `icon: path.resolve(__dirname, "assets/icon.icns")` 并沿用 `feat-034` 先例补 `ignore: [/^\/assets($|\/)/]`（图标源文件不进 asar）；`assets/icon.icns`（972,218 bytes，`e8cbc7e7…48bf`）与 `assets/icon-1024.png`（1024×1024、带 alpha）入库；删掉照片抽取那轮留下的 `.iconrebuild.tmp.mjs` 与 `brand/`（grep 确认无代码引用）。测试：重写 `tests/app-icon.test.ts` 为 4 个用例（1024px 透明母版、icns 签名与 icp4/icp5/icp6/ic07–ic14 类型、forge 接线、`/^\/assets($|\/)/` 排除规则），并对 `git show HEAD:forge.config.cjs` 跑 node 单行证明排除用例在改动前会失败。版本 `0.3.4`（TDD）：fixture 先改到 `0.3.4` ⇒ **5 failed**（`Release version must be 0.3.3.`），再改 `scripts/release-desktop.mjs`（第 21 行 `RELEASE_VERSION_ERROR`、第 155 行目标版本）+ `package.json` + `package-lock.json` + `feature_list.json` ⇒ **31 passed**。门禁：`npm run desktop:release`（Node.js **24.15.0**，日志 `/tmp/icon-release3.log`）**exit 0** —— 63 files / **863 tests**、statements 95.28%、三引擎 e2e **187 passed / 2 skipped**、live **2/2**（首跑 live 遇 DNS 抖动，重跑通过）；产物 `237,272,966` bytes / SHA-256 `6910120e…2704`。独立复核：`unzip -t` 无错、`CFBundleShortVersionString = 0.3.4`、Mach-O arm64、包内 `electron.icns` 与仓库 `assets/icon.icns` 同哈希、asar 里 `/assets` 与 `/brand` 各 0 条（总 230 条，比 `0.3.3` 少 11 条）、`server/node_modules/electron` 仍 0 条。体积比 `0.3.3` 大 **约 4.3 MB**，与图标无关，来自本次构建的 Next.js 追踪多带 `@img/sharp-wasm32` / `@emnapi/runtime` 与 3 个 build-hash 静态文件。安装：旧应用退出后备份 `/tmp/icon-v1-app`，`ditto` 装到 `/Applications` 并清隔离属性，冒烟 `ELECTRON_SMOKE_TEST=1 ELECTRON_SMOKE_TEST_SECRETS=1` **exit 0**，Helper 仍 `UIElement`（无幽灵图标）。发布：GitHub Release `v0.3.4`（`published=2026-09-21T03:41:41Z`，资产 `237,272,966` bytes / `uploaded`，标记 Latest），tag `v0.3.4` 指向 `e251267`，使 tag、已发布 ZIP 与 `checkout` 的源码三者一致（**决策：不升 `0.3.5`，但在同版本号下重跑了完整门禁** —— 首次发布只是几分钟大的空草稿、零资产，所以重跑后发布的 ZIP 里就是 v2 图标）。**踩到的坑（值得记下）**：把已经发布过的 release 所对应的 tag 删掉再重推到新提交时，GitHub 会把那条 release 打回草稿并把 tag 名改成占位符 `untagged-…`（release 与 tag 就此脱钩）；正确做法是先删掉那条草稿 release，再在 tag 已就位的情况下重新 `gh release create v0.3.4 <zip> --latest`。未做：不改网页 favicon、不重打历史产物、不动依赖与端点策略。
**上一轮（同步 `0.3.3` 到本机 + `feat-035`：standalone 可加载 + e2e 触达真实转换处理器，2026-09-21，未提交）**：用户说「昨天在另一台电脑更新到了 v0.3.3，你看看」，并要求 ① 同步源码 ② 下载安装 0.3.3 ③ 处理复核时发现的缺口。① `git merge --ff-only origin/main`：`f072a8b` → `f497d14`（3 个提交、19 文件 +302/−78，工作区原本干净、无分叉），本机版本变 `0.3.3`。② 产物独立复核 + 安装：GitHub 资产 `232,947,408` bytes、SHA-256 `1bf807df…7a72`（与 `docs/TESTING.md` 一致）、`unzip -t` 无错、`CFBundleShortVersionString 0.3.3`、Mach-O arm64、未压缩 **539 MB**；安装时**必须先 `rm -rf /Applications/MD-Convertor.app` 再 `ditto`** —— 第一次直接 `ditto` 覆盖是错的：目录仍是 **843 MB**、`server/node_modules/electron` 依然存在（`ditto` 只合并不删除，等于完全没吃到裁剪）；重装后实测 `lsappinfo`：主应用 `pid 6543 type="Foreground" Version="0.3.3"`、`next-server (v16.3.5)` 挂在 `Contents/Frameworks/MD-Convertor Helper.app` 且 `type="UIElement"`（`feat-033` 的效果仍在），包内无 `node_modules/electron`、`playwright-core/browsers.json` 在，并用包内 Playwright `chromium.launch()` 成功 ⇒ `0.3.3` 的裁剪在真实产物上验证通过（旧 `0.3.2` 备份 `/tmp/s19/old-0.3.2.app`）。③ 复核时发现一个**早于 `0.3.3`** 的缺口：`.next/standalone` 里没有 `node_modules/playwright-core/browsers.json`（Next 追踪跟到了 `playwright-core` 的静态 require、却漏掉它加载时读的数据文件）⇒ standalone 服务对任何链接都返回 500（实测 `Failed to load external module playwright-…: Cannot find module …/playwright-core/browsers.json`）；`prepare-desktop.mjs` 的整包重拷把这个问题从发布物里盖住了，而 e2e 全部在浏览器里拦截 `**/api/convert`（`paste`/`translate` 只 mock `convert-paste`）⇒ **从来没有用例碰过真实转换处理器**，所以两次门禁 178 passed 都没抓到。修复（TDD）：新增 `e2e/convert-api.spec.ts`（`request` fixture，不经浏览器拦截）—— 回环链接必须得到 403 `PRIVATE_TARGET`（离线，但只有路由成功加载 Playwright 依赖后才可能返回）+ 真实 paste 路由提取一次真实粘贴内容；RED 在未修构建上 `Expected: 403 / Received: 500`，GREEN 靠 `next.config.ts` 的 `outputFileTracingIncludes: { "/api/convert": ["node_modules/playwright-core/browsers.json"] }`（单文件、单路由）。实证：`.next/standalone/.../browsers.json` 存在（1,939 bytes）、standalone 的 Playwright 能 `launch()` + `setContent`、用 production standalone 对真实公网页 `POST /api/convert` ⇒ **HTTP 200 / 3.06s / `extractionMode=browser` / textChars 3812 / 内嵌图 1 / 无 warning**。④ 决定与收尾：用户选 **B**（2026-09-21）—— 保持 `0.3.3`，不改版本号、不重跑 `npm run desktop:release`，只把修复提交在 `v0.3.3` 之上（提交门 ponytail → code-review → neat-freak 已自审，本机 subagent 不可用）。全量验证（Node.js 24.15.0）：`./init.sh` exit 0（62 files / 859 tests、95.28%）、`npm run test:e2e` exit 0（**184 passed / 2 skipped**，较 178 增 6 = 新增 2 用例 × 3 引擎）、`npm run desktop:package` exit 0（产物版本 `0.3.3`、无 `server/node_modules/electron`、`browsers.json` 在）。残余：真实公网 URL 抓取 + 渲染无法做离线 e2e（SSRF 策略按设计拒绝回环地址），只能由 `tests/live` 与手工 200 验证覆盖。
**上一轮（`feat-034`：去掉重复的 Electron 运行时 + 版本 `0.3.3`，已过门禁、已装本机、已提交 `3897cd1` 并发布 `v0.3.3`）**：用户报告「跑得好慢」，实测发现 `electron-forge make` 在本机**经常空跑**：直接运行时无产物、退出码却是 0（发布脚本自身有产物校验，缺 ZIP 会抛 `Expected ZIP was not generated`，所以空跑/卡住的是 Forge 这一层）。① 根因两层：本机默认 Node **v24.16.0** 在解压 electron zip 时卡死在 204727/272259 字节（yauzl 管道回归），换 nvm 的 **v24.14.1** 后一次通过（另一台机器 24.15.0，故从未遇到）；同时发现应用被装了**两份** Electron —— `next build` 的输出追踪跟着 `playwright-core` 的 `require("electron")` 把整个 `electron` 包（含 276 MB 二进制）拷进 `.next/standalone`，而应用服务端代码**零处**引用 electron。② 修复（TDD）：`scripts/prepare-desktop.mjs` 在 `cp(sourceRoot, targetRoot, …)` 后加 `rm(targetRoot/node_modules/electron)`（4 行注释说明原因）；`scripts/prepare-desktop.test.mjs` 新增集成回归（server 不得含 `node_modules/electron`，同时保留 Playwright、Playwright Core、Sharp arm64 包与内置 Chromium Headless Shell），RED 失败 → GREEN 通过。③ 版本 `0.3.3`（TDD）：`scripts/release-guards.test.mjs` fixture `0.3.2`→`0.3.3` ⇒ RED **5 failed / 24 passed**（`Release version must be 0.3.2.`），再改 `scripts/release-desktop.mjs`、`package.json`、`package-lock.json`、`feature_list.json` ⇒ 全通过。④ 门禁（Node.js **24.14.1**，日志 `/tmp/s18b-release.log`）**exit 0**：`./init.sh` 62 files / **859 tests**、statements 95.28%、三浏览器 e2e **178 passed / 2 skipped**、live **2/2**、产物 `MD-Convertor-darwin-arm64-0.3.3.zip` `232,947,408` bytes、SHA-256 `1bf807dfe294860c24345efe5caf2b0fcbd54f88476df7085c9bd03b47b37a72`（独立复算一致）。⑤ 体积：对比 `0.3.2` 的 `358,726,788` bytes 少 **125,779,380 bytes ≈ 120 MiB（−35%）**，未压缩 843 MB → **539 MB**；ZIP 内 `server/node_modules/electron` 条目 = 0，`playwright` / `playwright-core` / `next` / `chrome-headless-shell` 都保留。⑥ 安装：`/Applications/MD-Convertor.app` 由 `0.3.2` 换为 `0.3.3`（旧版备份 `/tmp/s18-old-0.3.2.app`），安装后冒烟 `ELECTRON_SMOKE_TEST=1 ELECTRON_SMOKE_TEST_SECRETS=1` **exit 0**（`/tmp/s18-smoke.log`）：preload 桥 + 运行时密钥往返都通过。⑦ 文档已同步：`CHANGELOG`(+zh) 新增 `[0.3.3] - 2026-09-20`、`README`(+zh)、`docs/ARCHITECTURE`(+zh)、`docs/TESTING`(+zh)（0.3.2 降为历史产物）、`PROGRESS`、`feature_list.json`（`feat-034` done、`currentVersion 0.3.3`）。⑧ 已知误报：pi-lens 对 `scripts/prepare-desktop.mjs` L10/L22 报 `JSON.parse` 未包 try/catch —— 这两行改动前就存在（HEAD 逐字节相同），且构建脚本读不到依赖本就该立刻失败，未改动。⑨ **已提交、已发布**：一次提交 `3897cd1`「0.3.3：去掉内置服务里重复的 Electron 运行时」（代码 + 全部文档）已推送 `origin/main`，`gh release create v0.3.3 <zip> --target main --title "MD-Convertor v0.3.3"` 成功并发布（tag `3897cd1`，资产 `232,947,408` bytes），`git fetch --tags origin` 后本地 tag 同步；按用户要求先跑了提交门（ponytail → code-review → neat-freak）。

**上一轮（`feat-033`：程序坞幽灵图标修复 + 版本 `0.3.2`，已过门禁、已装本机、已发布 `v0.3.2`）**：用户发现打包应用运行期间程序坞多出一个黑色通用可执行文件图标且一直跳动，问要不要修，给出方案 A（只改源码，以后再发版）/ B（升 0.3.2 修好就跑完整门禁并发布），用户选 **B**。① 根因：`electron/main.mjs` 用 `spawn(process.execPath, [serverEntry], …)` 启本地服务，而 `process.execPath` 就是应用包自己的主可执行文件，macOS LaunchServices 因此把 Node 子进程当成「第二次启动 MD-Convertor」（`type="Foreground"`、`parentASN="MD-Convertor"`），而该子进程从不连接 WindowServer、图标永远跳不完。② 修复（TDD）：新增纯模块 `electron/server-binary.mjs`（`resolveServerBinary(execPath)` ⇒ `Contents/Frameworks/<基名> Helper.app/Contents/MacOS/<基名> Helper`，缺失时抛 `Desktop helper runtime is missing: <path>`）与 `electron/server-binary.test.mjs`（3 用例）；`electron/main.mjs` 改用该 helper 启动（仍是同一个 Electron 二进制，靠 `ELECTRON_RUN_AS_NODE=1` 以 Node 运行），helper bundle 声明 `LSUIElement` ⇒ 不占程序坞。无需改打包配置、无需新增素材。③ 版本 `0.3.2`：`scripts/release-guards.test.mjs` 先把 8 处 fixture 从 `0.3.1` 改成 `0.3.2`（`release-guards` ⇒ RED **5 failed / 24 passed**），再改 `scripts/release-desktop.mjs`、`package.json`、`package-lock.json`、`feature_list.json` ⇒ **32 passed**。④ 真机证据：修复前 `lsappinfo list` 里子进程挂在应用包上且 `type="Foreground"`，修复后挂在 `Contents/Frameworks/MD-Convertor Helper.app` 且 `type="UIElement"`（打包应用与安装后应用都验过）；程序坞截图 `pair-before.png`（应用图标 + 黑色 exec）与 `pair-after.png` / `pair-installed.png`（只剩应用图标）。⑤ 门禁（Node.js 24.15.0，日志 `/tmp/s17-release.log`）**exit 0**：`./init.sh` 62 files / **858 tests**、statements 95.28%、三浏览器 e2e **178 passed / 2 skipped**、live **2/2**，产物 `MD-Convertor-darwin-arm64-0.3.2.zip`，`358,726,788` bytes，SHA-256 `8fb7a93f…f1ba`；独立复核 `unzip -t`、版本 `0.3.2`、arm64、asar 内含 `server-binary.mjs`。⑥ 安装：`ditto /tmp/s17-app/MD-Convertor.app /Applications/MD-Convertor.app`（旧 `0.3.1` 备份 `/tmp/s17-old-0.3.1.app`），安装后子进程同样为 `UIElement`，`settings.json` SHA-256 未变（`93204f32…30b4`）。⑦ 文档同步中：`CHANGELOG`(+zh) 的 `[Unreleased]` 已归档为 `[0.3.2] - 2026-09-20`，`README`(+zh)、`docs/ARCHITECTURE`(+zh)、`docs/TESTING`(+zh)、`docs/QUALITY-AUDIT`、`PROGRESS`、`feature_list.json`（`feat-033` done、`currentVersion 0.3.2`）已更新。⑧ 发布：一次提交 `1c3ed80`「0.3.2：修复运行时的程序坞幽灵图标」（含代码 + 全部文档）已推送，`gh release create v0.3.2 <zip> --target main --title "MD-Convertor v0.3.2"` 成功，`git fetch --tags origin` 后本地 tag `v0.3.2` → `1c3ed80`，资产 `358,726,788` bytes 状态 uploaded。
**上一轮（发布 `v0.3.1` 并安装到本机）**：用户要求「提交Github，然后发布最新的Release到Github，并且安装到本机（替换旧版）」。① 提交门（自审，`subagent` 在本机不可用）：ponytail 无过度工程（无新依赖、CSS 净删除、字体走 `next/font/local`）、code-review 无新增 `src/lib` 模块故无新覆盖率门槛、neat-freak 发现四处文档仍写旧计数 853（已在本轮发布记录里一并改为 855）；顺手还原了 `src/app/page.tsx` 一处属性顺序的无意义改动。② 一次提交 `af7f6db`「`0.3.1`：依赖升级、界面微调与自带 Michroma 品牌字」（`feat-031` + `feat-032` 全部改动、`docs/UI-REVIEW-2026-09-20.md`、`public/fonts/*`、`tests/brand-font.test.ts`），已 `git push origin main`（`0caa564..af7f6db`）。③ 先 `pkill` 关掉运行中的应用再跑 `npm run desktop:release`（Node.js 24.15.0，日志 `/tmp/s16-release.log`）**exit 0**：`./init.sh` 61 files / **855 tests**、三浏览器 e2e **178 passed / 2 skipped**、live **2/2**、`electron-forge make` 与产物校验通过，产物 `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.1.zip`，`358,723,706` bytes，SHA-256 `c7411c58…161b`。④ 独立复核：`unzip -t` 无错、`CFBundleShortVersionString` = `0.3.1`、Mach-O arm64、包内自带字体与仓库文件同哈希（`b12098180dae…56cf`）、CSS `--font-brand:"michroma", "michroma Fallback"`。⑤ `gh release create v0.3.1 <zip> --target main --title "MD-Convertor v0.3.1" --notes-file …`（gh 2.99.0，登录 `haohaiHuang`）；校验 tag `v0.3.1` → `af7f6db`、资产 358,723,706 bytes 状态 uploaded。⑥ 本机旧版 `/Applications/MD-Convertor.app`（`0.2.1`，mtime Aug 22）替换为 `0.3.1`（无其他安装位置，`~/Applications` 不存在）。⑦ 文档同步：`CHANGELOG`(+zh) 的 `[Unreleased]` 归档为 `[0.3.1] - 2026-09-20`，`README`(+zh)、`docs/TESTING`(+zh)、`docs/QUALITY-AUDIT`、`PROGRESS` 的产物数字与测试计数全部对齐；`scripts/release-guards.mjs` 只硬校验 `v0.1.3` tag，新增 `v0.3.1` tag 不影响后续门禁。

**上一轮（`feat-037`：云端卡片「清除」改为整卡重置；已提交推送 `c568513`，未跑门禁）**：用户要求把云端 Provider 卡片里的「清除密钥」上移到右上角（与「保存」并列）并改成「清除所有已填入/选择的信息」。需求分析两问，用户选 **Q1①**（密钥库 + `settings.json` 里的 Provider 一起清，回到全新未配置状态）与 **Q2②**（头部只留一个「清除」，换密钥就清掉后重填整张卡片）。实现：`src/app/settings/page.tsx` 的 `clearCloudKey()` → `clearCloudProvider()`（`bridge.clear(id)` → `setCloudForm(EMPTY_CLOUD_DRAFT)` → `save({cloud:{providers:[], activeProviderId:null}})`，提示「已清除云端配置。」），按钮移入头部 `[清除][保存]`，密钥行按钮删除，占位改为「••••••••（已保存，清除后可重新填写）」。契约未改（空 `providers` 就是默认值），未升 `SETTINGS_VERSION`，无迁移。RED 2 failed / 22 passed ⇒ GREEN 24 passed；`./init.sh` exit 0（62 files / **859 tests**、95.28%）；三浏览器 e2e **187 passed / 2 skipped**；手工探针（standalone + mock settings API）实测按钮 `清除 x=852,y=471` / `保存 x=919,y=471`、点击后 PUT `{providers:[],activeProviderId:null}` + `clear ollama`、四字段全空、密钥框恢复可编辑，截图 `/tmp/clear-card-before.png`、`/tmp/clear-card-after.png`。已提交并推送 `c568513`；**未跑发布门禁**（若要发布先 bump 到 ≥ `0.3.4`）。真机测试副作用（用户确认是刻意的）：本机 `settings.json` 的云端 Provider 已被那次「清除」清空（现为 `providers: []` + `activeProviderId: null`），`mode` 仍为 `local`；**不要还原**，临时备份在 `/tmp/feat037-backup/` 可直接删。

**上一轮（`feat-036`：抓取失败时提示改用粘贴；已提交推送 `c568513`，未跑门禁）**：用户反馈「链接抓取不到时只是直接报错，应该提醒可以改用粘贴富文本」。范围收窄到**服务端抓取失败**。`src/app/page.tsx` 新增 `linkFetchFailed`（在 `runConversion` 的 `catch` 里按 `conversionMode === "link"` 置位，新尝试重置），仅在 `mode === "link" && requestState === "error" && linkFetchFailed` 时于错误卡片下方渲染 `.errorHint`（文案「有些页面需要登录或会拒绝自动访问，可以把正文粘贴进来转换：」）+ `.errorHintAction` 按钮「改用富文本粘贴」；处理器 `switchToPasteMode()` 复用 `switchPasteMode(previous, "paste")` 并把焦点移到 `#paste-tab`（沿用页面既有惯例）。**未改** `PasteOutputState`、接口、契约、翻译引擎、打包配置、`electron/preload*.cjs`。RED：新 e2e 用例在 `getByRole("button", {name:"改用富文本粘贴"})` 处超时（13 passed）⇒ GREEN 同文件 chromium **14 passed**；`./init.sh` exit 0（62 files / **859 tests**、95.28%）；三浏览器 `npm run test:e2e` exit 0 ⇒ **187 passed / 2 skipped**（基线 184/2）。真机探针（production standalone + playwright-core，`/api/convert` 由浏览器拦为 502 `UPSTREAM_ERROR`）：按钮 `x=636 y=613`、`color rgb(15,81,71)`，点击后 `富文本转换` `aria-selected=true`、`document.activeElement.id === "paste-tab"`，截图 `/tmp/hint-error.png`。已知上限：提示按「服务端失败」判定、不区分错误码，因此 413 这类粘贴也救不回来的失败同样会显示。已提交并推送 `c568513`；**未跑发布门禁**（若要发布必须先 bump 到 ≥ `0.3.4`）。

**上一轮（页头品牌字：去掉 MD 方块 + Michroma，已随 `0.3.1` 发布）**：用户要求「去掉左上角 MD 图标、只留标题文字」，并把品牌字换成 **Michroma**；随后用户问「字体能否直接嵌入产品代码」，于是从 `next/font/google` 改为**仓库自带**。最终方案：字体放在 `public/fonts/Michroma-Regular.woff2`（11,620 bytes、latin 子集）、许可证放在同目录 `public/fonts/OFL.txt`（OFL 1.1，版权行取自字体 name 表：`Copyright 2011 The Michroma Project Authors (https://github.com/googlefonts/Michroma-font)`），用 `next/font/local` 加载 —— 构建期是**本地文件读取，整个构建不再需要联网**（用 `sandbox-exec -p '(version 1)(allow default)(deny network*)' npm run build` 实测通过，并先用同一沙箱跑 `fetch('https://fonts.gstatic.com/...')` 得 ENOTFOUND 证明沙箱真的断网）。**只 vendored latin**：`next/font/local` 不产出 `unicode-range`，latin + latin-ext 一起传会生成两条同描述符的 `@font-face`，后者对所有字形生效而它没有 ASCII ⇒ 品牌字会回退 Arial。Michroma 只有 400 字重、无中文字形 ⇒ 只用在纯拉丁的品牌字上（hero 大标题是中文，不受影响），`font-weight` 760→400、去掉 `-0.03em` 负字距（Michroma 本身宽）、字号 15px。改动：`src/app/layout.tsx` 用 `localFont({src:"../../public/fonts/Michroma-Regular.woff2", weight:"400", variable:"--font-brand"})` 并挂 `<html className>`；两个页面删掉 `<span className={styles.brandMark}>MD</span>`，两处 `.brand` 用 `var(--font-brand)` 并删除 `.brandMark` 规则；`prepare-desktop.mjs` 已把 `public/` 整拷进包内，故许可证无需改打包脚本。TDD：两个 spec 的用例 RED **2 failed / 35 passed**（实收 `"MDMD-Convertor"`）⇒ chromium **37 passed**；新增 `tests/brand-font.test.ts` 先 RED（ENOENT）再 2 passed。切到 `next/font/local` 后族名由 layout.tsx 的绑定名生成（`"michroma"` / `"michroma Fallback"`），断言由字面 `"Michroma"` 改为 `/michroma/i` 并补上「页面实际加载的 woff2 与仓库文件 SHA-256 相等」（比原来更强）。`./init.sh` exit 0（61 files / **855 tests**、95.28%，`/tmp/s15-init.log`）；三浏览器 `npm run test:e2e` exit 0 ⇒ **178 passed / 2 skipped**（`/tmp/s15-e2e2.log`；首跑 1 个 firefox 用例 `NS_ERROR_PROXY_CONNECTION_REFUSED` 属 e2e server 掉线的已知偶发，单跑 firefox 59/1 skipped 全绿）；`npm run desktop:package` exit 0，包内 `server/.next/static/media/Michroma_Regular-s.p.*.woff2` 与仓库文件同哈希、`server/public/fonts/{Michroma-Regular.woff2,OFL.txt}` 都在；真机 CDP 探针：family `michroma`、品牌框 143×21、唯一字体请求来自应用自身、0 个 Google 请求，`settings.json` SHA-256 未变（`93204f32…30b4`）。CHANGELOG(+zh) 的 `[Unreleased]` 已按新的「仓库自带」说法改写；`feature_list.json` 的 `feat-032` 证据与 notes 已更新。

**上一轮（`feat-031`：版本 `0.3.1` + 依赖升级 + 界面三项 + 密钥框只读，已随 `0.3.1` 发布）**：用户一次提了 9 项，本轮落地其中 6 项（另 3 项：发布到 GitHub Releases 与真机小点用户选「稍后」，Apple 签名属问答）。① 版本按 TDD 升到 **`0.3.1`**：`scripts/release-guards.test.mjs` 先 RED，再改 `scripts/release-desktop.mjs`（`RELEASE_VERSION_ERROR` + `version !== "0.3.1"`）、`package.json`、`package-lock.json`（root 与 `packages[""]`）与 `feature_list.json` 的 `currentVersion` ⇒ `npm test -- release-guards` **29 passed**；坑：整文件替换会把「旧版本必须被拒」的 fixture 也改成目标版本（断言恒真），该 fixture 已固定为 `{ version: "0.2.1" }`。② 依赖升级（用户单独授权）：`next@16.3.5`、`sharp@0.35.4`（`@img/sharp-*` 0.35.4、`@img/sharp-libvips-*` 1.3.3），`npm audit --omit=dev` 从 3 条变 **0 漏洞** ⇒ QA-012 关闭。③ 界面：页头去掉 ⚙ 图标只留「设置」、「转换为 MD」→「转换」（两个面板）、富文本面板的转换/停止按钮移入 `.sourceRow` 紧跟 `sourceInput`，`.sourceInput` 改 `flex: 1 1 auto` 让按钮右边缘与粘贴框右边缘对齐（RED 差值 210.4375 → GREEN 0）。④ 密钥框：已保存时 `readOnly`（可聚焦，不用 `disabled`），占位「••••••••（已保存，先清除密钥再更换）」；「清除密钥」语义不变。证据：`./init.sh` exit 0（60 files / **853 tests**、statements 95.28%）；`npm run test:e2e` **172 passed / 2 skipped**；live 首跑 DNS 瞬时失败、重跑 **2/2**；`npm run desktop:package` 产物 `CFBundleShortVersionString 0.3.1` + 包内 `sharp 0.35.4`；真机 CDP 量测 `rightEdgeDelta 0`，截图 `/tmp/s13-paste-row.png`，用户真机测试通过。文档已同步 TESTING(+zh)/QUALITY-AUDIT/README(+zh)/ARCHITECTURE(+zh)/AGENTS/CHANGELOG(+zh)/PROGRESS/`feature_list.json`（`feat-031` done、`updatedAt 2026-09-20`）。

**上一轮（`feat-030` 云端配置收敛为单条 + 保存按钮位置修复，未跑门禁）**：用户改向 —— 「只保留一个云端模型录入，不需要可以追加多个模型」+ 去掉「当前使用」标签。需求分析阶段提了三问，用户选 **Q1=A**（单条云端配置）、**Q2=留**（保留名称字段）、**Q3=不留**（删掉删除按钮）。落地：`src/app/settings/page.tsx` 删除 `drafts` / `newProvider` / `ProviderDraft` / `providerDraft()` / `EMPTY_NEW_PROVIDER` / `NEW_PROVIDER_NOTE` / `patchProvider()` / `removeProvider()` / `createProvider()` / `addManualModel()`，改为单一 `cloudForm: CloudDraft`（`{name, baseUrl, keyInput, selectedModel, models}`）+ `editingProvider(cloud)`（`providers.find(id === activeProviderId) ?? providers[0] ?? null`）；只渲染一张 `<article aria-label="云端 Provider">`，头部 `[已配置/未配置] + 保存`，字段 名称 / Base URL + 拉取模型 / 模型（`<input list="cloud-models">` + `<datalist>`）/ API 密钥 + 清除密钥；`保存` 写入 `cloud: {providers:[one], activeProviderId: id}`（契约不变、无迁移、未升 `SETTINGS_VERSION`），模型不再随选择即时落盘。顺带修掉上一轮的遗留问题：Base URL 列在 `.grid` 里被压窄导致地址被截断（改为 `minmax(150px,1fr) minmax(300px,3fr)` + ≤640px 单列），模型字段的占位文案在已有模型时误报「先拉取模型」（已补回归断言，并用变异构建验证断言会转红）。RED→GREEN：`e2e/settings.spec.ts` 云端 describe 重写为 10 个用例，RED **11 failed**（含「密钥」一例）→ chromium **23 passed**；`./init.sh` exit 0（60 files / **853 tests**、statements **95.28%**）；三浏览器 e2e **169 passed / 2 skipped**；`npm run desktop:package` 后真机 CDP 实测（服务端口 62389）：卡片 1 张、旧卡片 0、`保存` 在卡片头部、`当前使用`/`设为当前`/`手填模型`/`添加模型`/`删除` 全部为 false，真实配置回填为 `Mimo` + 完整 Base URL + `mimo-v2.5-pro` + 八个黑点，截图 `/tmp/s11-cloud-card.png`。**未跑发布门禁**（版本决策未定）。

**（同一轮，前置）保存按钮位置一致性**：新建卡片原本把「保存」放在卡片底部左侧，与已保存卡片的右上角不一致 —— 已把 `保存` 移入卡片头部（`.providerHead` + `.actions`，`margin-left:auto` 右对齐，无 CSS 改动），新用例先 RED（按钮 y 在名称输入框下方）再 GREEN；该卡片已随本轮单卡片改造一并消失。

**上一轮（`feat-029` 云端 Provider 保存规则与密钥占位，未跑门禁）**：用户反馈两点 —— 密钥输入框每次进设置页都是空的（担心密钥丢失），以及云端 Provider 缺必填校验。按 AGENTS.md 先做需求分析（读码 + 真机截图），用户定下：**保存时名称、Base URL、API 密钥、模型四项必填**，密钥框接受**黑点占位**（不可选中/复制/提交，`value` 保持为空，页面依旧不读回密钥库）。落地：新增纯函数 `src/lib/settings/provider-form.ts`（`providerFormError()` 按表单顺序报第一条缺失 ——「请填写 Provider 名称。」/「请填写完整的 http(s) 接口地址。」/「请先填写 API 密钥。」/「请先拉取或选择模型。」），`saveProvider()` 与 `createProvider()` 都先过这道闸、不齐全不写盘；`POST /api/provider/models` 新增**草稿模式**（`{baseUrl, apiKey}`，缺的一半回退到已保存的 Provider，仍兼容 `{providerId}`）解开「填不满就存不了、存不了就拉不到模型」的死结；「拉取模型」两种卡片都改为**只读端点**（结果进草稿态，选模型或保存才写 settings），新建卡片新增模型字段（`<input list>` + `<datalist>`，可手填）；问题类提示（校验缺失、密钥库不可用、拉取失败、模型名为空）改用警告色 `var(--warning)`，进度与成功提示仍是 muted（`notes` 值类型改为 `{text, warn?}`）。RED→GREEN：`provider-form.test.ts` 8 用例、`route.test.ts` 20 passed（草稿用例 RED 6 failed / 14 passed）、`e2e/settings.spec.ts --project=chromium` 22 passed；`./init.sh` exit 0（60 files / **853 tests**、statements **95.28%**）；三浏览器 e2e **166 passed / 2 skipped**；`npm run desktop:package` 后真机实测（服务端口 52057 / CDP 9222）：密钥框空值 + 八个黑点占位、四个缺失提示按序出现、`settings.json` 未被写入。**未跑发布门禁**（版本决策未定）。这一轮**推翻了 `feat-026` 的两点**：拉取不再「先保存草稿」，密钥框不再保留本次输入。

**上一轮（`feat-027` 云端翻译超时 + `feat-028` 模式标签，未跑门禁）**：用户实测云端 Provider 报「返回了无法识别的回答」，真机诊断（自撰探针 + 一次性回环 shape 代理，只记响应形状）确认两个叠加缺陷 —— 单次调用 60s 上限对推理模型太短（`reasoning_content` 2,417–4,885 字符 vs `content` 92–246 字符；单批实测 38–60s），且读响应体途中的 abort 被 `catch { payload = null }` 吞掉、误报成 502。用户选 **A**：`TRANSLATE_CALL_TIMEOUT_MS` 60s → 180s（任务预算公式 `max(120s, 批次数 × 180s + 30s)` 自动跟随），读体 catch 改为 `if (combined.aborted) throw failedCall(...)`（超时 504 / 取消 499）；顺带按用户要求删掉设置页「当前生效」标签（切换时挤动选项）。RED→GREEN：`src/lib/translate/` 12 files / 198 tests、`e2e/settings.spec.ts --project=chromium` 19 passed；`./init.sh` exit 0（59 files / 839 tests、95.26%）；三浏览器 e2e 157 passed / 2 skipped；`npm run desktop:package` 后真机探针：3 段 ⇒ `RUN 200 @ 26.8s`、60 段（121 块）⇒ `ANALYZE 200 @ 78.9s` + `RUN 200 @ 284.4s`（修复前均为 `502 @ 60.0s`），日志无 `TRANSLATE_TIMEOUT`、无正文泄漏。新开 QA-013（长上限的取舍）。**仍未跑发布门禁。**

**上一轮（`feat-026` 云端 Provider 配置体验，未跑门禁）**：按用户实测反馈改造云端 Provider 配置 —— 删除「环境变量名」字段与 `apiKeyEnv` 契约（`RETIRED_PROVIDER_KEYS` 容忍旧文件、写出时丢弃，未升 `SETTINGS_VERSION`；密钥只剩系统密钥库一个来源）、删除「添加 Provider」改为常驻空卡片、每张卡片只留一个「保存」（名称 + Base URL + 有值时写密钥）、「拉取模型」移到 Base URL 右侧（当时的语义是「先保存草稿再拉取」，`feat-029` 已改为只读端点）、保存密钥后输入框保留本次输入（`feat-029` 已改为黑点占位）、删除 Provider 时同时清空密钥库。契约层 vitest 59 files / 837 tests；`./init.sh` exit 0（837 tests、95.26%）；三浏览器 e2e 157 passed / 2 skipped；打包后 CDP 实测「拉取模型」与 Base URL 同行（按钮 x=892，输入框 x=596，y=558.47）。

上一轮（`feat-025` 设置页 UI 反馈与页头清理）：按用户选定的 Q1②/Q2①/Q3① 落地六项 UI/UX 反馈：主页去掉右上角「本机处理 · 不保存内容」、齿轮图标改为带文字的「⚙ 设置」按钮；设置页把模式区从 `fieldset`+`legend` 换成标题卡片「翻译服务提供方」，`legend` 骑在上边框上的重叠问题随之消失，「当前生效」改为挂在选中项文字右上角的 in-flow 胶囊；隐藏「自定义语言标签」入口（`languages.custom` 字段与 `addCustomLanguage()` 及其单测保留，存量标签仍可选中）；`save()` 记录在途 Promise，页头新增「保存中…/已保存」胶囊，「返回转换」改为按钮并在导航前等待在途保存（失败则留在页面）。e2e 全量 154 passed / 2 skipped（三浏览器），`./init.sh` exit 0（59 files / 839 tests、statements 95.27%），打包后真机截图确认。**同样未跑发布门禁**。

上一轮（`feat-024` 长文翻译超时修复）见下文 `### feat-024 长文翻译超时修复（历史，未跑门禁）`，0.3.0 S6 详见 `### S6 已完成要点`。

上一轮（0.3.0 S6）详见下文 `### S6 已完成要点`。

### S6 已完成内容（不要重做）

- 版本面：`package.json` 与 `package-lock.json` 的顶层 `version` 为 `0.3.0`（注意：依赖 `is-arrayish`、`node-api-version` 的版本号曾被正则误改，已回退为 `0.2.1`）；`scripts/release-desktop.mjs` 的 `RELEASE_VERSION_ERROR` 与 `version !== "0.3.0"`；`feature_list.json` 的 `currentVersion` 为 `0.3.0`、`activeFeature` 为 `null`、`feat-023` 为 `done`。
- `scripts/release-guards.mjs` 的**退役语义**（用户方案 A 授权）：`HISTORICAL_ARCHIVE_RETIRED_NOTICE`、`assertProtectedArchive` 缺文件返回 `{status:"retired"}`、`captureHistoricalZipSnapshot` 只对存在的条目校验哈希、`listRetiredHistoricalZips()`；`PROTECTED_HISTORICAL_ZIP_MANIFEST` 新增 `0.2.1`（`32c1d96a…463e`）。**仍然硬校验**：存在的归档被改动/可写、目录中出现未登记发布 ZIP、`PROTECTED_BASELINE_COMMIT`（`v0.1.3`）与新鲜度检查。`release-desktop.mjs` 结尾会打印退役公告，`runRelease()` 返回值多了 `archiveStatus` 与 `retiredZips`。
- 覆盖率：`vitest.config.ts` 无改动（原本就已把 `src/lib/**/*.ts` 纳入 `include` 并对 `src/lib/translate/**` 每个模块设了逐文件门槛）。
- 文档：`docs/PRODUCT.md`(+zh) 删除「不使用 AI API/密钥/模型」非目标、补翻译能力与 11 种目标语言、按 PRD §5 改写隐私段；`docs/ARCHITECTURE.md`(+zh) 新增「设置、翻译接口与出网边界」节；`docs/TESTING.md`(+zh) 新增翻译覆盖清单、测试桩、逐文件门槛与 `workers: 1` 原因，并把旧的「0.3.0 门禁被阻断」段改为**已验证的 0.3.0 产物 + 历史锚点（0.2.1）**；`docs/QUALITY-AUDIT.md` 新增 QA-009/010/011/012、重写 Verdict 与 0.3.0 产物表；`README.md`/`README.zh.md` 把当前版本改为 `0.3.0` 并附产物大小与 SHA-256；`AGENTS.md` 更新版本号、归档现状（不再声称 0.1.x 归档在本机）与门禁表述；`CHANGELOG.md`(+zh) 的 `[Unreleased]` 已改为 `[0.3.0] - 2026-09-18`。
- 验证日志：`/tmp/s6-t61-red.log`（T6.1 RED）、`/tmp/s6-t64a-red.log`（退役改造 RED 6 failed / 23 passed）、`/tmp/s6-init-e2e.log`（早期 init.sh + e2e）、`/tmp/s6-release.log` 与 `/tmp/s6-release-2.log`（改造前的阻断证据）、`/tmp/s6-release-3.log`（**最终通过的完整门禁，0 条 ERROR**）。
- **未改动**：`src/**`（零改动）、新增依赖、settings 字段、阈值与接口、任何 URL 安全策略、`v0.1.3` 标签；也未提交、未整理 S1–S5 的未提交改动。

### 本轮新开风险（下一轮决策点）

- **feat-024 – feat-033 的构建已分别进入 `0.3.1` 与 `0.3.2` 产物，两者均已过门禁、已装本机并已发布（`v0.3.1` / `v0.3.2`）；`feat-034` 的构建进入 `0.3.3`、`feat-035`–`feat-037` 与应用图标进入 `0.3.4`，`feat-039`（视觉刷新）与「清空」按钮归位进入 `0.3.5`（均已过门禁、已装本机、已发布）**：下次改动前先 bump 版本号（≥ `0.3.6`）。
- **QA-012 已关闭（2026-09-20）**：`next@16.3.5`、`sharp@0.35.4` 升级后 `npm audit --omit=dev` 为 **0 漏洞**（剩余 28 条仅在 electron-forge 构建链的开发依赖里）；已在 `0.3.1` 与 `0.3.2` 门禁中复验。

### S5 实际交付接口（S6 直接使用）

- 决策纯函数：`src/lib/translate/decision.ts` —— `SKIP_RATIO = 0.97`、`CONFIRM_RATIO = 0.7`、`decideTranslation(analysis) => {action:"skip",reason:"target-language"|"empty",percent} | {action:"confirm",percent} | {action:"translate-all"}`。判定顺序：`totalChars === 0` ⇒ skip/empty；`ratio >= 0.97` ⇒ skip/target-language；`ratio >= 0.70` ⇒ confirm；否则 translate-all。比较用原始 ratio，`percent = Math.round(ratio*100)` 仅展示。S4 的 `decideTranslationScope()` 占位函数已删除。
- 页面状态机新增：`{status:"confirming", analysis, percent}`（弹窗中）、`{status:"skipped", reason:"target-language"|"empty"|"declined"}`（不翻译）；`showResultTabs` 同时排除这两个状态，所以不会出现空译文 Tab。`translationScopeRef`（新转换重置为 `"all"`）承载用户选择，`retryTranslation()` 拿 `analysisRef.current` + 该 scope 重跑，**不二次弹窗**。
- 确认框：原生 `<dialog>`，`useEffect` 里 `showModal()/close()`，Esc = 不翻译；文案 `检测到正文约 {percent}% 已是{目标语言}，是否只翻译其余部分？`；按钮 `不翻译` / `只翻译非目标语言部分`（后者 ⇒ `scope="non-target"`）。提示行 `role="status"`：≥97% `正文已是<目标语言>，无需翻译`；空散文 `正文没有可翻译的段落，无需翻译。`；选「不翻译」`已选择不翻译，结果保留原文。`。三条 skip 路径都不发 `run`。新样式 `.confirmDialog`（含 `::backdrop`）/`.confirmText`/`.confirmActions` 在 `src/app/page.module.css`。
- 保真 golden：`src/lib/translate/run.test.ts` 新用例用「把翻译结果包成 `«…»`」的 Provider，断言标记后逐字符等于预期、去标记后与输入逐字节一致、5 个目标语言段原样保留且 11 个非目标段被包裹、`meta = {scope:"non-target", translatedBlocks:11}`；fixture 覆盖标题/行内代码/链接/同行中英表格单元格/粗体/列表/引用/围栏代码/尾段。
- e2e 占比构造（S5 定式）：只 mock `/api/translate/analyze`（`route.fetch()` 后改写 `totalChars`/`targetChars`/`ratio`/`blocks[].language`），`/api/translate/run` 走真实端点；fixture 为 10 个等长段落，N/10 即精确占比（≥97% ⇒ 10/10；70%–97% ⇒ 8/10；<70% ⇒ 6/10；空散文 ⇒ 全块 skipped 且 chars 0）。手写整个 analyze 响应会因块数不一致撞 409 `TRANSLATE_ANALYSIS_STALE`。
- 验证证据：`./init.sh` 58 files / 830 tests、statements 95.25%、build OK；`npm run test:e2e` 142 passed / 2 skipped（三浏览器；S4 基线 127/2）。RED 日志 `/tmp/s5-e2e-red.log`；T5.2 的测试敏感性用「临时把 scope 过滤器改成恒真 ⇒ 新旧 non-target 用例同时失败」证明后已还原。

### 已知未做 / 上限（S6 不必补，除非用户要求）

- 没有阈值设置项（S5 范围不含「阈值开关」）。
- `totalChars === 0` 为防御分支：引擎在 analyze 阶段就会 400 `TRANSLATE_EMPTY_INPUT`，页面只在响应自报零散文时走到该提示。
- 语言判定是块级的：中英混排段落整体判为目标语言，不会被局部翻译。
- 页面路径仍不可达 409 `TRANSLATE_ANALYSIS_STALE`（analyze/run 共用同一 markdown）；译文未就绪时复制/下载仍静默回落原文。

### S4 实际交付接口（S5 已消费；保留作背景）

- 新增纯函数/客户端：`src/lib/translate/filename.ts`（`languageSuffix(tag)`、`translatedFilename(filename, tag)`，后缀 = trim→小写→非 `[a-z0-9]` 连续段替换为 `-`）、`src/lib/translate/client.ts`（`analyzeDocument(markdown, targetLanguage, signal?)`、`translateDocument(markdown, targetLanguage, analysis, scope, signal?)`、`TranslationError{status,code,message}`、`isCancelled(error)`、常量 `TRANSLATE_CANCELLED`）。两者都有逐文件 coverage 门槛（`vitest.config.ts`）。
- `client.ts` 的错误语义：服务端 `error.message` 优先，其次内置 `FALLBACK_MESSAGES[code]`，最后 `"翻译失败，请稍后重试。"` / `TRANSLATE_UNKNOWN_ERROR`；abort（`signal.aborted` 或 `AbortError`）⇒ `499 TRANSLATE_CANCELLED`；fetch 直接抛错 ⇒ `0 TRANSLATE_NETWORK_ERROR`（"无法连接本地翻译服务，请重试。"）。请求只带 `content-type: application/json`。
- 页面状态机（`src/app/page.tsx`）：`translation: idle | unconfigured | analyzing | translating | done{markdown,warnings} | cancelled | failed{message}`，另有 `resultTab: "original" | "translated"`。转移：转换开始 ⇒ `idle` + Tab 回原文；转换成功且勾选 ⇒ `analyzing`→`translating`→`done`（**任务开始时就切到译文 Tab**，进度与错误才可见）；`cancelTranslation()` ⇒ `cancelled`；409 `TRANSLATE_NOT_CONFIGURED` ⇒ `unconfigured`（不显示 Tab，改显示提示 + `/settings` 链接）；其它错误 ⇒ `failed{message}`；`retryTranslation()` 复用 `analysisRef.current`（不再重新 analyze）。
- `run` 请求体最终形状：`{markdown, targetLanguage, analysis, scope}`，其中 `markdown` 与 `analyze` 用的是同一个字符串，`analysis` 是 analyze 响应的 `analysis` 字段原样回传，`scope` 现在恒为 `"all"`。因为 analyze 与 run 的 markdown 必然相同，**409 `TRANSLATE_ANALYSIS_STALE` 在页面路径上不可达**，S4 因此没有实现「重新 analyze 后重试一次」；若 S5 引入人工编辑或重排，才需要补该分支。
- DOM/无障碍：结果 Tab list `aria-label="转换结果"`，tab id `original-result-tab` / `translated-result-tab`，panel id `original-result-panel` / `translated-result-panel`，方向键/Home/End 可切换；**未启用翻译时结果区 DOM 与 0.2.1 完全一致**（只有 `<article aria-label="Markdown 预览">`，没有外层 tabpanel），因为 home/paste e2e 以 `getByLabel("Markdown 预览")` 定位，多套一层会触发 strict mode 冲突。
- e2e 测试桩唯一入口：`scripts/start-e2e-server.mjs` 里的 `process.env.MD_CONVERTOR_TEST_PROVIDER = "1"`（S4 新增）；`/api/translate/*` 走真实 HTTP + 内置伪模型，不 mock。
- S5 接入点（已在 S5 实现并替换）：原 `src/app/page.tsx` 的 `decideTranslationScope()` 占位函数已删除，改调 `src/lib/translate/decision.ts` 的 `decideTranslation()`；`TranslationScope` 取值仍只有 `"all"` / `"non-target"`。`analysis`（含 `ratio` 与 per-block `language`）仍保存在 `analysisRef.current`。

### S4 与文档的偏差（需在后续会话知晓）

- `playwright.config.ts` 新增 `workers: 1`：S3 的翻译任务锁是进程级（429 `TRANSLATE_BUSY`），`fullyParallel: true` 多 worker 时多个用例会同时翻译并互相撞锁（本会话实测一次 429）。单 worker 让全套 e2e ≈1.2 分钟（并行时 27 秒）。
- e2e 真实设置存储是**全 project 共享**的一个临时目录。`e2e/settings.spec.ts` 原「真实 API 往返」用例把 `translation.defaultEnabled` 写成 `true` 后没有还原，S4 起主页面会读该设置并自动翻译，导致 firefox/webkit 的 home/paste 用例出现 `[zh-Hans]` 前缀与布局变化。现该用例用 `try/finally` + `request.put("/api/settings", storedSettings)` 还原默认值。
- 未实现「译文未就绪时禁用复制/下载」：在译文 Tab 且译文尚未就绪时，复制/下载回落为原文内容（不加 `.action:disabled` 样式与禁用逻辑，减少状态分支）。
- 取消后译文 Tab 除「已取消翻译。」外也给了「重试」按钮（文档只要求显示已取消）。

### S3 实际交付接口（S4 直接使用）

- 端点：`POST /api/translate/analyze`（body `{markdown, targetLanguage}`）→ `{analysis, warnings, meta}`；`POST /api/translate/run`（body `{markdown, targetLanguage, analysis, scope}`，`scope` 为 `"all" | "non-target"`）→ `{markdown, warnings, meta}`。两者都要 JSON content-type + `validateConvertApiCaller`，请求体上限 `TRANSLATE_MAX_REQUEST_BYTES = 40 MiB`。
- `analysis` 精确形状：`{targetLanguage, totalChars, targetChars, ratio, blocks: {index, language: "target"|"other"|"unknown"|"skipped", chars}[]}`；`blocks` 覆盖全部分段（含空行与代码块，标 `skipped`/`chars: 0`），前端原样回传即可；语言比较按 BCP-47 主标签。
- `meta`：analyze 为 `{targetLanguage, model, durationMs}`；run 为 `{targetLanguage, model, scope, batches, translatedBlocks, durationMs}`。`model` 在 test 档为 `"md-convertor-test"`，local 档可为 `null`。
- 失败/取消映射（前端只依赖状态码与 `error.code`）：409 `TRANSLATE_NOT_CONFIGURED`（去设置页）、409 `TRANSLATE_ANALYSIS_STALE`（重新 analyze 后重试一次）、502 `TRANSLATE_INVALID_RESPONSE` / `TRANSLATE_PROVIDER_ERROR`（提示重试）、504 `TRANSLATE_TIMEOUT`、499 `TRANSLATE_CANCELLED`（静默）、429 `TRANSLATE_BUSY`（等待）、400 `TRANSLATE_EMPTY_INPUT`、413 `TRANSLATE_INPUT_TOO_LARGE`。
- 取消：没有取消端点；前端 `AbortController` 中断在途 fetch 即可，服务端会中止上游请求/kill CLI 子进程并释放锁。
- 测试桩：`MD_CONVERTOR_TEST_PROVIDER=1` 时 `resolveEffectiveModel` 直接返回 `kind:"test"`（不读 settings），e2e 可用它跑真实 HTTP analyze→run 而完全不联网；未设置时该分支不存在。
- 引擎函数：`analyzeTranslation({markdown, targetLanguage, signal?, deps?})`、`runTranslation({markdown, targetLanguage, analysis, scope, signal?, deps?})`、`batchBlocks(blocks)`、`resetTaskLock()`（仅测试钩子）；`deps` 可注入 `readSettings` / `env` / `deps:{fetch,run}` / `taskTimeoutMs` / `callTimeoutMs` / `now`。
- 限额常量集中在 `src/lib/translate/limits.ts`（200,000 散文/待译字符、单批 ≤20 块且 ≤8,000 字符、单次调用 60s、任务总 120s、请求体 40 MiB）；analyze 与 run 共用一个进程内任务锁（429 `TRANSLATE_BUSY`）。

### S3 与文档的偏差（需在后续会话知晓）

- 分段器是两层实现（A 层行结构分类 + B 层行内受保护片段切出 `kind:"skip"` 段），逐字节一致由「每段是原始字符区间」保证，而非依赖模型守约；表格按单元格切分（管道不进入 `text`）。
- `run` 的 413 上限按「本次实际要发送的块」计算（`scope: "non-target"` 时只算非目标块）；`analyze` 按全部可译块计算。
- `assertBlockAlignment` 比较的是**全部分段**与 `analysis.blocks` 的长度与 index 序列；`run` 在块数不一致或 `analysis.targetLanguage` 与请求不符时都返回 409 `TRANSLATE_ANALYSIS_STALE`。
- 语言主标签比较把 `zh-Hant` 与 `zh-Hans` 视为同一目标语言（已知上限）。
- 本机 `claude` CLI 账号当前无可用模型，claude 路径只有 mock spawn 单元测试证据，没有本机端到端证据；真实使用会返回 502 `TRANSLATE_PROVIDER_ERROR`（消息只含退出码，不含 CLI 输出）。
- `scripts/probe-local-cli.mjs` 是一次性诊断脚本（TDD 之外的唯一非测试产物），保留在仓库以便复核 T3.1 结论；不在产品路径内。

### S2 实际交付接口（S3 已复用，继续有效）

- Provider 端点策略 `src/lib/provider/endpoint.ts`：`parseProviderUrl`、`isAllowedProviderAddress`、`resolveProviderTarget(input, {lookup?})`、`fetchProviderEndpoint(url, init, {fetch?})`；允许 unicast/loopback/private/uniqueLocal/carrierGradeNat，拉黑三个云元数据地址（含 IPv4-mapped IPv6），重定向只允许同协议同主机且最多 3 跳。错误码 `INVALID_PROVIDER_URL`/`PROVIDER_URL_CREDENTIALS`(400)、`PROVIDER_TARGET_BLOCKED`(403)、`TRANSLATE_PROVIDER_ERROR`(502)。**与 `src/lib/security/url.ts` 是两套独立实现，不得互相放宽。**
- 密钥解析 `src/lib/provider/credentials.ts`：`resolveProviderKey({id}) => {key} | null`（同步；**只读运行时表**）、`setRuntimeSecret(providerId, value|null)`、`resetRuntimeSecrets()`（仅测试）。运行时表由 `MD_CONVERTOR_SECRETS` 惰性播种；`apiKeyEnv` 与环境变量来源已退役（feat-026）。
- 模型拉取 `src/lib/provider/models.ts`：`listProviderModels({baseUrl, apiKey, deps?, timeoutMs?}) => string[]`（`GET {base}/models`，`Bearer`）；空密钥 ⇒ 409 `TRANSLATE_NOT_CONFIGURED`，失败 ⇒ 502 `TRANSLATE_PROVIDER_ERROR`。
- 本地 CLI：`src/lib/local-cli/registry.ts`（`LOCAL_CLI_REGISTRY`：`pi` → `--list-models`，`claude` → `listModelsArgs: null`；`findCliDefinition`）、`scan.ts`（`scanLocalClis({pathEnv?, isExecutable?})`、`pathDirectories`、`findCliExecutable`）、`models.ts`（`parseCliModelList`、`runCliCommand(executablePath, args, timeoutMs)`、`listLocalCliModels({cliId, executablePath, run?})`；未知 cliId ⇒ 400 `INVALID_CLI_ID`，不支持列表 ⇒ `[]`，空路径 ⇒ 409，启动/退出码非零 ⇒ 502）。
- 语言：`src/lib/settings/languages.ts`（`PRESET_TARGET_LANGUAGES` 11 项、`languageLabel`、`addCustomLanguage(custom, tag)`）。
- 本地 API 公共辅助 `src/lib/local-api.ts`：`MAX_LOCAL_API_BODY_BYTES = 64 * 1024`、`handleLocalApi(request, run)`、`readJsonBody(request, maxBytes)`、`readField(body, field)`；所有新路由 `runtime="nodejs"`、`dynamic="force-dynamic"`，受 `validateConvertApiCaller` 保护（JSON content-type 必需，包括无 body 的 POST）。
- AWS/密钥即时生效：`electron/runtime-secrets.mjs` 的 `pushRuntimeSecret({rendererUrl, sessionToken, providerId, value, fetchImpl?})`；`electron/main.mjs` 在 `secrets.set`/`secrets.clear` 内 await 推送（失败只 `console.warn`，不回传 message）。

### S2 与文档的偏差（需在后续会话知晓）

- `/api/runtime/secrets` 故意不与 settings 里的 Provider 列表交叉校验（它是运行时通道，不是设置变更）：任何合法格式的 `providerId` + `value`（`null` 或 1–8192 非空字符串）都被接受；密钥不落盘、不记日志。
- 设置页所有四节始终渲染（模式单选只改 `mode`，不做条件隐藏）；Provider 文本字段用按 id 键控的本地草稿态，写回后以服务端返回值为准。
- e2e 依赖 `.next/standalone` 产物（`scripts/start-e2e-server.mjs`），因此改 UI 后必须先 `npm run build` 再跑 `npm run test:e2e`，否则跑的是旧构建。

### S1 实际交付接口（继续有效）

- 渲染进程桥（仅打包应用内有值）：`window.mdConvertor.secrets`
  - `set(providerId: string, value: string): Promise<{ok: true, keyStored: true} | {ok: false, code: string}>`
  - `clear(providerId: string): Promise<{ok: true, keyStored: false} | {ok: false, code: string}>`
  - `status(): Promise<{ok: true, encryptionAvailable: boolean} | {ok: false, code: string}>`
  - `providerId` 必须匹配 `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`，否则同步抛 `TypeError`；`value` 长度 1–8192，否则同步抛 `TypeError`；IPC 失败只返回 `{ok:false, code:"IPC_FAILED"}`。
- 本地 HTTP：`GET /api/settings`、`PUT /api/settings`（完整 Settings 对象，无部分更新）；两者都要求 JSON `content-type`（GET 也要），受 `validateConvertApiCaller` 保护（打包应用由 Electron `webRequest` 注入 `x-md-convertor-token`，页面本身不发送）。
- 服务端环境变量：`MD_CONVERTOR_USER_DATA`（设置目录，缺省 `~/.md-convertor`）、`MD_CONVERTOR_SECRETS`（JSON 序列化的 provider→明文密钥 map，仅主进程注入，勿记日志）、`MD_CONVERTOR_SESSION_TOKEN`、`PATH`。Provider 密钥只有一个来源：主进程注入的运行时表（`MD_CONVERTOR_SECRETS`）。
- 测试接入点：`npm run e2e` 的服务器现在会设 `MD_CONVERTOR_SESSION_TOKEN=md-convertor-e2e-token`（`playwright.config.ts` 用 `extraHTTPHeaders` 配对发送）并把 `MD_CONVERTOR_USER_DATA` 指向每次运行新建的临时目录，因此 e2e 可以真实读写设置。

### S1 与文档的偏差（需在后续会话知晓）

- S1 文档写作 `electron/preload-api.mjs`；实现为 `electron/preload.cjs`（自包含） + `electron/preload-contract.cjs`（主进程共用的通道/限额契约） + `electron/preload.test.cjs`。原因：Electron 沙箱 preload 不能 require 相对路径，实测报 `module not found: ./preload-api.cjs`（该错误是本轮唯一一次真实 Electron 运行时故障，已由打包应用冒烟测试捕获并修复）。
- 沙箱 preload 的通道名/长度上限必须在 preload 内重复一份，`electron/preload.test.cjs` 会断言它们与 `preload-contract.cjs` 一致；改通道名时两处同改。

## Release Evidence

### 0.3.4（当前产物，已过门禁、已装本机、已发布）

- Node.js 24.15.0 `npm run desktop:release`: passed (exit 0, log `/tmp/icon-release3.log`; the first run hit a transient live-DNS failure and passed on rerun)
- Baseline `./init.sh`: 63 files / 863 tests, statements 95.28%, lint + `tsc --noEmit` clean, production build OK
- E2E: 187 passed / 2 skipped across Chromium, Firefox, and WebKit (`workers: 1`)
- Stable live comparisons: 2/2
- Production audit: no production advisories (QA-012 closed)
- ZIP: `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.4.zip`
- Bytes: `237,272,966`
- SHA-256: `6910120e004170cc1ff91d29315f883226a852cd012c3e9a1e335e6056b42704`
- Icon: `assets/icon.icns` 972,218 bytes `e8cbc7e7…48bf`; the packaged `Contents/Resources/electron.icns` hashes identically; the 230-entry asar contains 0 `/assets` and 0 `/brand` entries
- Verification: 0 entries under `server/node_modules/electron`; `unzip -t` clean; `CFBundleShortVersionString` 0.3.4; Mach-O arm64; installed at `/Applications/MD-Convertor.app` (previous build backed up at `/tmp/icon-v1-app`); packaged smoke test passed; Helper runs as `UIElement`
- Size delta: +4,325,558 bytes vs `0.3.3`, all from this build's Next.js tracing (optional `@img/sharp-wasm32` / `@emnapi/runtime` fallbacks plus three build-hash static files), not from the icon
- Published: GitHub Release `v0.3.4` (tag `e251267`, marked Latest — the commit this ZIP was built from), asset `237,272,966` bytes uploaded. This ZIP was built *after* the second icon version was put in place — extracting `electron.icns` from it yields the same `e8cbc7e7…48bf` as the committed `assets/icon.icns` — and the tag was then moved to that icon commit, so the tag, the released ZIP and `checkout v0.3.4` all agree
- Not signed or notarized (personal test only)
### 0.3.3（历史产物，已过门禁、已装本机、已发布；`out/` 内的 ZIP 已不在本机）

- Node.js 24.14.1 `npm run desktop:release`: passed (exit 0, log `/tmp/s18b-release.log`; the earlier attempt under the default Node 24.16.0 died with `Expected ZIP was not generated`)
- Baseline `./init.sh`: 62 files / 859 tests, statements 95.28%, lint + `tsc --noEmit` clean, production build OK
- E2E: 178 passed / 2 skipped across Chromium, Firefox, and WebKit (`workers: 1`)
- Stable live comparisons: 2/2
- Production audit: no production advisories (QA-012 closed)
- ZIP: `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.3.zip`
- Bytes: `232,947,408`
- SHA-256: `1bf807dfe294860c24345efe5caf2b0fcbd54f88476df7085c9bd03b47b37a72`
- Verification: the packaged server no longer carries a second `node_modules/electron` (~120 MiB smaller ZIP); Playwright, Playwright Core, the Sharp arm64 packages and the bundled Chromium headless shell are retained; installed at `/Applications/MD-Convertor.app` (previous `0.3.2` backed up at `/tmp/s18-old-0.3.2.app`)
- Published: GitHub Release `v0.3.3`, tag `3897cd1` (the commit this ZIP was built from); asset `232,947,408` bytes uploaded, and the server-side SHA-256 matches the local ZIP
- Not signed or notarized (personal test only)

### 0.3.2（历史产物，已过门禁、已装本机、已发布）

- Node.js 24.15.0 `npm run desktop:release`: passed (exit 0, log `/tmp/s17-release.log`)
- Baseline `./init.sh`: 62 files / 858 tests, statements 95.28%, lint + `tsc --noEmit` clean, production build OK
- E2E: 178 passed / 2 skipped across Chromium, Firefox, and WebKit (`workers: 1`)
- Stable live comparisons: 2/2
- Production audit: no production advisories (QA-012 closed)
- ZIP: `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.2.zip`
- Bytes: `358,726,788`
- SHA-256: `8fb7a93f33a07bb03b0b8558df4ff0c2abe40a14eee13fd9dc0348fedcc7f1ba`
- Verification: child server registered on `Contents/Frameworks/MD-Convertor Helper.app` with `type="UIElement"`; Dock shows one tile only; installed at `/Applications/MD-Convertor.app`
- Published: GitHub Release `v0.3.2`, tag `1c3ed80` (the commit this ZIP was built from); asset size `358,726,788` uploaded
- Not signed or notarized (personal test only)

### 0.3.1（历史产物，已通过门禁并已发布）

- Node.js 24.15.0 `npm run desktop:release`: passed (exit 0, log `/tmp/s16-release.log`)
- Baseline `./init.sh`: 61 files / 855 tests, statements 95.28%, lint + `tsc --noEmit` clean, production build OK
- E2E: 178 passed / 2 skipped across Chromium, Firefox, and WebKit (`workers: 1`)
- Stable live comparisons: 2/2
- Production audit: no production advisories (QA-012 closed)
- ZIP: `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.1.zip`
- Bytes: `358,723,706`
- SHA-256: `c7411c587b3842a76f79118ecdc6d061993a0a99c98e4801c14ff947f10e161b`
- Published: GitHub Release `v0.3.1` (tag `af7f6db` = the commit this ZIP was built from); installed at `/Applications/MD-Convertor.app`
- Not signed or notarized (personal test only)

### feat-027 / feat-028（未跑门禁）

- RED：`openai-compatible.test.ts` 读体超时用例 1 failed / 10 passed（实收 502 期望 504）；`limits.test.ts` 推理模型用例 1 failed / 3 passed；e2e「当前生效」用例首条断言失败。
- GREEN：`npx vitest run src/lib/translate/` → 12 files / 198 tests；`npx playwright test e2e/settings.spec.ts --project=chromium` → 19 passed；`./init.sh` exit 0（59 files / 839 tests、95.26%，`/tmp/s9-init.log`）；`npm run test:e2e` → 157 passed / 2 skipped（`/tmp/s9-e2e.log`）。
- 真机（打包应用，服务端口 63338 / CDP 9222，自撰探针）：3 段 ⇒ `ANALYZE 200 @ 16011ms` / `RUN 200 @ 26834ms`；60 段 121 块 ⇒ `ANALYZE 200 @ 78869ms` / `RUN 200 @ 284433ms`；修复前同探针为 `502 @ 60011ms` 与 `RUN 502 @ 60039ms`。模式 radio 位置三次切换逐项相等（`x/y` 相同），`当前生效` 计数恒 0；测试后 `settings.json` 已还原为 `mode: cloud` + `mimo-v2.5-pro`。
- 产物内容：`Contents/Resources/server/.next/server/chunks/src_lib_translate_limits_ts_0a46et0._.js` 含 `Math.max(12e4,18e4*e+3e4)`。

### feat-025 设置页 UI 反馈与页头清理（未跑门禁）

- 改动：主页删「本机处理 · 不保存内容」+ 齿轮改为带文字的「⚙ 设置」入口；设置页模式区改为标题卡片「翻译服务提供方」+ 挂在选中项上的「当前生效」标签；隐藏自定义语言入口；页头保存状态胶囊（保存中…/已保存/未保存）+「返回转换」按钮（等待在途保存）
- 测试：`./init.sh` exit 0（`/tmp/s7-init.log`）—— 59 files / **839 tests**、statements 95.27%、lint + `tsc --noEmit` + build 全绿；`npm run test:e2e` **154 passed / 2 skipped**（`/tmp/s7-e2e-final.log`）；RED 证据 `/tmp/s7-red.log`（6 failed / 23 passed）
- 真机：`npm run desktop:package` exit 0（`/tmp/s7-package3.log`）→ 截图 `/tmp/v2-home.png`、`/tmp/v2-settings.png`、`/tmp/v2-settings-local.png`；截图期间改动的 `mode` 已还原为 `cloud`
- **未跑 `npm run desktop:release`**：与 `feat-024` 一样，需先确定版本号

### feat-024 长文翻译超时修复（历史，未跑门禁）

- 现象：真机（`pi` + `deepseek-flash`）翻译 9,100 字文章报「翻译任务超时」；日志 `{"status":504,"code":"TRANSLATE_TIMEOUT","durationMs":120006}` = 固定 120s 上限
- 根因：批次数由「≤20 块」主导而非字符数；实测 `pi` 不慢（小 prompt 1–2s，8,000 字符批次 7s）
- 修复：`translateTaskTimeoutMs(batchCount) = max(120s, 批次数 × 60s + 30s)`，`analyze`/`run` 均按真实批次数决定 deadline（`src/lib/translate/limits.ts`、`run.ts`）
- 测试：`./init.sh` exit 0（`/tmp/s6-dyn-init.log`）—— 59 files / **839 tests**、statements 95.27%、lint + `tsc --noEmit` + build 全绿；RED→GREEN 证据见 `PROGRESS.md`
- 真机：`npm run desktop:package` exit 0（`/tmp/s6-dyn-package.log`）→ `out/MD-Convertor-darwin-arm64/MD-Convertor.app` 重测成功（服务端无 `TRANSLATE_TIMEOUT` 行）
- **未跑 `npm run desktop:release`**：下方 0.3.0 数值仍是修复前构建

### 0.3.0（历史产物，修复前构建；已被 `0.3.1` 取代）

- Node.js 24.15.0 `npm run desktop:release`: passed (exit 0, log `/tmp/s6-release-3.log`, 0 ERROR lines)
- Baseline `./init.sh`: 58 files / 835 tests, statements 95.25%, lint + `tsc --noEmit` clean, production build OK
- E2E: 142 passed / 2 skipped across Chromium, Firefox, and WebKit (`workers: 1`)
- Stable live comparisons: 2/2
- Packaged smoke: preload bridge + runtime secret round trip passed (exit 0)
- Production audit: 1 critical / 1 high / 1 moderate — see QA-012 (open)
- ZIP: `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.0.zip`
- Bytes: `358,562,540`
- SHA-256: `2a0e236e97e51d97fd24c7002a923ef5703ad8245234531f2eb3aa1350c81147`
- Not published to GitHub Releases; superseded by the `0.3.1` release
- Not signed or notarized (personal test only)

### 0.2.1（历史锚点，已列入 `PROTECTED_HISTORICAL_ZIP_MANIFEST`）

- Node.js 24.14.1 `npm run desktop:release`: passed
- Unit/security/integration tests: 322/322
- E2E: 60/60 across Chromium, Firefox, and WebKit
- Stable live comparisons: 2/2
- WeChat diagnostic: 12/12 code blocks and 279 lines matched in memory
- ZIP: `~/Downloads/MD-Convertor-archive/releases/MD-Convertor-darwin-arm64-0.2.1.zip`（重下并逐字节校验）
- Bytes: `354,635,067`
- SHA-256: `32c1d96af58a7701e6d2fe0bf619be0f8f224803355c6ef63aad43c85569463e`
- GitHub Release: https://github.com/haohaiHuang/MD-Convertor/releases/tag/v0.2.1

## Important Boundaries

- Node.js 24, Next.js 16, Electron, npm, TypeScript strict.
- TDD is mandatory for every code change.
- Only `darwin/arm64` is supported.
- `v0.1.3` remains an immutable historical tag at `ce041c9`.
- Old builds are not kept in the current repository workspace; release guards hash-check every historical ZIP that still exists in the external archive and report a missing entry as retired (user-authorized change on 2026-09-18, see `PROGRESS.md`).
- The app is unsigned and not notarized, so it is a personal-test build rather than a frictionless public distribution.
- Never store or print webpage bodies, clipboard content, cookies, tokens, or private URLs in tests or logs.
- 0.3.0 新增边界：翻译请求的正文与密钥同样不得写入日志或落盘；Provider 端点校验（放开 loopback/私网、禁跨主机重定向）与网页抓取 SSRF 策略是两套独立实现，不得互相放宽。
- S2 新增边界：四个新路由的日志仅 `{requestId,status,code,durationMs}`；`/api/runtime/secrets` 请求体一律不持久化、不记录；本地 CLI 子进程环境必须剔除 `MD_CONVERTOR_*`（含 `MD_CONVERTOR_SESSION_TOKEN`、`MD_CONVERTOR_SECRETS`）。
- S3 新增边界：两个翻译端点的请求体（正文、analysis）与模型输出都不落盘、不记日志；发往模型的 prompt 只含待翻译块（`skip` 段与元信息行不进入 prompt）；CLI 的 stdout/stderr 永不回显（非零退出只报状态码与退出码）；错误消息不回显正文、密钥或 URL query；翻译任务全程只允许一个在跑。
- S4 新增边界：页面只把用户勾选后的正文发给 `/api/translate/*`，不自动上传、不写历史；译文只存在于页面状态与下载/复制结果中，不落盘；错误提示只回显服务端 `error.message` 或内置文案，绝不显示正文、密钥、CLI 输出；e2e 不得把真实网页正文或密钥写入仓库。
- S5 新增边界：确认框与提示只展示占比百分比与目标语言名，不回显正文片段；「不翻译」路径不发任何翻译请求；e2e 用改写 analyze 响应构造占比，绝不把真实网页正文写入仓库。
- `feat-025` 新增边界：自定义语言入口已从设置页隐藏，但 `languages.custom` 字段与 `addCustomLanguage()` 及单测保留（存量自定义标签仍出现在目标语言下拉里）；要恢复入口只需恢复 `settings/page.tsx` 的那段 JSX 与 `setNote("language", …)` 分支。

## Next Stage Entry

- S1 → S6 全部完成；`feat-024` – `feat-039` 均 done；当前 `activeFeature` = `feat-041`（默认 MD 保存路径，**in-progress：S1 done 并提交 `ac8f91a`，S2 done 并提交 `f9b7534`，S2 真机缺陷（iCloud 路径校验 + 静默失败）已修复并单独提交，重新打包与真机复验均已完成，只剩用户签字**）。
- 下一轮入口是 `feat-041` 的 S3 发布收口：按 `docs/features/default-save-path/S3-release.md` 执行。**版本已是 `0.3.6`（S1 的 T1.0 已完成升级），S2 不需要再 bump**；再改代码前若已发布 0.3.6 才需 bump 到 ≥ `0.3.7`。开工前先把用户侧那两件事（真机两态签字 + firefox e2e）要掉，并先收窄 `forge.config.cjs` 的 asar ignore。
- 每轮开头固定读：`PROGRESS.md` → `session-handoff.md` → `feature_list.json` → 相关 `docs/`（涉及翻译行为时先读 `docs/PRD-translation.md`），然后跑 `./init.sh` 建立基线。
- 全部阶段文档（已完成入口）：`docs/features/translation/S1-settings-infra.md` 至 `S6-release-and-docs.md`；各文档的 Handoff 已写入下一阶段所需的真实接口与边界。

### S6 已完成要点（保留作背景）

- 版本面：`currentVersion`/`package.json`/`package-lock.json` 均为 `0.3.0`，门禁只接受 `0.3.0`；`feat-023` 已 `done`。
- ⚠️ 历史提示：`feat-024` 之后这条约束需要重新决策（见 `## Next Stage Entry`）；在那之前不要直接跑 `desktop:release` 后拿新哈希覆盖文档而没有版本判断。
- 门禁语义（方案 A）：缺档案报 retired 并继续，存在的归档照旧硬校验哈希，未登记 ZIP 与 `v0.1.3` 标签仍硬失败；`0.2.1` 已加回清单。
- 覆盖率未调整（已是逐文件门槛）；0.3.0 S6 时全量为 58 files / 835 tests、statements 95.25%；`feat-024` 之后为 59 files / 839 tests、95.27%。
- e2e 全量：142 passed / 2 skipped（Chromium/Firefox/WebKit，`workers: 1`）；改动 UI 后必须先 `npm run build` 再跑 e2e。
- `CHANGELOG.md` / `CHANGELOG.zh.md` 的 `[Unreleased]` 已整段归档为 `[0.3.0] - 2026-09-18`。
- 0.3.0 全部改动（S1–S6）当时留在未提交的工作区；已在 `v0.3.1` 那轮作为 `0caa564` 提交（此后每轮发布都另有独立的文档提交，S1–S6 的改动均已入库）。
- 打包环境：`node_modules/electron/dist` 已存在，无需重新下载。

### S5 已落地要点（详情见 `S5-language-ratio.md` 的 Handoff）

- 阈值决策只有一处：`decideTranslation()`（`src/lib/translate/decision.ts`，常量 `SKIP_RATIO` / `CONFIRM_RATIO` 同文件）；页面侧用 `translationScopeRef` 承载用户选择，已无占位函数。跳过路径（≥97% / 空散文 / 用户选「不翻译」）都不发 `run` 请求，也不显示译文 Tab。
- 局部翻译保真由 `src/lib/translate/run.test.ts` 的 golden 用例锁定（标记法：翻译结果包成 `«…»`，去标记后必须与输入逐字节一致）。
- e2e 造特定占比只能改写 `/api/translate/analyze` 的响应（不要手写整个 analyze 响应，否则 `run` 会 409 `TRANSLATE_ANALYSIS_STALE`）；fixture 用等长段落才能得到精确占比。
- `vitest.config.ts` 的 coverage `include` 是 `src/lib/**/*.ts` glob，新模块自动纳入统计，但**逐文件门槛要手动加**（95/90/100/95）。

## Environment Notes

- 网络（2026-09-18 实测）：`github.com` 返回 200、`api.github.com` 可用（2026-09-17 记录的不可达已不成立）；GitHub releases 上只有 `v0.2.1` 带资源、`v0.2.0` 无资源，因此 0.1.x 历史 ZIP 无法从 GitHub 取回。若 `node_modules/electron/dist` 再次缺失，用 `ELECTRON_MIRROR=https://registry.npmmirror.com/-/binary/electron/ npx install-electron`。
- 代理（2026-09-20 实测）：本机 `ALL_PROXY` / `HTTPS_PROXY` 指向 `127.0.0.1:7897`，当时客户端在监听但转发已坏 —— `gh`、`curl` 报 `EOF` / `SSL_ERROR_SYSCALL`，`git fetch` / `git push` 同样失败，**直连正常**。发布 `v0.3.3` 时用直连绕过：`git -c http.proxy= -c https.proxy= push|fetch origin`，`gh` 则先 `unset ALL_PROXY HTTPS_PROXY HTTP_PROXY`。下次再遇到 `EOF` 先试直连，不要以为是 GitHub 挂了。
- Playwright 浏览器：`npx playwright install chromium firefox webkit`（当前 revision 1228 / 1532 / 2311），缺浏览器时 `npm run test:e2e` 会直接报缺可执行文件。
- `MD_CONVERTOR_TEST_PROVIDER=1` 是测试/e2e 专用开关（内置伪模型，不联网）；生产未设置时该分支不可达。生产路径的环境变量仍是 `MD_CONVERTOR_USER_DATA` / `MD_CONVERTOR_SECRETS` / `MD_CONVERTOR_SESSION_TOKEN` / `PATH`。
- **Firefox e2e 在本 agent 环境无法运行（2026-09-22 实测）**：Playwright Firefox 启动时要再套一层 macOS seatbelt，报 `Sandbox error: sandbox_init() failed with error "Operation not permitted"` 后进程退出，表现为**每个用例 30s 超时**。同一用例 chromium / webkit 均绿（`/tmp/s2-wk-probe.log`：webkit 1 passed in 2.4s），故属环境限制而非代码缺陷。三引擎 e2e 必须由用户在普通终端补跑；在本环境请用 `npx playwright test --project=chromium --project=webkit`。
- **代理会污染 Playwright（2026-09-22）**：环境注入 `HTTP_PROXY=http://127.0.0.1:50291`，Playwright 会继承它——`connectOverCDP` 报 `Unexpected status 502`。跑任何 Playwright / 网络命令前先 `unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy` 并设 `NO_PROXY=127.0.0.1,localhost no_proxy=...`；系统代理则是 Clash 的 `127.0.0.1:7897`（Firefox 跟随、Chromium 不跟随）。
- **打包应用在本 shell 里的启动姿势（2026-09-22）**：环境注入 `ELECTRON_RUN_AS_NODE=1`，会让 Electron 当纯 Node 跑并报 `bad option: --remote-debugging-port=9222`；取消后 Chromium 自己的沙箱又被宿主 seatbelt 拒（`Failed to initialize sandbox ... Operation not permitted` → GPU 进程崩溃）。探针用 `unset ELECTRON_RUN_AS_NODE` + `--no-sandbox --disable-gpu --remote-debugging-port=9222` 跑通；**`--no-sandbox` 仅为探针用，正常双击启动不受影响**。另注意后台 `&` 起的应用进程会在该次 Bash 调用结束时被回收，启动与探针要放进同一条命令；zsh 下 `rm -f dir/*` 遇无匹配会报错并中断整条 `&&` 链，改用 `find dir -type f -delete`。
- **`MD_CONVERTOR_USER_DATA` 无法隔离打包应用（2026-09-22 实测）**：`electron/env.mjs` 的 `buildServerEnv()` 无条件写入 `MD_CONVERTOR_USER_DATA: userDataDir`（注释原文「the MD_CONVERTOR_* keys are always authoritative」），主进程算出的目录永远赢，启动前设这个变量**没有任何效果**。因此真机探针必然读写用户真实的 `settings.json`、并把文件写进开关当前指向的真实目录（本次真的写进了用户的 iCloud 云盘）。探针必须五步收尾：备份真实 settings.json → 跑 → 逐字段比对证明 `output` 之外未被改动（页面 PUT 是整份替换）→ 还原 `defaultPath`/`useDefaultPath` → 删除落在真实目录里的探针文件。

## Recommended Next Action

`feat-041`（默认 MD 保存路径）**S1 已提交（`ac8f91a`）、S2 已提交（`f9b7534`）、真机缺陷已修复并单独提交，且已重新打包 + 真机复验通过**（S1 契约 + IPC + 设置页输出卡片；S2 主页面三态分叉 + 降级 + 反馈条 + 真机两态探针；修复 iCloud 路径被路径校验拒掉 + preload 抛异常被 `void` 吞掉导致的「点下载毫无反应」）；S3 文档就绪。**新会话开工提示词见本文件顶部「新会话开工提示词（复制即用）」**。下一步：
1. **要用户做两件事**（包已就绪，不用再打）：① 亲手过一遍真机两态（开开关 → 不弹框且文件落进 iCloud 的 `Note/未归档`；关开关 → 弹框）——开关当前是关的，`defaultPath` 已就位，开开关即可测；② 在普通终端跑 `npm run test:e2e` 补 **firefox** 引擎（本 agent 环境跑不了 Firefox，原因见 Environment Notes）。
2. **然后按 `docs/features/default-save-path/S3-release.md` 收口**：`npm run desktop:release`、本机安装、GitHub Release、文档收口。发布前先收窄 `forge.config.cjs` 的 asar ignore（当前把 `.workbuddy/`、`PROGRESS.md`、`session-handoff.md`、`feature_list.json`、`docs/` 都打进了包——实证：修复后新包 `app.asar` 里残留的 6 处 `value.includes("~")` 全部来自这些文档，不是代码）。
3. **跑门禁必须用 Node 24.14.1 或 24.15.0**：本机默认 v24.16.0 在解压 electron zip 时静默卡死，`electron-forge make` 空跑却仍返回 exit 0。
4. **断言真实 errno 的测试在本 agent 环境要用 `NODE_OPTIONS=` 跑**：WorkBuddy 通过 `NODE_OPTIONS` 注入 brokered-fs shim，会把 `ENOTDIR`/`EPERM` 变成 `CODEBUDDY_BROKER_DENY`。`NODE_OPTIONS= ./init.sh` 即全绿（67 files / 955 tests）。
5. **真机小点**：等用户给清单后再评估是否单开一轮。
6. **云端 Provider 端到端实测**：`feat-027` 的自撰探针已绿，仍需用户用真实文章在设置页走一遍「拉取模型 → 选模型 → 翻译」。
7. **签名/notarization 用户 2026-09-20 决定不做**（QA-008 accepted / not planned）；要恢复需 Developer ID Application 证书 + notarytool 凭据，签名后必须重跑门禁更新哈希。
8. **UI 评审结论勿重提**：`docs/UI-REVIEW-2026-09-20.md` 的 P0×6 + P1×10 用户已决定全部不改；主页像素级断言（转换按钮右边缘与粘贴框右边缘差值 < 4px 且与「来源 URL」输入框同行）继续是刻意锁定的效果，要改先改断言。

不要重做 S1 与 S2 及之前全部已完成 feature（含 `feat-024` – `feat-040`）；不要把下载分叉扩成「另存为」对话框（FSD 非目标：用户要的是「不再弹」）；不要改成「只报笼统文案」——`OUTPUT_CODE_MESSAGES` 的六个真实 fs 码是 S2 的明确决策（见 S2 文档「决策记录」）；**不要把 `isAbsoluteDirPath` 收紧回 `value.includes("~")`**（那正是本次真机缺陷的根因，iCloud 云盘目录会被全部拒掉）；**不要给任何 `await bridge.*` 去掉 `.catch()`**（preload 是抛异常而非 resolve `{ ok: false }`）；不要放宽端点、密钥或归档守卫；不要把已退役的历史 ZIP 条目从 `PROTECTED_HISTORICAL_ZIP_MANIFEST` 中删除。
