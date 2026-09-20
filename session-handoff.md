# Session Handoff

## Resume Here

- Current version: `0.3.3`（`package.json`、锁文件、`feature_list.json` 与发布门禁均为 `0.3.3`）。**已跑 `npm run desktop:release`（2026-09-20，exit 0）**：`out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.3.zip`，`232,947,408` bytes，SHA-256 `1bf807dfe294860c24345efe5caf2b0fcbd54f88476df7085c9bd03b47b37a72`。已安装到 `/Applications/MD-Convertor.app`（替换 `0.3.2`，未压缩 539 MB）。**尚未提交、尚未发布**（`v0.3.2` 仍是最新 Release）。未签名，仅适合个人测试
- Active feature: none（`feat-024` – `feat-034` 均已 done）
- Pending: ① **提交与发布 `v0.3.3`**（改动已过门禁、已装本机，尚未提交；用户授权后先跑提交门 ponytail → code-review → neat-freak，再一次提交 + `git push origin main` + `gh release create v0.3.3 <zip> --target main`）；② **跑门禁必须用 Node 24.14.1 或 24.15.0** —— 本机默认的 **v24.16.0 在解压 electron zip 时会静默卡死**，`electron-forge make` 因此空跑并仍返回 exit 0（`nvm use 24.14.1` 后一次通过）；③ **真机小点**（用户提到「稍后把真机测试的一些小点完善了再说」，等清单）；④ **云端 Provider 端到端实测**（`feat-027` 探针已绿，仍需用户用真实文章在设置页走一遍）；⑤ 任何代码改动都需新版本号（≥ `0.3.4`）并重跑门禁（门禁硬校验目标版本）；⑥ **UI 评审已完成（`0.3.1`），用户看过对照板后决定全部不整改** → 记录见 `docs/UI-REVIEW-2026-09-20.md`（对照板是临时文件，已删），不要重提这批发现（除用户指认具体条目）；⑦ 签名/notarization 用户 2026-09-20 决定不做（QA-008 accepted）
- Branch: `main`；`feat-031` + `feat-032` 已提交（`af7f6db`）并推送，`v0.3.1` tag 指向 `af7f6db`（**不要移动/覆盖已发布的 tag 与产物**）；`feat-033` 已提交（`1c3ed80`）并发布为 `v0.3.2`（tag 指向 `1c3ed80`）；`feat-034`（`0.3.3`）**未提交**
- Product scope: local Apple Silicon Mac app with Link Conversion, Rich Text Conversion and document translation
- Planning docs: `docs/PRD-translation.md`, `docs/features/translation/FSD.md` + `S1`–`S6` 阶段执行文档
- Full historical project records: `~/Downloads/MD-Convertor-archive/docs/pre-v0.2.1/`
- Historical release ZIP: `~/Downloads/MD-Convertor-archive/releases/MD-Convertor-darwin-arm64-0.2.1.zip`（已重下并校验哈希；0.1.0–0.2.0 与 0.1.3 副本永久丢失）

## Latest Change

**本轮（`feat-034`：去掉重复的 Electron 运行时 + 版本 `0.3.3`，已过门禁、已装本机，未提交）**：用户报告「跑得好慢」，实测发现 `electron-forge make` 在本机**经常空跑**：直接运行时无产物、退出码却是 0（发布脚本自身有产物校验，缺 ZIP 会抛 `Expected ZIP was not generated`，所以空跑/卡住的是 Forge 这一层）。① 根因两层：本机默认 Node **v24.16.0** 在解压 electron zip 时卡死在 204727/272259 字节（yauzl 管道回归），换 nvm 的 **v24.14.1** 后一次通过（另一台机器 24.15.0，故从未遇到）；同时发现应用被装了**两份** Electron —— `next build` 的输出追踪跟着 `playwright-core` 的 `require("electron")` 把整个 `electron` 包（含 276 MB 二进制）拷进 `.next/standalone`，而应用服务端代码**零处**引用 electron。② 修复（TDD）：`scripts/prepare-desktop.mjs` 在 `cp(sourceRoot, targetRoot, …)` 后加 `rm(targetRoot/node_modules/electron)`（4 行注释说明原因）；`scripts/prepare-desktop.test.mjs` 新增集成回归（server 不得含 `node_modules/electron`，同时保留 Playwright、Playwright Core、Sharp arm64 包与内置 Chromium Headless Shell），RED 失败 → GREEN 通过。③ 版本 `0.3.3`（TDD）：`scripts/release-guards.test.mjs` fixture `0.3.2`→`0.3.3` ⇒ RED **5 failed / 24 passed**（`Release version must be 0.3.2.`），再改 `scripts/release-desktop.mjs`、`package.json`、`package-lock.json`、`feature_list.json` ⇒ 全通过。④ 门禁（Node.js **24.14.1**，日志 `/tmp/s18b-release.log`）**exit 0**：`./init.sh` 62 files / **859 tests**、statements 95.28%、三浏览器 e2e **178 passed / 2 skipped**、live **2/2**、产物 `MD-Convertor-darwin-arm64-0.3.3.zip` `232,947,408` bytes、SHA-256 `1bf807dfe294860c24345efe5caf2b0fcbd54f88476df7085c9bd03b47b37a72`（独立复算一致）。⑤ 体积：对比 `0.3.2` 的 `358,726,788` bytes 少 **125,779,380 bytes ≈ 120 MiB（−35%）**，未压缩 843 MB → **539 MB**；ZIP 内 `server/node_modules/electron` 条目 = 0，`playwright` / `playwright-core` / `next` / `chrome-headless-shell` 都保留。⑥ 安装：`/Applications/MD-Convertor.app` 由 `0.3.2` 换为 `0.3.3`（旧版备份 `/tmp/s18-old-0.3.2.app`），安装后冒烟 `ELECTRON_SMOKE_TEST=1 ELECTRON_SMOKE_TEST_SECRETS=1` **exit 0**（`/tmp/s18-smoke.log`）：preload 桥 + 运行时密钥往返都通过。⑦ 文档已同步：`CHANGELOG`(+zh) 新增 `[0.3.3] - 2026-09-20`、`README`(+zh)、`docs/ARCHITECTURE`(+zh)、`docs/TESTING`(+zh)（0.3.2 降为历史产物）、`PROGRESS`、`feature_list.json`（`feat-034` done、`currentVersion 0.3.3`）。⑧ 已知误报：pi-lens 对 `scripts/prepare-desktop.mjs` L10/L22 报 `JSON.parse` 未包 try/catch —— 这两行改动前就存在（HEAD 逐字节相同），且构建脚本读不到依赖本就该立刻失败，未改动。⑨ **未提交、未发布**：`v0.3.2` 仍是最新 Release，提交门与发布待用户授权。

**本轮（`feat-033`：程序坞幽灵图标修复 + 版本 `0.3.2`，已过门禁、已装本机、已发布 `v0.3.2`）**：用户发现打包应用运行期间程序坞多出一个黑色通用可执行文件图标且一直跳动，问要不要修，给出方案 A（只改源码，以后再发版）/ B（升 0.3.2 修好就跑完整门禁并发布），用户选 **B**。① 根因：`electron/main.mjs` 用 `spawn(process.execPath, [serverEntry], …)` 启本地服务，而 `process.execPath` 就是应用包自己的主可执行文件，macOS LaunchServices 因此把 Node 子进程当成「第二次启动 MD-Convertor」（`type="Foreground"`、`parentASN="MD-Convertor"`），而该子进程从不连接 WindowServer、图标永远跳不完。② 修复（TDD）：新增纯模块 `electron/server-binary.mjs`（`resolveServerBinary(execPath)` ⇒ `Contents/Frameworks/<基名> Helper.app/Contents/MacOS/<基名> Helper`，缺失时抛 `Desktop helper runtime is missing: <path>`）与 `electron/server-binary.test.mjs`（3 用例）；`electron/main.mjs` 改用该 helper 启动（仍是同一个 Electron 二进制，靠 `ELECTRON_RUN_AS_NODE=1` 以 Node 运行），helper bundle 声明 `LSUIElement` ⇒ 不占程序坞。无需改打包配置、无需新增素材。③ 版本 `0.3.2`：`scripts/release-guards.test.mjs` 先把 8 处 fixture 从 `0.3.1` 改成 `0.3.2`（`release-guards` ⇒ RED **5 failed / 24 passed**），再改 `scripts/release-desktop.mjs`、`package.json`、`package-lock.json`、`feature_list.json` ⇒ **32 passed**。④ 真机证据：修复前 `lsappinfo list` 里子进程挂在应用包上且 `type="Foreground"`，修复后挂在 `Contents/Frameworks/MD-Convertor Helper.app` 且 `type="UIElement"`（打包应用与安装后应用都验过）；程序坞截图 `pair-before.png`（应用图标 + 黑色 exec）与 `pair-after.png` / `pair-installed.png`（只剩应用图标）。⑤ 门禁（Node.js 24.15.0，日志 `/tmp/s17-release.log`）**exit 0**：`./init.sh` 62 files / **858 tests**、statements 95.28%、三浏览器 e2e **178 passed / 2 skipped**、live **2/2**，产物 `MD-Convertor-darwin-arm64-0.3.2.zip`，`358,726,788` bytes，SHA-256 `8fb7a93f…f1ba`；独立复核 `unzip -t`、版本 `0.3.2`、arm64、asar 内含 `server-binary.mjs`。⑥ 安装：`ditto /tmp/s17-app/MD-Convertor.app /Applications/MD-Convertor.app`（旧 `0.3.1` 备份 `/tmp/s17-old-0.3.1.app`），安装后子进程同样为 `UIElement`，`settings.json` SHA-256 未变（`93204f32…30b4`）。⑦ 文档同步中：`CHANGELOG`(+zh) 的 `[Unreleased]` 已归档为 `[0.3.2] - 2026-09-20`，`README`(+zh)、`docs/ARCHITECTURE`(+zh)、`docs/TESTING`(+zh)、`docs/QUALITY-AUDIT`、`PROGRESS`、`feature_list.json`（`feat-033` done、`currentVersion 0.3.2`）已更新。⑧ 发布：一次提交 `1c3ed80`「0.3.2：修复运行时的程序坞幽灵图标」（含代码 + 全部文档）已推送，`gh release create v0.3.2 <zip> --target main --title "MD-Convertor v0.3.2"` 成功，`git fetch --tags origin` 后本地 tag `v0.3.2` → `1c3ed80`，资产 `358,726,788` bytes 状态 uploaded。
**本轮（发布 `v0.3.1` 并安装到本机）**：用户要求「提交Github，然后发布最新的Release到Github，并且安装到本机（替换旧版）」。① 提交门（自审，`subagent` 在本机不可用）：ponytail 无过度工程（无新依赖、CSS 净删除、字体走 `next/font/local`）、code-review 无新增 `src/lib` 模块故无新覆盖率门槛、neat-freak 发现四处文档仍写旧计数 853（已在本轮发布记录里一并改为 855）；顺手还原了 `src/app/page.tsx` 一处属性顺序的无意义改动。② 一次提交 `af7f6db`「`0.3.1`：依赖升级、界面微调与自带 Michroma 品牌字」（`feat-031` + `feat-032` 全部改动、`docs/UI-REVIEW-2026-09-20.md`、`public/fonts/*`、`tests/brand-font.test.ts`），已 `git push origin main`（`0caa564..af7f6db`）。③ 先 `pkill` 关掉运行中的应用再跑 `npm run desktop:release`（Node.js 24.15.0，日志 `/tmp/s16-release.log`）**exit 0**：`./init.sh` 61 files / **855 tests**、三浏览器 e2e **178 passed / 2 skipped**、live **2/2**、`electron-forge make` 与产物校验通过，产物 `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.1.zip`，`358,723,706` bytes，SHA-256 `c7411c58…161b`。④ 独立复核：`unzip -t` 无错、`CFBundleShortVersionString` = `0.3.1`、Mach-O arm64、包内自带字体与仓库文件同哈希（`b12098180dae…56cf`）、CSS `--font-brand:"michroma", "michroma Fallback"`。⑤ `gh release create v0.3.1 <zip> --target main --title "MD-Convertor v0.3.1" --notes-file …`（gh 2.99.0，登录 `haohaiHuang`）；校验 tag `v0.3.1` → `af7f6db`、资产 358,723,706 bytes 状态 uploaded。⑥ 本机旧版 `/Applications/MD-Convertor.app`（`0.2.1`，mtime Aug 22）替换为 `0.3.1`（无其他安装位置，`~/Applications` 不存在）。⑦ 文档同步：`CHANGELOG`(+zh) 的 `[Unreleased]` 归档为 `[0.3.1] - 2026-09-20`，`README`(+zh)、`docs/TESTING`(+zh)、`docs/QUALITY-AUDIT`、`PROGRESS` 的产物数字与测试计数全部对齐；`scripts/release-guards.mjs` 只硬校验 `v0.1.3` tag，新增 `v0.3.1` tag 不影响后续门禁。

**上一轮（页头品牌字：去掉 MD 方块 + Michroma，已随 `0.3.1` 发布）**：用户要求「去掉左上角 MD 图标、只留标题文字」，并把品牌字换成 **Michroma**；随后用户问「字体能否直接嵌入产品代码」，于是从 `next/font/google` 改为**仓库自带**。最终方案：字体放在 `public/fonts/Michroma-Regular.woff2`（11,620 bytes、latin 子集）、许可证放在同目录 `public/fonts/OFL.txt`（OFL 1.1，版权行取自字体 name 表：`Copyright 2011 The Michroma Project Authors (https://github.com/googlefonts/Michroma-font)`），用 `next/font/local` 加载 —— 构建期是**本地文件读取，整个构建不再需要联网**（用 `sandbox-exec -p '(version 1)(allow default)(deny network*)' npm run build` 实测通过，并先用同一沙箱跑 `fetch('https://fonts.gstatic.com/...')` 得 ENOTFOUND 证明沙箱真的断网）。**只 vendored latin**：`next/font/local` 不产出 `unicode-range`，latin + latin-ext 一起传会生成两条同描述符的 `@font-face`，后者对所有字形生效而它没有 ASCII ⇒ 品牌字会回退 Arial。Michroma 只有 400 字重、无中文字形 ⇒ 只用在纯拉丁的品牌字上（hero 大标题是中文，不受影响），`font-weight` 760→400、去掉 `-0.03em` 负字距（Michroma 本身宽）、字号 15px。改动：`src/app/layout.tsx` 用 `localFont({src:"../../public/fonts/Michroma-Regular.woff2", weight:"400", variable:"--font-brand"})` 并挂 `<html className>`；两个页面删掉 `<span className={styles.brandMark}>MD</span>`，两处 `.brand` 用 `var(--font-brand)` 并删除 `.brandMark` 规则；`prepare-desktop.mjs` 已把 `public/` 整拷进包内，故许可证无需改打包脚本。TDD：两个 spec 的用例 RED **2 failed / 35 passed**（实收 `"MDMD-Convertor"`）⇒ chromium **37 passed**；新增 `tests/brand-font.test.ts` 先 RED（ENOENT）再 2 passed。切到 `next/font/local` 后族名由 layout.tsx 的绑定名生成（`"michroma"` / `"michroma Fallback"`），断言由字面 `"Michroma"` 改为 `/michroma/i` 并补上「页面实际加载的 woff2 与仓库文件 SHA-256 相等」（比原来更强）。`./init.sh` exit 0（61 files / **855 tests**、95.28%，`/tmp/s15-init.log`）；三浏览器 `npm run test:e2e` exit 0 ⇒ **178 passed / 2 skipped**（`/tmp/s15-e2e2.log`；首跑 1 个 firefox 用例 `NS_ERROR_PROXY_CONNECTION_REFUSED` 属 e2e server 掉线的已知偶发，单跑 firefox 59/1 skipped 全绿）；`npm run desktop:package` exit 0，包内 `server/.next/static/media/Michroma_Regular-s.p.*.woff2` 与仓库文件同哈希、`server/public/fonts/{Michroma-Regular.woff2,OFL.txt}` 都在；真机 CDP 探针：family `michroma`、品牌框 143×21、唯一字体请求来自应用自身、0 个 Google 请求，`settings.json` SHA-256 未变（`93204f32…30b4`）。CHANGELOG(+zh) 的 `[Unreleased]` 已按新的「仓库自带」说法改写；`feature_list.json` 的 `feat-032` 证据与 notes 已更新。

**上一轮（`feat-031`：版本 `0.3.1` + 依赖升级 + 界面三项 + 密钥框只读，已随 `0.3.1` 发布）**：用户一次提了 9 项，本轮落地其中 6 项（另 3 项：发布到 GitHub Releases 与真机小点用户选「稍后」，Apple 签名属问答）。① 版本按 TDD 升到 **`0.3.1`**：`scripts/release-guards.test.mjs` 先 RED，再改 `scripts/release-desktop.mjs`（`RELEASE_VERSION_ERROR` + `version !== "0.3.1"`）、`package.json`、`package-lock.json`（root 与 `packages[""]`）与 `feature_list.json` 的 `currentVersion` ⇒ `npm test -- release-guards` **29 passed**；坑：整文件替换会把「旧版本必须被拒」的 fixture 也改成目标版本（断言恒真），该 fixture 已固定为 `{ version: "0.2.1" }`。② 依赖升级（用户单独授权）：`next@16.3.5`、`sharp@0.35.4`（`@img/sharp-*` 0.35.4、`@img/sharp-libvips-*` 1.3.3），`npm audit --omit=dev` 从 3 条变 **0 漏洞** ⇒ QA-012 关闭。③ 界面：页头去掉 ⚙ 图标只留「设置」、「转换为 MD」→「转换」（两个面板）、富文本面板的转换/停止按钮移入 `.sourceRow` 紧跟 `sourceInput`，`.sourceInput` 改 `flex: 1 1 auto` 让按钮右边缘与粘贴框右边缘对齐（RED 差值 210.4375 → GREEN 0）。④ 密钥框：已保存时 `readOnly`（可聚焦，不用 `disabled`），占位「••••••••（已保存，先清除密钥再更换）」；「清除密钥」语义不变。证据：`./init.sh` exit 0（60 files / **853 tests**、statements 95.28%）；`npm run test:e2e` **172 passed / 2 skipped**；live 首跑 DNS 瞬时失败、重跑 **2/2**；`npm run desktop:package` 产物 `CFBundleShortVersionString 0.3.1` + 包内 `sharp 0.35.4`；真机 CDP 量测 `rightEdgeDelta 0`，截图 `/tmp/s13-paste-row.png`，用户真机测试通过。文档已同步 TESTING(+zh)/QUALITY-AUDIT/README(+zh)/ARCHITECTURE(+zh)/AGENTS/CHANGELOG(+zh)/PROGRESS/`feature_list.json`（`feat-031` done、`updatedAt 2026-09-20`）。

**上一轮（`feat-030` 云端配置收敛为单条 + 保存按钮位置修复，未跑门禁）**：用户改向 —— 「只保留一个云端模型录入，不需要可以追加多个模型」+ 去掉「当前使用」标签。需求分析阶段提了三问，用户选 **Q1=A**（单条云端配置）、**Q2=留**（保留名称字段）、**Q3=不留**（删掉删除按钮）。落地：`src/app/settings/page.tsx` 删除 `drafts` / `newProvider` / `ProviderDraft` / `providerDraft()` / `EMPTY_NEW_PROVIDER` / `NEW_PROVIDER_NOTE` / `patchProvider()` / `removeProvider()` / `createProvider()` / `addManualModel()`，改为单一 `cloudForm: CloudDraft`（`{name, baseUrl, keyInput, selectedModel, models}`）+ `editingProvider(cloud)`（`providers.find(id === activeProviderId) ?? providers[0] ?? null`）；只渲染一张 `<article aria-label="云端 Provider">`，头部 `[已配置/未配置] + 保存`，字段 名称 / Base URL + 拉取模型 / 模型（`<input list="cloud-models">` + `<datalist>`）/ API 密钥 + 清除密钥；`保存` 写入 `cloud: {providers:[one], activeProviderId: id}`（契约不变、无迁移、未升 `SETTINGS_VERSION`），模型不再随选择即时落盘。顺带修掉上一轮的遗留问题：Base URL 列在 `.grid` 里被压窄导致地址被截断（改为 `minmax(150px,1fr) minmax(300px,3fr)` + ≤640px 单列），模型字段的占位文案在已有模型时误报「先拉取模型」（已补回归断言，并用变异构建验证断言会转红）。RED→GREEN：`e2e/settings.spec.ts` 云端 describe 重写为 10 个用例，RED **11 failed**（含「密钥」一例）→ chromium **23 passed**；`./init.sh` exit 0（60 files / **853 tests**、statements **95.28%**）；三浏览器 e2e **169 passed / 2 skipped**；`npm run desktop:package` 后真机 CDP 实测（服务端口 62389）：卡片 1 张、旧卡片 0、`保存` 在卡片头部、`当前使用`/`设为当前`/`手填模型`/`添加模型`/`删除` 全部为 false，真实配置回填为 `Mimo` + 完整 Base URL + `mimo-v2.5-pro` + 八个黑点，截图 `/tmp/s11-cloud-card.png`。**未跑发布门禁**（版本决策未定）。

**（同一轮，前置）保存按钮位置一致性**：新建卡片原本把「保存」放在卡片底部左侧，与已保存卡片的右上角不一致 —— 已把 `保存` 移入卡片头部（`.providerHead` + `.actions`，`margin-left:auto` 右对齐，无 CSS 改动），新用例先 RED（按钮 y 在名称输入框下方）再 GREEN；该卡片已随本轮单卡片改造一并消失。

**本轮（`feat-029` 云端 Provider 保存规则与密钥占位，未跑门禁）**：用户反馈两点 —— 密钥输入框每次进设置页都是空的（担心密钥丢失），以及云端 Provider 缺必填校验。按 AGENTS.md 先做需求分析（读码 + 真机截图），用户定下：**保存时名称、Base URL、API 密钥、模型四项必填**，密钥框接受**黑点占位**（不可选中/复制/提交，`value` 保持为空，页面依旧不读回密钥库）。落地：新增纯函数 `src/lib/settings/provider-form.ts`（`providerFormError()` 按表单顺序报第一条缺失 ——「请填写 Provider 名称。」/「请填写完整的 http(s) 接口地址。」/「请先填写 API 密钥。」/「请先拉取或选择模型。」），`saveProvider()` 与 `createProvider()` 都先过这道闸、不齐全不写盘；`POST /api/provider/models` 新增**草稿模式**（`{baseUrl, apiKey}`，缺的一半回退到已保存的 Provider，仍兼容 `{providerId}`）解开「填不满就存不了、存不了就拉不到模型」的死结；「拉取模型」两种卡片都改为**只读端点**（结果进草稿态，选模型或保存才写 settings），新建卡片新增模型字段（`<input list>` + `<datalist>`，可手填）；问题类提示（校验缺失、密钥库不可用、拉取失败、模型名为空）改用警告色 `var(--warning)`，进度与成功提示仍是 muted（`notes` 值类型改为 `{text, warn?}`）。RED→GREEN：`provider-form.test.ts` 8 用例、`route.test.ts` 20 passed（草稿用例 RED 6 failed / 14 passed）、`e2e/settings.spec.ts --project=chromium` 22 passed；`./init.sh` exit 0（60 files / **853 tests**、statements **95.28%**）；三浏览器 e2e **166 passed / 2 skipped**；`npm run desktop:package` 后真机实测（服务端口 52057 / CDP 9222）：密钥框空值 + 八个黑点占位、四个缺失提示按序出现、`settings.json` 未被写入。**未跑发布门禁**（版本决策未定）。这一轮**推翻了 `feat-026` 的两点**：拉取不再「先保存草稿」，密钥框不再保留本次输入。

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

- **feat-024 – feat-033 的构建已分别进入 `0.3.1` 与 `0.3.2` 产物，两者均已过门禁、已装本机并已发布（`v0.3.1` / `v0.3.2`）；`feat-034` 的构建进入 `0.3.3`（已过门禁、已装本机）**：下次改动前先 bump 版本号（≥ `0.3.4`）。
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

### 0.3.3（当前产物，已过门禁、已装本机，尚未提交与发布）

- Node.js 24.14.1 `npm run desktop:release`: passed (exit 0, log `/tmp/s18b-release.log`; the earlier attempt under the default Node 24.16.0 died with `Expected ZIP was not generated`)
- Baseline `./init.sh`: 62 files / 859 tests, statements 95.28%, lint + `tsc --noEmit` clean, production build OK
- E2E: 178 passed / 2 skipped across Chromium, Firefox, and WebKit (`workers: 1`)
- Stable live comparisons: 2/2
- Production audit: no production advisories (QA-012 closed)
- ZIP: `out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.3.zip`
- Bytes: `232,947,408`
- SHA-256: `1bf807dfe294860c24345efe5caf2b0fcbd54f88476df7085c9bd03b47b37a72`
- Verification: the packaged server no longer carries a second `node_modules/electron` (~120 MiB smaller ZIP); Playwright, Playwright Core, the Sharp arm64 packages and the bundled Chromium headless shell are retained; installed at `/Applications/MD-Convertor.app` (previous `0.3.2` backed up at `/tmp/s18-old-0.3.2.app`)
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

## Next Stage Entry（已无待开发阶段）

- S1 → S6 全部完成，`feat-024`（长文翻译超时）与 `feat-025`（设置页 UI 反馈）也已 done；`activeFeature` 为 `null`，不要在无新授权下重启任何阶段文档。
- 若要开新一轮，入口是用户决策而非某个 S 文档：① **真机小点**（用户提过「稍后把真机测试的一些小点完善了再说」，等清单）；② QA-012 已关闭（`next@16.3.5`、`sharp@0.35.4`，`npm audit --omit=dev` 0 漏洞）；③ **云端 Provider 端到端实测**（`feat-027` 已用自撰探针在真机跑通，仍需用户用真实文章在设置页走一遍「拉取模型 → 选模型 → 翻译」）；④ 发布：`v0.3.1` / `v0.3.2` 已发布（2026-09-20）；`0.3.3`（`feat-034` 去掉重复 Electron 运行时，ZIP 小约 120 MiB）已过门禁、已装本机、**待提交与发布**；下一轮若有改动，先 bump 版本号（≥ `0.3.4`）再跑门禁。
- 每轮开头固定读：`PROGRESS.md` → `session-handoff.md` → `feature_list.json` → 相关 `docs/`（涉及翻译行为时先读 `docs/PRD-translation.md`），然后跑 `./init.sh` 建立基线。
- 全部阶段文档（已完成入口）：`docs/features/translation/S1-settings-infra.md` 至 `S6-release-and-docs.md`；各文档的 Handoff 已写入下一阶段所需的真实接口与边界。

### S6 已完成要点（保留作背景）

- 版本面：`currentVersion`/`package.json`/`package-lock.json` 均为 `0.3.0`，门禁只接受 `0.3.0`；`feat-023` 已 `done`。
- ⚠️ 历史提示：`feat-024` 之后这条约束需要重新决策（见 `## Next Stage Entry`）；在那之前不要直接跑 `desktop:release` 后拿新哈希覆盖文档而没有版本判断。
- 门禁语义（方案 A）：缺档案报 retired 并继续，存在的归档照旧硬校验哈希，未登记 ZIP 与 `v0.1.3` 标签仍硬失败；`0.2.1` 已加回清单。
- 覆盖率未调整（已是逐文件门槛）；0.3.0 S6 时全量为 58 files / 835 tests、statements 95.25%；`feat-024` 之后为 59 files / 839 tests、95.27%。
- e2e 全量：142 passed / 2 skipped（Chromium/Firefox/WebKit，`workers: 1`）；改动 UI 后必须先 `npm run build` 再跑 e2e。
- `CHANGELOG.md` / `CHANGELOG.zh.md` 的 `[Unreleased]` 已整段归档为 `[0.3.0] - 2026-09-18`。
- 0.3.0 全部改动（S1–S6）仍在**未提交**的工作区；下一会话应在其上叠加，不要重置、回滚或顺手整理，也不要自行提交。
- 打包环境：`node_modules/electron/dist` 已存在，无需重新下载。

### S5 已落地要点（详情见 `S5-language-ratio.md` 的 Handoff）

- 阈值决策只有一处：`decideTranslation()`（`src/lib/translate/decision.ts`，常量 `SKIP_RATIO` / `CONFIRM_RATIO` 同文件）；页面侧用 `translationScopeRef` 承载用户选择，已无占位函数。跳过路径（≥97% / 空散文 / 用户选「不翻译」）都不发 `run` 请求，也不显示译文 Tab。
- 局部翻译保真由 `src/lib/translate/run.test.ts` 的 golden 用例锁定（标记法：翻译结果包成 `«…»`，去标记后必须与输入逐字节一致）。
- e2e 造特定占比只能改写 `/api/translate/analyze` 的响应（不要手写整个 analyze 响应，否则 `run` 会 409 `TRANSLATE_ANALYSIS_STALE`）；fixture 用等长段落才能得到精确占比。
- `vitest.config.ts` 的 coverage `include` 是 `src/lib/**/*.ts` glob，新模块自动纳入统计，但**逐文件门槛要手动加**（95/90/100/95）。

## Environment Notes

- 网络（2026-09-18 实测）：`github.com` 返回 200、`api.github.com` 可用（2026-09-17 记录的不可达已不成立）；GitHub releases 上只有 `v0.2.1` 带资源、`v0.2.0` 无资源，因此 0.1.x 历史 ZIP 无法从 GitHub 取回。若 `node_modules/electron/dist` 再次缺失，用 `ELECTRON_MIRROR=https://registry.npmmirror.com/-/binary/electron/ npx install-electron`。
- Playwright 浏览器：`npx playwright install chromium firefox webkit`（当前 revision 1228 / 1532 / 2311），缺浏览器时 `npm run test:e2e` 会直接报缺可执行文件。
- `MD_CONVERTOR_TEST_PROVIDER=1` 是测试/e2e 专用开关（内置伪模型，不联网）；生产未设置时该分支不可达。生产路径的环境变量仍是 `MD_CONVERTOR_USER_DATA` / `MD_CONVERTOR_SECRETS` / `MD_CONVERTOR_SESSION_TOKEN` / `PATH`。

## Recommended Next Action

`feat-034`（去掉重复 Electron 运行时 + 版本 `0.3.3`）已实现、**已跑完发布门禁（exit 0，ZIP `232,947,408` bytes / SHA-256 `1bf807df…7a72`）**，已安装到 `/Applications/MD-Convertor.app` 替换 `0.3.2`，文档（`CHANGELOG`(+zh)、`README`(+zh)、`docs/ARCHITECTURE`(+zh)、`docs/TESTING`(+zh)、`PROGRESS`、`session-handoff`、`feature_list.json`、`AGENTS.md`）已同步。下一步：① **提交 + 推送本轮改动，并发布 GitHub Release `v0.3.3`**（`gh release create v0.3.3 <zip> --target main`，随后 `git fetch --tags origin`）；② **真机小点**：等用户给清单后再评估是否单开一轮；③ 若再改代码，先 bump 版本号（≥ `0.3.4`）再跑 `npm run desktop:release`（门禁硬校验目标版本），**不要移动或覆盖 `v0.3.1` / `v0.3.2` 的 tag 与产物**；④ **签名/notarization 用户 2026-09-20 决定不做**（QA-008 accepted / not planned）；若将来要分发再补 Developer ID Application 证书与 notarytool 凭据，并重跑门禁更新哈希。⑤ 主页有像素级断言 `e2e/home.spec.ts`：转换按钮右边缘与粘贴框右边缘差值 < 4px 且与「来源 URL」输入框同行，改 `.sourceInput`/`.sourceRow` 前先看那条用例。不要重做 S1–S6 与 `feat-024` – `feat-033`；不要放宽端点、密钥或归档守卫；不要把已退役的历史 ZIP 条目从 `PROTECTED_HISTORICAL_ZIP_MANIFEST` 中删除。
