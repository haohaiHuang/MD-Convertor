# S1 — 顶栏与栅格（Spec / Plan / Tasks）

- 上游：`docs/PLAN-ui-fix.md`（施工计划）+ `docs/UI-FIX-DESIGN-SPEC-2026-09-30.md`（数值规格，下称「规格」）
- 条目事实源：`docs/UI-REVIEW-2026-09-30.md`（点 1、点 2、P1-3/4/5 属本阶段）
- 前置：T1.0 簿记（本文件所属动作）；基线 `NODE_OPTIONS= ./init.sh` = 95 files / 1270 passed / 0 skipped（2026-10-01 实测）
- 状态：**进行中**
- feature_list id：`feat-043`
- 四条锁死决策（见 `PLAN-ui-fix.md` §3）：D1 `--col: 880px`；D2 placeholder `#6b7484`；D3 顶栏三列栅格、品牌左列配平（**不**硬居中，见下）；D4 P2-3…P2-6 推迟。
- **红线**：`home.spec.ts:540-553` 三屏品牌 x 一致（±0.05px）——顶栏宽度必须 `min(var(--col),100%)` 且不随内容变。

---

## Spec

**目标**：统一三页内容列（`--col: 880px`）+ 顶栏贴合内容列 + 三列栅格品牌居中 + 控件度量归一 + 设置页返回文案映射。

**关键决定**（与规格 §1/§2/§3 一致）：

1. `globals.css` `:root` 只加 3 个 token：`--col: 880px`、`--control-h: 36px`、`--radius-control: 10px`；不加颜色 token；`--weight-ui: 400` 禁改。
2. 栅格映射按规格 §1.2 表逐行换 `var(--col)`；header / shell / hintRow / translateToggle 用 `min(var(--col),100%)`。保持不动：page `.shell`（1180）、`.statusCard` 族（720）、`.confirmDialog`（480）、`.result` 区（规格 §7 风险 16，本轮范围外）。
3. 顶栏三列网格 `1fr auto 1fr`：左列返回胶囊（首页为 null/空占位）、中列品牌、右列设置按钮/`saveStatus`；品牌靠左右列等宽配平落到视口中轴。删 `.headerLeft` / `.backSlot`（86px）/ settings `.backLink`。
4. 控件归一：≤40px 胶囊一律 36px / 13.5px / radius 10px；checkbox 17→16；`.backButton` 去 86px 固定宽。
5. 返回文案映射（含 `← ` 前缀）：home→「← 返回首页」、local-docs→「← 返回文档处理」、convert→「← 返回转换」、缺省→「← 返回」；可访问名即可见文案。主界面返回按钮文案与 `aria-label="返回首页"` **不动**。
6. 禁用态弃 opacity 换色（规格 §3.4）。

---

## Plan

布局类任务的 RED = e2e 几何/主题断言先行改写或新增（T1.1 集中做）；逻辑类（文案映射）RED = vitest 单测。断言先行四条（禁止先改实现）：settings.spec「返回转换」等待保存用例 name→「返回」、local-docs.spec 返回文案→「返回文档处理」、`settings.spec:548` CLI 启停对象、`settings.spec:697` 重复提示——前两条属本阶段 T1.5，后两条属 S2。

---

## Tasks

| id | 任务 | RED（先写失败测试） | 完成条件 | 验证 |
| --- | --- | --- | --- | --- |
| T1.0 | 开工簿记 + 基线 | — | feature_list.json 立 feat-043（in-progress）+ 建 `docs/features/ui-fix/`；基线记录在案 | `NODE_OPTIONS= ./init.sh`（95/1270/0） |
| T1.1 | 断言先行（几何） | 新增：品牌中心 x ≈ header 中心 ±4px；顶栏返回左缘≈内容列左缘、设置右缘≈列右缘（±4px）；两钮同高（±1px）；保留 home.spec 三屏品牌 x 一致断言 ⇒ 旧实现上 failed | 新断言在旧实现上失败（RED 成立）并留日志 | `npx playwright test --project=chromium -g "…"` |
| T1.2 | token 落地 | theme.spec 可断 `:root` 三变量存在 ⇒ failed | globals.css 加 3 个 token，测试绿 | `npx vitest run tests/palette.test.ts` + `./init.sh` |
| T1.3 | 栅格统一 | T1.1 对齐断言转绿 | 各 max-width → `var(--col)`（映射表见规格 §1.2） | T1.1 绿 + 760px 断点用例绿 |
| T1.4 | 顶栏三列网格 | T1.1 居中断言转绿 | `.brand` 移出 `.headerLeft`（删 `.headerLeft`/`.backSlot`）；header 三列网格（flex fallback 保留）；saveStatus 右置 | 居中断言绿 + 跨屏品牌 x 断言绿 |
| T1.5 | 控件归一 + 返回文案 | unit：`settings/client.ts` 增 `from→返回文案` 映射函数测试；e2e：**先改** settings.spec「返回转换」name→「返回」、local-docs.spec 返回→「返回文档处理」 | 36px/13.5px/10px 归一；checkbox 17→16；`.backButton` 去固定宽；淘汰 `.backLink`；返回文案接映射 | `npx vitest run src/app/settings/client.test.ts` + 相关 e2e 绿 |
| T1.6 | S1 验收 | — | — | `NODE_OPTIONS= ./init.sh` + `npm run test:e2e` 全绿（**Firefox 必跑**）+ 1180×820 截图对照点 1/点 2 生效 |

## Result

（2026-10-01 完成）T1.0–T1.6 全部落地，TDD 留痕完整：T1.1 三条几何断言 RED（品牌中心偏轴、边缘间隙 178.8px、双钮高度差 4px）→ GREEN；T1.2 token 断言 RED → `globals.css` 加 `--col:880px`/`--control-h:36px`/`--radius-control:10px` → GREEN；T1.3 14 处宽度字面量按规格 §1.2 映射换 `var(--col)`；T1.4 顶栏三列网格 `1fr auto 1fr`（flex 兜底保留，删 `.headerLeft`/`.backSlot`/`.backLink`，品牌 `justify-self:center`，宽度 `min(var(--col),100%)`）；T1.5 控件归一（36/13.5/10、checkbox 16px、禁用态弃 opacity 换色）+ `backLabel(from)` 4 单测 + settings.spec:595 / local-docs.spec:152 断言先行改写（标题同步）。返工裁定：② translateToggle 禁用态去 opacity（§3.3，断言先行补入 `translate.spec`）；⑥ 两条 e2e 标题同步；③ `.modeTab:disabled` 最小化改法**裁定接受**（§3.4 配方枚举不含 `.modeTab`）。**T1.6 独立 QA PASS**：init.sh 95 files/1274 passed/0 skipped、e2e 330/6/0 三引擎、红线 `home.spec:540-553` 原文未动全绿、1180×820 三屏截图消解走查点 1/点 2。

## Handoff

S2 起点＝`S2-state-and-feedback.md`（状态与反馈）。断言先行四条的后两条（settings.spec CLI 启停对象、输出卡重复提示）留给 S2 先改断言；placeholder `#6b7484` 归 S2 T2.3。红线（`home.spec:540-553` 三屏品牌 x ±0.05px）与本阶段几何/token/禁用态断言全绿不动。
