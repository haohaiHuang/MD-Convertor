# S1 — 目录访问与输入目录设置（Spec / Plan / Tasks）

- 上游：`docs/features/app-document-processing/FSD.md`（§4.2 设置、§4.3 扫描与守卫、§4.6 去重）
- 前置：无（本阶段是 A 的第一个阶段）
- 状态：**已完成**（2026-09-24，T1.0–T1.7 全绿；版本面已 bump 到 `0.3.7`，**未发布**）
- feature_list id：`feat-042`
- 本阶段不写界面（S3 才画首页面板）；本阶段结束时：版本已 bump、设置里能存输入目录、服务端能安全地扫出一个目录里的 `.md` 并判出每一条的 `state`。

---

## Spec

**目标**：把「目录」这条线打通到可测为止 —— 设置字段、系统下载目录的唯一来源、服务端路径守卫、扫描路由、去重判定（纯函数）。UI 留给 S3。

**关键决定**：

1. `Settings.input.defaultPath: string | null`，`null` = 跟随系统下载目录；`SETTINGS_VERSION` 不变（走 §4.2）。
2. 允许缺失的根键从 `output` 扩到 `output` + `input`（`src/types/settings.ts:128` 的 `ROOT_KEYS` 与 :252 的判断循环改成对 `LENIENT_ROOT_KEYS = ["output", "input"]` 的循环）；其余字段仍然严格。
3. 系统下载目录：主进程 `app.getPath("downloads")` → `buildServerEnv()` 新增 `downloadsDir` 参数与 `MD_CONVERTOR_DOWNLOADS_DIR` 环境变量 → 服务端读取，缺失回退 `path.join(os.homedir(), "Downloads")`。**不新增 IPC 通道**（FSD V6）。
4. 路径守卫新增服务端实现 `src/lib/local-docs/paths.ts`，与 `electron/preload-contract.cjs` **同规**，并加一条 parity 单测把样例表喂给两边（防漂移）。
5. 扫描：只扫一层、只收 `.md`（大小写不敏感）、按文件名排序、上限 500 + `truncated`；`dirPath` 省略 = 用系统下载目录。
6. 去重：`decideLocalDoc(标记, 文件)` 纯函数 + 标记构造/解析（输出 md 首行 HTML 注释里的 JSON）；`state ∈ new | skip | check`。
7. 本阶段**不动** `src/lib/images.ts`（那是 S2）、不碰首页、不碰插件。

---

## Plan

### T1.0 版本面 bump 到 0.3.7（本块第一次动桌面代码）

要同步的地方（读代码确认过：**6 个文件**，与 0.3.5 → 0.3.6 那次 bump 的改动面逐字一致，见提交 `ac8f91a`）：

| 位置 | 内容 |
| --- | --- |
| `package.json` | `version` |
| `package-lock.json` | 根 `version` 与 `packages[""].version` |
| `feature_list.json` | `currentVersion` |
| `scripts/release-desktop.mjs` | `RELEASE_VERSION_ERROR` 串 + `if (version !== "0.3.6")` |
| `scripts/release-guards.test.mjs` | 「accepts only the current … release target」的期望串与 fixture 版本（334–386、497–505 行） |
| `AGENTS.md` | Verification 段的版本句（「只允许目标版本 0.3.6」） |

**不动的（发布 0.3.7 时才同步）**：这六个文件里另有大量 **历史** `0.3.6` 字面量，一个都不要改——`feature_list.json` 里 20 处（全在旧 feature 的 verification 叙述里）、`AGENTS.md` 的另外 4 处（第 14/16/41/59 行）、`package-lock.json` 的依赖范围 `eslint-import-resolver-node: ^0.3.6`、`src/types/settings.ts:247` 的注释。
同一道理的还有 `README.md` / `README.zh.md`、`docs/ARCHITECTURE.md` / `.zh.md`、`docs/PRODUCT.md` / `.zh.md`、`docs/TESTING.md` / `.zh.md` 里「当前版本 0.3.6 / 最近发布 v0.3.6 / 发布流程只接受 0.3.6」那几句：它们在 **0.3.7 真正发布时**才改（历史节奏就是分开的：bump 提交 `ac8f91a` 只碰上面这 6 个文件，README / ARCHITECTURE / PRODUCT / TESTING 由发布收口的 `3578822` 改）。

**RED**：先只改 `package.json` + `package-lock.json` 到 `0.3.7`，并在**既有**的 `scripts/release-guards.test.mjs` 里加一条断言（读 `package.json` 与 `release-desktop.mjs` 的目标版本、`feature_list.json` 的 `currentVersion`，断言三者相等）⇒ 当前 failed（脚本目标仍是 `0.3.6`）；再把其余几处同步 ⇒ passed。

**完成条件**：一致性测试绿；`npx vitest run scripts/release-guards.test.mjs` 绿；`init.sh` 里没有任何硬编码 `0.3.6` 的断言失败。

### T1.1 设置字段 `input` + 宽容读入扩列

`src/types/settings.ts`：`InputSettings { defaultPath: string | null }`，`DEFAULT_SETTINGS.input = { defaultPath: null }`，`ROOT_KEYS` 加 `input`，缺失容忍改成 `LENIENT_ROOT_KEYS` 循环，`readInput()` 用 `readNullableString(..., NON_EMPTY)`（与 `output.defaultPath` 同规），写出的文件里始终带 `input`。

**RED**：`src/types/settings.test.ts` 追加：① 完整 `input` 往返；② 旧文件（无 `input`）读入 ⇒ 回退 `{defaultPath: null}` 且**不**整体失败；③ `input.defaultPath: ""` ⇒ 拒绝；④ 未知键 `input.extra` ⇒ 拒绝 ⇒ 前两条当前 failed。

**完成条件**：`npx vitest run src/types/settings.test.ts` 全绿；断言「除 `output`/`input` 外的字段缺失仍然报错」（防止宽容扩散）。

### T1.2 主进程把系统下载目录传进服务端

`electron/env.mjs` 的 `buildServerEnv({ ..., downloadsDir = "" })` 返回对象加 `MD_CONVERTOR_DOWNLOADS_DIR: downloadsDir`；`electron/main.mjs:133` 的调用处传 `downloadsDir: app.getPath("downloads")`。

**RED**：`electron/env.test.mjs` 加断言「给定 `downloadsDir` 时环境里有该键、且调用方给的 base env 覆盖不了它」（与 `MD_CONVERTOR_USER_DATA` 同款口径）⇒ 当前 failed。

**完成条件**：该测试绿；`npx vitest run electron/env.test.mjs` 绿。

### T1.3 服务端路径守卫 + parity 测试

`src/lib/local-docs/paths.ts`：

- `isSafeDirectoryPath(value)`：绝对路径、拒绝 `..` 段、拒绝段首 `~`、非空；
- `isMarkdownFileName(value)`：`/\.md$/i` 且不含 `/`、`\`、`..`；
- `resolveScanDir(dirPath | undefined, downloadsDir)`：省略即用 `downloadsDir`；
- 与 `electron/preload-contract.cjs` 的样例表（正常 `/Users/x/Downloads`、iCloud `…/com~apple~CloudDocs`、`~` 在段首、`a/../b`、相对路径、空串）逐条对齐。

**RED**：`src/lib/local-docs/paths.test.ts` + `src/lib/local-docs/paths.parity.test.ts`（后者 import 两边实现）⇒ 模块不存在，failed。

**完成条件**：两文件绿；`com~apple~CloudDocs` 这种「波浪号不是简写」的路径必须通过（既有教训，别再写 `value.includes("~")`）；parity 用例至少 6 条。

### T1.4 去重判定与产物标记（纯函数）

`src/lib/local-docs/dedup.ts`：

- `buildDocMarker({source, size, mtimeMs, sha256, outputPath, processedAt})` → 一行 `<!-- md-convertor: {…} -->`；
- `parseDocMarker(markdownText)` → `DocMarker | null`（`try/catch`，缺字段即 `null`）；
- `stripDocMarker(markdownText)`（S2 翻译前用）；
- `decideLocalDoc(marker, file, outputPath)` → `"new" | "skip" | "check"`（规则见 FSD §4.6）；
- `localDocFilename(sourceFileName)` → `cleanFilenameStem(stem) + ".md"`（复用 `src/lib/markdown.ts` 的净化）。

**RED**：`src/lib/local-docs/dedup.test.ts` 覆盖：无标记 → `new`；标记齐且 size/mtime 同 → `skip`；size 或 mtime 变 → `check`；输出路径变 → `new`；标记 JSON 损坏/多字段/`null` → `new` 且不抛；文件名净化（含 `/`、`:`、空 stem）⇒ 模块不存在，failed。

**完成条件**：全部绿；`stripDocMarker` 对「没有标记但有正文」的文件原样返回（不能吞第一行）。

### T1.5 扫描路由 `POST /api/local-docs/scan`

`src/app/api/local-docs/scan/route.ts`：`runtime = "nodejs"`、`dynamic = "force-dynamic"`、`validateConvertApiCaller(request)`；读 body（小体积上限）、守卫、`readdir(dir, {withFileTypes:true})` 过滤 `.md`、排序、上限 500、按 T1.4 判出每条 `state`（`skip`/`check` 需要读产物文件的首行标记）、返回 `{dirPath, downloadsDir, files, truncated}`。

**RED**：`src/app/api/local-docs/scan/route.test.ts` 对 `mkdtemp` 出来的真实目录跑：列出两个 `.md` 与一个 `.txt`（`.txt` 不在）⇒ failed；`ENOENT` / `EACCES` / `ENOTDIR` 映射成既有 fs 码文案；`dirPath` 省略时用 `downloadsDir`（测试用环境变量注入一个临时目录）；`truncated` 在超过上限时为 `true`；未授权调用方被拒。

**完成条件**：全部绿；路由不写任何文件（只读）。

### T1.6 设置页「输入目录」卡片

`src/app/settings/page.tsx` 照抄「输出」卡片：路径回显（`input.defaultPath ?? 系统下载目录`）、「选择目录」（`selectDirectory()` → PUT 设置）、**「恢复默认」**（写回 `null`）、notes；无桥接时禁用并显示「只能在桌面应用中使用」。

**RED**：`e2e/settings.spec.ts` 追加两条（无 preload ⇒ 两个按钮 disabled + 提示文案；stub 桥接 ⇒ 点「选择目录」后路径回显更新、点「恢复默认」后回显下载目录）⇒ 当前 failed。

**完成条件**：两条 e2e 绿（`npx playwright test --project=chromium -g "输入目录"`）；写设置沿用「取真实响应后只改写 `output`/`input` 再 fulfill」的既有做法，不 PUT 真设置。

### T1.7 阶段收尾

`./init.sh` 全绿（Node 24.14.1 或 24.15.0）；`CHANGELOG.md` 与 `.zh.md` 的 `[Unreleased]` 加一条（用户可见：设置里多了输入目录）；`AGENTS.md` 的版本句与阶段状态同步；`feature_list.json` 记录 T1.0–T1.6 的 RED/GREEN 证据。

---

## Tasks

| id | 任务 | RED（先写失败测试） | 完成条件 | 验证 |
| --- | --- | --- | --- | --- |
| T1.0 | 版本面 bump `0.3.7` 并同步 6 处 | 先只改 `package.json`/`package-lock.json`，在既有 `scripts/release-guards.test.mjs` 加一条「三处版本相等」断言 ⇒ failed | 该断言绿；整个 `release-guards.test.mjs` 绿 | `npx vitest run scripts/release-guards.test.mjs` |
| T1.1 | `Settings.input` + 宽容读入扩到 `output`+`input` | `src/types/settings.test.ts` 加「旧文件缺 `input` 仍能读」⇒ 当前 failed | 4 条新用例绿；其它字段仍严格 | `npx vitest run src/types/settings.test.ts` |
| T1.2 | `buildServerEnv` 带 `MD_CONVERTOR_DOWNLOADS_DIR` | `electron/env.test.mjs` 加断言 ⇒ failed | 断言绿 | `npx vitest run electron/env.test.mjs` |
| T1.3 | 服务端路径守卫 + 与 preload 契约的 parity 测试 | 新测试文件 + 模块不存在 ⇒ failed | 两文件绿（≥6 条 parity） | `npx vitest run src/lib/local-docs/paths.test.ts src/lib/local-docs/paths.parity.test.ts` |
| T1.4 | 去重判定与产物标记纯函数 | `dedup.test.ts` ⇒ 模块不存在，failed | 全部绿（含损坏标记不抛） | `npx vitest run src/lib/local-docs/dedup.test.ts` |
| T1.5 | `POST /api/local-docs/scan` | `route.test.ts` 对真实临时目录断言 ⇒ failed | 列表/排序/上限/错误映射/默认目录全绿 | `npx vitest run src/app/api/local-docs/scan/route.test.ts` |
| T1.6 | 设置页「输入目录」卡片（含「恢复默认」） | `e2e/settings.spec.ts` 两条新用例 ⇒ failed | 两条绿 | `npx playwright test --project=chromium -g "输入目录"` |
| T1.7 | 阶段收尾 | — | `./init.sh` 全绿；CHANGELOG/AGENTS/feature_list 同步 | `NODE_OPTIONS= ./init.sh` |

## Result

**S1 已完成（2026-09-24，T1.0–T1.7 全绿）**；桌面版本面已 bump 到 `0.3.7`（**未发布**，`desktop:release` 仍需用户单独授权）。

| id | 结果 | RED → GREEN 证据 |
| --- | --- | --- |
| T1.0 | 版本面 6 处同步到 `0.3.7` | RED：`release-guards.test.mjs` 新增「目标版本 = `package.json` + lockfile 两处 + `feature_list.currentVersion`」断言（目标版本用正则从 `RELEASE_VERSION_ERROR` 取，后续 bump 自动跟随），先只改 `package.json`/`package-lock.json` ⇒ `expected '0.3.7' to be '0.3.6'`；GREEN：`npx vitest run scripts/release-guards.test.mjs` = 30 passed |
| T1.1 | `Settings.input` + 宽容读入扩到 `output`+`input` | RED：`settings.test.ts` 新 `describe("input settings")` 6 条、5 failed（`expected undefined to deeply equal { defaultPath: null }`、`settings.input is not a known field`），其中一条是反扩散断言（删 `translation.defaultEnabled`/`local.activeCliId` 仍须抛）；GREEN：`settings.test.ts` + `route.test.ts` = 84 passed |
| T1.2 | `buildServerEnv` 带 `MD_CONVERTOR_DOWNLOADS_DIR` | RED：`electron/env.test.mjs` 加 2 条 ⇒ `expected undefined to be '/Users/test/Downloads'`；GREEN：25 passed。缺省 `""`，服务端读到空串回退 `path.join(os.homedir(), "Downloads")` |
| T1.3 | 服务端路径守卫 + parity | RED：`Cannot find module './paths'`；GREEN：`paths.test.ts` + `paths.parity.test.ts` = 19 passed（parity 8 条，含 `/Users/someone/Library/Mobile Documents/com~apple~CloudDocs/Docs`） |
| T1.4 | 去重判定与产物标记（纯函数） | RED：`Cannot find module './dedup'`；GREEN：19 passed（损坏/多字段标记不抛、`stripDocMarker` 对无标记正文原样返回） |
| T1.5 | `POST /api/local-docs/scan` | RED：`Cannot find module './route'`；GREEN：`route.test.ts` 15 passed。真实 `mkdtemp` 目录、不 mock 扫描：只列一层 `.md` 且排序、扫描前后目录清单不变（只读）、`new`/`skip`/`check` 三态、501 截断、ENOENT/ENOTDIR/EACCES 映射、省略 `dirPath` 用 `MD_CONVERTOR_DOWNLOADS_DIR`、跨源 origin 与缺 token 两条 403 |
| T1.6 | 设置页「输入」卡片 | `npx playwright test --project=chromium -g "输入目录"` = 2 passed（未设置时回显「系统下载目录」、无桥接两按钮禁用 + 提示；stub 桥接下选择目录 → PUT body `input` 变 `{ defaultPath: … }` 且 `output` 未被顺手动过；恢复默认写回 `null`）；`-g "输出"` 5 passed 回归 |
| T1.7 | 阶段收尾 | `NODE_OPTIONS= ./init.sh` exit 0（Node 24.15.0，**83 files / 1129 tests**）；`npm run test:e2e` 245 例中 244 passed、仅 firefox 一条既有失败（与本阶段无关，见下） |

**范围外但必须声明的三件事**：

1. **修掉一个既有门禁陷阱（1 行，`vitest.config.ts`）**：`next build` 会把整个仓库镜像进 `.next/standalone`（`*.test.ts` 也在内），而 `test.exclude` 里没有 `.next`，于是任何 `./init.sh` 只要跟在一次 build 或 e2e 之后就会收进 85 份重复用例并失败（实测 17 failed / 162 passed / 179 files，失败样本 `.next/standalone/src/lib/images.test.ts:573`；排除后 83 files 全绿）。**这是根因修，不是 `rm -rf .next` 绕过** —— 否则每个跑过 e2e 的会话都会撞上它。
2. **`chooseOutputDirectory()` 补了一个 `.catch()`**：preload 的校验函数是抛异常而不是 resolve `{ ok: false }`，同文件同类调用点已按既有约定补成 `.catch((): OutputResult => ({ ok: false, code: "SELECT_DIRECTORY_FAILED" }))`。
3. **一条既有 e2e 失败（firefox，非本阶段引入，未修）**：`home.spec.ts` 的「改用富文本粘贴」提示按钮在 firefox 上真实指针点击不生效。**证据**：在 HEAD `1a08440` 的干净 worktree 上复现（`--repeat-each=5` 5/5 失败，确定性而非 flaky）；`src/app` 与 `e2e/` 自 `v0.3.6` 起零改动。**机制**（探针实测，未修）：按钮在视口底部（中心 y≈660 / 视口高 720），该坐标下的原始鼠标事件根本到不了文档（window 捕获监听为空、`elementFromPoint` 仍返回按钮本身），而 `el.click()` 与同样方法的「模式 tab」点击都正常；把页面滚 15px 让按钮中心升到 y≈646 后同一发原始点击即生效 —— 属**环境敏感的坐标问题**（firefox 窗口 `outerHeight` 805 > 屏幕 `availHeight` 692），不是应用逻辑缺陷，且桌面端跑的是 Chromium（Electron），对用户无影响。

## Handoff

- **S1 已收口，下一站是 S2**（`S2-document-pipeline.md`）：本块不再需要任何改动，S2 直接开工（S2 才动 `src/lib/images.ts`，本阶段刻意没碰）。
- **版本面已是 `0.3.7`，不要重复 bump**；发布 `0.3.7` 未获授权。
- T1.3 的 parity 测试是本阶段最有价值的一件小事：`electron/preload-contract.cjs` 与 `src/lib/local-docs/paths.ts` 是**两套独立实现**，谁改谁都要跑它。
- `src/lib/local-docs/dedup.ts` 的三个函数已就绪可复用：`buildDocMarker` / `parseDocMarker` / `stripDocMarker`（S2 翻译前必须 `stripDocMarker`，模型不能看到标记行）、`decideLocalDoc` 与 `localDocFilename`。
- `scanLocalDocs` 已能判出 `new`/`skip`/`check` 三态；S3 只需要把它接到首页面板，**不要再写第二套扫描逻辑**。
- `defaultDownloadsDir(env = process.env)` 已导出且可注入，S3/S2 要测「默认目录」时复用它，不要在测试里读真实 `~/Downloads`。
