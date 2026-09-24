# S2 — 单文件加工管线（Spec / Plan / Tasks）

- 上游：`docs/features/app-document-processing/FSD.md`（§4.4 图片内嵌、§4.5 翻译复用、§4.6 标记）
- 前置：**S1 已完成**（`src/lib/local-docs/paths.ts`、`dedup.ts` 的标记构造/解析/剥离、`Settings.input`、扫描路由）
- 状态：**未开始**
- feature_list id：`feat-042`
- 本阶段结束时不写盘、不画界面：产出「给定一份本地 md，返回它加工后的全文」这段可单测的管线（写盘在 S3 经既有 IPC 通道，界面在 S3）。

---

## Spec

**目标**：把一份本地 `.md` 变成「图片已内嵌、可选已翻译、带处理标记」的产物文本，全部逻辑可注入依赖、可单测。

**关键决定**：

1. **Markdown 级内联器**（不做 md→HTML→Turndown 回环）：新增 `src/lib/local-docs/inline-images.ts`，只改图片引用这一处，正文其它字节不动（FSD §4.4，否决理由已写在那里）。
2. **复用而不是复制图片策略**：把 `src/lib/images.ts` 里可复用的那层**提为导出**——`embedImageBuffer(buffer, contentType)`（即现在的 `processImageBuffer` 去掉 DOM/粘贴语境的参数）与 `mapWithConcurrency`、`MAX_IMAGES`、`MAX_SOURCE_IMAGE_BYTES`；**这是行为不变的重构，既有 `src/lib/images.test.ts` 必须保持全绿**（FSD §2 的 A1，需先点头）。
3. 图片来源与边界：`http(s)` → 既有 `fetchPublicResource`（SSRF 校验 + 8 MiB 上限）；**本地路径** → 以源 md 所在目录为根解析并 `readFile`，**拒绝**逃出根目录（`..`）与根外的绝对路径；`data:` → 原样保留、不计数、不读盘。
4. 超限与失败一律**保留原始引用** + 一条 warning（FSD V4），不替换成替代文本、不新增上限。
5. 翻译复用 `analyzeTranslation` + `runTranslation`；`decideTranslation` 需要确认时按 `non-target` 直接执行并记录（FSD V5）；**翻译前先 `stripDocMarker`，翻译后写新标记**。
6. 跳过判定在**服务端自己重算**（不信任渲染层传来的 `state`）：标记存在且源路径/输出路径一致且 size+mtime 一致 ⇒ `{skipped:true}`；size 或 mtime 变了 ⇒ 先算 sha256，相同即跳过。
7. 产出文件名由源文件名派生（`localDocFilename`，S1 T1.4 已实现），翻译不改名。
8. 路由**只读不写**：产物由渲染层经 `outputBridge().saveFile()` 落盘（FSD §4.6）。
9. 引用式图片语法（`![alt][id]`）**不处理**，原样保留（已知限制，写进 §6 风险）；`<img>` 只处理带 `src` 的形态。

---

## Plan

### T2.0 `src/lib/images.ts` 导出重构（行为不变）

- 新增导出 `embedImageBuffer(buffer, contentType)`：内部就是现在的 `processImageBuffer(buffer, contentType, { validateDeclaredFormat: true, placeholderEligible: false, invalidFormatWarning: <IMAGE_TYPE_UNSUPPORTED> })`；把 `prepareImage` 的远端分支与 `prepareDataUriImage` 改成调它，保证**只有一个**实现。
- 导出 `mapWithConcurrency`（S2 内联器要限并发抓图）与 `MAX_IMAGES` / `MAX_SOURCE_IMAGE_BYTES`。

**RED**：新增 `src/lib/images.exports.test.ts`：`embedImageBuffer` 对小 PNG buffer 返回 `data:image/png;base64,…`；对声明 `image/jpeg` 但实际是 PNG 的 buffer 返回 `IMAGE_TYPE_UNSUPPORTED`；对 >2 MiB 的图走 `shouldOptimizeImage` 分支（重编码为 webp）⇒ 现在因导出不存在而 failed。

**完成条件**：新测试绿；`npx vitest run src/lib/images.test.ts` **全绿**（证明行为没变）；`git diff src/lib/images.ts` 只有提取与导出，没有逻辑改动。

### T2.1 图片引用扫描（纯函数）

`scanImageRefs(markdown)` → `[{ start, end, syntax: "inline" | "html", target, alt }]`：匹配 `![alt](dest)` / `![alt](dest "title")` / `<img src="…">`；**跳过**围栏代码块与行内代码里的内容（``` 与 `）；不匹配引用式 `![alt][id]`。

**RED**：`src/lib/local-docs/scan-refs.test.ts`：普通行内图、带 title、尖括号包住的 URL、围栏代码里的 `![]()` **不**被收、`` `![a](b)` `` 不被收、`<img>` 形态、多处引用位置正确（用于原地替换）、引用式语法不入选 ⇒ 模块不存在，failed。

**完成条件**：全部绿，且「替换后正文除图片那一处外逐字节相同」（用一个多段落实例断言）。

### T2.2 内联管线 `inlineLocalDocImages`

`inlineLocalDocImages(markdown, { sourceDir, signal, deps })` → `{ markdown, warnings, stats: { embedded, kept } }`：

- 逐条按 T2.1 的位置**从后往前**替换（避免位移），限并发抓取（复用 `mapWithConcurrency`）；
- `data:` 原样保留且不计入 `stats.embedded`；`http(s)` 走 `fetchPublicResource(…, { maxBytes: MAX_SOURCE_IMAGE_BYTES })`；本地路径按根解析、逃逸即拒绝；只接受 `SUPPORTED_TYPES` 里的类型；
- 张数超过 `MAX_IMAGES` ⇒ 超出部分保留原引用 + 一条 warning；
- 单张读盘/抓取失败、类型不支持、超 8 MiB、总量超 `MAX_MARKDOWN_BYTES` ⇒ 保留原引用 + warning（warning 词汇沿用既有 code 体系）。

**RED**：`src/lib/local-docs/inline-images.test.ts`（真实临时目录 + 一个本地 `node:http` fixture 端口，不联网）：本地相对图变 `data:`；本地绝对路径在根外被拒；`http` 图变 `data:`；404 图保留原引用 + warning；31 张图时第 31 张保留原引用；`data:` 不计数；正文其它部分不变 ⇒ failed。

**完成条件**：全部绿；`stats` 与实际替换数一致。

### T2.3 组合层 `processLocalDoc`

`src/lib/local-docs/process.ts`：`processLocalDoc({ sourcePath, outputDir, force, translate, targetLanguage }, deps)` →

1. 守卫 + `stat` 源文件 → 读源；
2. 读 `<outputDir>/<localDocFilename(源名)>` 的首行标记并 `decideLocalDoc`：
   - `skip` 且非 `force` ⇒ 返回 `{ skipped: true, reason: "processed" }`（**不读图、不翻译**）；
   - `check` ⇒ 算源 `sha256`，与标记相同 ⇒ 同样 `{skipped:true}`；
3. `inlineLocalDocImages`（`deps.inlineImages` 可注入）；
4. `translate` 为真时：`analyzeTranslation` → `decideTranslation` 需要确认 ⇒ 取 `non-target` 直接跑（`deps.translate?: runTranslation`，测试注入 fake）⇒ 翻译前先 `stripDocMarker`；
5. `sha256`（源）+ 新标记（首行）+ 返回 `{ markdown, filename, sha256, warnings, stats, translation: { ran, scope } }`；
6. **全程不写盘**。

**RED**：`src/lib/local-docs/process.test.ts`：新文件走全流程；已处理的文件 ⇒ `skipped` 且**没调用**内联/翻译（用 fake 计数断言）；mtime 变但内容同 ⇒ `skipped`；`force` ⇒ 重做；翻译 fake 被调用一次且拿到的是**剥掉标记**的文本；翻译后产出的首行是**新**标记 ⇒ failed。

**完成条件**：全部绿；`skipped` 分支不产生任何网络/模型调用。

### T2.4 路由 `POST /api/local-docs/process`

`src/app/api/local-docs/process/route.ts`：`runtime="nodejs"`、`dynamic="force-dynamic"`、`validateConvertApiCaller(request)`；body `{ path, outputPath?, force?, translate?, targetLanguage? }`（`outputPath` 省略即用设置里既有的输出目录，仍缺失则 400 并给可读原因）；调 `processLocalDoc`；把 `AppError` 映射成既有 fs 码文案；**不写盘**。

**RED**：`route.test.ts`：对临时目录走一遍（含 `skipped` 与未授权调用方被拒）⇒ failed。

**完成条件**：全部绿；`grep -c "writeFile\|mkdir" route.ts` = 0（只读证明）。

### T2.5 阶段收尾

`./init.sh` 全绿；`CHANGELOG.md`/`.zh.md` 不加条目（本阶段无用户可见变化）；`feature_list.json` 记录 T2.0–T2.4 的 RED/GREEN 证据；`FSD.md` §7 的风险表按实施发现更新（如「本地图片根外绝对路径」的最终口径）。

---

## Tasks

| id | 任务 | RED（先写失败测试） | 完成条件 | 验证 |
| --- | --- | --- | --- | --- |
| T2.0 | `images.ts` 导出重构（`embedImageBuffer` / `mapWithConcurrency` / 两个常量），行为不变 | `src/lib/images.exports.test.ts` 断言导出的行为 ⇒ 导出不存在，failed | 新测试绿 + 既有 `images.test.ts` 全绿 + diff 里无逻辑改动 | `npx vitest run src/lib/images.exports.test.ts src/lib/images.test.ts` |
| T2.1 | 图片引用扫描 `scanImageRefs` | `scan-refs.test.ts`（围栏/行内代码不收、引用式不入）⇒ failed | 全部绿 | `npx vitest run src/lib/local-docs/scan-refs.test.ts` |
| T2.2 | 内联管线 `inlineLocalDocImages`（本地/远端/data/超限/失败） | `inline-images.test.ts`（临时目录 + 本地 fixture 端口）⇒ failed | 全部绿；正文其余部分不变 | `npx vitest run src/lib/local-docs/inline-images.test.ts` |
| T2.3 | 组合层 `processLocalDoc`（跳过判定 + 剥离标记后翻译 + 新标记） | `process.test.ts` 用 fake 计数断言「跳过时零调用」⇒ failed | 全部绿 | `npx vitest run src/lib/local-docs/process.test.ts` |
| T2.4 | `POST /api/local-docs/process` | `route.test.ts` ⇒ failed | 全部绿；路由零写盘 | `npx vitest run src/app/api/local-docs/process/route.test.ts` |
| T2.5 | 阶段收尾 | — | `./init.sh` 全绿；文档与 `feature_list.json` 同步 | `NODE_OPTIONS= ./init.sh` |

## Result

**未开始**。

## Handoff

- S3 从本阶段拿走的形状：`processLocalDoc(input, deps)` 的返回值（`markdown` / `filename` / `sha256` / `warnings` / `stats` / `skipped` / `translation`），S3 的批量编排只负责「逐条调用 → 经 IPC 写盘 → 更新行状态」。
- `embedImageBuffer` 是**两端共用**的：网页端 `embedImages` 也走它。改它的行为等于同时改网页端，任何改动都要两边测试一起跑。
- 本地图片的根目录口径（相对路径以源 md 所在目录为根、根外绝对路径默认拒绝）在 T2.2 定稿后要写回 FSD §7 的风险表；这是本阶段唯一「设计上还开着」的一条。
- 别在 T2.3 里写盘。写盘只有 S3 那一处，走 `outputBridge().saveFile()`。
