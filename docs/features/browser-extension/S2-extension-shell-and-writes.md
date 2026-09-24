# S2 — 扩展外壳、注入与写盘编排（Spec / Plan / Tasks）

- 上游：`docs/features/browser-extension/FSD.md`（架构决定 §3.1、§3.3、§3.5）
- 前置：S1 完成（`extension/src/convert/**` 纯函数已绿、`npm run build:extension` 可用）
- 状态：**实施中 —— T2.0（事实探针）与 T2.1（外壳骨架）已完成**，T2.2 起待做
- feature_list id：`feat-040`

## Spec

**目标**：做出一个可加载的 MV3 扩展——点工具栏图标 → 读当前页 DOM → 转 Markdown → 收图落盘 → 写 `<标题>.md`，全程只在下载目录内写文件，并且编排逻辑用注入式 `chrome` 假对象就能测。

**关键决定**（细节见 FSD §3）：

1. **权限只有三个**：`activeTab`、`scripting`、`downloads`；`host_permissions` 为空；不声明静态 `content_scripts`，改用点击时 `chrome.scripting.executeScript({ files: ["content.js"] })`。
2. **职责切分**：content script 负责「提取 + 转换 + 图片清单」（它是唯一有 DOM/`DOMParser` 的地方）；service worker 负责「命名 + 下载编排 + 引用回写 + 写 md + 反馈」。
3. **消息契约（`extension/src/messages.ts` 一处定义，两端共用类型）**：

```ts
type ConvertRequest = { type: "md-convertor:convert" };
type ConvertPayload = {
  type: "md-convertor:article";
  title: string;
  markdown: string;                   // 含占位符 md-convertor-image-<n>
  images: { placeholder: string; url: string }[];
  sourceUrl: string;
  convertedAt: string;
};
type ConvertFailure = { type: "md-convertor:failed"; code: string; message: string };
```

**落地偏差（T2.1）**：`ConvertRequest` **未实现** —— 注入后的实际流程是 content script 单向上报，SW 不需要向它发请求（FSD §3.3 的契约里保留这个概念类型只为说明信任方向）。另：`convert` 只在 `http(s)` 页面生效，其余协议直接回 `UNSUPPORTED_PAGE`。

4. **无手势注入**：SW 侧的 `run(tabId, deps)` 是唯一编排入口，`deps` 是 `chrome` 形状对象（`{ tabs, action, scripting, downloads, runtime }`）。生产 worker.ts 只做两件事：把真实 `chrome` 传进去、把结果写成角标。
5. **注入 → 消息 → 编排**：注入 content.js 后，content 主动 `chrome.runtime.sendMessage(payload)`，SW 用 `sender.tab.id` 关联并带超时等待（10s）；content 报 `failed` 或超时 → 角标 `!` + 可读原因。
6. **写盘一律相对路径**（绝对路径会被浏览器报 `Invalid filename`），md 与图片目录名同源派生，`conflictAction: "overwrite"`（同名覆盖，让文件对永远同步）。
7. **md 总是写**（除非提取阶段失败）；图片失败退回原 URL + 独立一行 `<!-- 图片未下载：<url> -->`；角标告警。
8. **不做保活**：并发上限降到 4，超时 60s；真被打断再加（FSD §6）。

**非目标**：popup、右键菜单、预览、改文件名、翻译、图标（工具栏先显示浏览器默认拼图图标，需要专属图标时另开一轮）、`extension/dist/` 之外的产物。

## Plan

### 1. `extension/manifest.json`

```json
{
  "manifest_version": 3,
  "name": "MD Convertor — 网页转 Markdown",
  "version": "0.1.0",
  "description": "把当前网页抓成 Markdown，连图片一起存到下载目录。",
  "permissions": ["activeTab", "scripting", "downloads"],
  "action": { "default_title": "把当前页转成 Markdown" },
  "background": { "service_worker": "worker.js" }
}
```

### 2. `scripts/build-extension.mjs`（扩展 T1.0）

- 追加两个入口：`extension/src/content.ts` → `extension/dist/content.js`、`extension/src/worker.ts` → `extension/dist/worker.js`（IIFE、minify）；再把 `extension/manifest.json` 拷进 `extension/dist/`。
- 自检：产物文本里出现 `require("node:`、`jsdom`、`domino` 任一项即构建失败（T1.0 的断言从 `dist-test` 扩到 `dist`）。

### 3. `extension/src/content.ts`

- 顶层立即执行：`buildArticle(document, location.href, { sanitize: DOMPurify, now: () => new Date().toISOString() })`；成功 → `sendMessage(ConvertPayload)`；`null` → `sendMessage({ type: "md-convertor:failed", code: "NO_ARTICLE" })`。
- 前置判断：`location.protocol` 非 http(s) → `code: "UNSUPPORTED_PAGE"`（特权页通常根本注入不进来，这条是兜底）。

### 4. `extension/src/worker-run.ts`（可测编排）

```ts
export async function run(tabId: number, deps: ChromeDeps): Promise<RunResult>
```

流程：注入 → 等 payload（10s 超时）→ `naming` 定 `dirName`/`mdName` → 图片按 4 并发下载（`conflictAction: "overwrite"`、`saveAs: false`、`filename: <dirName>/<n>-<slug>.<ext>`）→ `chrome.downloads.onChanged` 等结束 → `chrome.downloads.search({ id })` 核对真实 basename 与父目录名 → `rewriteImageReferences` → `writeMarkdown` → 返回 `{ ok, mdName, saved, failed }`。

错误分支一律返回**可读 code**：`UNSUPPORTED_PAGE` / `NO_ARTICLE` / `INJECT_FAILED` / `TIMEOUT` / `DOWNLOAD_FAILED`。

### 5. `extension/src/references.ts`（纯函数）

`rewriteImageReferences(markdown, plans: { placeholder, outcome }[])`：成功 → `![](dirName/实际文件名)`；失败 → `![](原始 URL)` + 下一行 `<!-- 图片未下载：<url> -->`；未出现的占位符原样保留（便于发现 bug）。只替换精确的 `](md-convertor-image-N)` 形式，正文里普通文本不受影响（有专门用例）。

### 6. `extension/src/write.ts`

`writeMarkdown(deps, dirName, mdName, markdown)` → data URL（`data:text/markdown;charset=utf-8,` + `encodeURIComponent`）+ `chrome.downloads.download({ filename: <mdName>, conflictAction: "overwrite" })`；探针实测 2 MiB 通过。

### 7. `extension/src/worker.ts`

`chrome.action.onClicked.addListener((tab) => void run(tab.id!, realChromeDeps))`；`runtime.onMessage` 只接受 `ConvertPayload`/`ConvertFailure` 并交给等待中的 promise；结束时 `setBadgeText({ text: "✓" | "!" })` + `setTitle` 详情，4s 后清空。所有 `void` 调用必须有 `.catch()`（feat-041 的教训：抛出的异常被 `void` 吞掉表现为「点了没反应」）。另挂一个测试钩子 `globalThis.__mdConvertorRun`（Playwright 点不了工具栏，S3 的集成测试直接调编排；扩展自身不读它）。

### 8. 打桩单测（`chrome.*` fake）

`extension/src/worker-run.test.ts`：手写 `fakeChrome()`（可控的下载成功/失败/超时/`onChanged` 时序/`search` 返回不同 basename），断言：md 文本、失败标记、角标、并发上限（同时进行的 `download` 调用数 ≤ 4）。不装 sinon。

## Tasks

| id | 任务 | RED（先写失败测试） | 完成条件 | 验证 |
| --- | --- | --- | --- | --- |
| T2.0 | **事实探针**（写代码前先敲定四条） | 先写 `extension/tests/probe.spec.ts`：① SW 无手势 `executeScript` 是否被拒；② `filename` 不带扩展名时浏览器是否自行补；③ `chrome.downloads.search()` 返回的绝对路径与父目录名形态；④ `conflictAction: "overwrite"` 重复下载同一文件名的实际结果 ⇒ 先 failed | 四条都有实测输出，逐条填进本文档「探针结果」表 | `npm run test:extension -- -g probe` |
| T2.1 | manifest + 消息契约 + 注入链路骨架（happy path 写 md） | `extension/tests/skeleton.spec.ts`：加载扩展 → `serviceWorker.evaluate(() => run(tabId))` → 下载目录出现 `<标题>.md` ⇒ 先 failed（无 manifest/无产物） | 端到端最小路径通（先不要求图片与回写） | `npm run test:extension -- -g skeleton` |
| T2.2 | content script：接入核心、失败可读化 | `extension/tests/content.spec.ts`：fixture 页 → payload 字段完整；`no-article` 页 → `failed/NO_ARTICLE`；`file://` 页 → `UNSUPPORTED_PAGE`（或注入被拒可读化）⇒ 先 failed | chromium 全绿 | `npm run test:extension -- -g content` |
| T2.3 | 下载编排（并发 4、等待、overwrite、60s 超时、真实文件名核对） | `worker-run.test.ts`：7 张图 + fake chrome ⇒ 断言并发峰值 ≤ 4；1 张失败/1 张超时 ⇒ 其余仍然完成；`search` 返回补过扩展名的 basename ⇒ 引用用真实名；父目录名不符 ⇒ 该图按失败处理 ⇒ 先 failed | 全绿 | `npx vitest run extension/src/worker-run.test.ts` |
| T2.4 | 引用回写纯函数 | `references.test.ts`：成功/失败/未出现占位符/正文含相似文本（不被误替换）/同一占位符出现两次 ⇒ 先 failed | 全绿 | `npx vitest run extension/src/references.test.ts` |
| T2.5 | md 写盘（data URL、UTF-8、overwrite、中文文件名） | `write.test.ts`：mock `downloads` 断言 `filename` 是相对路径、URL 是可解析的 data URL、中文内容解码后逐字节相同 ⇒ 先 failed | 全绿 | `npx vitest run extension/src/write.test.ts` |
| T2.6 | 反馈：角标与工具提示 | `worker-run.test.ts` 扩：成功 → `✓` + 标题含张数；部分失败 → `!` + 标题含「N 张图未下载」；提取失败 → `!` + 原因；4s 后清空（用注入时钟）⇒ 先 failed | 全绿 | 同上 |
| T2.7 | 打桩单测矩阵收口 | 覆盖 `INJECT_FAILED` / `TIMEOUT` / `DOWNLOAD_FAILED` / 特权页 / 提取失败五条失败路径 ⇒ 先 failed | 五条全绿，`coverage` 中 `worker-run.ts`、`references.ts`、`write.ts` 达阈值 | `npm run test:coverage` |
| T2.8 | 阶段收尾 | — | `./init.sh` 全绿；`extension/dist/` 恰含 `manifest.json` / `content.js` / `worker.js` 且无 Node 内置模块；探针结论已落本文档 | `./init.sh` |

## 探针结果（T2.0，2026-09-24 实测；机器化证据 = `extension/tests/probe.spec.ts` 5 条用例）

| # | 问题 | 实测结论 | 对设计的影响 |
| --- | --- | --- | --- |
| 1 | SW 无手势 `executeScript` 是否可用 | **不可用**。SW 用 `chrome.tabs.query({})` 拿到 tabId 后注入普通 http 页，两个 tab 全部报 `Cannot access contents of the page. Extension manifest must request permission to access the respective host.` | 集成测试须用测试专用 manifest 变体（补 `host_permissions`）；「工具栏点击 → activeTab 授权」这一段只能人工验收（S3） |
| 2 | 请求的 `filename` 无扩展名时是否被补 | **不补，原样落盘**：`标题.images/note`（MIME `text/markdown`）与 `标题.images/photo`（MIME `image/png`）都保持无扩展名，浏览器不从 MIME 反推 `.md`/`.png` | 引用必须走 `search()` 返回的真实 basename（设计已如此）；扩展名只能由我们自己按 URL 后缀决定 |
| 3 | `search()` 返回的路径形态 | **绝对路径，且包含请求的相对子目录**：`<下载目录>/<dirName>/1-image.png`，与磁盘逐项一致 | 「父目录名 == `dirName`」这条核对规则成立，保留 |
| 4 | `conflictAction: "overwrite"` 的实际行为 | **真覆盖**：第二次下载返回同一路径，磁盘上只有一个文件、内容是第二次的，没有 `dup (1).md` 之类的分身 | 保留 `overwrite`（`uniquify` 会拆散 md 与 `.images/` 的文件对） |
| 5 | `filename` 给绝对路径会怎样 | **被拒**：`Invalid filename`（与 2026-09-22 探针一致） | 写盘一律相对路径；这条现在有机器化证据 |

**测试装置坑（S3 集成测试必须照抄这一套）**：Playwright 对 persistent context 一律发 CDP `Browser.setDownloadBehavior { behavior: "allowAndName" }`，于是每次下载都被写成 `<guid>`（无扩展名）并**丢掉请求的子目录** —— 实测在这一装置下第 2、3、4 条都测不出来（第一次跑 probe 时收到的就是 GUID）。修法两步，缺一不可：① 在 profile 里预写 `Default/Preferences` 的 `download.default_directory` 指向临时目录；② 启动后自己补发一次 `Browser.setDownloadBehavior { behavior: "default" }` 覆盖 Playwright 的设置。**`launchPersistentContext` 的 `downloadsPath` 选项不能用**（它正是 `allowAndName` 的入口），`acceptDownloads: "internal-browser-default"` 也无效（Playwright 客户端把任何真值都归一成 `accept`）。

## Handoff

- 结束时必须写清：消息契约的确切字段；`run(tabId, deps)` 的注入形状；角标语义（`…` 进行中 / `✓` 成功 / `!` 失败）与 4s 清空；`overwrite` 的理由（`uniquify` 会拆散 md 与 `.images/` 的文件对）；探针五条结论 + Playwright 下载装置坑的修法。
- 已知限制：无图标；无保活；不做 popup；工具栏点击 → `activeTab` 授权这一段只能人工验收（S3）。
