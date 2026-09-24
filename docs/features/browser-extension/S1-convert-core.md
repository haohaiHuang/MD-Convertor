# S1 — 转换核心与构建/门禁接线（Spec / Plan / Tasks）

- 上游：`docs/features/browser-extension/FSD.md`
- 前置：无（本阶段不碰桌面端、不改版本；**这不是 S0**，见 FSD §0）
- 状态：**待实施**
- feature_list id：`feat-040`

## Spec

**目标**：把「DOM → 正文 → Markdown + 图片清单」这一段做成**无 Node 依赖的纯函数**，用 vitest（node 环境 + jsdom 造 DOM）锁住行为，并用一次真实浏览器页面上下文的冒烟证明产物确实能在浏览器里跑。本阶段结束时**还没有扩展**（没有 manifest、没有 service worker、没有写盘）。

**关键决定**（细节见 FSD §3.1–§3.4、§3.6、§3.7）：

1. 目录：`extension/src/convert/`（核心）+ `extension/tests/`（fixture 与浏览器冒烟）；产物 `extension/dist-test/`（gitignore），S2 才产出 `extension/dist/`。
2. 核心 API **只收 DOM**（`Document` / `Element`），不收 HTML 字符串——`turndown` 的 `package.json` 把 `@mixmark-io/domino` 映射为 `false`，bundle 后喂字符串会拿到空 stub（FSD §3.6）。
3. **净化实例由调用方注入**（`deps.sanitize`）：Node 侧注入 `createDOMPurify(jsdomWindow)`，浏览器侧注入 `DOMPurify` 本身（FSD §3.2.1）。
4. 净化配置与 Turndown 配置**照抄桌面端口径**（`src/lib/extract.ts:22`、`src/lib/markdown.ts:277`），文件名净化照抄 `src/lib/markdown.ts:46`；这是 R3/R7 的唯一保证方式（不共享代码，靠口径对齐 + 两边各自单测）。
5. 图片：只收集 http(s)；`data:` 原样留在 md 里；同 URL 去重；md 里写占位符 `md-convertor-image-<n>`（FSD §3.3）。
6. 提取失败（Readability 无正文）**不兜底**，返回 `null`，由上层的失败路径处理（FSD §3.2.4）。
7. 构建：esbuild（`^0.28.1`，新增 devDependency）`platform: "browser"` + `bundle` + `minify`；本阶段只产出一个**测试用**入口 `extension/dist-test/core.js`（IIFE，`globalName: mdConvertorCore`），供浏览器冒烟使用。
8. 新增 devDependency：`esbuild`、`@types/chrome`（后者本阶段只为了让 `tsc` 认识将来要用的 `chrome` 命名空间都可以先不装；**S2 装**）。

**非目标**：manifest、service worker、content script、`chrome.*` 调用、写盘、反馈、`extension/dist/`（全属 S2）；不改 `playwright.config.ts` 既有三个项目、不改 `run-e2e.mjs`、不改 `init.sh` 的流程（只让它自然收进新单测）。

## Plan

### 1. 仓库骨架与构建（T1.0）

- `extension/src/convert/{index,extract,markdown,images,naming,sanitize}.ts`
- `scripts/build-extension.mjs`：
  - 入口（本阶段）`extension/src/convert/index.ts` → `extension/dist-test/core.js`（`format: "iife"`、`globalName: "mdConvertorCore"`、`platform: "browser"`、`target: "chrome110"`、`bundle: true`、`minify: true`、`sourcemap: false`）；
  - S2 在此文件里追加 `content.ts` / `worker.ts` 两个入口 → `extension/dist/`；
  - 末尾打印每个产物的大小（S2 起同时做「无 Node 内置模块」自检）。
- `package.json`：`"build:extension"`、`"test:extension"`（= 构建 + `playwright test --config=playwright.extension.config.ts`）；devDependencies 加 `esbuild`。
- `.gitignore`：`extension/dist/`、`extension/dist-test/`。`eslint.config.mjs` 的 `globalIgnores` 加 `extension/dist/**`、`extension/dist-test/**`。
- `vitest.config.ts`：coverage 的 `include` 追加 `"extension/src/**/*.ts"`，并给四个核心文件加阈值（`lines 90 / branches 80 / functions 100 / statements 90`，与项目既有密度一致）。单测的收集**无需配置**（vitest 默认 include 已覆盖 `extension/**`，且 `environment: "node"` 不变）。

### 2. `extension/src/convert/sanitize.ts`

`createSanitizer(purify)` → `(html: string) => string`，配置照抄 `src/lib/extract.ts:22`（`USE_PROFILES: { html: true }`、`FORBID_TAGS`、`FORBID_ATTR: ["style", "srcdoc"]`、`ALLOW_DATA_ATTR: false`）。

### 3. `extension/src/convert/extract.ts`

`extractArticle(document: Document, sourceUrl: string, deps: { sanitize }): ExtractedArticle | null`

- 微信特判：host 为 `mp.weixin.qq.com` 且存在 `#js_content` 时走专用分支（`data-src` 提升为 `src`，文本长度 < 50 → 返回 `null`）。
- 常规分支：`document.cloneNode(true)` → `new Readability(clone, { charThreshold: 50 }).parse()`；无 `content` → `null`。
- 标题回退：`meta[property="og:title"]` → `document.title` → `"未命名网页"`。
- `textLength` 用**临时元素**（`document.createElement("div")` + `innerHTML` + `textContent.length`）算，不再造第二个 jsdom（桌面端那里是为 jsdom 便利，浏览器不需要）。
- 返回 `{ title, html: 净化后的 html, textLength }`。

### 4. `extension/src/convert/images.ts`

`collectImages(root: Element, baseUrl: string): { images: ImagePlan[]; html: string }`

- 遍历 `img[src]`：取值顺序 `data-src` → `data-lazy-src` → `currentSrc` → `src`；用 `new URL(value, baseUrl)` 绝对化；非 http(s) 跳过（`data:` 原样留下）。
- 同 URL 去重（第一个出现者获得序号，后面的 img 复用同一占位符）。
- 每个候选：`img.setAttribute("src", "md-convertor-image-<n>")`，并移除 `srcset` / `sizes` / `loading`。
- 返回被改写后的 `html`（或直接在传入的克隆上改，接口以「改完返回」为准，便于测试断言）。

### 5. `extension/src/convert/markdown.ts`

`htmlToArticleMarkdown(html, { title, sourceUrl, convertedAt, images }): string`

- h1 去重（首个 h1 文本等于标题则删掉）、链接绝对化、`normalizeMultiCodeBlocks` 的等价处理（相邻围栏块合并规则照抄桌面端口径）。
- Turndown 配置照抄 `src/lib/markdown.ts:277`；`turndown.use(gfm)`；`turndown.remove([...])`。
- 头部两行与桌面端同形：`# <标题>` + 空行 + `> 来源：[<url>](<<url>>)` + `> 转换时间：<ISO>` + 空行 + 正文 + 尾部空行。
- **本阶段不做占位符回写**（那是 SW 的活，S2 T2.4）。

### 6. `extension/src/convert/naming.ts`

`cleanFilenameStem(value)`（照抄规则）、`mdFileName(title)`、`imageDirName(title)`、`imageFileName(index, url)`（`<三位序号>-<slug>.<ext>`，slug ≤ 40 字符，扩展名白名单 `png/jpg/jpeg/gif/webp/avif/svg/bmp`）、`fallbackName(url)`（`page-<6 位短哈希>`）。

### 7. `extension/src/convert/index.ts`

`buildArticle(document, sourceUrl, deps: { sanitize, now }): { title, markdown, images, sourceUrl } | null`：串起提取 → 图片收集 → md 生成。`now` 注入以便测试固定时间戳。

### 8. fixture 与测试

- `extension/tests/fixtures/article.html`（含导航/侧栏/页脚/GFM 表格/围栏代码/中文/惰性图/`data:` 图/重复图/`onerror` 与 `javascript:` 链接）、`wechat.html`、`no-article.html`。
- 单测：`extension/src/convert/*.test.ts`（jsdom + `createDOMPurify(window)`）。
- 浏览器冒烟：`extension/tests/core-smoke.spec.ts` + `playwright.extension.config.ts`（`testDir: "./extension/tests"`、只 chromium、`workers: 1`、无 `webServer`；启动参数可选地从 `MD_CONVERTOR_EXTENSION_CHROMIUM_ARGS` 读，沙箱内用 `--no-sandbox,--disable-gpu`）。冒烟用 `page.setContent(fixture)` + `page.addScriptTag({ path: "extension/dist-test/core.js" })`，在页面里调 `globalThis.mdConvertorCore.buildArticle(document, location.href, { sanitize: DOMPurify … })` —— **注意**：浏览器侧净化实例需在页面里给，冒烟脚本用一个最小 `sanitize` 桩（`DOMPurify` 不随 bundle 一起暴露），只断言「提取 + 图片清单 + md 文本」在浏览器里跑得通。

## Tasks

| id | 任务 | RED（先写失败测试） | 完成条件 | 验证 |
| --- | --- | --- | --- | --- |
| T1.0 | 仓库骨架 + 构建脚本 + npm 脚本 + ignore/coverage 接线 | 先加 `npm run build:extension` 与 `extension/tests/extension-build.test.mjs`（断言 `extension/dist-test/core.js` 存在、非空、且不含 `require("node:` / `jsdom` / `domino` 字样）⇒ 当前因脚本缺失而 failed | `build:extension` 成功产出 `dist-test/core.js`；该测试 passed；`eslint`/`tsc` 对 `extension/**` 无报错 | `npm run build:extension && npx vitest run extension/tests/extension-build.test.mjs` |
| T1.1 | 净化 + 标题回退 + md 骨架（h1 去重、链接绝对化、围栏代码、头部两行） | `extension/src/convert/markdown.test.ts`：`<script>`/`onerror`/`javascript:` 必须消失；标题重复的 h1 被删；相对链接绝对化；时间戳来自注入的 `now` ⇒ 先 failed | 全部 passed | `npx vitest run extension/src/convert/markdown.test.ts` |
| T1.2 | 正文提取（Readability + 微信分支 + `textLength` + 失败返回 null） | `extract.test.ts`：导航/侧栏/页脚不出现在 `html`；`no-article.html` → `null`；微信 fixture 走 `#js_content` 且 `data-src` 被提升；短文本微信页 → `null` ⇒ 先 failed | 全部 passed（含既有 `wechat-code-comparison` 口径不回归——它属桌面端，不受影响） | `npx vitest run extension/src/convert/extract.test.ts` |
| T1.3 | 图片收集、去重与占位符 | `images.test.ts`：惰性图取 `data-src`；相对路径按 baseUrl 绝对化；`data:` 图不入选且原样保留；同 URL 只占一个序号；`srcset` 被移除 ⇒ 先 failed | 全部 passed | `npx vitest run extension/src/convert/images.test.ts` |
| T1.4 | 文件名/目录名净化与图片命名 | `naming.test.ts`：`<>:"/\|?*` 与控制字符被替换；尾部点/空白被去；`title` 为空或保留名 → 回退名；中文保留；扩展名白名单外的 URL 不带扩展名；md 名与 `.images` 目录名同源 ⇒ 先 failed | 全部 passed | `npx vitest run extension/src/convert/naming.test.ts` |
| T1.5 | 合成入口 `buildArticle()` 的整篇基线 | `index.test.ts`：一篇 fixture 的 md 与「图片清单 + 占位符位置」符合固定快照（含 `convertedAt` 用注入时间）⇒ 先 failed | 全部 passed | `npx vitest run extension/src/convert/index.test.ts` |
| T1.6 | 浏览器内冒烟（证明无 Node 依赖） | `extension/tests/core-smoke.spec.ts` 断言页面上下文里能产出同形 md 与图片清单 ⇒ 先 failed（产物与全局名尚不存在） | 冒烟 passed（`--project=chromium`，只跑这一个 spec） | `npm run build:extension && npx playwright test --config=playwright.extension.config.ts` |
| T1.7 | 阶段收尾 | — | `./init.sh` 全绿（新单测已自然收进 `npm test`；桌面既有 999 用例不红）；`CHANGELOG.md` 不加条目（本阶段无用户可见变化） | `./init.sh` |

## Handoff

- 结束时必须写清：核心 API 的**输入是 DOM 不是字符串**（原因：domino 被 `browser` 字段映射为 `false`）；净化实例与 `now` 是**注入**的；图片只收 http(s) 且去重；占位符形如 `md-convertor-image-<n>`（S2 的回写函数依赖它的确切形状）；文件名/目录名同源派生。
- 已知限制：本阶段没有任何 `chrome.*` 调用，产物 `extension/dist-test/core.js` **不是可加载的扩展**；`extension/dist/` 尚不存在；S2 的第一个任务是事实探针（无手势注入、`downloads` 补扩展名、`overwrite` 行为），未出结论前不要写 SW 编排。
