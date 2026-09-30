# S4 — 插件分发包、验收与收口（Spec / Plan / Tasks）

- 上游：`docs/features/app-document-processing/FSD.md`（§4.8 插件分发、§4.9 测试分层、§5 验收）
- 前置：**S3 已完成**（首页有插件下载按钮与本地文档面板）；插件本体（`feat-040`）**已关闭**，本阶段只增加「打包 + 说明」，不改插件行为
- 状态：**T4.0 / T4.1 / T4.3 完成（2026-09-29）；T4.2 机器侧全绿；2026-09-30 两轮真机反馈（16 条）+ B1 缺陷已全部落地，同日用户跑完 12 条人工验收并签字，`feat-042` 已置 `done`**
- feature_list id：`feat-042`
- 本阶段不 publish 桌面产物：`desktop:release` 与 `0.3.7` 的发布需用户单独下指令（见 §风险）

---

## Spec

**目标**：让首页那个按钮真的能拿到一个可用的 ZIP（含使用说明），把「机器验不了的」列成人工清单并逐条签字，然后把全部文档收口。

**关键决定**：

1. ZIP 由**既有** `npm run build:extension` 追加产出到 `public/md-convertor-extension.zip`（不新增脚本、不装 zip 库），用 macOS 自带 `ditto -c -k --keepParent`。
2. `package.json` 加 `"prebuild": "npm run build:extension"`：任何 `next build`（含 `init.sh`、e2e 的重建、`desktop:make`）都会带上 ZIP，按钮不会 404。
3. ZIP 结构固定：`md-convertor-extension/{manifest.json, content.js, worker.js, 使用说明.md}`（「加载已解压的扩展程序」指向解压出来的那个目录）。
4. `.gitignore` 加 `public/*.zip` 与打包用的临时目录（构建产物不进库，同 `extension/dist/`）。
5. 测试用 `unzip -Z1` 断言条目**恰好**是那 4 个文件，且三个代码文件非空（防止「ZIP 里少了 worker.js」这类静默失败）。
6. 人工验收清单（12 条）写本文件 + `docs/TESTING.md`，签字后 `feat-042` 才可置 `done`。
7. **不改插件行为、不改桌面既有流程**：本阶段若发现要改，先回来改 `FSD.md`。

---

## Plan

### T4.0 使用说明 `extension/使用说明.md`

内容（面向拿到 ZIP 的用户）：怎么在 Chrome/Edge 里「加载已解压的扩展程序」；点一下图标会发生什么（`.md` + `.images/` 落到浏览器下载目录）；权限只有三项（`activeTab` / `scripting` / `downloads`）与「不读 Cookie、不上传内容」的口径；已知限制（特权页不可用、整篇图片全失败会留一个空目录、重复导出覆盖）；与桌面端「本地文档」的分工（先插件攒文章 → 再桌面端批量内嵌图片/翻译）。链接到仓库 README 与 `docs/`。

**RED**：`extension/tests/extension-package.test.mjs` 断言 ZIP 里含 `使用说明.md` 且非空 ⇒ 文件与 ZIP 都还不存在，failed。

### T4.1 ZIP 产出与接线

- `scripts/build-extension.mjs`：把现有三份产物拷进**每进程唯一**的暂存目录 `extension/dist-package/<pid>/md-convertor-extension/`（+ `使用说明.md`），`ditto -c -k --norsrc --noextattr --keepParent` 先打到同目录的 `pack.zip` 再 `rename` 成 `public/md-convertor-extension.zip`（`--norsrc --noextattr` 是实测必需，否则带出 `._*` AppleDouble 伴生条目；`<pid>` 与 `rename` 是实测必需的并发安全，见 §Result 偏差四）；目录不存在就现建。
- `package.json`：加 `"prebuild": "npm run build:extension"`。
- `.gitignore`：加 `public/*.zip`、`extension/dist-package/`。

**RED**：同 T4.0 的测试文件补断言：`public/md-convertor-extension.zip` 存在；`unzip -Z1` 输出恰好 **5 条**（目录前缀 + 4 文件）；`manifest.json` / `content.js` / `worker.js` 解出的字节数 > 0；`manifest.json` 里的 `version` 与 `extension/manifest.json` 一致 ⇒ 先 failed。

**完成条件**：`npm run build:extension && npx vitest run extension/tests/extension-package.test.mjs` 绿；`rm -rf public/md-convertor-extension.zip && npm run build` 之后该文件重新出现（证明 `prebuild` 接线有效）。

### T4.2 端到端与人工验收

- 机器侧（已有）：`./init.sh` 全绿 + `npm run test:e2e` 全绿（S3 已建）。
- 人工清单（真机，逐条签字；填在本文件 §Result 与 `feature_list.json`）：

| # | 场景 | 期望 |
| --- | --- | --- |
| 1 | 打开应用 | 首页是入口画面：两张入口（转换既有文档 / 粘贴URL/富文本转换）+ 底部「下载浏览器插件」；点进「粘贴URL/富文本转换」后内层两个 tab 与之前一致，且能「← 返回」 |
| 2 | 点「下载浏览器插件」 | 下载目录出现 ZIP；解压得到 `md-convertor-extension/`；按 `使用说明.md` 在 Chrome 里能加载 |
| 3 | 切到「转换既有文档」 | 自动按设置里的输入目录（默认系统下载目录）扫描，列出 `.md` 与状态 |
| 4 | 「选择目录」换一个目录 | 列表自动刷新；回设置页看到同一个值 |
| 5 | 设置页「恢复默认」 | 输入目录回显系统下载目录；回首页重新扫描得到下载目录的内容 |
| 6 | 全选 → 一键转换 | 逐行状态推进，收尾出现汇总；**不自动**打开目录 |
| 7 | 点汇总里的「打开目录」 | Finder 打开输出目录，产物与源文件都在（源未被改动） |
| 8 | 勾选翻译再转化一批 | 产出为译文（复用既有 Provider）；行状态只说「完成」，不注明译文范围 |
| 9 | 同一批再点一次一键转换 | 全部「已处理，跳过」（不重复处理）；想重做某行就重新勾选它再一键转换（已无单独「重新处理」按钮） |
| 10 | 输出目录设成输入目录 | 被拒绝并给出建议按钮；点后输出目录变成 `<输入目录>/processed` |
| 11 | 断网打开产物 | 图片可见（base64 内嵌） |
| 12 | 含 ≥30 张图的文档 | 行状态只说状态（「完成」）；未内嵌的张数看汇总行（`内嵌图片 N 张 · 未内嵌 M 张`），不静默 |

**完成条件**：12 条逐条有结论（通过 / 记录偏差）；任何一项失败都回到对应阶段修，不在本阶段「就地绕过」。

### T4.3 文档收口

- `AGENTS.md`：在册 features 列表加 `docs/features/app-document-processing/`；「当前阶段」段与 Verification 段同步（本块要改桌面代码 ⇒ 版本句里的 `0.3.6` 已在 S1 T1.0 改成 `0.3.7`，此处核对；若尚未发布，注明「已 bump 未发布」）。
- `docs/TESTING.md`：补「桌面端本地文档处理」一节（临时目录 + 桩桥接的口径、不碰真实 Downloads、人工 12 条清单的位置）。
- `CHANGELOG.md` / `.zh.md`：`[Unreleased]` 汇总本块的全部用户可见变化（模式选择器、本地文档批量处理、插件下载 ZIP）。
- `PROGRESS.md` / `session-handoff.md` / `feature_list.json`：状态、证据、唯一推荐下一步。
- `docs/QUALITY-AUDIT.md`：`## Archived Round Log` 压一条 ≤10 行的轮次记录。
- `docs/PLAN-browser-extension.md`：§3 交接契约里「去重依据」与「桌面端输入」两条按本块实现口径回填一句（现在写的是方向，实现后写实）。

**完成条件**：`./init.sh` 全绿；上述文件逐个改完且无过期叙述；`feat-042` 可置 `done`。

---

## Tasks

| id | 任务 | RED（先写失败测试） | 完成条件 | 验证 |
| --- | --- | --- | --- | --- |
| T4.0 | `extension/使用说明.md`（加载步骤/行为/权限/已知限制/与桌面端分工） | 打包测试断言 ZIP 内含该文件 ⇒ failed | 文件存在且非空；ZIP 里也在 | `npx vitest run extension/tests/extension-package.test.mjs` |
| T4.1 | `build-extension.mjs` 追加产出 `public/md-convertor-extension.zip` + `prebuild` + `.gitignore` | 该测试断言 ZIP 存在与 4 个条目 ⇒ failed | 测试绿；删掉 ZIP 后 `npm run build` 能重新产出 | `npx vitest run extension/tests/extension-package.test.mjs && npm run build` |
| T4.2 | 端到端门禁 + 12 条人工验收 | —（机器侧 S3 已建；人工侧只能人跑；入口画面追改另按 TDD 补 RED） | `./init.sh` 与 `npm run test:e2e` 全绿；12 条各有结论 | `NODE_OPTIONS= ./init.sh && npm run test:e2e` |
| T4.3 | 文档收口（AGENTS/TESTING/CHANGELOG/PROGRESS/session-handoff/feature_list/QUALITY-AUDIT/PLAN） | — | `./init.sh` 全绿；无过期叙述 | `NODE_OPTIONS= ./init.sh` |

## Result

**实施完成（2026-09-29）**：T4.0 / T4.1 / T4.3 逐条 RED → GREEN；T4.2 的机器侧（`./init.sh` + `npm run test:e2e`）全绿。**12 条人工验收已于 2026-09-30 由用户真机跑完并签字（`真机测试OK`），`feat-042` 随之置 `done`**。

### T4.0 使用说明

`extension/使用说明.md`（7 节）：加载已解压扩展程序的 5 步、点一次图标会发生什么（`.md` + `.images/` 落下载目录、`✓`/`!` 角标）、三项权限逐条用途 + 「**不读 Cookie、不上传任何内容**」口径、已知限制（特权页、整篇图片全失败留空目录、同名覆盖、短正文判失败、只能写下载目录）、与桌面端「转换既有文档」的分工、仓库链接。RED：`extension/tests/extension-package.test.mjs` 断言 ZIP 内含该文件 ⇒ 文件与 ZIP 都不存在，failed。

### T4.1 ZIP 产出与接线

- `scripts/build-extension.mjs`：既有三份产物 + `使用说明.md` 拷进每进程唯一的暂存目录 `extension/dist-package/<pid>/md-convertor-extension/`，`execFileSync("/usr/bin/ditto", ["-c","-k","--norsrc","--noextattr","--keepParent", staging, pack])` 打到 `pack.zip` 后 `rename` 进 `public/`。**未新增脚本、未装 zip 库。**
- `package.json` 加 `"prebuild": "npm run build:extension"`；`.gitignore` 加 `public/*.zip` 与 `extension/dist-package/`。
- RED：测试 4 条先 failed（ZIP 不存在）。GREEN：`npx vitest run extension/tests/extension-package.test.mjs` **4 passed**；`rm -f public/md-convertor-extension.zip && npm run build` 后该文件重新出现（`prebuild` 接线有效，两次串行重建均为 `34692` bytes）。
- **实测偏差一（必须加的两个 flag）**：只给 `-c -k --keepParent` 时 `ditto` 会带出 4 个 AppleDouble `._*` 伴生文件——ZIP 有 **9 条**（folder + 4 files + 4 `._*`）；补 `--norsrc --noextattr` 后是干净的 **5 条**（folder + 4 files）。测试显式断言没有 `._*` 基线。
- **实测偏差二（条目名与 `unzip -Z1`）**：`ditto` 不写 ZIP 的 UTF-8/EFS 标志位（`flag_bits = 0x8` 而非 `0x800`），所以 `unzip -Z1` 把 `使用说明.md` 按 locale 转码后**显示乱码**（`使�?�说�??.md`）；但 `ditto -x -k` 与 `unzip` **实际解压出来的文件名是对的**（已在磁盘上核对）。测试因此不比对那条的字节：用 `unzip -Z1` 断言总数为 5、三条 ASCII 文件名与目录前缀精确匹配、恰好一条 `.md` 且无 `._*`；然后 `unzip -q -o` 解到临时目录，按正确文件名读内容（版本 / 权限 / 三个权限名 / 「不读」「不上传」/ 非空）。这是 S4 风险表预留的已知取舍（未改名成 README.md）。
- **实测偏差三（lint 需要一条 ignore）**：新暂存目录 `extension/dist-package/` 里是压缩包的拷贝，会被 eslint 当作源码扫出 `no-this-alias` ⇒ `eslint.config.mjs` 的 `globalIgnores` 加 `extension/dist-package/**`（与既有 `extension/dist/**`、`extension/dist-test/**` 同列）；这是 T4.1 新目录的必然结果，不是顺手重构。
- **实测偏差四（并发构建互踩，已修）**：`extension-build.test.mjs` 与 `extension-package.test.mjs` 都在 `beforeAll` 跑 `npm run build:extension`，而 vitest 默认按文件并行 fork ⇒ 两个进程同时 `rm -rf` **同一个**暂存目录、同时写**同一个** `public/md-convertor-extension.zip`。并列跑这两个文件 3 次：**2 次红**（`unzip -Z1` 在别人写一半的 ZIP 上退出非 0，报 `Command failed`）；加 `--no-file-parallelism` 后 3/3 绿 ⇒ 是竞态，不是环境。修法是两行级：暂存目录改每进程唯一 `extension/dist-package/<pid>/md-convertor-extension/`，`ditto` 先写同目录 `pack.zip` 再 `rename` 到 `public/`（同卷原子替换，读者只会看到完整档案），收尾 `rm -rf` 自己那一份。改后并列跑 **5/5 绿**。确定性的 ZIP 大小是 **34692** bytes（`rm -rf` 后连建两次同值）；早先记录的 `34346` 出自被并发踩坏的那条路径，不是有效基线。回归检查就是 `npx vitest run extension/tests/extension-build.test.mjs extension/tests/extension-package.test.mjs`（`init.sh` 里正是这样并列跑的）。

### T4.2 机器侧 + 人工验收

- `NODE_OPTIONS= ./init.sh` **exit 0**（Node 24.15.0，**92 files / 1237 tests**，较 S3 基线 91/1233 增 1 文件 4 例＝新打包测试）；`tsc --noEmit` 与 eslint 干净。
- `npm run test:e2e` **exit 0：278 passed / 4 skipped / 0 failed**（第二次跑；第一次有 1 条 firefox flake——见下）。
- `npm run test:extension` **15 passed**（~6s，自带 `build:extension`）。
- **首次全量 e2e 的 1 条失败（新观察到的 flake，非本轮引入）**：`e2e/home.spec.ts:305`（firefox，`locator.fill` 30s 超时——点在尚未 hydrate 的内层「富文本转换」tab 上被丢弃，正文框没出现）。该用例**未被本轮触碰**，隔离重跑 `--project=firefox --repeat-each=5` **5/5 passed（每条 ~0.7s）**，第二次全量跑也不再复现 ⇒ 判为 flake（与既有 V3 `:108` 同族、不同用例）。**未修**（范围外，要修先问用户），第二次全量跑可作为干净门禁记录。
- **12 条人工验收**：本轮不代跑、不用自动化桩或 S3 的 e2e 冒充；下表两列（§T4.2 与 §T4.2 的签字表）的结论栏均为 **2026-09-30 用户签字通过**。

**签字（2026-09-30）**：用户在同一日的打包构建上跑完全部 12 条并入「真机测试OK」⇒ **12 条全部通过**，`feature_list.json` 的 `feat-042.status` 已由 `in-progress` 改为 **`done`**（verification 39 条）；下表的「期望」栏因第五 / 第六轮的 UX 修订（第 9 条改为重新勾选重做；第 12 条改为行只说「完成」）而与首次实现时不同，以修订后为准。

**追改（2026-09-29，真机反馈后）——首页改为入口画面**：按用户裁定，FSD 第 51 行原话「一开始的选择画面」是本意，S3 实现的「顶部 tablist + 默认落转换画面」作废（详见 `S3-home-modes-and-batch.md` §Result 的追改段）。落地与验收影响：

- `src/app/page.tsx` 改为互斥三态早返回（`home` / `convert` / `local-docs`），入口画面＝两张入口卡 + 插件下载链接，二级画面页头「← 返回」；删掉外层 `role="tablist"`/`aria-controls`/`handleHomeModeTabKeyDown`（互斥早返回下 tab 语义不成立）；插件链接改为只在入口画面。
- 测例侧新增 `e2e/entry.ts`（`gotoHydrated` / `gotoConverter` / `openLocalDocs`），13 处 `page.goto("/")` 改为先等 `/api/settings` GET 再进二级画面；`home.spec.ts` 新增 4 条入口画面断言（RED：4 failed）。
- 门禁：`NODE_OPTIONS= ./init.sh` **exit 0**（同 92 files / 1237 tests）；`npm run test:e2e` **278 passed / 4 skipped / 0 failed**（3 浏览器，2.4m）；`tsc --noEmit` 与 eslint 干净。
- **修掉一条真失败（不是 flake）**：`home.spec.ts:109`「suggests the paste mode…」在 firefox 上**确定性**失败（本次 3/3、之后 5/5）。已查实机制：本环境下 firefox 对**合成鼠标点击**在视口底部一条窄带（该布局下 y≈672，正好是「改用富文本粘贴」按钮的垂直中心）会丢事件或偏移 48px——该点 `document.elementFromPoint` 命中按钮、DOM `.click()` 能切 tab，但 `locator.click()` 与 `page.mouse.click(735,672)` 都收不到任何 `pointerdown`（A 轮探针定量：同一 y 上的合成点击返回空事件列表，`y=680` 的那次被送到 `clientY=632` 的 textarea 上）。案例未被产品缺陷触发（人工点击与 DOM 派发均正常）⇒ 测例侧改成点按钮偏上位置（仍是真实鼠标点击）后 firefox **225 passed（75 例 × 3）」**。机制与口径已记入 `docs/TESTING.md`。
- 另一条 `paste.spec.ts:212`（firefox `beforeEach` 等 `/api/settings` 超时）隔离重跑**全绿**，维持既有 flake 判定，未修。另观察到大同族的 `settings.spec.ts:544`（firefox 上设置页还没渲染完就查 radio，报 `element(s) not found`）在一轮全量里红过一次，隔离 `--repeat-each=5` **5/5 绿**；改完 CSS 后的全量复跑 **278 passed / 4 skipped / 0 failed**（exit 0）。两条都不改。
- **刷新 / 重开应用回到入口画面**：客户端状态直接归位，不写 `sessionStorage`；`e2e/translate.spec.ts` 的 `page.reload()` 后补一行 `gotoConverter(page)` 以保持原断言意图。
- **设计校验（`design-router` 环节 4，2026-09-29）**：`design_audit("src/app")` 回 **BLOCK**（🔴 7 / 🟡 88 / 🔔 73，168 项），逐条分诊后 **本轮落地未新增一条 🔴**——①🔴 **gate 26**（缺 `:focus-visible`）与 **gate 46**（`".downloads"` 被当成编造指标）是审计器的**误报**：它只扫 `.tsx`、无法与 CSS module 配对（`page.module.css` 的 `.backButton` / `.entryCard` / `.modeTab` / `.textarea` / `.sourceInput` / `.input` / `.backToTop` 都有）；`.downloads` 是目录名词不是数字；②🔴 **gate 37**（字体族计数）与 🔔 **gate 30**（`content: "✓"`）是 0.3.5 视觉刷新留下的既有基线，本轮未碰；③🟡 **gate CS-4** 已就地修：`.backButton` 的 `height: 34px` → `min-height: 34px`（内容更矮时高度不变，字号放大时不再裁切）；④🟡 **gate DR-A5**（`.entryCard:hover` 的 `translateY(-2px)` 未包在 `@media (hover: hover)` 里）与 **gate 24**（非 4pt 间距）按本产品 genre = **modern-minimal** 豁免：genre 明确允许 hover 抬升与 8px 圆角细边卡片，间距沿用本文件既有节奏（同族 `.submit:hover` / `.action:hover` 亦同）。`design_contrast("src/app/page.module.css")` **洁净**（未检出低于 4.5:1 的显式 color/background 配对；入口画面全部沿用 `--ink` / `--muted` / `--accent` / `--line` / `--surface` 既有 token，未新增颜色对）；`prefers-reduced-motion` 已由全局 `.page *` 规则覆盖新过渡，未新增块。**7 条 🔴 均落在本轮改动之外，未顺手修（范围外）。**

| # | 场景 | 期望 | 结论 |
| --- | --- | --- | --- |
| 1 | 打开应用 | 首页是入口画面：两张入口 + 插件下载；点进「粘贴URL/富文本转换」后内层两个 tab 与之前一致可「← 返回」 | 通过（2026-09-30 用户签字） |
| 2 | 点「下载浏览器插件」 | 下载目录出现 ZIP；解压得到 `md-convertor-extension/`；按 `使用说明.md` 在 Chrome 里能加载 | 通过（2026-09-30 用户签字） |
| 3 | 切到「转换既有文档」 | 自动按输入目录扫描，列出 `.md` 与状态；工具栏一行＝翻译产物 → 重新扫描 → 一键转换 | 通过（2026-09-30 用户签字） |
| 4 | 「选择目录」换目录 | 列表自动刷新；设置页回显同一个值 | 通过（2026-09-30 用户签字） |
| 5 | 设置页「恢复默认」 | 输入目录回显系统下载目录；首页重新扫描得到下载目录内容 | 通过（2026-09-30 用户签字） |
| 6 | 全选 → 一键转换 | 逐行状态推进 + 收尾汇总（数量一行 / 输出目录一行 /「打开目录」在右侧）；**不自动**打开目录 | 通过（2026-09-30 用户签字） |
| 7 | 点汇总「打开目录」 | Finder 打开输出目录，产物与源文件都在（源未改动） | 通过（2026-09-30 用户签字） |
| 8 | 勾选翻译再转化一批 | 产出为译文；行状态只说「完成」，不注明译文范围 | 通过（2026-09-30 用户签字） |
| 9 | 同一批再点一次 | 全部「已处理，跳过」；想重做某行就重新勾选它再一键转换（已无单独「重新处理」按钮） | 通过（2026-09-30 用户签字） |
| 10 | 输出 = 输入 | 被拒绝并给出建议按钮；点后输出变成 `<输入目录>/processed` | 通过（2026-09-30 用户签字） |
| 11 | 断网打开产物 | 图片可见（base64 内嵌） | 通过（2026-09-30 用户签字） |
| 12 | 含 ≥30 张图 | 行状态只说「完成」；未内嵌张数看汇总行 `内嵌图片 N 张 · 未内嵌 M 张`，不静默 | 通过（2026-09-30 用户签字） |

### 真机点检反馈（2026-09-29，2026-09-30 已实施）

用户首轮真机点检口头报告的 3 条缺陷。**汇报当时只记账、未改代码；2026-09-30 连同下面两轮优化一起落地**（下表为反馈原样记录，「已核实的可能位置」列写的是当时的核实结论；实际改动见 §追改（2026-09-30））。

| # | 报告原话（症状） | 已核实的可能位置（均未复现） | 复现所需 |
| --- | --- | --- | --- |
| B1 | 「转换之后图片没有嵌入成功」 | 待定：`src/lib/images.ts` 的链接转换内嵌路径 / `src/lib/local-docs/inline-images.ts` 的本地 md 内嵌路径 / 插件 `extension/src/worker-run.ts`——**报告未说明是「粘贴 · 链接转换」还是「转换既有文档」** | 一次样例（源 URL 或 `.md` 文件）+ 落盘产物，先分清走的是哪条路径 |
| B2 | 「返回按钮挤占子页面的左上角 `MD-Convertor` 标题，让标题向右移动了」 | 已定位：`src/app/page.module.css:18` 的 `.headerLeft { display:flex; gap:16px }`——二级画面多出的「← 返回」（`.backButton`）把 `.brand` 推右（按钮 ~50px + 16px 间隙）；入口画面没有返回按钮，所以进出二级画面时品牌位置会跳 | 无需复现，是本轮入口画面改动的直接视觉后果 |
| B3 | 「目录过长时右侧的按钮会换行，应该把目录改成「…」缩略显示」 | 已定位：`src/app/settings/page.module.css:210` 的 `.path`（`<code>` 显示目录，无 `min-width:0` / 无 text-overflow）与 `:242` 的 `.actions { flex-wrap: wrap }` ⇒ 长路径把「选择目录 / 恢复默认」挤到下一行；同一结构还见于输入卡（`settings/page.tsx:403`）与输出卡（`:446`）、CLI 卡（`:647`） | 设置页把输入/输出目录设成一个很长的路径即可 |

三条已同步记进 `feature_list.json` 的 `feat-042.verification`（「已记录缺陷，未修」）与 `PROGRESS.md`。

### 真机点检反馈 · 第二轮：UX 优化需求（2026-09-30，同日已实施）

用户次日口述的 6 条入口画面 / 文案优化，全部落在 `src/app/page.tsx`（入口画面）+ `src/app/page.module.css`。**汇报当时记账未动代码；同一天按用户 7 条拍板 +「其他按你的意见执行」落地**（下表为反馈原样记录，落地见 §追改（2026-09-30））。

| # | 要求（用户原话要点） | 现状（已核实，`page.tsx` 入口画面） |
| --- | --- | --- |
| U1 | 标题和副标题去掉，只保留最简单的两个大卡片入口 + 底部插件下载链接 | 现有 `<h1 className={styles.landingTitle}>选择你要处理的内容</h1>` + `<p className={styles.landingLead}>两种入口：…</p>`；「只保留…两个卡片 + 插件下载」字面上也暗示 `eyebrow`（`Web to Markdown`）一起去掉 —— 已拍板：**删**（标题、副标题、eyebrow 三者一并去掉） |
| U2 | 入口卡片改成正方形，卡片主标题字体放大 | `.entryGrid` + `.entryCard`（`entryTitle` / `entryNote` 两级排版，现为横长卡片）；正方形需定 `aspect-ratio`，字号放大涉及 `.entryTitle` 的 `font-size` 与 `.entryCard` 内边距/换行（`entryNote` 是长句，正方形里会更高） |
| U3 | 「转换既有文档」副标题改成「插件下载的文档为非Base64内嵌模式，可用此功能转换/翻译，其他.md文档也能使用」 | 现为「扫描本机目录里的 .md，内嵌图片、按需翻译，重复导出自动跳过。」 |
| U4 | 「粘贴 链接转化」改为「粘贴URL/富文本转换」；副标题里的「Markdown 文件」改为「.md 文件」 | 卡片标题现为「粘贴 · 链接转换」（中间是 `·`，非空格）；副标题现为「粘贴网页链接或正文，在本机提取内容和图片，生成 Markdown 文件。」⇒ 末段改「生成 .md 文件」 |
| U5 | 「下载浏览器插件」按钮加下划线，否则不能准确识别可点击 | `.pluginLink` 现无下划线（靠色+悬停识别）；注意与「链接描述目的地」的写法一致性，且下划线不要影响 hover/focus 表现 |
| U6 | 插件副标题改为「Chrome里直接转存网页为本地.md」，且该副标题应与下载按钮**居中对齐** | `.pluginRow` 现为 `flex-wrap: wrap` 的横排（按钮 + `.pluginNote` 同行靠左）；「在 Chrome 里点一下图标，把当前网页存成本地 Markdown。」⇒ 改文案 + 改居中布局 |

**开工时的流程入口（已定，届时别从零走全套）**：用户已给定方向与文案 ⇒ 按 `design-references` 第一层「有方向要落地」**从环节 2/3 切入**（U2 的卡片正方形/字号属**组件级微调**，走轻量路径：grep 兄弟组件 + 复用既有 token，不引新色板/不引 emoji 图标），改完必须跑**环节 4**（`design_audit` + `design_contrast`）+ 更新 e2e 断言（入口画面现有 4 条断言会因文案变化而红）；U1/U6 是布局结构变化，改前先读 FSD §4.1 与 `docs/PRD-app-document-processing.md` R8/R9 并同步追改。

### 真机点检反馈 · 第三轮（2026-09-30，同日已实施）

用户同日口述的 7 条（4 条交互/布局 + 1 条命名统一 + 2 条设置返回与目录显示）。**汇报当时只记账未动代码；同一天落地**（下表为反馈原样记录，落地见 §追改（2026-09-30））。

| # | 要求（用户原话要点） | 已核实的位置 |
| --- | --- | --- |
| L1 | 未勾选文档时出现「先勾选要处理的文档」，**这行字一出现列表就下沉**；要求列表不要有下沉动作 | `src/app/local-docs/panel.tsx:245` 生成 `disabledReason`，`:315` 之后按 `disabledReason ? <p className={styles.hint}>…</p> : null` 条件渲染；`.hint { margin: 8px 0 0 }`（`panel.module.css:138`）⇒ 出现/消失使下方表格位移。**同类条件块还有两处**：`panel.tsx:319`「这个目录里没有 md 文件。」、`panel.tsx:281-292` 的同目录拒绝块（都会顶动列表） |
| L2 | 「重新扫描」和一键转换应同一层级，放在**一键转换左侧** | 「重新扫描」在 `panel.tsx:275-282`，属 `.dirRow` 的 `.actions`（与「选择目录 / 恢复默认」同排，`panel.module.css:60`）；「一键转换」在 `.toolbar`（`panel.tsx:307-314`），两者不在同一排 |
| L3 | 「翻译产物」勾选框也一样，放在**移动后的重新扫描按钮左侧** | `switchRow` 在 `panel.tsx:295-306`，同在 `.toolbar`，`.toolbar { justify-content: space-between }`（`panel.module.css:115-122`）⇒ 目前是「左：翻译产物 / 右：一键转换」；L2+L3 之后的期望顺序：**翻译产物 → 重新扫描 → 一键转换** |
| L4 | 已处理行右侧的「重新处理」按钮没意义（状态已变、也不再勾选），用户想处理自然会勾选再一键转换 | `panel.tsx:367-375`，条件是 `row.state === "skip" || row.status.phase === "failed"`；`rerunRow()` 在 `:213-218`（置 `checked + forced` 后立刻 `execute`）；`src/lib/local-docs/batch.ts:25-26` 的注释写明 `forced` 就是「满足 `重新处理`：行状态是 `skip` 也照发」 |
| L5 | 应叫「一键转换」而不是「一键转化」，全文案统一用「转换」 | 产品串在 `panel.tsx:315`；注释在 `batch.ts:34`；**e2e 有 8 处断言**（`e2e/local-docs.spec.ts:128/147/149/177/207/212/221/234`）；文档侧散落在 `FSD.md` / `PRD-app-document-processing.md` / `S3-home-modes-and-batch.md` / `S4-…md` / `docs/QUALITY-AUDIT.md` / `CHANGELOG.md` / `CHANGELOG.zh.md` / `session-handoff.md` / `feature_list.json` |
| L6 | 设置里「输入」卡片显示的是「系统下载目录」这个标签，和扫描页「直接显示路径」的逻辑不统一；且**任一端改动，另一端要同步** | 设置页 `src/app/settings/page.tsx:403`：`settings.input.defaultPath ?? "系统下载目录"`；扫描页 `panel.tsx:261`：`settings?.input.defaultPath ?? scan?.downloadsDir ?? "系统下载目录"`（**多一层已解析的真实路径**，来自 `src/lib/local-docs/scan.ts:35/91/126` 的 `downloadsDir`）；写入侧本来就是同一个设置键（`settings/page.tsx:169-172` 与 `panel.tsx:165` 都改 `input.defaultPath`）⇒ 数据同步已存在，**缺的是两端显示口径一致（设置页拿不到已解析的默认目录）** |
| L7 | 「返回转换」要记录进入设置的来源画面，点击后回那个画面，而不是一律回首页 | `src/app/settings/page.tsx:148-152` `leaveSettings()` 固定 `router.push("/")`；进入设置的入口有三处：入口画面页头 `page.tsx:642` `<Link href="/settings">`、转换画面页头（同一个 `siteHeader`）、转换结果里的提示链接 `page.tsx:995`。**注意**：转换画面不是路由而 `page.tsx` 里的 `homeMode` state，所以「回去」不能只靠 router |

### 汇总与修改建议（2026-09-30，用户已拍板并按此实施）

三批共 **16 条**（3 缺陷 + 13 优化：U1–U6、L1–L7）。按「改动性质」归三类。用户回复了 7 个待拍板点（U1 删 eyebrow / U2 窄屏退化 / U6 上下居中 / L1 三处条件块都改 / L4 不保留「重新处理」只改状态文案 / L6 参考面板路径样式 / L7 用 URL 参数），其余「按你的意见执行」，故按本表落地（落地见 §追改（2026-09-30））：

| 组 | 条目 | 建议做法 | 影响面 | 需用户拍板 |
| --- | --- | --- | --- | --- |
| **A · 入口画面视觉与文案**（U1–U6） | U1 去标题副标题 · U2 卡片正方形+标题放大 · U3 换副标题文案 · U4 改标题+`.md 文件` · U5 插件链接加下划线 · U6 插件副标题文案+居中 | 组件级微调走轻量路径（复用现有 token，不引新色板/图标）；改完跑 `design_audit` + `design_contrast`（环节 4） | `src/app/page.tsx` + `page.module.css`；`e2e/home.spec.ts` 4 条入口断言；`FSD §4.1`、`PRD R8/R9` | eyebrow「Web to Markdown」是否一起去掉（U1 只点名标题+副标题）；U2 正方形在窄屏（<761px）是否退化为横卡 |
| **B · 既有文档面板交互**（L1–L5） | L1 让提示行**常驻占位**（`{disabledReason ?? "\u00A0"}` 或给该行固定 `min-height`），顺带处理另两处条件块；L2+L3 把「翻译产物 + 重新扫描」移进 `.toolbar`，顺序＝翻译产物 → 重新扫描 → 一键转换（右侧成组，与一键转换同级）；L4 把「重新处理」的显示条件收窄为**只留失败行**（`row.status.phase === "failed"`），成功/跳过的行不再显示；L5 全仓「一键转换」→「一键转换」 | `panel.tsx` + `panel.module.css`；`e2e/local-docs.spec.ts`（8 处改名 + 新增/调整勾选与按钮位置断言）；`batch.ts` 注释 | **L4 与现有验收口径冲突**：S3 文档与 12 条验收的**第 9 条**都写明「点某行『重新处理』后只有它重做」，改掉要同步改 S3 文档 + FSD §4.6 + 验收第 9 条 + 用例；失败行是否保留「重新处理」由你定（建议保留） |
| **C · 设置页与来源/目录口径**（L6–L7） | L6 让设置页也显示**已解析的真实目录**（`/api/settings` GET 增一个 `input.effectiveDir`，或复用 scan 的 `downloadsDir`），两端同一口径；数据双向同步已存在，只需补一条「设置改完回到面板即刷新」的断言；L7 用 `router.back()` 并带「来源」标记（进入设置的链接加 `?from=local-docs` / `?from=convert`；直接打开 `/settings` 无标记则回首页），回转换画面时把 `homeMode` 置回 `convert` | `src/app/settings/page.tsx`（+ `client.ts`）、`src/app/api/settings/route.ts` 与类型、`src/app/page.tsx`（链接带 from + 初值）、`e2e/settings.spec.ts`、`e2e/local-docs.spec.ts` | L6 显示成「路径」还是「路径 + （系统默认）小注」；L7 来源是否用 URL 参数（可直接分享/可刷新）还是 `sessionStorage` |

**另：3 条缺陷（B1–B3）建议单独一轮**，不与上面混做——B1 还缺样例与路径判定，B2/B3 只动 CSS（`page.module.css:18` 的品牌左侧定位；`settings/page.module.css:210` + `:242` 的 `min-width:0` / text-overflow 与按钮换行）。

### 追改（2026-09-30）—— 16 条真机反馈 + B1 全部落地

三批反馈与 B1 在同一轮按 TDD（RED 先行）落地。逐条：

**入口画面（U1–U6｜`src/app/page.tsx` + `page.module.css`｜`e2e/home.spec.ts`）**

- U1：删 `<h1>选择你要处理的内容</h1>` + `<p>两种入口：…</p>` + eyebrow `Web to Markdown`（`.landingTitle` / `.landingLead` / `.eyebrow` 与 `.eyebrow` CSS 一并删）。RED：转换画面用例加 `getByText("Web to Markdown")` count 0。
- U2：`.entryCard { aspect-ratio: 1 / 1 }`、`.entryTitle` 字号放大；`<761px` 退化为横卡（媒体查询 `aspect-ratio: auto`）。
- U3：卡片副标题改「插件下载的文档为非Base64内嵌模式，可用此功能转换/翻译，其他.md文档也能使用」。
- U4：卡片标题「粘贴 · 链接转换」→「粘贴URL/富文本转换」，副标题末段「生成 Markdown 文件。」→「生成 .md 文件。」。
- U5：`.pluginLink` 加 `text-decoration: underline` + `text-underline-offset: 3px`。
- U6：`.pluginRow` 改 `flex-direction: column; align-items: center`，副标题文案改「Chrome里直接转存网页为本地.md」。

**本地文档面板（L1–L5｜`src/app/local-docs/panel.tsx` + `panel.module.css`｜`e2e/local-docs.spec.ts`）**

- L1：`disabledReason` 三种条件提示改为**常驻提示行**（行始终占位），下方表格不再因提示出现/消失而位移。**2026-09-30 第四轮 R2 已推翻这半条**：占位行整个删掉（用户要求「不要浪费空间」），只在有真实信息时渲染。
- L2+L3：`.toolbar` 顺序改为 **翻译产物 → 重新扫描 → 一键转换**（「重新扫描」从 `.dirRow` 移入 `.toolbar`）。
- L4：删掉每行「重新处理」按钮；成功/跳过的行不再显示入口，想重做就重新勾选该行（勾选即 `forced`，见 `batch.ts`）；失败行状态文案为「处理失败（原因）」。用户拍板「不保留按钮，只在状态上改成处理失败」。
- L5：全仓「一键转化」→「一键转换」（产品串 + 8 处 e2e 断言 + 文档）。

**设置与来源（L6–L7｜`src/app/settings/*`、`src/app/api/settings/route.ts`、`src/app/page.tsx` + `home-mode.ts`｜`e2e/settings.spec.ts`）**

- L6：两端共用 `inputDirLabel()`（`settings/client.ts`），`/api/settings` GET 回 `defaults.inputDir`（已解析的真实目录）⇒ 设置页与扫描页同一口径；双向同步本就走同一个设置键。
- L7：设置页用 `?from=`（`home` / `convert` / `local-docs`）记住来源，`leaveSettings()` 据此回对应画面（`page.tsx` 用 `pendingHomeMode()` 读 `?from=` 给初值）。

**缺陷（B1–B3）**

- **B1（2026-09-30 定位并修复，读方）**：真机样例 `~/Downloads/X 上的 姚金刚 (@yaojingang).md`（11 张图）暴露 `src/lib/local-docs/scan-refs.ts` 的 `INLINE_IMAGE` 正则用 `[^\s)]+` 取目标，遇到**含空格 / 括号**的路径（插件产物 `<标题>.images/`，标题带空格或半角括号）会截断 ⇒ 整条图片引用不匹配 ⇒ 既不入候选也无 warning，行状态停在「完成（内嵌 0 张，保留 0 张）」。修法（读方、最小改动）：目标改为允许空格与配平括号（空格不跨行）。RED：`scan-refs.test.ts` 新增 4 例 + `process.test.ts` 新增 1 例 ⇒ 3 failed；GREEN：`src/lib/local-docs/` **7 files / 99 tests passed**；对真机样例的临时探针跑出 `{"embedded":11,"kept":0,"warnings":[]}`（探针已删）。**写方（插件是否该 percent-encode 文件名）未动**，作可选后续，需另行授权。
- **B2**：二级画面「← 返回」把品牌 `MD-Convertor` 推右 ⇒ 修 `page.module.css` 的品牌横向定位；`e2e/home.spec.ts` 加「三个画面里品牌横向位置一致」断言。
- **B3**：设置页长目录把右侧按钮挤换行 ⇒ 设置页 `.path` 改单行 + 省略号（`min-width:0` / `overflow:hidden` / `white-space:nowrap` / `text-overflow:ellipsis`），目录加 `title`。

**顺带（同轮，用户点名的路径显示统一）**：面板 `.path` 与设置页 `.path` 统一为「单行 + 省略号 + `title` 悬停看全值」，颜色统一 `--ink`、字号 12.5px（面板补 `min-width:0; flex:1 1 0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis`，`<code>` 加 `title`）。RED：`e2e/local-docs.spec.ts` 新增「目录长路径单行省略，完整值挂在 title，按钮仍与它同排」⇒ 先 failed（无 `title`）→ 再 failed（按钮换行，补 `flex:1 1 0` 后绿）。

### T4.3 文档收口

`AGENTS.md`（当前阶段段 + 在册 features + Verification 的 `build:extension` 产出注）、`docs/TESTING.md`（本地文档处理一节指到本表；`build:extension` 产出补 ZIP/暂存目录；Release Guard 的 `0.3.6` 版本行就地更正为 `0.3.7`；覆盖计数改现测值）、`CHANGELOG.md` / `.zh.md`（`[Unreleased]` 加插件下载 ZIP 一条）、`PROGRESS.md`、`session-handoff.md`、`feature_list.json`、本文件、`docs/QUALITY-AUDIT.md`（`## Archived Round Log` 一条）、`docs/PLAN-browser-extension.md` §3（去重依据 / 桌面端输入两行按实现口径回填）。

### 未做 / 未验证

- 未跑 `desktop:release`、未 push、未动任何历史 tag 或 ZIP（发布 `0.3.7` 未获授权）。
- 12 条人工验收 2026-09-30 全部签字通过 ⇒ `feat-042` 已置 `done`（2026-09-30；当时的 0.3.7 尚未发布、未 push、未动 tag/ZIP —— **这些已在同日第二十轮的提交门轮次完成：tag `v0.3.7` + GitHub Release 已发布**）。
- `unzip -Z1` 对非 ASCII 条目名乱码属已接受取舍（未改名 README.md）；`ditto -x -k` 与 `unzip` 解压正确。
- 首次 e2e 的 firefox flake（`:305`）未修，与既有 V3 同族。
- **B1 只修了读方**（`scan-refs.ts` 容忍含空格/括号的路径）；插件写方仍按 `<标题>` 原样落盘、不 percent-encode 文件名，属可选的后续加固，需另行授权。

### 真机点检反馈 · 第四轮（2026-09-30，同日已处理）—— 面板布局与返回路径

用户在同一轮点检里口述 5 条。**R1 与 R5 在真机与浏览器探针下都无法复现，因此不做机制改动，只加「钉住行为」的回归用例并如实汇报**；R2–R4 按 TDD 落地（RED：`e2e/local-docs.spec.ts` 3 failed → GREEN：该文件 14 passed）。

| # | 报告原话（症状） | 结论 |
| --- | --- | --- |
| R1 | 面板 → 设置 → 点「返回转换」回到了入口画面，而不是面板 | **未复现**（下详） |
| R2 | 未勾选时的「先勾选要处理的文档。」占位行浪费空间，列表被推得离操作区太远 | 已修：删掉 `checkedCount === 0` 这一支，`notice` 只在有真实信息（缺桥/未设置目录）时渲染，`.hint` 去掉 `min-height` ⇒ **取代第三轮 L1 的「常驻占位」** |
| R3 | 「翻译产物」勾选框没有紧贴「重新扫描」左侧 | 已修：`.toolbar { justify-content: flex-end }`（原 `space-between` 把它顶到最左，与右侧按钮之间留出整段空白） |
| R4 | 转换结果区改成：数量一行、输出目录一行、「打开目录」在右侧（不是压在文字下方） | 已修：`summaryText(summary, outputDir)` 拆出 `countsText(summary)`，结果区改 `.result`（`justify-content: space-between`）+ `.resultText`（两行）+ `.actions` |
| R5 | 设置页「输入」卡片显示「系统下载目录」文字而不是已解析的具体路径 | **未复现**（下详） |

**R1 / R5 的核实过程**（两条都判为「当前源码不复现」，未改任何导航或取值机制）：

- 浏览器探针（新增两条钉住用例，都用真实路由而非桩）：①面板 → 设置（URL 确为 `/settings?from=local-docs`）→「返回转换」落回面板；②设置页输入卡与面板显示**同一个**解析后的路径（只有 `/api/settings` 少了 `defaults` 时才可能回落成那句文字，而 GET/PUT 都带 `defaults`）。
- 真机探针（真实 Electron + 真实 preload + 用户真实 `settings.json`，`--user-data-dir` 隔离）：同一流程回面板 ✓；设置页输入目录 = 面板目录 = `/Users/huanghaohai/Downloads` ✓。
- 反向推断：用户机器上 `/Applications/MD-Convertor.app`（app.asar）、`out/`、`.desktop/server/server.js` 的 mtime 全是 **9-23**，早于面板（`local-docs/**`）落地，不可能是所跑的那个应用。若仍复现，需用户给出运行方式（哪个 bundle / 是否 Finder 启动）。

门禁：`NODE_OPTIONS= ./init.sh` **exit 0**；`npx vitest run` **93 files / 1252 tests**（coverage 96 / 87.78 / 98.2）；`npm run test:e2e` **303 passed / 6 skipped / 0 failed**（三引擎 2.5m；6 skipped＝4 条既有加上新增的两条 chromium-only 用例）。首次全量跑有一条 firefox flake（`settings.spec.ts:731`，页面停在「正在读取设置…」30s——桩路由未命中，隔离 `--repeat-each=3` 3/3 绿），复跑即无。

### 真机点检反馈 · 第五轮（2026-09-30，同日已处理）—— 设置页长路径

| # | 报告原话（症状） | 结论 |
| --- | --- | --- |
| R6 | 设置页「输入」卡片的路径过长时，右侧的「选择目录 / 恢复默认」被挤到下一行；期望把显示区宽度固化、超出部分用省略号截断 | 已修：`.providerHead .path { flex: 1 1 0 }` |

`flex-wrap: wrap` 的换行依据是各元素自身的 max-content 宽度：`.path` 虽有 `min-width: 0` + 省略号（第三轮 B3 那半条），但没设 flex basis，于是超长路径照样先把这一行撑断、按钮才下移（实测按钮与路径的垂直中心差 40px）。改成 `flex: 1 1 0` 后 hypothetical main size 归零、不再触发折行，路径留在同一行收缩并由既有省略号截断。规则挂在 `.providerHead .path` 上，因此输入 / 输出 / 本地代理三处路径同时受益；`.providerHead` 本身保留 `wrap`，窄屏仍能换行。

新用例落在 `e2e/settings.spec.ts`（`输入目录` 组内），覆盖此前没有的「设置页长路径」场景：断言 `title` 为完整值、`whiteSpace: nowrap`、`textOverflow: ellipsis`、`scrollWidth > clientWidth`、单行高度，以及两个按钮与路径的垂直中心对齐。RED 时只有居中那一条失败，与预判一致（省略号本身早已生效）。GREEN：`e2e/settings.spec.ts` + `e2e/local-docs.spec.ts`（chromium）47 passed。

同轮另修了一条**上一轮自己写的钉住用例**的测试缺陷：它在客户端导航后立刻结束，转发的 `/api/settings` 桩还在 `route.fetch()` 里，Playwright 关闭上下文时报 `Response has been disposed`（三引擎全量跑里偶发 1 例）。现在两次导航各自等它触发的设置请求落地再断言（`--repeat-each=10` 10/10 绿）。

门禁：`NODE_OPTIONS= ./init.sh` exit 0；`npm run test:e2e` **306 passed / 6 skipped / 0 failed**（三引擎 2.5m）。

### 真机点检反馈 · 第六轮（2026-09-30，同日已处理）—— 行状态只说状态

| # | 报告原话（症状） | 结论 |
| --- | --- | --- |
| R7 | 「某篇文章转换后，里边的状态显示状态就好（例如已完成），不要显示什么内嵌图片数量什么的」 | 已改：`statusLabel` 的 `done` 分支由「完成（内嵌 N 张，保留 M 张）」改为 **「完成」** |

**这推翻了 FSD §4.7「每行状态」与 §4.4「已知命中」的原裁定**（原口径要求行内显式写出 N 张已内嵌 / M 张保留，理由是 ≥30 图长文会撞上限、用户可能以为图丢了）。用户是最终裁定者，按新口径执行：**信息不丢，只是从每行搬到汇总行** —— `countsText()` 仍在结果区给出 `成功 N 篇 · 跳过 N 篇 · 失败 N 篇 · 内嵌图片 N 张 · 未内嵌 M 张`。失败行仍带原因（「处理失败（…）」），只有成功行被简化。

TDD：RED＝把 `e2e/local-docs.spec.ts` 两处断言改成 `getByRole("cell", { name: "完成", exact: true })`（必须 `exact`，否则子串匹配会在旧文案下误绿），chromium 跑出 1 failed；GREEN＝`panel.tsx` 的 `done` 分支改成 `return "完成"`（**没有**动 `client.ts` 的数据搬运，`status.embedded` / `status.kept` 仍进 `BatchSummary`），`e2e/local-docs.spec.ts` chromium 14 passed。

> 注意：`src/app/**` 不在 vitest 覆盖率 include 里，所以这次的证据是 e2e（14 passed）而不是单测。

### 提交门只报未改项的落地（2026-09-30 第七轮，同日已处理）

`0.3.7` 发布前的四个只读评审（ponytail / code-review·Spec / code-review·Standards / neat-freak）里，有一批「只报未改、等用户裁决」的项。用户裁定「改」后逐条落地（另：`0.3.7` 已发布，所以本轮在**不 bump 版本**的前提下改，见本节末）。

| # | 评审发现 | 处置 |
| --- | --- | --- |
| 1 | 「全选 + 一键转换」会把已处理的文档一并重做（`panel.tsx` 的全选设 `forced: true`，与 FSD §4.6「已处理的默认不勾选」冲突） | 已改：表头「全选」只勾 `state !== "skip"` 的行、且**不带 `force`**；单独勾已处理的那一行仍是重做（L4 逃生口不变）。FSD §4.6 新增「默认勾选」行、§1 的 R2 行同步 |
| 2 | `process.ts` 的 `force` 跳过 sha256 短路，重新勾选未改动的文档会整篇重算（「预期行为，但规格文字写得比实现窄」） | 保留实现、**改规格**：FSD §4.6「强制重做」改为「忽略 `skip`，也忽略哈希」并注明推翻原措辞；新增 `process.test.ts` 钉住用例（未改动 + 不带 `force` ⇒ 跳过；带 `force` ⇒ 重算）。理由：逃生口要在「源没变、只是要重跑」时有效（B1 那一轮正是如此），哈希挡住它就不是逃生口 |
| 3 | 「`phase: "skipped"` 分支在 UI 上不可达」 | 分两半：**服务端来的跳过可达**（新 `e2e/local-docs.spec.ts`「内容没变只改了 mtime」：报「已处理，跳过」、不写盘、汇总跳过 1 篇），FSD §4.7 记下这是它唯一可见路径；**客户端那条本地镜像分支确实死**（`nextPending` 要求 `checked`，而勾过的 `skip` 行必是 `forced`），已删，`client.test.ts` 改为钉「未勾选的已处理行不发起请求」 |
| 4 | ponytail 的 3 处可删：`resolveScanDir` 只被自己的测试调用、`joinDocPath` 重复了 `batch.ts` 的去尾斜杠、`scan.ts`/`process.ts` 各有一份相同的目录守卫 | 已删/合并：`resolveScanDir` 连同其测试删除；`withoutTrailingSlash` 改为导出、`joinDocPath` 复用它；两份守卫合并为 `paths.requireSafeDirectoryPath` |
| 5 | （本轮新发现）打包冒烟 `ELECTRON_SMOKE_TEST_SECRETS=1` 在 0.3.7 上**必红** | 已修：本地文档那一轮起 GET `/api/settings` 多带一个响应专用的 `defaults`，而 PUT 严格拒绝未知根键（`route.test.ts` 有钉），`electron/main.mjs` 的冒烟直接把 GET 的回包回灌 PUT ⇒ 400 `INVALID_SETTINGS`（实测）。现在回灌前 `delete current.defaults`，并加 `tests/secrets-smoke-payload.test.ts` 钉住这行（源码级守卫，同 `forge-package-scope.test.ts` 的口径）。发布门禁不跑冒烟，所以 0.3.7 带着它出过门 |

证据：RED＝`npx playwright test --project=chromium e2e/local-docs.spec.ts -g "全选|内容没变只改了"` 1 failed / 1 passed（失败在「全选后已处理行仍勾上」）→ GREEN＝同文件 chromium **16 passed**；单测 `npx vitest run src/lib/local-docs/ src/app/local-docs/ tests/` **181 passed**。门禁：`NODE_OPTIONS= ./init.sh` exit 0（**94 files / 1252 tests**）；`npm run test:e2e` **312 passed / 6 skipped / 0 failed**（三引擎 2.6m）+ `E2E tracked-file check passed.`。

> 版本面：`0.3.7` 已于 2026-09-30 发布，本轮**未 bump**（用户未授权下一个发布）。这批改动在 `main` 上、位于 tag `v0.3.7` 之后；下一次发布轮的第一件事是把版本面与 `scripts/release-desktop.mjs` 的目标版本一起推到 `0.3.8`（含 guard fixture），否则发布门禁会用 0.3.7 的名字打出 0.3.7 之后的源码。
>
> 本机安装（同日）：用户要求把带修复的构建装上 ⇒ 清 `out/` + `.desktop`、`desktop:make` exit 0（`.app` 572 M），用**新产的 ZIP** 解压后 `ditto` 进 `/Applications`（名字仍是 `0.3.7`，**与实际源不同版**，仅本机使用）；原发布版 0.3.7 归档为 `~/Downloads/MD-Convertor-archive/installed-apps/MD-Convertor-0.3.7-release.app`。该包上打包冒烟实测通过（`Runtime secret smoke passed`），`settings.json` / `secrets.json` 与备份逐字节相同。

## Handoff

- 本阶段是 A 的收尾，但**不等于发布**：`desktop:release` 的目标版本已随 S1 T1.0 是 `0.3.7`（`scripts/release-desktop.mjs` 两处与 `scripts/release-guards.test.mjs` 均已核对），发布 `0.3.7` 需要用户单独下指令，并同时更新 `AGENTS.md` 版本句与 `docs/TESTING.md` 的产物哈希段。
- **12 条人工验收已全部签字（2026-09-30），`feat-042` 已是 `done`，本阶段无剩余阻塞项**；第 9（重复跳过）与第 12（≥30 图）在签字时未报偏差。将来若这两条出问题，回到 S3（`S3-home-modes-and-batch.md`）或 S2，不要在 S4 里加补丁。
- 其余（ZIP 产出、prebuild 接线、门禁、文档）均已绿。
- ZIP 与 `public/` 的关系只有一条：`prebuild` 保证它总在 `next build` 之前产出（`init.sh`、e2e 重建、`desktop:make` 都覆盖）。若将来把插件构建从桌面构建里拆出去，必须同时保证 `desktop:prepare` 之前跑过它。
