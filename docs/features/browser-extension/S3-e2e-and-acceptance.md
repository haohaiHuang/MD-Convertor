# S3 — 端到端集成、真机验收与文档收口（Spec / Plan / Tasks）

- 上游：`docs/features/browser-extension/FSD.md`（验收标准 §5、风险 §6）
- 前置：S1 + S2 完成（`extension/dist/` 可加载），五条探针结论与 Playwright 下载装置修法已落到 S2 文档
- 状态：**待实施**
- feature_list id：`feat-040`

## Spec

**目标**：把「真浏览器 + 真扩展 + 真写盘」这一段变成可重复的证据，剩下只有人能测的部分做成一份可签字的人工清单，并把文档面同步到事实。

**关键决定**：

1. **测试配置独立**：新增 `playwright.extension.config.ts`（`testDir: "./extension/tests"`、只 chromium、`workers: 1`、无 `webServer`）。**不动** `playwright.config.ts` 的既有三个项目，也不改 `scripts/run-e2e.mjs`——扩展测试不能拖慢或影响桌面 e2e 门禁。
2. **fixture 站**用 `node:http` 现搭（`extension/tests/fixtures/server.mjs`）：静态 HTML + 图片；**一个需要 cookie 才返回 200 的图片路径**（用真实浏览器会话证明 PLAN 附录 A.3.1 的 cookie 结论），**一个永远 404 的图片路径**（证明失败标记），一篇中文长标题、一篇含 `/` `:` 的标题。
3. **写盘落点**：**不要用 `launchPersistentContext` 的 `downloadsPath`**（它正是 Playwright 把下载改成 `<guid>` 的 `allowAndName` 入口，会同时丢掉扩展名与请求的子目录 —— S2 T2.0 实测）。按 S2「探针结果」下的修法：① profile 里预写 `Default/Preferences` 的 `download.default_directory` 指向临时目录；② 启动后发一次 CDP `Browser.setDownloadBehavior { behavior: "default" }`。然后断言**真实文件**（不只看 `downloads.search`）。
4. **规范的那一次在 Terminal 里跑**（沙箱内 Chromium 需要 `--no-sandbox --disable-gpu`，见 `MD_CONVERTOR_EXTENSION_CHROMIUM_ARGS`）；沙箱内跑出来的只能当功能证据，不能当规范证据。
5. **人工验收由用户签字**：工具栏点击与 `activeTab` 授权是自动化点不到的（Playwright 无法点浏览器工具栏），这一段只能人工。

**非目标**：不发布扩展商店、不做多浏览器（Firefox/Safari）、不做 CI 流水线、不给扩展加图标或 popup。

## Plan

### 1. `extension/tests/fixtures/server.mjs`

`node:http` 服务，端口固定（如 43117），路由：`/article`（GFM 表格 + 围栏代码 + 中文 + 惰性图 + 重复图 + 相对路径图）、`/article-cookie`（图片挂在需要 cookie 的路径）、`/article-missing`（含一张 404 图）、`/no-article`、`/img/*`、`/protected/*`（无 cookie → 403）。启动后打印 URL，测试用 `beforeAll` 起、`afterAll` 关。

### 2. `extension/tests/integration.spec.ts`

- 用 `chromium.launchPersistentContext` + `--disable-extensions-except` / `--load-extension` 加载 `extension/dist`；下载目录按上文 §Spec 3 的修法指向临时目录（**不传 `downloadsPath`**）。
- **必须用测试专用的 manifest 变体**：把 `extension/dist` 拷进临时目录后给 `manifest.json` 补 `host_permissions: ["http://127.0.0.1/*"]`（把 fixture 站的实际 origin 写进去）。原因（S2 T2.0 探针 1 实测）：SW **无手势** 调 `chrome.scripting.executeScript` 会被拒（`… must request permission to access the respective host.`），而 Playwright 点不了工具栏、拿不到 `activeTab` 授权。改的是临时目录里的副本，`extension/dist/` 与产品语义不变。
- 通过 `context.serviceWorkers()`（或 `waitForEvent("serviceworker")`）拿 SW，`sw.evaluate((id) => globalThis.__mdConvertorRun(id), tabId)` —— S2 的 `worker.ts` 需为此暴露一个测试用途的内部函数名（**只在 SW 里挂 `globalThis`，不影响生产语义**）。
- 断言矩阵：
  1. `<标题>.md` 与 `<标题>.images/*` 真实出现在 `downloadsPath`；md 内的相对引用与实际文件名逐一对应（朴素正则提取 `](...)` 后逐个 `existsSync`）。
  2. cookie 保护的图片被成功下载（文件存在且非空）。
  3. 404 图：md 里是原始 URL，且下一行有 `<!-- 图片未下载：<url> -->`；`search()`/角标显示 1 张失败。
  4. 同一篇连导两次：文件对仍是同一组（目录里**没有** `标题 (1).md`），md 内容一致。
  5. 中文标题与含 `/` `:` 的标题：文件名干净、`downloadsPath` 里无非法字符、md 可读。

### 3. 人工验收（用户执行，签字）

清单（照 FSD §5 的 5–8 条）：

1. 真机 Chrome → `chrome://extensions` → 开发者模式 → 「加载已解压的扩展程序」→ 选 `extension/dist`。
2. 找一篇普通文章 → 点工具栏图标 → 下载目录出现 `<标题>.md` + `<标题>.images/`，**桌面端未运行**；md 用 Typora/Obsidian 打开图片能显示。
3. 找一篇登录后才可见、图片带会话的文章 → 同样导出；图片应当下得来。
4. 同一篇再点一次 → 文件被覆盖（不出现 `(1)`），文件对仍然成对。
5. 一篇 ≥30 张图的文章 → 观察是否有下载中断（MV3 休眠风险）。
6. 记录浏览器「下载前询问保存位置」是否开启（开着会逐张弹框，行为符合预期即可）。

### 4. 文档收口

- `AGENTS.md`：平台边界加限定（桌面产物只构建/验收 `darwin/arm64`；浏览器扩展不受此限，验收环境为 Chromium）；Verification 段增 `npm run test:extension` 的口径与「构建/集成不进 `init.sh`」的规定。
- `docs/TESTING.md`：新增扩展测试一节（分层、命令、`MD_CONVERTOR_EXTENSION_CHROMIUM_ARGS`、fixture 站、人工验收清单）。
- `CHANGELOG.md`：`[Unreleased]` 加用户可见变化（浏览器插件首个版本：一键把当前页存成 Markdown + 图片）。
- `PROGRESS.md` / `session-handoff.md` / `feature_list.json`：状态、证据、下一步。
- `docs/QUALITY-AUDIT.md`：只追加本轮风险登记（无桌面产物，故不动发布门禁段）。

## Tasks

| id | 任务 | RED（先写失败测试） | 完成条件 | 验证 |
| --- | --- | --- | --- | --- |
| T3.0 | fixture 站（含 cookie 保护图与 404 图） | `extension/tests/fixtures/server.test.mjs`：无 cookie 拿 `/protected/*` → 403、带 cookie → 200；`/img/missing.png` → 404 ⇒ 先 failed（服务器不存在） | 全绿 | `npx vitest run extension/tests/fixtures/server.test.mjs` |
| T3.1 | 真实扩展 + 真实写盘断言 | `integration.spec.ts` 用例①②：md 与图片文件真的落进 `downloadsPath`；md 引用与实际文件名逐一对应 ⇒ 先 failed | chromium 全绿（Terminal 里跑的规范那一次） | `npm run test:extension -- -g integration` |
| T3.2 | cookie 图与 404 图的差别路径 | 用例③：cookie 图成功、404 图退回原 URL + `<!-- 图片未下载：… -->` ⇒ 先 failed | 全绿 | 同上 |
| T3.3 | 重复导出与文件名净化 | 用例④⑤：覆盖、无 `(1)`、中文与 `/` `:` 标题文件名干净 ⇒ 先 failed | 全绿 | 同上 |
| T3.4 | 人工验收执行与签字 | — | 用户按 §3 清单跑完 6 条并签字（含 ≥30 图那篇的结论）；结论写进 `feature_list.json` 的 verification | 人工（用户）；证据为用户回复 + 本文件记录 |
| T3.5 | 文档收口 | — | `AGENTS.md` / `docs/TESTING.md` / `CHANGELOG.md` / `PROGRESS.md` / `session-handoff.md` / `feature_list.json` 与事实一致；`init.sh` 与 `test:extension` 均绿 | `./init.sh && npm run test:extension` |
| T3.6 | 阶段收尾 | — | `extension/dist-test/` 与临时 Downloads 目录已清理（或在 gitignore 内）；`git status --short` 只含预期改动 | `git status --short` |

## Handoff

- 结束时必须写清：`npm run test:extension` 的规范运行环境（Terminal，非沙箱）；人工验收的结论（尤其 ≥30 图那篇是否被打断）；`activeTab` 授权段无法自动化这一缺口；扩展版本号与桌面版本面的关系（互不影响，`desktop:release` 仍只认桌面版本）。
- 若 T3.4 暴露 MV3 休眠打断下载：在 `extension/src/worker-run.ts` 的下载等待处按 `ponytail:` 注释加保活（例如 20s 一次的 `chrome.runtime.getPlatformInfo()` 心跳），并在本文档记录改动与复验结果。
