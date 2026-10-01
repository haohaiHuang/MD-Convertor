# S2 — 状态与反馈（Spec / Plan / Tasks）

- 上游：`docs/PLAN-ui-fix.md` + `docs/UI-FIX-DESIGN-SPEC-2026-09-30.md`（规格 §4）
- 条目事实源：`docs/UI-REVIEW-2026-09-30.md`（P1-1、P1-2、P2-1、P2-2）
- 前置：S1 完成（顶栏与栅格落地）
- 状态：**未开始**
- feature_list id：`feat-043`

---

## Spec

**目标**：阻断提示可见可行动（P1-1）、CLI 状态不自相矛盾（P1-2）、占位符对比度达标（P2-2）、删重复提示（P2-1）。

**关键决定**（规格 §4）：

1. `no-output` 与 `same-dir` 同套 `.hint .hintWarning`（`--warning: #8a5a12`，5.91:1；不配底、不加图标；弱再上 B 方案 `--warning-soft` 底）。notice DOM 上移到 `.toolbar` **之前**；行内追加 secondary 胶囊「去设置」跳 `/settings?from=local-docs`；`disabledReason` 设 id、`aria-describedby` 挂「一键转换」（启用即移除）；panel 补 `.srOnly`。
2. CLI：`checked={enabled && !!detectedPath}`、保存 coerce `enabled:false`；「未检测到」转 `.pathMissing`（muted 12.5px）；8px 状态点（accent/muted，`aria-hidden`）。
3. placeholder 三处统一 `#6b7484`（4.71:1）——page.module.css 现 L296/345/377；**不用** `#767f8f`（4.04:1 不达标）。
4. 删输出卡 L481「目录选择只能在桌面应用中使用。」重复句（输入卡 L432 保留）；输出「选择目录」补 `title`。

---

## Plan

断言先行：`settings.spec:548` CLI 启停对象、`settings.spec:697` 输出卡重复提示两条**先改断言**（禁止先改实现）；P1-1 三条 e2e 新增。

---

## Tasks

| id | 任务 | RED（先写失败测试） | 完成条件 | 验证 |
| --- | --- | --- | --- | --- |
| T2.1 | P1-1 no-output 四件套 | e2e：警示行在 toolbar **之前**、含「去设置」跳 `/settings?from=local-docs`、「一键转换」`aria-describedby` 挂禁用原因（启用即移除）⇒ failed | 断言绿 + 视觉复核警示可见 | `npx playwright test --project=chromium -g "…"` |
| T2.2 | P1-2 CLI 状态 | e2e：**先改** settings.spec:548（启停往返改用已检测的 CLI）；新增「启用 claude」disabled 且未勾选 ⇒ failed | `checked={enabled && !!detectedPath}`、保存 coerce、`.pathMissing`、8px 状态点 | 断言绿 |
| T2.3 | P2-2 placeholder | e2e/theme：三处 `::placeholder` computed color == `#6b7484` ⇒ failed | 三处换色 | 断言绿 + 对比度 4.71:1 复核记录 |
| T2.4 | P2-1 删重复提示 | e2e：**先改** settings.spec:697（改按钮 title 或页面级）⇒ failed | 删输出卡重复句；输出「选择目录」补 `title` | 断言绿 |
| T2.5 | S2 验收 | — | — | `NODE_OPTIONS= ./init.sh` + `npm run test:e2e` 全绿 + 4 页截图对照 P1-1/2 视觉销项 |

## Result

（2026-10-01 完成）T2.1–T2.4 全部落地，断言先行全程留痕：local-docs 三条 RED（警示行在 toolbar 之后且灰色、无「去设置」、`aria-describedby` null）→ GREEN（notice 上移 + `.hint .hintWarning` 警示色 + 「去设置」胶囊 + `convert-disabled-reason` 生命周期）；settings.spec:536 断言先行 RED（保存不 coerce、claude 可勾）→ GREEN（`coerceDetectedClis` + 8px 状态点 + `.pathMissing`）；theme.spec placeholder RED（rgb(147,155,169)）→ GREEN（rgb(107,116,132)＝`#6b7484`，4.71:1，palette 白名单登记）；settings.spec:706 断言先行 RED（title 空）→ GREEN（删输出卡重复句、按钮条件挂 title）。**裁定**：输出「选择目录」按钮 title 条件挂载（仅无桥接/禁用态挂）——规格意图是「禁用原因仍可读」，可用态恒挂会说谎；后由 S3 补反向断言形成双向锁。**T2.5 独立 QA PASS**：init.sh 95/1274/0、e2e 342/6/0 三引擎、六组新断言逐条核对全绿、4 页截图销项。

## Handoff

S3 起点＝`S3-polish-and-closeout.md`（观感收尾与终验）：P1-6 `.hintRow` 同轴、P1-7 `.entryCard` 尺寸、终验（11 条销项 + Tab 焦点扫描 + 对比度复核 5.78/6.26/4.71）、台账收尾。遗留小项：条件 title 可用态反向断言（`not.toHaveAttribute("title")`）由 S3 补。
