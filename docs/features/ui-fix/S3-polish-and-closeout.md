# S3 — 观感收尾与终验（Spec / Plan / Tasks）

- 上游：`docs/PLAN-ui-fix.md` + `docs/UI-FIX-DESIGN-SPEC-2026-09-30.md`（规格 §5）
- 条目事实源：`docs/UI-REVIEW-2026-09-30.md`（P1-6、P1-7）
- 前置：S2 完成
- 状态：**未开始**
- feature_list id：`feat-043`

---

## Spec

**目标**：同屏辅助信息同轴（P1-6）、首页入口卡留白回收（P1-7）、终验销项与台账收尾。

**关键决定**（规格 §5）：

1. `.hintRow` 整组左对齐（D3）：`width: min(var(--col),100%); margin: 18px auto 0; justify-content: flex-start`；与 `.translateToggle` 左缘同轴。✓ 字形（P2-5）不动；760px `flex-wrap` 保留。**（2026-10-01 真机反馈取代：特点组改为与勾选框同行、右对齐到内容列右缘，见 Result 追记。）**
2. `.entryCard`：删 `aspect-ratio: 1/1` → `min-height: 220px`；padding `28px 24px`；删 760px 的 `aspect-ratio: auto` 死规则；其余（gap 12px、居中、22px/13.5px 字号）不动。
3. 终验对照度：禁用 primary 5.78:1、secondary 6.26:1、placeholder 4.71:1（如实记录）；Tab 焦点扫描无缺环。

---

## Plan

布局类 RED = e2e 几何断言先行。终验跑全量门禁（`./init.sh` + `npm run test:e2e`，Firefox 必跑）+ 真机截图逐条销项 + 台账收尾（T3.4）。

---

## Tasks

| id | 任务 | RED（先写失败测试） | 完成条件 | 验证 |
| --- | --- | --- | --- | --- |
| T3.1 | P1-6 同轴 | e2e：hintRow 与 translateToggle 左缘一致（±4px）⇒ failed | `.hintRow` → `flex-start` + `min(var(--col),100%)` | 断言绿 |
| T3.2 | P1-7 entryCard | e2e：卡片高度 ≤ 260px（无内容拉伸）；760px 单列不破 ⇒ failed | 删 `aspect-ratio` → `min-height: 220px`；padding 28px 24px；删 760px 死规则 | 断言绿 |
| T3.3 | 终验 | — | — | `NODE_OPTIONS= ./init.sh` + `npm run test:e2e` 全绿；1180×820 四页 + 760px 一张截图逐条销项；Tab 焦点扫描无缺环；对比度复核（5.78 / 6.26 / 4.71） |
| T3.4 | 台账收尾 | — | feature_list.json 挂证据；PROGRESS.md / session-handoff.md 更新；`CHANGELOG.md` / `CHANGELOG.zh.md` 记用户可见变化；QUALITY-AUDIT 归档一条 ≤10 行 | clean、restartable state |

## Result

（2026-10-01 完成）T3.1–T3.4 全部落地：T3.1 同轴断言 RED（左缘差 314.72px）→ `.hintRow` `justify-content: flex-start` → GREEN（实测 delta 0.00px）；T3.2 entryCard 断言 RED（433px 高）→ 删 `aspect-ratio` 换 `min-height:220px` + padding `28px 24px` + 删 760px 死规则 → GREEN（220px，双列/单列护栏绿）；补强 title 反向锁（`settings.spec`，护栏断言无 RED，如实申报）。**T3.3 独立 QA 终验 PASS**：init.sh 95/1274/0、e2e **348 passed/6 skipped/0 failed** 三引擎（Firefox 必跑）、**11/11 销项**（销项表与截图 `outputs/qa-s3-*.png` + qa-s1/qa-s2 两组）、Tab 焦点扫描四页 0 缺环、对比度复核 5.78/6.26/4.71 全对上且禁用态 opacity 全 1。T3.4 台账已同步（feature_list 7 条 verification + status done、PROGRESS、session-handoff、QUALITY-AUDIT round log、CHANGELOG 双语、AGENTS.md）。**未 bump（0.3.9）、未 commit、未发布。**

**追记（2026-10-01 真机确认反馈）**：用户指出特点行独占一行「感觉很怪」，裁定改为与翻译勾选框**同一行、右对齐**。TDD：`home.spec.ts` 用例改名「产品特点与翻译勾选同行，特点组右对齐到内容列右缘」（同行 ≤6px / 在勾选右侧 / 组右缘贴 `.form` 右缘 ±4px）⇒ RED（三引擎垂直差 37px）→ 新增 `.footerRow`（`space-between`）包住勾选 + 特点组、`.translateToggle` 去宽去外边距、`.hintRow` 去列宽 ⇒ GREEN 3/3。取代 T3.1 的左缘同轴口径（该断言已被新断言替换）；无勾选框（未配翻译）时特点组维持左对齐（`space-between` 单子项行为）。门禁：init.sh 95/1274/0 + e2e **348 passed / 6 skipped / 0 failed** 三引擎。

## Handoff

feat-043 已关闭（11 条销项、三阶段独立验收均 PASS）。下一步＝等用户审阅改动并指示 commit；发布前才 TDD bump 到 `0.3.10`（bump 与发布均需用户授权）。**一处待用户确认**：D3 品牌对齐——实施按规格口径（顶栏 `1fr auto 1fr` + 品牌 `justify-self:center` 落视口中轴），旧交接提示词「86px 配平列/品牌左对齐」判为走样；若用户要左对齐，只改 `.brand` 的 `justify-self` 一行并同步 `home.spec:601` 品牌中心断言（红线 `home.spec:540-553` 仍不动）。
