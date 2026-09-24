# FSD 总纲 — 浏览器插件（Browser Extension，B）

- 状态：**实施中（2026-09-24）**：S1 已完成（转换核心 + 构建/门禁接线），S2 / S3 未开工
- 日期：2026-09-24
- 上游：`docs/PRD-browser-extension.md`（需求已确认，§3 六条已裁定）+ `docs/PLAN-browser-extension.md`（线路方向、边界、工程决策）
- 阶段执行文档：`S1-convert-core.md`、`S2-extension-shell-and-writes.md`、`S3-e2e-and-acceptance.md`
- feature_list id：`feat-040`
- 同线路另一产品（A 桌面端「文档处理」，`feat-042`）：**与本块无顺序依赖、无代码依赖**，本轮不在范围内

## 0. 本轮三个前提（要改先回来改本文件）

1. **B 先做、A 另案**。`feature_list.json` 里 `feat-040 → feat-042` 的依赖已删除；A 是否做、何时做、做成什么样，都不影响 B 的验收。B 的产物是给「任何 Markdown 工具」用的文件，不欠任何消费者。
2. **不共享代码**（B 自带转换核心，`extension/src/convert/`）。**不改桌面端任何文件**（`src/`、`electron/`、`tests/`、打包配置）。理由与代价见 §3.8。
3. **桌面版本面不动**：B 不产生桌面产物、不跑 `desktop:release`，因此**不需要**把 `0.3.6` bump 到 `0.3.7`（`AGENTS.md` 那句「再改代码前先 bump」只在改动桌面代码时触发）。插件版本由 `extension/manifest.json` 自管，起点 `0.1.0`；插件的任何版本都不进桌面发布门禁。

---

## 1. 需求拆解

用户原话（2026-09-22 定方向）：

> 在浏览器里读到一篇好文章（可能是登录后才看得到的、图片挂在带会话的 CDN 上），想一键把它变成 Markdown 存到本地，图片一起带下来。

拆成可验证的行为（编号沿用 PRD §2，确认结果见 PRD §3）：

| 编号 | 行为（用户可观察） |
| --- | --- |
| R1 | 点一次浏览器工具栏图标，当前页被转换；不碰其它页面 |
| R2 | 结果里只有正文：导航、侧栏、页脚、评论都不在 |
| R3 | 正文与文本转换规则和桌面端一致（图片表示两端不同，见 §3.8） |
| R4 | 图片落到下载目录的 `<标题>.images/`，正文用相对路径引用 |
| R5 | 产物写在系统下载目录根，**桌面端不需要在运行** |
| R6 | 抓不到的图片保留原始 URL，并在正文里留下可见标记 |
| R7 | 脚本、事件属性、`javascript:` 链接被剥除 |
| R8 | 成功/失败都有可感知提示（角标 ✓ / !，悬停看详情） |

---

## 2. 目标与非目标

**目标**：

1. 一个 MV3 扩展：工具栏点击 → 提取当前页正文 → 转 Markdown → 收图落盘 → 写 `<标题>.md`。
2. 产物形态固定为 `<标题>.md` + 同级 `<标题>.images/`，正文相对引用（B 的对外契约，见 PRD §4）。
3. 读不到/下不来的图片不静默丢：留原 URL + HTML 注释标记 + 角标告警。
4. 只用当前页 DOM 与浏览器自身的下载能力：**不申请 `host_permissions`**，权限只有 `activeTab` + `scripting` + `downloads`。
5. 全程 TDD（RED → GREEN → REFACTOR），证据写进 `feature_list.json`。

**非目标**（越界先回来改本文件）：

- 不做 Firefox / Safari 版本、不做批量抓取/爬取、不做账号与同步、不发布扩展商店（线路级非目标，见 PLAN §8）。
- 插件内不做翻译、不碰任何密钥、不申请任何与翻译相关的权限。
- 不做预览、不做右键菜单、不做 popup、不让用户改文件名（PRD §3 已裁定）。
- 不做「整页兜底提取」：Readability 挑不出正文就报失败（理由见 §3.2）。
- 不做 MV3 保活机制：先按风险登记（§6），人工验收用大图量文章压一次，真被打断再加。
- 不动桌面端：不改 `src/`、`electron/`、`forge.config.cjs`、`playwright.config.ts` 的既有项目（只允许**新增** `extension` 项目，若届时确需新增）。
- 不引入打包框架：不装 vite/webpack/rollup，只用已在 `node_modules` 里的 esbuild（§3.6）。

---

## 3. 架构决定

### 3.1 运行形态与注入

| 项 | 决定 | 依据 |
| --- | --- | --- |
| manifest | MV3，`action`（无 popup）、`background.service_worker`、无 `content_scripts` 声明 | 静态 `content_scripts` 会在**每个**页面常驻，我们只需要用户点击的那一次 |
| 触发 | `chrome.action.onClicked`（唯一入口） | PRD §3-1 裁定（工具栏按钮） |
| 注入 | `chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] })` | 用户手势授权 `activeTab`，正是「只处理你主动点击的当前页」的边界 |
| 权限 | `["activeTab", "scripting", "downloads"]`；**`host_permissions` 为空** | 探针实测：`chrome.downloads.download()` 对 HTTP(S) 会带上该 host 的 cookie，所以收图不需要 host 权限（PLAN 附录 A.3.1） |
| 转换在哪跑 | **content script**（页面上下文，有 DOM 与 `DOMParser`） | MV3 service worker **没有 `DOMParser`**，Turndown 解析 HTML 需要它；offscreen document 是多余的活动部件（探针 A.3.2 已确认不需要） |
| 写盘在哪编排 | **service worker** | `chrome.downloads` 只在扩展上下文可用；content script 拿不到 |
| 两者之间 | `chrome.runtime.sendMessage` 一条消息，`sender.tab.id` 关联 | 单次往返，无需状态机 |

特权页（`chrome://`、扩展页、`file://`、商店页）注入会被浏览器拒绝——按预期处理：角标 `!` + 工具提示「这个页面不允许扩展读取」。

### 3.2 转换核心（`extension/src/convert/`）

纯函数，**无 Node 依赖**，输入是「我手里已经有一个 DOM」，所以浏览器（live DOM）与 vitest（jsdom 造的 DOM）跑的是同一份代码：

```ts
// S1 已交付的真实签名（`extension/src/convert/`）
buildArticle(document, sourceUrl, { sanitize, now }) → { title, markdown, images, sourceUrl } | null
  extractArticle(document, sourceUrl, { sanitize })    → { title, html, textLength } | null
  collectImages(root: Element, baseUrl)                → { images: ImagePlan[]; html: string }
  htmlToArticleMarkdown(root: HTMLElement, opts)       → string
  createSanitizer(purify)                              → (html: string) => string
```

`ImagePlan = { index, url, placeholder }`，`placeholder = "md-convertor-image-<n>"`；`opts = { title, sourceUrl, convertedAt }`。**`htmlToArticleMarkdown` 只收 `HTMLElement`，不收 HTML 字符串**（Turndown 只接受 `string | HTMLElement | DocumentFragment`，而且字符串会走 `DOMParser` 分支拿到被映射为空的 `domino` stub）。

关键决定：

1. **净化实例由调用方注入**（`opts.sanitize`）：Node 里必须 `createDOMPurify(window)`，浏览器里 `import DOMPurify` 得到的已是实例（探针 A.3.3）。核心不认识环境，环境适配层负责喂。
2. **净化配置与桌面端同源**（`FORBID_TAGS: script/style/iframe/object/embed/form/svg/math`、`FORBID_ATTR: style/srcdoc`、`ALLOW_DATA_ATTR: false`）——照抄 `src/lib/extract.ts:22` 的口径，R7 才成立。
3. **Turndown 配置照抄桌面端**（`atx` / `-` / `fenced` / `*` / `**` / `inlined` + `gfm`），R3「文本转换规则一致」才成立。
4. **不做整页兜底**。桌面端有 `extractBodyFallback` 是因为它已经付了抓网页的代价，白跑一次可惜；插件失败零成本，兜底只会把导航页脚塞进正文。挑不出正文 → 报失败。
5. **只导出 http(s) 图片**。`data:` 图片留在 md 里原样（它本来就是内嵌的、断网可看），因为给 `data:` 图起文件名要猜扩展名。这不是丢东西。
6. **惰性图片取值顺序**：`data-src` → `data-lazy-src` → `currentSrc`/`src`（与桌面端富文本粘贴的惰性图规则同款）。**注意顺序**：Readability 会丢掉所有 `data-*`，所以常规分支要在 `document.cloneNode(true)` 之后、`new Readability(...)` 之前先做一次提升，否则正文里的 `src` 已是被替换过的占位图（桌面端只有微信分支做提升，插件两条分支都做，见 `S1-convert-core.md` 的 Result）。

### 3.3 图片落盘与引用回写

| 项 | 决定 |
| --- | --- |
| 请求 shape | `chrome.downloads.download({ url, filename: "<dirName>/<n>-<slug>.<ext>", conflictAction: "overwrite", saveAs: false })` |
| 目录/文件名 | `dirName = cleanFilenameStem(title) + ".images"`；每个图片序号 + URL basename slug；扩展名从 URL pathname 取（白名单内才用，未知则不带） |
| 去重 | 同一次转换里**相同绝对 URL 只下载一次**，占位符复用（收集阶段就把重复 img 的 `src` 设成同一个占位符） |
| 占位符 | md 里写成 `![](md-convertor-image-3)`（纯词，不含 `:` `/`，Turndown 不会改写它） |
| 引用回写 | 纯函数 `rewriteImageReferences(markdown, plans)`：成功 → `![](dirName/实际文件名)`；失败 → `![](原始 URL)` + **下一行**独立 HTML 注释 `<!-- 图片未下载：<url> -->` |
| 实际文件名核对 | 下载完成后用 `chrome.downloads.search({ id })` 读**真实**路径，取其 basename 作为引用（Chrome 可能自己补扩展名——所以不猜）；若真实父目录名 ≠ `dirName`，视为失败（宁可退回原 URL，也不写出指向找不到的文件的引用） |
| 并发与等待 | 上限 4 个并发。等结束**用轮询 `chrome.downloads.search({ id })` 而不是监听 `onChanged`**（实测下载可能在 `download()` resolve 前就已结束，事后挂监听会漏掉那次事件；轮询还能在同一次调用里拿到真实路径）；单张超时 60s，超时未完成的按失败处理 |
| md 一定写 | 除非提取阶段就失败，否则**总是写 md**（部分成功好过全丢），失败的图按上面的规则标记；角标 `!` + 工具提示给出「N 张图未下载」 |

`overwrite` 而不是 `uniquify`：Chrome 的 `uniquify` 只改 md 名字（`标题 (1).md`），`.images/` 目录名不变，**一次重复导出就会把文件对拆散**。覆盖才能让「一对文件」永远同步，也和桌面端已发布的同名覆盖口径一致（同时意味着**不加时间戳**）。

### 3.4 标题与文件名净化

照抄桌面端 `src/lib/markdown.ts:46`（`cleanFilenameStem`）的规则：`<>:"/\|?*` 与控制字符 → `-`；去掉首尾的空白与点；折叠连续空白；中文原样保留；上限 80 字符；净化后为空或命中保留名（`CON`/`PRN`/…）时回退 `page-<短哈希>`。md 文件名与 `.images/` 目录名**同源派生**，永远成对。

### 3.5 反馈

`chrome.action.setBadgeText`（`✓` / `!`，进行中 `…`）+ `chrome.action.setTitle`（详情：成功张数、失败张数、失败原因首条）。徽标 4 秒后清空。不做通知、不做 popup（PRD §3 裁定）。

### 3.6 仓库与构建

| 项 | 决定 |
| --- | --- |
| 位置 | `extension/`（`src/` 源码、`dist/` 产物、`tests/` 测试脚手架），仓库根下与 `src/` 并列 |
| 打包进桌面产物？ | **不会**。`forge.config.cjs` 的 `ignore` 是保留清单（只留 `package.json` + `electron/`），所以新增 `extension/` 天然不进 asar，也**不需要**改打包配置或 `tests/forge-package-scope.test.ts` |
| 构建 | `npm run build:extension` → `scripts/build-extension.mjs`（esbuild，`platform: "browser"`、`bundle: true`、`minify: true`） |
| 产物 | `extension/dist/{manifest.json, worker.js, content.js}`；测试用 `extension/dist-test/`（gitignore）。**不做专属图标**（工具栏先显示浏览器默认图标） |
| 依赖 | 复用已有运行时依赖（`@mozilla/readability`、`turndown`、`turndown-plugin-gfm`、`dompurify`）；**新增 devDependency：`esbuild`（`^0.28.1`，当前已在 `node_modules` 里 0.28.1，只是传递依赖）与 `@types/chrome`** |
| domino / jsdom 残留 | `turndown` 的 `package.json` 有 `"browser": { "@mixmark-io/domino": false }`，esbuild 会把它替换成空模块 → 浏览器产物天然不依赖 Node DOM。代价：**bundled 版不能给 Turndown 喂字符串**（喂了会拿到空 stub），核心 API 一律收 DOM 节点/元素 |

### 3.7 测试分层与门禁

| 层 | 内容 | 入口 | 进 `init.sh`？ |
| --- | --- | --- | --- |
| 1 纯函数单测 | 提取 / 净化 / 标题与文件名 / 图片占位符与清单 / 引用回写 / md 生成（vitest，`environment: "node"`，用 jsdom 造 DOM） | `npm test` | **是** |
| 2 编排单测（`chrome.*` 打桩） | SW 的 `run(tabId)`：消息关联、并发上限、成功/失败/超时矩阵、md 文本、角标 | `npm test` | **是** |
| 3 浏览器内冒烟 | esbuild 产物在真实页面上下文里跑核心，断言 md 片段与图片清单（证明「无 Node 依赖」不是嘴上说） | `npm run test:extension` | 否 |
| 4 扩展集成 | Playwright 加载**真实** MV3 扩展 + 本地 fixture 站（含 cookie 保护的图片），断言真实落盘 | 同上 | 否 |
| 5 人工验收 | 真机 Chrome 加载未打包扩展，跑两篇真实文章 + 一次重复导出 | 人工清单（S3） | 否 |

- **构建不进 `init.sh`**：`build:extension` 只在第 3/4/5 层前跑（每次门禁多跑一次 esbuild 收益小于成本）。
- **第 3/4 层自带一份 Playwright 配置**（`playwright.extension.config.ts`，`testDir: extension/tests`，只 chromium，`workers: 1`）：既有 `playwright.config.ts` 的三个项目与 `scripts/run-e2e.mjs`（桌面 e2e 门禁）**一律不动**，扩展测试不能拖慢或影响桌面门禁。
- **打桩方式**：SW 编排函数把 `chrome` 形状的依赖**当参数注入**（`run(tabId, { downloads, tabs, action, scripting, runtime })`），测试传手写 fake。不引入 sinon/proxyquire。
- **集成测试的已知缺口**：Playwright 点不到浏览器工具栏图标，`activeTab` 授权需要真实手势 → 第 4 层从 SW 侧直接调 `run(tabId)`。若届时实测无手势注入被拒，就用**测试专用 manifest 变体**（构建开关加 `host_permissions`，生产 manifest 不变），并把「工具栏点击 → activeTab 授权」这一段明确标为**只能人工验收**（第 5 层）。

### 3.8 与桌面端的关系（为什么这次不共享代码）

- 本轮裁定：**B 自带核心，零桌面端改动**。代价是两端「正文提取 + 文本转换规则」将来可能漂移；收益是 B 不碰已发布的桌面代码（不改 `extract.ts`/`markdown.ts`，不冒行为漂移风险，不需要 bump 版本）。
- 对冲：核心写成**纯函数 + 注入环境依赖 + 自带单测**。将来若 A 要「两端一字不差」，把 `extension/src/convert/` **搬**成共享模块、再让桌面壳委托过去即可——是移动，不是重写。
- 措辞修正：PLAN §4.4 原来写「两端输出必须一致」，严格讲从一开始就不成立（图片表示两端不同：插件相对路径 vs 桌面 base64；md 头部是否含转换时间也可能不同）。**能保证的是「正文提取结果与文本转换规则一致」**，这条已写进 PRD §3。

---

## 4. 阶段划分

| 阶段 | 内容 | 交付物 |
| --- | --- | --- |
| **S1** | 转换核心（纯函数）+ 仓库/构建/门禁接线 | `extension/src/convert/**` + `npm run build:extension` + 浏览器内冒烟通过；`init.sh` 收进第 1 层单测 |
| **S2** | 扩展外壳：manifest、SW 编排、content script、下载与回写、反馈 | `extension/dist/` 可加载的 MV3 扩展；第 2 层打桩单测绿；S2 首任务的事实探针结论落文档 |
| **S3** | 端到端集成 + 真机人工验收 + 文档收口 | 第 3/4 层绿；用户签字；`PROGRESS.md` / `CHANGELOG.md` / `feature_list.json` / `AGENTS.md` / `docs/TESTING.md` 同步 |

S1 是纯逻辑（可完全 CI 验证）；S2 是外壳与平台交互（事实探针先行）；S3 是真实环境证据与收口。三阶段各自独立提交。

---

## 5. 验收标准

实现验收（可机器验证）：

1. `./init.sh` 全绿（含第 1、2 层扩展单测；桌面既有 999 用例不红）。
2. `npm run build:extension` 产出 `extension/dist/` 四个必需项；产物中**不含** `node:` 内置模块、`jsdom`、domino 的引用。
3. `npm run test:extension` 两项目绿：真实扩展在 Playwright 中可以加载、转换、并把 `<标题>.md` + `<标题>.images/*` 真正写进 `downloadsPath`。
4. fixture 站里受 cookie 保护的图片被成功下载（证明「带会话」这条不是空话）；404 图退回原 URL 且带 `<!-- 图片未下载：… -->` 标记。

产品验收（人工清单，S3 执行并签字）：

5. 真机 Chrome「加载已解压的扩展程序」指向 `extension/dist`，点图标 → 下载目录根出现文件对；桌面端未运行。
6. 同一篇文章导出两次 → 第二次覆盖，文件对仍然成对（不出现 `标题 (1).md` 配 `标题.images/`）。
7. 一篇 ≥30 张图的文章压一次，观察是否有下载被打断（MV3 休眠风险，§6）。
8. 中文标题、含 `/` `:` 的标题各一次 → 文件名干净、可打开。

---

## 6. 风险与未验证

| 项 | 现状 | 触发条件与处置 |
| --- | --- | --- |
| 无手势注入是否可用（集成测试） | **未验证** | S2 首任务探针；不可用则走测试专用 manifest 变体 + 人工验收 |
| `chrome.downloads` 是否给无扩展名文件补扩展名 | **未验证** | S2 首任务探针；回写一律以 `search()` 的真实 basename 为准，本设计不依赖猜测 |
| MV3 后台休眠打断批量下载 | 未压测 | 先不做保活；验收第 7 条压一次，真被打断再按 `ponytail:` 注释处加保活（并发上限已降到 4） |
| 超大页面（DOM 克隆 + Readability） | 只测过小页面 | 识别到耗时 >3s 时不阻断（转换在 content script，慢就是慢）；必要时先记 `ponytail:` 再说 |
| md 体积超过 data URL 上限 | 探针实测 2 MiB 通过 | 超过约 4 MiB 罕见；失败会被角标暴露，不静默 |
| 「下载前询问保存位置」设置 | 非代码可控 | 写进人工验收说明：该项开着会逐张弹框 |
| `activeTab` 对 `file://` / 商店页无效 | 浏览器限制 | 角标 `!` + 可读原因 |

---

## 7. 依据（本轮引用的既有事实）

- 可行性与平台限制：`docs/PLAN-browser-extension.md` 附录 A（2026-09-22 Playwright + 临时 MV3 探针，18 项通过）。
- 桌面端口径照抄对象：`src/lib/extract.ts:22`（净化配置）、`src/lib/markdown.ts:46`（文件名净化）、`src/lib/markdown.ts:277`（Turndown 配置）。
- 打包边界：`forge.config.cjs` 的 `ignore` 为保留清单；`tests/forge-package-scope.test.ts` 从 `electron/main.mjs` 的 import 反推必需文件——两者都不受新增 `extension/` 影响。
- 结构范本：`docs/features/default-save-path/FSD.md` 与 `S1-settings-and-ipc.md`（阶段文档形态、Tasks 表列头）。
