# S4 — 插件分发包、验收与收口（Spec / Plan / Tasks）

- 上游：`docs/features/app-document-processing/FSD.md`（§4.8 插件分发、§4.9 测试分层、§5 验收）
- 前置：**S3 已完成**（首页有插件下载按钮与本地文档面板）；插件本体（`feat-040`）**已关闭**，本阶段只增加「打包 + 说明」，不改插件行为
- 状态：**未开始**
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

- `scripts/build-extension.mjs`：把现有三份产物拷进暂存目录 `extension/dist-package/md-convertor-extension/`（+ `使用说明.md`），用 `execFileSync("/usr/bin/ditto", ["-c", "-k", "--keepParent", stagingDir, "public/md-convertor-extension.zip"])`；目录不存在就现建。
- `package.json`：加 `"prebuild": "npm run build:extension"`。
- `.gitignore`：加 `public/*.zip`、`extension/dist-package/`。

**RED**：同 T4.0 的测试文件补断言：`public/md-convertor-extension.zip` 存在；`unzip -Z1` 输出恰好 4 条（含目录前缀）；`manifest.json` / `content.js` / `worker.js` 解出的字节数 > 0；`manifest.json` 里的 `version` 与 `extension/manifest.json` 一致 ⇒ 先 failed。

**完成条件**：`npm run build:extension && npx vitest run extension/tests/extension-package.test.mjs` 绿；`rm -rf public/md-convertor-extension.zip && npm run build` 之后该文件重新出现（证明 `prebuild` 接线有效）。

### T4.2 端到端与人工验收

- 机器侧（已有）：`./init.sh` 全绿 + `npm run test:e2e` 全绿（S3 已建）。
- 人工清单（真机，逐条签字；填在本文件 §Result 与 `feature_list.json`）：

| # | 场景 | 期望 |
| --- | --- | --- |
| 1 | 打开应用 | 首页顶部出现模式选择器；默认仍是「粘贴 · 链接转换」；内层两个 tab 与之前一致 |
| 2 | 点「下载浏览器插件」 | 下载目录出现 ZIP；解压得到 `md-convertor-extension/`；按 `使用说明.md` 在 Chrome 里能加载 |
| 3 | 切到「转换既有文档」 | 自动按设置里的输入目录（默认系统下载目录）扫描，列出 `.md` 与状态 |
| 4 | 「选择目录」换一个目录 | 列表自动刷新；回设置页看到同一个值 |
| 5 | 设置页「恢复默认」 | 输入目录回显系统下载目录；回首页重新扫描得到下载目录的内容 |
| 6 | 全选 → 一键转化 | 逐行状态推进，收尾出现汇总；**不自动**打开目录 |
| 7 | 点汇总里的「打开目录」 | Finder 打开输出目录，产物与源文件都在（源未被改动） |
| 8 | 勾选翻译再转化一批 | 产出为译文，行状态注明「只翻译了非目标语言部分」 |
| 9 | 同一批再点一次一键转化 | 全部「已处理，跳过」（不重复处理）；点某行「重新处理」后只有它重做 |
| 10 | 输出目录设成输入目录 | 被拒绝并给出建议按钮；点后输出目录变成 `<输入目录>/processed` |
| 11 | 断网打开产物 | 图片可见（base64 内嵌） |
| 12 | 含 ≥30 张图的文档 | 行状态明确写出「N 张已内嵌、M 张保留原引用」，不静默 |

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
| T4.2 | 端到端门禁 + 12 条人工验收 | —（机器侧 S3 已建；人工侧只能人跑） | `./init.sh` 与 `npm run test:e2e` 全绿；12 条各有结论 | `NODE_OPTIONS= ./init.sh && npm run test:e2e` |
| T4.3 | 文档收口（AGENTS/TESTING/CHANGELOG/PROGRESS/session-handoff/feature_list/QUALITY-AUDIT/PLAN） | — | `./init.sh` 全绿；无过期叙述 | `NODE_OPTIONS= ./init.sh` |

## Result

**未开始**。

## Handoff

- 本阶段是 A 的收尾，但**不等于发布**：`desktop:release` 只允许目标版本 `0.3.6`（已发布），发布 `0.3.7` 需要用户单独下指令，并同时更新 `脚本目标版本`、`AGENTS.md` 版本句与 `docs/TESTING.md` 的产物哈希段。
- 人工验收 12 条里第 9（重复跳过）与第 12（≥30 图）是最容易出偏差的两条：前者依赖去重标记，后者依赖 `MAX_IMAGES` 的提示口径——出问题先改对应阶段再改文档，不要就地绕过。
- ZIP 与 `public/` 的关系只有一条：`prebuild` 保证它总在 `next build` 之前产出。若将来把插件构建从桌面构建里拆出去，必须同时保证 `desktop:prepare` 之前跑过它。
