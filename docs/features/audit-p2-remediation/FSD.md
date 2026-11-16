# FSD · audit-p2-remediation（`feat-044`）

> 状态：**已实施，未发布**（2026-11-14，版本面 `0.3.11`）。单阶段文档，Spec / Plan / Task 一体。

## 1. 来源与范围

2026-11-14 的跨项目审计（外部只读报告）对 `MD-Convertor` 提了 6 条，逐条回仓库复现后**全部成立**；本轮修其中的 4 条代码问题与 1 条门禁缺口，**不修** Electron 版本（另立 `feat-045`，需要真机冒烟与发布授权）。

| 编号 | 审计原文（摘要） | 复现证据 | 本轮处置 |
|---|---|---|---|
| A1 | 批量转换时不同源文件可能清洗成同一个产物名，静默互相覆盖 | 探针 `["a?.md","a*.md","a<b.md","a\|b.md"]` → `["a-.md","a-.md","a-b.md","a-b.md"]` | **修**（T1.0 / T1.1） |
| A2 | 图片内嵌只做字符串前缀检查，符号链接可指向源目录之外 | 探针：`link.png -> 目录外/secret.png` 被当作 `embedded: 1`，无 warning | **修**（T2.0） |
| A3 | 插件把 Markdown 下载失败也报成功（角标打 ✓） | 真实 `run()` + 假 chrome（`search` 报 `interrupted`）返回 `{ok: true}` | **修**（T3.0） |
| A4 | 「生产依赖 0 漏洞」口径窄，且发布门禁没有落实审计 | `release-desktop.mjs` 只跑 `init.sh`/e2e/live/make；`QUALITY-AUDIT.md` 要求每道门禁复跑审计 | **修**（T4.0） |
| A5 | Electron 43.3.0 命中 12 条公告（devDependency，但打包后即运行时） | `npm audit --json` 的 electron 条目 | **不修**，登记 `feat-045` |
| A6 | `package.json` 写 `next: ^16.3.5`，实际锁 16.4.6（语义下界过时） | 读两个文件 | **不修**（卫生项，随下次依赖变更一并处理） |

非目标：不新建第二条批量编排或第二条写盘路径；不改 `extension/src/write.ts` 的签名；不升级 Electron；不发布。

## 2. 设计决定

### D1 · 产物名冲突用「哈希戳」而不是「去重后缀」

- 现状：`cleanFilenameStem()` 把文件名里的非法字符逐个换成 `-`，`a?.md` 与 `a*.md` 因此都变成 `a-.md`；`localDocFilename()` 只做清洗，不感知冲突；`electron/output.mjs` 的 `writeFile` 同路径直接覆盖 ⇒ 后一篇静默吃掉前一篇。
- 决定：**只有清洗真正改动过名字时才追加 `-<8 位哈希>`**，哈希取**源文件名去掉 `.md` 后的词干**的 FNV-1a（8 位小写十六进制）；追加前先把清洗结果尾部的连续 `-` 收成一个，所以 `a/b:c?.md` 得到 `a-b-c-<hash>.md` 而不是 `a-b-c--<hash>.md`。`Notes.md`、`会议记录 2026.md` 这类干净名字保持原样。
- 理由：① 干净名字一改，既有产物全部失去 `skip` 判定，用户第二次扫描会把整目录重做一遍；② 文件名冲突只可能发生在「清洗后有损」的名字上，冲突域与改名域完全重合，所以只对改名过的名字加戳即可（在 32 位哈希不碰撞、且源名本身不是 `a-<hash8>.md` 这种形态的前提下）消解；③ 用 FNV-1a 手写实现而不引 `node:crypto`，与 `extension/src/convert/naming.ts` 的 `shortHash` 保持同一算法口径 —— 实测 `dedup.ts` 目前只被服务端 `scan.ts` / `process.ts` 值引用（`batch.ts` 是 `import type`，编译后擦除），所以这条理由眼下是「口径统一 + 不留 runtime 差异」，不是被迫的（真要删掉这 8 行，代价是已 stamp 过的产物名会变，故保留）。
- 取代关系：推翻 `FSD` 与 `feat-042` 里「产物名 = `cleanFilenameStem(stem) + ".md"`」的字面读法（对脏名字有效，对干净名字不变）。

### D2 · 符号链接边界用 `realpath`，整篇只解析一次根

- 现状：`inlineLocalRef()` 把引用 `path.resolve` 之后做 `startsWith(sourceDir + sep)` 的**字符串**比较；`link.png -> ../secret.png` 的词法路径在树内、真实目标在树外 ⇒ 目录外的图片被读进 base64。
- 决定：对**解析后**的路径取 `realpath`，再与**源目录的 realpath** 比较；符号链接解析到树外按 `IMAGE_SOURCE_INVALID` 处理（保留原引用 + warning），解析到树内仍正常内嵌。**注意顺序**：扩展名白名单检查在 `realpath` 判定之前，所以「树外 + 不支持的扩展名」报的是 `IMAGE_TYPE_UNSUPPORTED`（两种都保留原引用）。
- 细节：源目录的 `realpath` 每篇只算一次（`inlineLocalDocImages` 开头）；解析失败（目录已不存在）时退回词法根，让每条引用各自报可读性 warning，而不是整篇失败。名字 `escape-dir` 这类**目录名里的点**不受影响，因为判定看的是解析结果而不是字符串。

### D3 · 插件 md 写盘复用 `waitForDownload`，独立超时

- 现状：`chrome.downloads.download()` 在下载**开始**时就 resolve；`run()` 拿到 id 就返回 `ok: true`，角标打 ✓，而文件可能是 0 字节或被中断。
- 决定：复用图片那条轮询 `downloads.search()` 到 `state === "complete"` 的等待，新增 `MD_TIMEOUT_MS = 10_000`（md 是内存里的 data URL，10 秒足够刷盘）；中断/超时 → `{ok: false, code: "DOWNLOAD_FAILED", message: "下载未完成（<state>）"}`。
- 连带收益：`extension/tests/harness.ts` 里只为测试而存在的 `waitForDownloadComplete()` 被删掉 —— 生产侧现在自己等，测试读文件前不需要再等。

### D4 · 审计门禁「生产依赖失败、Electron 只告警」

- 现状：`npm audit` 只要发现漏洞就 exit 1，直接接进门禁会让门禁无法通过（devDependency 的公告必然存在）。
- 决定：新增 `scripts/audit-runtime.mjs`，**判报告而不是判退出码**：`npm audit --omit=dev --json` 有公告 → 抛 `PROD_AUDIT_ERROR` 中止发布；Electron 有公告 → 打印一行 tracked warning 并继续（登记在 `QA-DEV`，随 `feat-045` 处理）。npm 不可执行时给「无法执行」而不是静默通过。
- 接线：`release-desktop.mjs` 在 `./init.sh` 之后、`test:e2e` 之前跑 `npm run audit:runtime`。

## 3. 任务与证据

| Task | 内容 | RED（先红） | GREEN / 证据 |
|---|---|---|---|
| T1.0 | `localDocFilename` 哈希戳 | `dedup.test.ts` 新增 3 条 + 改写 2 条（改名才加戳、脏名字互不冲突、干净名字不变、确定性）→ 新增/改写的 5 条全红 | `dedup.ts` 新增 `stemHash()`（FNV-1a）+ 条件追加 ⇒ 该文件全绿 |
| T1.1 | 列表显示真实产物名 | 扫描路由新用例（两个脏名 → 2 个不同 `outputName`）→ `expected 1 to be 2` | `ScannedLocalDoc.outputName` + `BatchRow.outputName` + 面板单元格显示产物名（`title` 给出原名）⇒ 路由用例绿；e2e「清洗过的源文件名在列表里显示真实产物名」三引擎绿 |
| T2.0 | 符号链接边界 | `inline-images.test.ts` 新增 2 条（树外链接拒、树内链接仍内嵌）→ 树外那条嵌进了 base64 | `inlineLocalRef(target, sourceDir, rootReal, embed)` + `realpath` 判定 ⇒ 15 passed |
| T3.0 | 插件 md 下载反馈 | `worker-run.test.ts` 新增 2 条（被中断 / 永不完成）→ 两条都 `ok: true` | `MD_TIMEOUT_MS` + `waitForDownload` ⇒ 14 passed；删除 `waitForDownloadComplete` 后 `test:extension` `--repeat-each=3` 45 passed，证明生产侧真的在等 |
| T4.0 | 审计门禁 | 新增 `scripts/audit-runtime.test.mjs`（9 条）→ `Cannot find module './audit-runtime.mjs'` | 新脚本 + `release-guards.test.mjs` 事件序插入 `audit:runtime` ⇒ `scripts/` 41 passed；真跑 `node scripts/audit-runtime.mjs` exit 0（prod 0 漏洞，electron 12 条公告） |
| T5.0 | 版本面 `0.3.11` | `release-guards.test.mjs` 期望先红 | 四处版本面同步 ⇒ 41 passed |

## 4. 验证

| 项目 | 读数 |
|---|---|
| `npm run lint` / `typecheck` | 干净（`md-convertor@0.3.11`） |
| `npm run test:coverage` | 96 files / 1291 passed / 0 skipped，逐文件阈值全过（`dedup.ts` 100、`inline-images.ts` 100、`worker-run.ts` ≥ 阈值） |
| `npm run test:e2e`（三引擎） | 351 passed / 6 skipped / 0 failed + tracked-file check passed |
| `npm run test:extension` | 15 passed（`--repeat-each=3` 45 passed） |
| `npm run audit:runtime` | prod 0 漏洞；electron 12 条公告（tracked） |
| `./init.sh` | 见 `PROGRESS.md` 当轮记录 |

## 5. 遗留

- `feat-045`：Electron 43.3.0 → 43.8.10（或 45.x）升级，需要完整门禁 + 打包冒烟 + 发布授权。
- `package.json` 的 `next: ^16.3.5` 下界过时（锁是 16.4.6），改它属于依赖变更，等下一次依赖轮。
- 本轮 bump 到 `0.3.11`，**未提交、未发布**；发布需要单独授权。
