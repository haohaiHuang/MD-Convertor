# FSD 总纲 — 桌面端「文档处理」（App Document Processing，A）

- 状态：**规划完成（2026-09-24）**：PRD §3 六条已与用户逐条对齐、四个阶段文档已就绪，**尚未动一行应用代码**（`src/`、`electron/`、打包配置均未改，版本仍是 `0.3.6`）
- 日期：2026-09-24
- 上游：`docs/PRD-app-document-processing.md`（§3 六条待定项已于 2026-09-24 全部裁定）+ `docs/PLAN-browser-extension.md`（线路方向、交接契约、共同口径、§6 四组已裁定规则）
- 阶段执行文档：`S1-directory-and-settings.md`、`S2-document-pipeline.md`、`S3-home-modes-and-batch.md`、`S4-extension-package-and-acceptance.md`
- feature_list id：`feat-042`
- 同线路另一产品（B 浏览器插件，`feat-040`）：**已完成并关闭（2026-09-24）**。与本块**无顺序依赖、无代码依赖**；本块只消费它约定的产物形态（`<标题>.md` + 同级 `<标题>.images/`、正文相对引用）——而因为本块图片走 base64 内嵌（§4.4），连这一点也不是必需的，那只是「最可能出现在下载目录里的输入样本」。

---

## 0. 本轮五个前提（要改先回来改本文件）

1. **只加工本地文件，不新增抓取/提取能力**。输入是磁盘上的 `.md`（外加它引用的图片）。网页抓取链（`convertUrlToMarkdown` / Readability / Playwright）一行都不动，也不通过本块调用。
2. **复用而非新建引擎**。图片内嵌沿用 `src/lib/images.ts` 的常量与策略；翻译沿用 `src/lib/translate/run.ts` 与**既有** Provider / 语言设置——**不新增任何翻译设置项**（用户 2026-09-24 明确："翻译开关的逻辑沿用现在的"）。
3. **本块要改桌面代码** ⇒ 第一次动 `src/` 之前先把 `0.3.6` bump 到 **`0.3.7`**，并同步版本面（`package.json` / `package-lock.json` 两处 / `feature_list.json` 的 `currentVersion` / `scripts/release-desktop.mjs` 的两处硬编码 / `scripts/release-guards.test.mjs` 的期望串与 fixture / `AGENTS.md` Verification 段的版本句）。详细清单与「哪些 `0.3.6` 不该动」在 S1 T1.0。这是 **S1 的第一个任务**。
4. **不抢主画面**：首页默认仍是现在的「链接 / 富文本」转换，行为、布局、像素级断言全部不变；「本地文档」是并列的第二个模式（§4.1）。
5. **插件分发包是构建产物，不是运行时行为**：ZIP 由 `npm run build:extension` 产出到 `public/`，随既有 `public/` 通道进桌面产物（§4.8）；点按钮就是一次普通的静态资源下载。

---

## 1. 需求拆解

### 1.1 PRD §3 六条待定项的裁定（2026-09-24 用户逐条确认）

| # | 问题 | 裁定 | 落到哪 |
| --- | --- | --- | --- |
| ① | 图片内嵌形态 | **base64 直接内嵌**（不复制 `<标题>.images/`）。产物是单个自包含文件，断网可开 | §4.4、S2 |
| ② | 输入目录默认值 | **设置页新增「输入目录」设置项，默认值为系统下载目录**；并给一个**「恢复默认」**按钮（点回下载目录） | §4.2、S1、S3 |
| ③ | 命中去重 | **跳过并提示**（不静默、不自动重新处理） | §4.6、S1、S3 |
| ④ | 反馈呈现 | **逐条状态列表 + 收尾汇总**（进度条不做） | §4.7、S3 |
| ⑤ | 处理完自动打开输出目录 | **不自动打开**；展示输出路径 + 一个「打开目录」按钮 | §4.7、S3 |
| ⑥ | 输出目录 == 输入目录 | **拒绝**，并给一键改用安全子目录 `<输入目录>/processed/` | §4.6、S3 |

### 1.2 需求映射与验收（R 编号沿用 PRD §2，本轮新增 R8–R9）

| 编号 | 需求 | 验收（用户可观察） |
| --- | --- | --- |
| R1 | 选择输入目录并列出其中的 `.md` | 可浏览选择目录；列表显示文件名 + 大小 + 修改时间 + 处理状态 |
| R2 | 勾选要处理的文件 | 单选 / 多选 / 全选；已处理的默认不勾选 |
| R3 | 内嵌图片 | 处理后图片在本地，md **断网可开**（base64） |
| R4 | 翻译（可选） | 复用桌面端已有翻译能力（同一 Provider 与语言设置，**无新设置项**） |
| R5 | 输出到目标目录 | 输出目录 = 设置里已有的输出目录；**绝不覆盖源文件**（源=输出直接拒绝） |
| R6 | 去重 | 已经处理过的文件不重复处理，逐条提示「已处理，跳过」 |
| R7 | 处理反馈 | 每行状态（待处理 / 处理中 / 完成 / 跳过 / 失败+原因）+ 收尾汇总 |
| R8 | 首页模式选择器（**本轮新增**） | 首页**顶部**两个模式：「转换既有文档（本地 md 批量）」/「粘贴 · 链接转换」；选前者即按默认目录打开并列出可转化的 `.md`，点「一键转化」即开始 |
| R9 | 插件下载按钮（**本轮新增**） | 选择器**下方**一个小按钮，点一下把打包好的插件 ZIP 下到本地，ZIP 内含使用说明 |

用户原话（2026-09-24）：

> 一开始的主画面，在现有画面**前面加一个选择器**，二选一：「转换既有（本地 md 批量）」「粘贴/链接转换」。选前者 → 按默认目录打开并呈现扫描出的可转化 .md 列表（单选/多选/全选），点「一键转化」自动开始，勾选翻译则按内容翻译，**翻译开关逻辑沿用现有**（不设独立的设置项）；该画面还可另选其它目录，选后自动扫描加载列表。另外**一开始的选择画面下方有一个小的插件下载按钮**，点击自动下载打包好的 zip 到本地，zip 内含使用文档。

---

## 2. 本轮替你落的默认（没有单独问过的，集中列在这里，可否决）

这七条是在你没有单独指定的地方我替你定的；任何一条不同意，改这里 + 对应阶段文档即可，不改代码。

| # | 默认 | 理由 | 若否决的代价 |
| --- | --- | --- | --- |
| V1 | **首页默认模式仍是现在的「粘贴 · 链接转换」**；「本地文档」是另一个模式，不替换任何现有行为 | 保住已经发布的单篇流程、既有 e2e 像素锁（`e2e/home.spec.ts` 的 `rectsInOneFrame` 断言）与用户肌肉记忆；「不抢主画面」也是线路 §5.4 的原话 | 要把默认切到本地文档，需同时改 e2e 断言与 `page.tsx` 初值，代价小但会动已发布界面 |
| V2 | **输出文件名由「源文件名」派生**（`cleanFilenameStem(源 stem) + ".md"`），**不取 H1**；翻译不改名（内容替换） | 一个源 = 一个确定的产物名 ⇒ 扫描时能**预判**产物路径，去重才判定得了；取 H1 则产物名要读一遍源文件才知道 | 若想「产物名跟随标题」，去重需改成先读源文件再判定（多一轮 IO），且改名后判定漂移 |
| V3 | **去重依据写在输出 md 首行的一行 HTML 注释标记里**（记源绝对路径 + size + mtimeMs + sha256 + outputPath），**不建索引文件** | PLAN §3 定的键是「路径 + 内容哈希 + mtime + 输出路径」；写进产物本身 ⇒ 无额外状态、无索引损坏问题、产物自带出处，删掉产物即等于「重来」；索引文件方案还要处理并发写与损坏兜底 | 若讨厌产物里多一行注释，改用 `<输出目录>/.md-convertor-processed.json`（多一个格式 + 损坏兜底 + 与产物不同步的风险） |
| V4 | 图片超限或取不到时（>30 张 / 单张 >8 MiB / 总量超预算 / 读取失败）**保留原始引用**，**不**替换成 `[图片：…]` 替代文本，也不新增上限 | 源 md 与源图都在本地，原引用仍然可用；替代文本会**主动破坏**一个本来还能看的文档（网页场景不同：那 URL 是远端的，留 URL 才有意义） | 若想清理不可用引用，那是产品语义变化（会丢信息），要改 PRD |
| V5 | 批量翻译遇到「大部分已是目标语言」**不弹窗**，直接按「只翻译非目标语言部分」执行，并在该行状态里注明 | 批量逐文件弹窗等于不可用；单篇流程的选择器弹窗**行为不变** | 若要保留确认，需改成批量前一次性确认（多一个交互态） |
| V6 | **系统下载目录只有一个来源，且不为它新增 IPC**：主进程 `app.getPath("downloads")` → 既有 `buildServerEnv()` 多带一个环境变量 → 服务端读取；不为它新增 channel 或 preload 方法 | 复用 feat-041 已有的「主进程 → 服务端子进程环境」通道，零新面；`app.getPath` 是系统权威值。（本块唯一新增的 IPC 面是「打开目录」那一条，见 §4.7） | 若坚持走 IPC 给渲染层，需新增 channel + preload 方法 + 契约同步 + 两处测试（约四个文件） |
| V7 | 扫描**只扫一层**，不进子目录 | Downloads 目录下的子目录是用户自己的结构；递归会在用户没预期的地方读写（且 `<标题>.images/` 这类目录会白白被遍历） | 想递归就要定义排序、深度上限与「产物放哪」的问题 |

另有两处**需要你在实施前明确点头**（属于"动既有文件"，不是新写代码）：

- **A1**：把 `src/lib/images.ts` 里逐张图的准备工作（类型嗅探 / 大小判定 / 是否压缩 / 能否内嵌）**提为导出的小函数**，供新增的 Markdown 级 inliner 共用。这是**行为不变的重构**（既有 `src/lib/images.test.ts` 必须保持全绿），但它在改一个已发布、有回归保护的文件（S2 T2.0）。
- **A2**：`electron/env.mjs` 的 `buildServerEnv()` 增加一个参数与一个环境变量，`electron/main.mjs` 调用处传入 `app.getPath("downloads")`（S1 T1.2）。同样是既有文件的小改，带测试。

---

## 3. 目标与非目标

**目标**：

1. 桌面端多一个并列模式：挑一个目录 → 看见里面的 `.md` 及其状态 → 勾选 → 一键转化 → 得到自包含、可选已翻译的产物。
2. 产物自包含：`http(s)` 与本地相对路径引用的图片都内嵌成 base64，断网可开。
3. 已处理过的不重复处理（跳过并提示），但**不阻塞**用户强制重做某一条。
4. 全程复用既有能力与既有设置：不新增翻译引擎、不新增翻译设置项、输出目录用设置里已有的那一个。
5. 首页多一个插件下载入口，ZIP 由构建产出并含使用说明。
6. 全程 TDD（RED → GREEN → REFACTOR），证据写进 `feature_list.json`。

**非目标**（越界先回来改本文件）：

- 不做批量下载网页、不做站点爬取、不做定时/后台处理（PRD §4）。
- 不改变现有单篇转换（URL / 粘贴）的任何行为、布局与网络调用。
- 不引入新的 Markdown 解析依赖（理由见 §4.4）；不引入新的打包框架或 zip 库（用 macOS 自带工具，见 §4.8）。
- 不做递归扫描（V7）、不做文件预览、不做逐文件改名、不做产物差异对比。
- 不做 `.md` 以外的输入格式（`.markdown` / `.txt` 不在范围）。
- 不检测「产物被手工编辑过」（去重只按源文件判定，见 §4.6）。
- 不发布插件到扩展商店（线路 §8），ZIP 只用于「加载已解压的扩展程序」。

---

## 4. 架构决定

### 4.1 首页结构与模式选择

| 项 | 决定 | 依据 |
| --- | --- | --- |
| 位置 | `src/app/page.tsx` 顶部加一级模式选择器（`role="tablist"`，复用现有 `modeTabs` 的样式与键盘模型），其下才是现有的 URL / 粘贴内层 tab | 用户原话「在现有画面前面加一个选择器」 |
| 两个模式 | `convert`（默认；内含现有「链接」「富文本」两个内层 tab）与 `local-docs`（新面板） | V1；内层 tab 只在 `convert` 下显示 |
| 默认值 | `convert`（即现在的主画面） | V1 + 线路 §5.4「不是常驻主流功能」 |
| 现有断言 | `e2e/home.spec.ts` 的像素锁（textarea / source / submit 同一水平行）与 `rectsInOneFrame` 断言**必须保持绿** | 默认模式不变，切换前 DOM 与现在一致 |
| 插件按钮 | 选择器下方一行小字按钮：`<a href="/md-convertor-extension.zip" download>下载浏览器插件</a>` | 用户原话；静态资源，无桥接也可用（§4.8） |

### 4.2 输入目录设置（② + 恢复默认）

| 项 | 决定 | 依据 |
| --- | --- | --- |
| 设置字段 | `Settings.input.defaultPath: string \| null`；`null` = 跟随系统下载目录 | 需要区分「用户明确选过某目录」与「未选过」——否则「恢复默认」无处可回 |
| 版本 | `SETTINGS_VERSION` **不变**（仍 `1`）：新增可选字段不构成不兼容变更 | `output` 当年也是这么加的 |
| 校验 | 与 `output.defaultPath` 同规：非空字符串 | 与既有字段口径一致；真实路径合法性在扫描时由服务端守卫判（§4.3） |
| 宽容读入 | 允许缺失的键从 `output` **扩到** `output` + `input`（仅新增字段、仅缺失时回退默认） | 旧 `settings.json` 缺 `input` 时不能整份重置；这是与 `output` **同类同理由**的例外，其余字段仍然严格（实施时把这段条件改成对一个小清单的循环，避免写两遍） |
| 系统下载目录来源 | 主进程 `app.getPath("downloads")` → `buildServerEnv()` 新增 `MD_CONVERTOR_DOWNLOADS_DIR` → 服务端读取；**缺失时回退 `path.join(os.homedir(), "Downloads")`** | V6；回退分支让 `npm run dev` / e2e（无 Electron）也能跑 |
| 设置卡片 | 照抄设置页「输出」卡片的模板：路径回显 + 「选择目录」+ **「恢复默认」** + notes；无桥接时提示只能桌面用 | 既有模板已在 `src/app/settings/page.tsx`，零新样式 |
| 「恢复默认」语义 | 把 `input.defaultPath` 写回 `null`（不写死当前下载目录的字符串） | 用户换了系统下载目录后，默认值自动跟上 |

### 4.3 目录扫描与路径守卫

| 项 | 决定 | 依据 |
| --- | --- | --- |
| 路由 | `POST /api/local-docs/scan`，body `{ dirPath?: string, outputPath?: string }`；**省略 `dirPath` 即「用系统下载目录」** | 默认值解析只发生在一个地方；渲染层不需要第二支「取默认路径」的接口 |
| 返回 | `{ dirPath, downloadsDir, files: [{ name, size, mtimeMs, state }], truncated }` | 渲染层只要列表；`state` 见 §4.6 |
| 路径守卫 | 新增 `src/lib/local-docs/paths.ts`（服务端）：绝对路径、拒绝 `..` 段、拒绝段首 `~`、扩展名白名单 `.md` | 服务端也要校验（渲染层不可信），与主进程/预加载的 `isAbsoluteDirPath` **同规** |
| 防漂移 | 一条 **parity 单测**把两套实现的样例表喂给两边，断言结论逐条一致 | 两处规则必须同规，靠测试钉住而不是靠记忆 |
| 遍历 | 只扫一层；只收 `isFile()` 且 `/\.md$/i`；按文件名排序；上限 `MAX_SCAN_FILES = 500` + `truncated` 标记 | V7 + 避免超大目录拖垮响应 |
| 失败 | ENOENT / ENOTDIR / EACCES 等映射成既有那套 fs 码文案（`src/app/settings/client.ts` 的 `OUTPUT_CODE_MESSAGES`），不新增文案体系 | 复用已固化的「六个真实 fs 码」词汇 |
| 调用方校验 | 与既有路由同款：`runtime="nodejs"`、`dynamic="force-dynamic"`、`validateConvertApiCaller(request)` | `src/app/api/*` 的统一口径 |

### 4.4 图片内嵌（①，base64）

**关键事实（已读代码确认）**：`embedImages(html: string, sourceUrl, signal, totalBudgetBytes, strategy)` 收的是 **HTML 字符串**（内部 `new JSDOM(...)`），而 A 的输入是 **Markdown**；且它解析图片走 `fetchPublicResource()`——`new URL(input)` + DNS 校验 + `undiciFetch`，**只认 `http(s)`**，本地相对路径与 `file://` 直接失败。所以「直接复用 `embedImages`」不可行。

| 项 | 决定 | 依据 |
| --- | --- | --- |
| 方案 | **新增 Markdown 级 inliner**：`src/lib/local-docs/inline-images.ts`，扫描 `![alt](url)` 与 `<img src="...">`，逐张换成 base64 data URI | 输入就是 md，改的只是图片引用这一处 |
| 否决的方案 | **md → HTML → `embedImages` → Turndown 回环**：需要一个 md→HTML 解析依赖（当前 `package.json` **没有**），且 Turndown 会把全文重新规范化（表格对齐、围栏代码、空行、头部） | 与「不动原文其它部分」直接冲突；新依赖也不该为一个功能引入 |
| 策略复用 | 把 `images.ts` 里逐张图的准备逻辑（类型嗅探 / `MAX_SOURCE_IMAGE_BYTES` 8 MiB / `OPTIMIZE_THRESHOLD_BYTES` 2 MiB 是否重编码 / 能否内嵌）**提为导出函数**共用；常量仍只有一份 | 口径必须与网页端一致（超限行为、warning 词汇）；见 §2 的 A1 |
| 图片地址解析 | `http(s)` → 既有 `fetchPublicResource`（SSRF 校验、重定向上限、体积上限）；**相对路径 / 绝对文件路径** → 以**源 md 所在目录**为根解析并 `readFile`，拒绝 `..` 逃逸出根目录；`data:` → 原样保留、不计入张数 | 本地图不能走网抓；`data:` 已经在本地 |
| 上限 | `MAX_IMAGES = 30` / 单张 8 MiB / 总量 `MAX_MARKDOWN_BYTES = 20 MiB`（与桌面端同数） | 复用既有常量，不新造阈值 |
| 超限行为 | **保留原始引用** + 一条 warning（V4），**不**替换成替代文本 | 源图仍在本地 |
| 已知命中 | 插件产物里 ≥30 图的长文（T3.4 实测有 40 图页）**会**撞上 30 图上限 | 这不是假设：FSD §6 已实测存在 40 图页面；UI 需把「N 张图未内嵌」显式说给用户（S3） |

### 4.5 翻译复用（R4，无新设置项）

| 项 | 决定 | 依据 |
| --- | --- | --- |
| 引擎 | 复用 `analyzeTranslation` + `runTranslation`（`src/lib/translate/run.ts`）与既有 Provider / 语言设置 | 用户明确「沿用现在的」；PRD §4 非目标 |
| 开关 | 复用首页现有的翻译开关状态（初值来自 `settings.translation.defaultEnabled`），**不写入新设置、不新增设置项** | 用户原话 |
| 确认交互 | 批量里 `decideTranslation` 返回需确认时，**不逐文件弹窗**，直接按「只翻译非目标语言部分」执行并在该行注明（V5） | 批量弹窗不可用 |
| 串行 | 翻译有**进程级互斥**（`taskInFlight`），批处理天然串行 | 读代码确认：`src/lib/translate/run.ts` |
| 标记保护 | 翻译前**先剥掉**输出标记行（§4.6），翻译后再写新标记 | 否则模型会看到标记、或把它改坏 |
| 失败 | 翻译失败不丢文件：按失败行记录原因，**原样（未翻译）产物**不写（避免用户以为翻译过了） | 不静默 |

### 4.6 写盘、输出目录与去重（③ ⑥ R5 R6）

| 项 | 决定 | 依据 |
| --- | --- | --- |
| 谁写盘 | **逐条经既有 IPC 通道**：`outputBridge().saveFile(outputDir, filename, markdown)`（`preload` + `main` 双重校验已在 feat-041 建好） | 复用唯一写门，不新开服务端写用户文件的路径 |
| 服务端角色 | 只**读**（读源 md、读图片、读产物标记），**不写**用户文件 | 读写在权限模型上就该分开 |
| 输出目录 | 复用设置里**已有的** `output.defaultPath`（不新增第二个输出目录设置）；未配置时禁用一键转化并说明 | 少一个设置、少一处歧义 |
| 源 = 输出 | **拒绝**并给出「改用 `<输入目录>/processed`」一键按钮（写进输出设置）（⑥） | R5 不覆盖源文件 |
| 去重键 | 源绝对路径 + sha256 + size + mtimeMs + 输出路径（PLAN §3 定的键） | 只用路径改名/移动后失效；只用 mtime 判不出内容是否变 |
| 去重载体 | 输出 md **首行一行 HTML 注释**（V3），形如 `<!-- md-convertor: {"source":…} -->`（JSON，`try/catch` 解析） | 无额外状态；产物自带出处 |
| 跳过判定 | 标记存在 && `source` 相同 && 输出路径相同 && size+mtime 相同 ⇒ `skip`；size 或 mtime 变了但标记存在 ⇒ `check`（**处理时先算哈希**，相同即跳过、不计费） | 兼顾「git checkout / iCloud 同步改了 mtime」与「真的改了内容」 |
| 强制重做 | 每行一个「重新处理」入口，忽略 `skip`（`check` 仍做哈希比对） | ③ 选了「跳过」，但没有逃生口会把人卡死 |
| 不检测 | 产物被手工编辑过**不**视为「需重做」 | 去重只按源判定；写进文档即可 |
| 并发 | 串行逐条（一条写完再下一条） | 与翻译的进程级互斥一致；也避免 IPC 高峰 |

### 4.7 反馈（④ ⑤ R7）

| 项 | 决定 | 依据 |
| --- | --- | --- |
| 每行状态 | `待处理` / `处理中` / `完成（含 N 张图已内嵌，M 张保留原引用）/ 跳过（已处理）/ 失败（原因）` | ④ 裁定 |
| 汇总 | 全部结束后一行：`成功 N · 跳过 N · 失败 N` + 输出目录路径 + 「打开目录」按钮；**不自动打开**（⑤） | ⑤ 裁定 |
| 「打开目录」 | 新开一条最小 IPC 通道 `md-convertor:system:open-path`（主进程 `shell.openPath`，独立小模块 `electron/system.mjs`，同样校验绝对路径 + 拒绝 `..` 段，失败值回给渲染层）；渲染层每次 `await` 都带 `.catch()` | ⑤ 要这个按钮，而 web 侧没有开目录的能力；**本块仅此一条新增 IPC 面** |
| 失败不中断 | 单条失败只标记该行，后续继续 | 批量的基本要求 |
| 可测位置 | 状态机与编排放 `src/app/local-docs/*.ts`（纯函数 + 注入依赖），**不放进组件** | 口径同扩展的 `worker-run.ts`：不放进入口文件等于没有门禁 |

### 4.8 插件分发（R9）

| 项 | 决定 | 依据 |
| --- | --- | --- |
| ZIP 由谁产 | `npm run build:extension`（既有脚本）追加产出 `public/md-convertor-extension.zip` | 单一构建入口，不新增脚本 |
| 打进桌面产物 | 由既有 `public/` 通道完成（`scripts/prepare-desktop.mjs` 已复制 `public/`；`public/fonts` 就是这么进包的） | 零新机制 |
| 触发时机 | `package.json` 加 `"prebuild": "npm run build:extension"`，任何 `next build`（含 `init.sh`、`desktop:make`、e2e 的重建）都会带上 ZIP | 一行 npm 约定；避免「忘了先构建插件」导致按钮 404 |
| ZIP 内容 | `md-convertor-extension/` 目录 + 其中的 `manifest.json` / `content.js` / `worker.js` / `使用说明.md` | 「加载已解压的扩展程序」要求一个目录；说明放在同目录最容易被看到 |
| 打包工具 | macOS 自带 `ditto -c -k --keepParent`（`/usr/bin/ditto`），**不装 zip 库** | 产品只做 darwin/arm64；零新依赖 |
| 忽略 | `.gitignore` 加 `public/*.zip` | 构建产物不进版本库（同 `extension/dist/`） |
| 断言 | 测试用 `unzip -Z1` 列出条目，断言恰好是上面 4 个文件（macOS 自带 `unzip`） | 防止「ZIP 里少了 worker.js」这类静默失败 |
| 使用说明 | `extension/使用说明.md`（加载步骤、点一下会发生什么、权限只有三项、图片落在哪、已知限制） | 用户原话「zip 内含使用文档」 |

### 4.9 测试分层与门禁

| 层 | 内容 | 进 `init.sh`？ |
| --- | --- | --- |
| ① 纯函数单测（vitest） | 路径守卫与 parity、去重判定与标记解析、图片内联、批次计划与状态机、fs 码文案 | ✅ |
| ② 路由单测（vitest + 临时目录） | `/api/local-docs/scan`、`/api/local-docs/process` 对真实临时目录读写 | ✅ |
| ③ 设置/首页组件测试（jsdom） | 输入目录卡片、模式选择器、本地文档面板的降级态 | ✅ |
| ④ e2e（Playwright，既有项目） | 默认模式未变（像素锁）、切换模式、插件 ZIP 可下载、stub 桥接下的扫描/勾选/一键转化/跳过提示/源=输出拒绝 | `npm run test:e2e`（门禁，非内循环） |
| ⑤ 真机人工验收（S4 清单） | 真目录 + 真对话框 + 真落盘 + 真翻译 + 断网开产物 | 不进（只能人跑） |

---

## 5. 阶段划分

| 阶段 | 内容 | 交付物 |
| --- | --- | --- |
| **S1** | 版本面 bump `0.3.7` + 输入目录设置 + 系统下载目录来源 + 服务端路径守卫 + 扫描路由 + 去重判定纯函数 | `Settings.input`、`MD_CONVERTOR_DOWNLOADS_DIR`、`src/lib/local-docs/{paths,dedup}.ts`、`POST /api/local-docs/scan`、设置页「输入目录」卡片 |
| **S2** | 单文件加工管线：Markdown 级图片内嵌 + 可选翻译 + 产物标记 + 产出路由 | `src/lib/local-docs/inline-images.ts`、`images.ts` 导出重构（行为不变）、`POST /api/local-docs/process` |
| **S3** | 首页模式选择器 + 插件下载按钮 + 本地文档面板 + 批量编排与反馈 | `src/app/page.tsx` 的选择器、`src/app/local-docs/**`、逐条状态 + 汇总 + 打开目录 |
| **S4** | 插件分发包 + 端到端/人工验收 + 文档收口 | `extension/使用说明.md`、`public/md-convertor-extension.zip`（含 `prebuild` 接线）、验收清单与全部文档同步 |

S1/S2 是逻辑与管线（可完全机器验证，但 S1 改了设置字段与主进程环境面 ⇒ 必须同步文档）；S3 是界面与编排（**唯一新增 IPC 面的阶段**）；S4 是分发与收口。四阶段各自独立提交，顺序执行（S2 的第一个任务依赖 S1 的路径守卫，S3 依赖 S1+S2 的接口）。

---

## 6. 验收标准

机器验收：

1. `./init.sh` 全绿（lint / typecheck / 单测 / 生产构建；既有 1067 用例不红）。版本面四处一致（`package.json` = `package-lock.json` = `feature_list.json`.currentVersion = `release-desktop.mjs` 的目标）。
2. `npm run test:e2e` 全绿：默认模式与现有像素锁未变；模式可切换；插件按钮指向 `/md-convertor-extension.zip` 且能下载；stub 桥接下的本地文档流程（扫描 → 勾选 → 一键转化 → 逐条状态 → 汇总）走通；源=输出被拒绝；桥接抛异常时界面有可读报错（不静默）。
3. `unzip -Z1 public/md-convertor-extension.zip` 恰好列出 `md-convertor-extension/{manifest.json,content.js,worker.js,使用说明.md}`。
4. 去重：同一批连续转化两次 ⇒ 第二次全部「已处理，跳过」（不发起处理请求）；改其中一个源文件的一个字节 ⇒ 只有它重新处理。
5. 图片：含远端图与本地相对路径图的 fixture ⇒ 产物里是 `data:` URL，无网络引用；断网（e2e 用 `route` 拦截）打开仍可渲染。

产品验收（人工清单，S4 执行；**状态：未开始**）：

6. 首页出现模式选择器，默认仍是现在的「粘贴 · 链接转换」；内层两个 tab 与原来一致。
7. 点「下载浏览器插件」→ 下载目录出现 ZIP → 解压后按 `使用说明.md` 能在 Chrome 里「加载已解压的扩展程序」。
8. 切到「本地文档」→ 自动按设置里的输入目录（默认系统下载目录）扫描并列出 `.md`；「选择目录」换目录后自动重新扫描；「恢复默认」回到下载目录。
9. 全选 / 单选 → 「一键转化」→ 逐条状态推进 → 收尾汇总；输出目录出现产物，源目录原文件**未被改动**。
10. 勾选翻译 → 产出为译文（复用既有 Provider），行状态注明「只翻译了非目标语言部分」。
11. 断网打开产物 → 图片可见。
12. 输出目录选成输入目录 → 被拒绝，点建议按钮后输出目录变成 `<输入目录>/processed`。

---

## 7. 风险与未验证

| 项 | 现状 | 触发条件与处置 |
| --- | --- | --- |
| 30 图上限会正好命中插件产物 | **已知会命中**：T3.4 人工验收用过 40 图页面 | UI 必须把「N 张图未内嵌」显式写出（S3），否则用户会以为图片丢了；是否抬上限是产品决定（V4） |
| 图片内嵌后的 md 体积 | 网页端实测「2 MiB data URL 通过」，`MAX_MARKDOWN_BYTES = 20 MiB` | 大图多的文档可能撞 20 MiB 上限；撞到即保留原引用 + warning，不静默 |
| 本地图片读取的根目录 | 未验证 | 相对路径解析以源 md 所在目录为根并拒绝 `..` 逃逸；绝对路径图片是否允许（在源目录外）**需在 S2 实现时定**，默认**拒绝**（只允许源目录树内 + `http(s)` + `data:`） |
| `ditto` 写出的 ZIP 里中文文件名 | 未验证 | `ditto` 写 UTF-8 名；若某个解压工具乱码，说明文件里的步骤仍可读（或改名为 `README.md`，一行的事） |
| 「产物被手工编辑」不触发重做 | 设计决定（§4.6） | 用户改过产物后不会重做；逃生口是「重新处理」 |
| 翻译的进程级互斥 | 已读代码确认存在（`taskInFlight`） | 批量天然串行；若将来放开并发，翻译锁必须先改 |
| 批处理中途退出 | 未验证 | 已写完的产物与标记保持有效（逐条原子），未处理的仍是 `new`；重跑即续作 |
| 桥接在 e2e 里是桩 | 既有约束：mock 桥接抓不到「异常被 `void` 吞掉」这类问题（feat-041 教训） | 桩要能**抛**；真对话框 + 真落盘归人工验收（S4 第 8–12 条） |
| `prebuild` 让 `next build` 依赖 esbuild | 新耦合 | 好处是 ZIP 永远不会忘构建；代价是纯桌面构建多花约 1 秒。若将来拆分发布流程，可改成只在 `desktop:prepare` 前跑 |

---

## 8. 依据（本轮引用的既有事实）

- 需求与线路：`docs/PRD-app-document-processing.md`（§3 六条 2026-09-24 裁定）、`docs/PLAN-browser-extension.md` §3 交接契约、§5.4、§6 四组已裁定规则。
- 复用目标：`src/lib/images.ts`（`embedImages` 收 HTML 字符串 + `fetchPublicResource` 只认 `http(s)` + `MAX_IMAGES`/`MAX_SOURCE_IMAGE_BYTES`/`OPTIMIZE_THRESHOLD_BYTES`）、`src/lib/markdown.ts`（`cleanFilenameStem`、`MAX_MARKDOWN_BYTES`）、`src/lib/translate/run.ts`（`analyzeTranslation`/`runTranslation`/`taskInFlight`）。
- 写盘与 IPC：`electron/output.mjs`（`select-directory`/`save-file`，双重校验）、`electron/preload.cjs` 与 `electron/preload-contract.cjs`（`isAbsoluteDirPath` 同规）、`src/app/settings/client.ts`（`OUTPUT_CODE_MESSAGES` 六个 fs 码）。
- 设置面：`src/types/settings.ts`（`SETTINGS_VERSION = 1`；`output` 是当时唯一允许缺失的键；`src/types/settings.ts:247` 的注释即其理由）。
- 环境传递：`electron/env.mjs` 的 `buildServerEnv({baseEnv, pathEnv, userDataDir, secrets, dotEnv})`、`electron/main.mjs:133` 的调用处（`pathEnv` 已是拿 `app.getPath("home")` 算出来的 ⇒ `app.getPath("downloads")` 走同一个位置就行）。
- 打包边界：`scripts/prepare-desktop.mjs:66`（`public/` → 产物根）、`.gitignore`（已有 `extension/dist/`、`.next/`、`.desktop/`）。
- 首页与 e2e：`src/app/page.tsx`（现有 `modeTabs` 与翻译开关）、`e2e/home.spec.ts`（textarea/source/submit 像素锁）、`e2e/settings.spec.ts`（桥接桩 663–721 行）、`e2e/geometry.ts`（`rectsInOneFrame`）。
- 结构范本：`docs/features/browser-extension/FSD.md` 与 `S1-convert-core.md`（章节形态、Tasks 表列头）、`docs/features/default-save-path/FSD.md` 与 `S1-settings-and-ipc.md`（设置 + IPC 阶段的做法）。
