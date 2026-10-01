# PLAN — UI 走查整改（feat-043）改修实施计划

> 状态：**待用户批准开工**（回复「按推荐」即按本文默认决策执行）。
> 输入三件套：`docs/UI-REVIEW-2026-09-30.md`（走查报告，条目事实源）、
> 本文 §2 需求摘要（许明需定稿）、`docs/UI-FIX-DESIGN-SPEC-2026-09-30.md`（彩格调整改规格，数值事实源）。
> 产出目标：走查 P1 全清零（9 项，含用户两点）+ 零成本 P2 两条，共 **11 条**，分 S1–S3 三阶段 TDD 推进。
> 边界：**不 bump 版本（保持 0.3.9）、不发布、不动 `extension/`、不改视觉方向**；发布任何版本需用户单独授权。

---

## 1. 事项定位

- 单一事项 `feat-043「UI 走查整改」`，开工时登记 `feature_list.json`（状态 `in-progress`），
  阶段任务事实源落 `docs/features/ui-fix/S1–S3-*.md`（沿用 Tasks 表含 RED/完成条件/验证列的既有格式）。
- 只动这些文件：`src/app/globals.css`、`src/app/page.tsx`、`src/app/page.module.css`、
  `src/app/settings/page.tsx`、`src/app/settings/page.module.css`、`src/app/settings/client.ts`（+test）、
  `src/app/local-docs/panel.tsx`、`src/app/local-docs/panel.module.css`、`e2e/**`（断言先行）。
- **TDD 铁律**：每个任务先有失败测试（RED）→ 最小实现（GREEN）→ REFACTOR。布局类任务的 RED =
  e2e 几何/主题断言先行改写或新增；逻辑类任务（文案映射、enabled 归一）RED = vitest 单测。

## 2. 需求摘要（许明需定稿，浓缩）

- **范围**：批 1 顶栏与栅格（点 1、点 2、P1-3/4/5）→ 批 2 状态与反馈（P1-1/2、P2-1/2）→ 批 3 观感收尾（P1-6/7），共 11 条。
- **推迟**：P2-3 表格状态 chip、P2-4 hero 展示字体、P2-5 ✓ 换 SVG、P2-6 圆角全量收敛（防蔓延，将来单独立项）。
- **目标**：P1 9/9 销项；用户两点在 1180×820 截图可见生效；布局改动全部在 e2e 断言显式更新后落地；760px 断点、reduced-motion、focus-visible、对比度零回退。
- **DoD**：11 条逐条对照走查报告销项 + TDD 留痕 + `./init.sh` 与 `npm run test:e2e` 全绿 + 真机截图视觉销项 + 台账（feature_list.json / PROGRESS.md / CHANGELOG）齐全。

## 3. 决策点（默认「按推荐」）

| # | 决策 | 推荐（默认） | 备选 |
|---|---|---|---|
| D1 | `--col` 取值 | **880px**（彩格调裁决：中文 ≈54 字/行、首页卡 433×220 比例稳、表格 832px 容纳 5 列、全局最小扰动） | 960px（许明需备选，表单偏宽 ≈60 字/行） |
| D2 | placeholder 色 | **`#6b7484`**（4.71:1 达 AA；走查报告的 #767f8f「≈4.6:1」系误算，实为 4.04:1 不达标） | #767f8f（验收须如实记 4.04:1） |
| D3 | P1-6 对齐轴 | **整组左对齐**（`.hintRow` → `flex-start`，与表单控件同轴）**（2026-10-01 真机反馈取代：特点组与勾选框同行、右对齐到内容列右缘）** | 二者都居中（不得混用） |
| D4 | 裁剪边界 | 按 §2 推迟 P2-3…P2-6 | 连做则 P2-6 必须单独立项 |

## 4. 实施规格（数值一律以 `docs/UI-FIX-DESIGN-SPEC-2026-09-30.md` 为准，此处只列任务）

新增 token 仅 3 个：`--col: 880px`、`--control-h: 36px`、`--radius-control: 10px`；不新增颜色 token；
`--weight-ui: 400` 禁改（theme.spec 锁字重）。禁用态一律弃 opacity 换色（旧评审 P0-1 教训）。

---

## 5. 阶段与任务

### S1 顶栏与栅格（批 1，布局批——断言先行）

| # | 任务 | RED（先写/先改的测试） | 实现 | 完成条件 |
|---|---|---|---|---|
| T1.0 | 开工簿记 + 基线 | — | feature_list.json 立 feat-043；建 `docs/features/ui-fix/` | `./init.sh` + `npm run test:e2e` 基线全绿并记录 |
| T1.1 | 断言先行 | 新增：品牌居中（brand 中心 x ≈ header 中心 ±4px）；顶栏返回左缘≈内容列左缘、设置右缘≈列右缘（±4px）；两钮同高（±1px）；保留 home.spec 三屏品牌 x 一致断言 | — | 新断言在旧实现上**失败**（RED 成立） |
| T1.2 | token 落地 | theme.spec 可断 `:root` 变量存在 | globals.css 加 3 个 token | init.sh 绿 |
| T1.3 | 栅格统一 | T1.1 对齐断言转绿 | 各 max-width → `var(--col)`（映射表见规格 §1；header/shell/hintRow 用 `min(var(--col),100%)`） | T1.1 断言绿 + 760px 断点用例绿 |
| T1.4 | 顶栏三列网格 | T1.1 居中断言转绿 | page.tsx：`.brand` 移出 `.headerLeft`（删 `.headerLeft`/`.backSlot`）；page/settings `.header` 三列网格 `1fr auto 1fr`（flex fallback 保留）；saveStatus 右置 | 居中断言绿 + 跨屏品牌 x 断言绿 |
| T1.5 | 控件归一 + 返回文案 | unit：`settings/client.ts` 增 `from→返回文案` 映射函数测试（home→「← 返回首页」/local-docs→「← 返回文档处理」/convert→「← 返回转换」/缺省→「← 返回」）；e2e：**先改** settings.spec「返回转换等待在途保存」name→「返回」、local-docs.spec 返回→「返回文档处理」 | 36px/13.5px/10px 归一（≤40px 胶囊全档）；checkbox 17→16；`.backButton` 去 86px 固定宽；淘汰 `.backLink`；返回文案接映射 | 单测绿 + 相关 e2e 绿 |
| T1.6 | S1 验收 | — | — | `./init.sh` + `npm run test:e2e` 全绿（**Firefox 必跑**）+ 1180×820 截图对照点 1/点 2 生效 |

### S2 状态与反馈（批 2）

| # | 任务 | RED | 实现 | 完成条件 |
|---|---|---|---|---|
| T2.1 | P1-1 no-output 四件套 | e2e：警示行在 toolbar **之前**、含「去设置」按钮跳 `/settings?from=local-docs`、「一键转换」`aria-describedby` 挂禁用原因（启用即移除） | `no-output` 套 `.hint .hintWarning`（先文字色，弱则 B 方案上 `--warning-soft` 底）；notice DOM 上移；追加「去设置」secondary 胶囊；`disabledReason` 设 id；panel 补 `.srOnly` | 断言绿 + 视觉复核警示可见 |
| T2.2 | P1-2 CLI 状态 | e2e：**先改** settings.spec:548（启停往返改用已检测的 CLI）；新增「启用 claude」disabled 且未勾选（claude 未检测到） | `checked={enabled && !!detectedPath}`、保存 coerce `enabled:false`；`.pathMissing`（muted）；8px 状态点（accent/muted，aria-hidden） | 断言绿 |
| T2.3 | P2-2 placeholder | e2e/theme：三处 `::placeholder` computed color == `#6b7484` | page.module.css L296/345/377 三处换色 | 对比度 4.71:1 复核记录 |
| T2.4 | P2-1 删重复提示 | e2e：**先改** settings.spec:697（输出卡断言改按钮 title 或页面级） | 删输出卡 L481 重复句；输出「选择目录」补 `title` | 断言绿 |
| T2.5 | S2 验收 | — | — | init.sh + test:e2e 全绿 + 4 页截图对照 P1-1/2 视觉销项 |

### S3 观感收尾（批 3）与终验

| # | 任务 | RED | 实现 | 完成条件 |
|---|---|---|---|---|
| T3.1 | P1-6 同轴 | e2e：hintRow 与 translateToggle 左缘一致（±4px） | `.hintRow` → `width: min(var(--col),100%); justify-content: flex-start` | 断言绿 |
| T3.2 | P1-7 entryCard | e2e：卡片高度 ≤ 260px（无内容拉伸）；760px 单列不破 | 删 `aspect-ratio: 1/1` → `min-height: 220px`；padding 28px 24px；删 760px 死规则 | 断言绿 |
| T3.3 | 终验 | — | — | `./init.sh` + `npm run test:e2e` 全绿；真机 1180×820 四页 + 760px 一张截图逐条销项；Tab 焦点扫描无缺环；placeholder/禁用态对比度复核（禁用 primary 5.78:1、secondary 6.26:1、placeholder 4.71:1） |
| T3.4 | 台账收尾 | — | feature_list.json 挂证据；PROGRESS.md / session-handoff.md 更新；`CHANGELOG.md` [Unreleased] 记用户可见变化；QUALITY-AUDIT 归档一条 ≤10 行轮次记录 | clean、restartable state |

## 6. 风险清单（彩格调逐条核对过 e2e，执行时对照）

1. **品牌 x 断言红线**：home.spec 三屏品牌 x 一致（±0.05px）是生命线——header 宽度必须固定 `min(var(--col),100%)`，不得随内容变；显式 `grid-column` 保证首页无返回键时品牌不偏。
2. **断言先行四条**（禁止先改实现）：settings.spec「返回转换」等待保存用例（name→「返回」）、local-docs.spec 返回文案、settings.spec:548 CLI 启停对象、settings.spec:697 输出卡重复提示断言。
3. **Firefox 死区**：home.spec「改用富文本粘贴」click(30,6) 避 y≈672 死区——布局后若按钮顶部移入死区，调 click position 并复跑 Firefox。
4. **字重锁**：按钮/品牌字重锁 `var(--weight-ui)`（theme.spec 拦 500）；规格未列明处不改任何色值与字重。
5. **禁用态**：弃 opacity 换色后自测 primary/secondary 禁用各一眼（旧 P0-1「禁用态 2.51:1」不得回归）。
6. **已知留白**（不属本轮）：`.result` 区仍为 1180 全宽，比新列 880 宽；违和感若明显，另立事项收进 `min(var(--col),100%)`，勿混入本轮。

## 7. 验证口径（汇总）

| 层 | 命令/手段 | 通过标准 |
|---|---|---|
| 基线 | `./init.sh` | exit 0 |
| 交互与布局 | `npm run test:e2e` | 全绿（Chromium/WebKit/Firefox） |
| 视觉销项 | 真机 Electron 1180×820 ×4 + 760px ×1 截图 | 11 条逐条现象消失、无新增不一致 |
| 可访问性 | Tab 扫描 + WCAG 对比度复核 | 焦点无缺环；禁用态/placeholder 达标值如实记录 |
| 台账 | feature_list.json / PROGRESS.md | 每条挂验证命令与结果 |

## 8. 执行方式

- 用户批准后按 S1 → S2 → S3 顺序开工（One feature at a time，批内可小步提交但**只有用户要求才 commit**）。
- 每完成一个阶段向用户通报并附截图；S3 结束交付对照销项表（11 条 × 现状/改后证据）。
