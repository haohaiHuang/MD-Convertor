# MD-Convertor UI 走查整改 · 设计规格（v0.3.9 → 整改批 1/2/3）

> 出品：设计原型专家团 · 设计系统专家（彩格调）。基于 0.3.5 既有视觉语言（浅灰渐变 + 白卡 + 蓝灰单主色 + 克制留白）做**令牌定制**，不换设计系统。
> 依据：`docs/UI-REVIEW-2026-09-30.md`（11 条：点1、点2、P1-1…P1-7、P2-1、P2-2 + 批3两条）。P2-3…P2-6 推迟。
> 本文所有色值为 WCAG 相对亮度公式实测值（非估算）。只出规格，不含实现代码。

## 0. 新增 token 一览（globals.css `:root`，仅 3 个，其余全部复用）

```css
--col: 880px;            /* 三页共用内容列宽 */
--control-h: 36px;       /* 控件统一高度（顶栏/工具条级按钮） */
--radius-control: 10px;  /* 控件统一圆角 */
```

不新增任何颜色 token；placeholder 用行内色值（见 §4）。`--weight-ui: 400` 严禁改动（theme.spec 锁定按钮/品牌字重 400）。

---

## 1. 栅格规格（对应：点 2、批1②）

### 1.1 `--col` 裁决：**880px**（960 否决）

| 候选 | 主转换表单/textarea 行长 | 文档表格（panel） | 首页入口卡 | 设置页 | 扰动量 |
|------|------------------------|------------------|-----------|--------|--------|
| 960px | 16px 中文 ≈ 60 字/行，超舒适编辑行长（40–55） | 不变 | 473px/卡，更空（与 P1-7 方向相反） | +100px | 表单面放大约 17% |
| **880px（采纳）** | ≈ 54 字/行，聚焦 | 960→880，内容宽 832px 足容纳 5 列 | 433px/卡 + 220px 高 ≈ 2:1，比例稳 | +20px，无感知 | 全局最小扰动 |

理由补充：
- 旧评审「820 是合适阅读表面」是旧视觉时代针对**结果区**的判断，不适用本轮（当前结果区在 shell 1180 全宽，见 §7 备注）；820 还会反向挤掉文档表格 80px，不采纳。
- 960/880 在 960px 视口下都受 `min(var(--col), 100%)` 保护（可用宽 883px），无断点风险；差异只体现在 ≥1180 桌面视口（本产品主战场）。
- 880 使三页（首页/转换/文档处理/设置）共用同一中轴与同一左右缘，点 1 的品牌居中轴、点 2 的顶栏贴合全部复用它。

### 1.2 「元素 → 现 max-width → 新值」完整映射

| 选择器 | 文件 | 现值 | 新值 |
|--------|------|------|------|
| `.header` | page.module.css | flex，随 shell 1180 全宽 | `width: min(var(--col), 100%)` + 三列网格（§2） |
| `.header` | settings/page.module.css | flex，随 shell 860 全宽 | 同上（三列网格） |
| `.hero` | page.module.css | 960px | `var(--col)` |
| `.landing` | page.module.css | 960px | `var(--col)` |
| `.entryGrid` | page.module.css | 820px | `var(--col)` |
| `.subtitle` | page.module.css | 820px | `var(--col)` |
| `.modeTabs` | page.module.css | 820px | `var(--col)` |
| `.modePanel` | page.module.css | 820px | `var(--col)` |
| `.form` | page.module.css | 820px | `var(--col)` |
| `.translateToggle` | page.module.css | `min(820px, 100%)` | `min(var(--col), 100%)` |
| `.validation` | page.module.css | 820px | `var(--col)` |
| `.hintRow` | page.module.css | 随父级 .hero | `width: min(var(--col), 100%); margin: 18px auto 0`（§5） |
| `.translationNotice` | page.module.css | 820px | `var(--col)` |
| `.saveNotice` | page.module.css | 820px | `var(--col)` |
| `.panel` | local-docs/panel.module.css | 960px | `var(--col)` |
| `.degraded` | local-docs/panel.module.css | 960px | `var(--col)` |
| `.shell` | settings/page.module.css | 860px | `min(var(--col), 100%)` |
| **保持不动** | | | `.shell`（page，1180px，页面外框）、`.statusCard/.errorCard/.cancelledCard/.errorHint`（720px，窄提示面）、`.confirmDialog`（480px）、`.result` 区（见 §7 风险 16） |

统一写法：`max-width: var(--col)`（translateToggle/hintRow/header/shell 用 `min(var(--col), 100%)` 防溢出）。`.form` 是 flex，820→880 无断点问题；760px 断点与 `prefers-reduced-motion` 均不受影响（该断点规则不涉列宽变量）。

---

## 2. 顶栏规格（对应：点 1、点 2、批1①④⑤、P1-5）

### 2.1 三列网格（page.module.css 与 settings/page.module.css 同语义）

```css
.header {
  display: flex;                       /* fallback：老引擎仍左右分布，不破版 */
  align-items: center;
  justify-content: space-between;
  display: grid;                       /* 现代引擎：三列 */
  grid-template-columns: 1fr auto 1fr;
  width: min(var(--col), 100%);        /* 顶栏贴合内容列（点 2） */
  min-height: var(--control-h);        /* 首页无返回按钮时高度不塌 */
  margin: 0 auto clamp(54px, 8vw, 100px);   /* settings 页保留自身节奏：clamp(28px, 5vw, 48px) */
}
.headerBack    { grid-column: 1; justify-self: start; }   /* 胶囊返回；首页渲染 null 或空占位 */
.brand         { grid-column: 2; justify-self: center; }  /* 品牌居中（点 1） */
.headerActions { grid-column: 3; justify-self: end; display: inline-flex; align-items: center; gap: 12px; }
```

- DOM 调整：`.brand` 移出 `.headerLeft`，成为 `.header` 直接子元素（page.tsx L639-641 / settings/page.tsx L366-368 同改）；删除 `.headerLeft` 样式。
- **backSlot 86px 机制删除**：品牌居中后其 x 只取决于 `.header` 宽（三屏同值），不再依赖左列占位；`.backButton` 同时去掉固定 86px 宽（设置页返回文案更长，固定宽会溢出），改自然宽（padding 0 14px）。e2e 品牌 x 断言仍成立（§7 风险 2）。
- 显式 `grid-column` 保证首页（无返回按钮）时品牌仍落第二列。

### 2.2 品牌字规格（引用 layout.tsx 字体定义）

| 项 | 值 |
|----|----|
| font-family | `var(--font-brand), "Inter", system-ui, sans-serif`（layout.tsx localFont：`public/fonts/Michroma-Regular.woff2`，`weight: 400`，`variable: --font-brand`） |
| font-size / weight | 15px / `var(--weight-ui)`（=400，禁改） |
| letter-spacing / color | 0.01em / `var(--ink)` |
| 定位 | grid 第 2 列 `justify-self: center`；主界面与设置页共用同一轴（两页 header 同宽 = `--col`），页间不再跳动 |

### 2.3 返回/设置按钮统一胶囊（P1-4 的顶栏部分）

| 项 | 值 |
|----|----|
| 高度 / 字号 / 字重 | `min-height: var(--control-h)`（36px）/ 13.5px / `var(--weight-ui)` |
| 圆角 / 内边距 | `var(--radius-control)`（10px）/ `0 14px` |
| 边框 / 底色 / 字色 | `1px solid var(--line)` / `var(--surface)` / `var(--ink)`（返回键由 muted → ink，两枚同色同规格） |
| 悬停 | `color: var(--accent); border-color: var(--accent)`（160ms ease） |
| 按下 | `transform: translateY(1px)` |
| 焦点 | `outline: 2px solid var(--accent); outline-offset: 2px` |
| 34/38 归一规则 | 凡 ≤40px 的胶囊按钮一律 36px + 13.5px + 10px 圆角，不再保留 34/38 档；42px（sourceInput/modeTab）与 48px（submit/clearAction/action）属输入/主操作档，本轮不动 |

### 2.4 saveStatus（设置页顶栏第三列）

| 态 | 文案 | 规格 |
|----|------|------|
| saving | 「保存中…」 | pill：font-size 12px、padding 3px 10px、radius 999px、`background: var(--accent-soft)`、`color: var(--accent-dark)`（11.68:1）；`role="status"` |
| saved | 「已保存」 | 同上（**文案不动**，多处 e2e 按文案定位） |
| error | 「未保存」 | `background: var(--danger-soft)`、`color: var(--danger)`（5.54:1），替换现在的自定义对 `#fbe9e7/#8d3b2f`；`role="alert"` |

位置：`grid-column: 3; justify-self: end`，与 36px 按钮同排垂直居中。不加图标、不加边框（克制）。

### 2.5 设置页顶栏并入主界面语言（P1-5 + 批1④⑤）

- 结构完全同 §2.1：左胶囊返回 + 品牌居中 + saveStatus 右置；**淘汰 `.backLink`**（settings/page.module.css L28-42 删除）。
- 胶囊样式与 §2.3 完全一致（settings/page.module.css 复制同款 `.backButton` 或抽出公共类）。
- 返回文案按 `from` 映射（**含「← 」前缀**，即胶囊可见文案 = `← ` + 下表短语；不加 aria-label，可访问名即可见文案，子串可被 e2e 命中）：

| `from` | 文案 |
|--------|------|
| `home` | `← 返回首页` |
| `local-docs` | `← 返回文档处理` |
| `convert` | `← 返回转换` |
| 缺省/未知 | `← 返回` |

- `leaveSettings()` 等待在途保存的行为保留不变（settings.spec 行为断言只改定位文案，见 §7 风险 7/8）。
- 主界面返回按钮维持现状文案「← 返回」+ `aria-label="返回首页"`（e2e 按 role name 定位，**不要改**）。

---

## 3. 控件度量规范（对应：P1-4、批1③）

### 3.1 新 token 与高度分档

| 档 | 高度 | 适用 | 规格 |
|----|------|------|------|
| 控件（`--control-h`） | 36px | 顶栏两枚、panel `.button/.primary`、settings `.button`、「去设置」「改用 X」 | `min-height: var(--control-h); padding: 0 14px; line-height: 1; border-radius: var(--radius-control); font-size: 13.5px` |
| 输入 | 42px | `.sourceInput`、`.modeTab`（min-height 42） | 本轮不动 |
| 主操作 | 48px | `.submit`/`.clearAction`/`.action`/`.stop` | 本轮不动（圆角见 §6） |

panel/settings 的 `.button/.primary` 现为 `padding: 9px 14px`（高度随行高漂移约 38–40px）→ 改为 `min-height: var(--control-h); padding: 0 14px; line-height: 1`，与顶栏严格同高。

### 3.2 按钮层级

| 层级 | 例 | 底/字/边框 | 悬停 |
|------|----|-----------|------|
| primary | 「转换」「一键转换」「保存」 | `var(--accent)` / #fff / `var(--accent)`（11.42:1） | `var(--accent-dark)` / #fff（13.22:1） |
| secondary | 「选择目录」「重新扫描」「恢复默认」「清空」「去设置」「← 返回」「设置」 | `var(--surface)` / `var(--ink)` / `var(--line)`（15.9:1） | 字 `var(--accent)` + 边框 `var(--accent)`（或保持现有 hover 规则，两套合一为上式） |
| text（行内文字动作） | 「改用富文本粘贴」`.errorHintAction` | 无边框、`var(--accent-dark)`、下划线 offset 3px | 维持现状 |

「去设置」按钮走 **secondary 胶囊**（36/13.5/10），与同一提示行里既有的「改用 X」胶囊保持同一行内动作语言。字重一律 `var(--weight-ui)`。

### 3.3 checkbox 统一 16px

| 位置 | 现值 | 新值 |
|------|------|------|
| settings `.checkbox` | 17px | 16px |
| panel `.checkbox` | 16px | 维持 |
| page `.translateToggle input` | 16px | 维持 |
| settings `.modeOption input/.radioRow input` | 16px | 维持 |

一律 `accent-color: var(--accent)`。禁用勾选框：`cursor: not-allowed` + 宿主 label 经 `:has(input:disabled)` 转 `var(--muted)`、`cursor: default`（**不用 opacity**）。

### 3.4 禁用态写法（P0-1 教训：旧禁用 2.51:1；现状 primary 禁用 opacity 0.55 实测仅 2.01:1）

**弃用 opacity 表达，一律换色**（`opacity: 1` 覆盖旧值）：

```css
/* primary（.primary:disabled / .submit:disabled / .stop:disabled） */
background: var(--accent-soft); color: var(--muted); border-color: var(--line); box-shadow: none;
/* secondary（.button:disabled / .clearAction:disabled / .action:disabled） */
background: var(--paper); color: var(--muted); border-color: var(--line); box-shadow: none;
/* 通用 */
cursor: not-allowed;
```

| 写法 | 对比度 |
|------|--------|
| 新 primary 禁用（muted / accent-soft） | **5.78:1** |
| 新 secondary 禁用（muted / paper） | **6.26:1** |
| 旧 opacity 0.55 primary（实测混色） | 2.01:1（弃） |

`:hover:not(:disabled)` 规则保持在 disabled 之前声明顺序不变，禁用态不得触发 hover 填充。

---

## 4. 状态表达规范（对应：P1-1、P1-2、P2-1、P2-2、批2⑥⑦⑧⑨）

### 4.1 `no-output` / `same-dir` 警示行（P1-1，panel.tsx L245-255/L317-326）

| 项 | 规格 |
|----|------|
| class | `no-output` 与 `same-dir` 同套 `.hint .hintWarning`（不再区分灰/琥珀）；「这个目录里没有 md 文件。」等信息性提示维持 `.hint` 灰 |
| 色值 | `color: var(--warning)` #8a5a12，底为 `--surface`：**5.91:1** |
| 字号/字重 | 13px / `var(--weight-ui)`；line-height 1.5 |
| 底色/图标 | **不配 `--warning-soft` 底、不加图标**（与既有 same-dir 行同语言，克制）。B 方案（实测仍嫌弱再上）：`background: var(--warning-soft); padding: 8px 12px; border-radius: var(--radius-control);`（5.36:1，复用 `.warning` 卡词汇） |
| 位置 | 移到 `.toolbar` **之前**（DOM 上移）；`margin: 18px 0 0`，`.toolbar` 维持 `margin-top: 18px`（无提示时 dirRow→toolbar 间距不变） |
| 动作 | 行内追加 secondary 胶囊「去设置」（§3.2），跳 `/settings?from=local-docs`（复用 page.tsx `settingsHref` 模式）；`same-dir` 的「改用 X」按钮保持现状 |
| a11y | `role="status"` 保留；`disabledReason` 文本设 `id`，「一键转换」`disabled` 时挂 `aria-describedby`（启用时移除）；panel.module.css 补一份 `.srOnly`（照抄 page.module.css L353-363） |

### 4.2 CLI 检测状态（P1-2，settings/page.tsx L640-699）

| 项 | 规格 |
|----|------|
| 未检测到的「启用」勾选框 | `disabled` 且强制不勾选（渲染 `checked={cli.enabled && !!cli.detectedPath}`，保存时 coerce `enabled:false`）；label 转 `var(--muted)` + `cursor: default`（§3.3） |
| 「未检测到」文本 | 新 `.pathMissing { color: var(--muted); font-size: 12.5px; }`，替换现在的 `.path`（--ink）；落点 `--paper` 底：**6.26:1**（真实路径维持 `.path` --ink） |
| 检测状态点 | 8px 实心圆（`border-radius: 999px`，`aria-hidden="true"`），紧跟 CLI 名字，gap 6px；已检测 `background: var(--accent)`（10.93:1 on paper）、未检测 `background: var(--muted)`（6.26:1）。**8px 而非走查所记 12px**：12px 与 14.5px 行文同高显笨重，8px 足以作色点区分 |

### 4.3 placeholder（P2-2 / 批2⑧）—— 实测修正

| 色值 | 对 #ffffff | 对 textarea 底 #fafbfc | 结论 |
|------|-----------|----------------------|------|
| 现状 #939ba9 | 2.80:1 | 2.68:1 | 远低 AA |
| 定稿值 #767f8f | **4.04:1** | **3.90:1** | 走查所记 ≈4.6:1 有误；仍 < AA 4.5 |
| **推荐 #6b7484** | **4.71:1** | **4.55:1** | **AA 达标**，且仍浅于 `--muted`（6.54:1），占位符层次不丢 |

**裁决：三处占位符统一 `#6b7484`**（`.textarea::placeholder`、`.input::placeholder`、`.sourceInput::placeholder`，page.module.css L296/345/377）。不抽 token（遵守少量 token 约束），三处同值替换；settings `.input::placeholder` 可顺手同值统一（浏览器默认色，非本轮必改）。
若坚持上游定稿 #767f8f：请如实在验收里记 4.04:1（较现状 2.80 提升但未达 AA），不要沿用「4.6:1 达标」的错误记述。

### 4.4 删重复提示（P2-1 / 批2⑨）

- 删除 settings **输出卡**内的「目录选择只能在桌面应用中使用。」（L481 一处），保留**输入卡**一处（L432，首次出现、紧邻其按钮）。
- 输出卡「选择目录」按钮补 `title="目录选择只能在桌面应用中使用"`，禁用原因仍可读（不引新组件）。

---

## 5. 批 3 观感收尾（对应：P1-6、P1-7）

### 5.1 `.hintRow` 与 `.translateToggle` 同轴（P1-6）—— 裁决：**整组左对齐**

> **2026-10-01 真机反馈取代本节口径**：用户裁定「无需登录 / 图片内嵌 / 随用随走」不再独占一行，改为与翻译勾选框**同一行、右对齐**到内容列右缘（`.footerRow` flex 行：勾选左、特点组 `space-between` 靠右；无勾选框时特点组维持左对齐）。下方左对齐方案为历史记录，不再按它施工。

```css
.hintRow {
  width: min(var(--col), 100%);
  margin: 18px auto 0;
  justify-content: flex-start;   /* 原 center */
  /* 其余（gap 20px、13px、muted、✓ 伪元素）不动 */
}
```

- `.translateToggle` 保持左缘不动（仅宽度换 `min(var(--col), 100%)`）；两行左缘同落内容列左缘。
- 理由：勾选行是表单控件，居中会悬空且交互目标漂移；✓ 特点行归入同一「表单辅助信息」组后，hero 的居中轴只保留标题/副标题/模式 tab，视线不再左右跳。「二者都居中」是可行备选（若想保留产品宣言感），但两者必须同轴，不得混用。
- 760px 断点既有 `flex-wrap` 保留；✓ 字形（P2-5）本轮不动。

### 5.2 `.entryCard` 尺寸（P1-7）

| 项 | 现值 | 新值 |
|----|------|------|
| 高度 | `aspect-ratio: 1 / 1`（≈365px，上下各 ~130px 空白） | 删除；`min-height: 220px` |
| padding | 24px | `28px 24px` |
| 内部 gap | 12px | 维持 12px |
| 纵向分布 | `justify-content: center` | 维持（220px 高下内容居中，上下各 ~26px 余量，均衡） |
| 标题/说明 | 22px / 13.5px | 不动 |
| 760px 断点 | `aspect-ratio: auto` | 该行**删除**（已无 aspect-ratio，死规则）；`min-height: 220px` 继承（单列下仍为良好触控高度）；`.entryGrid` 单列规则不动 |

---

## 6. 圆角映射表（对应：本轮涉及元素归一，防继续加档；P2-6 仍推迟）

**两条原则**：① 控件一律 `--radius-control` = 10px，pill 一律 999px，不引入新档；② 容器圆角 = 内层控件圆角 + 内边距（同心圆），故 14/18 是**派生值**不是新档，P2-6 收敛时按此计算。

| 元素 | 现值 | 本轮归一值 | 说明 |
|------|------|-----------|------|
| `.backButton` / `.settingsLink` / settings 返回胶囊 | 11px | **10px**（`var(--radius-control)`） | 本轮改，消灭 11 档 |
| panel `.button/.primary`、settings `.button`、「去设置」「改用 X」 | 10px | 10px | 维持 |
| `.submit/.clearAction/.action/.stop`（48px 主操作） | 12px | 10px（可顺手改） | 非 11 条必改；改则一步到位，勿再新增档 |
| `.input/.sourceInput/.textarea/.modeTab/.warning/.preview pre` | 10px | 10px | 维持 |
| `.modeTabs`（分段容器） | 14px | 14px | = tab 10 + padding 4，同心派生，维持 |
| `.entryCard` | 16px | 16px | 卡片档，维持 |
| `.form/.panel/.degraded/.card/.preview/.confirmDialog` | 18px | 18px | = 内层 10 + padding 8–9，同心派生；P2-6 再裁 |
| `.statusCard/.errorCard/.cancelledCard/.provider/.error(settings)` | 14px | 本轮不动 | P2-6 范围 |
| `.stats>div/.fallbackBox/.saveNotice/.error(panel)` | 12px | 本轮不动 | P2-6 范围 |
| `.saveStatus/.saveStatusError/.pill/.badge/.backToTop` | 999px | 999px | pill 档，维持 |
| 新增元素（状态点、去设置等） | — | 10px 或 999px | 禁止新增档位 |

---

## 7. 风险与回归提示（e2e 触点逐条）

| # | 断言（文件:行） | 触动点 | 判定 |
|---|----------------|--------|------|
| 1 | 转换按钮右缘与粘贴框右缘 <4px（home.spec.ts:305） | `--col` 加宽 .form | **安全**（.form 内 flex 关系不变，整体平移加宽） |
| 2 | 三个画面品牌 x 一致，±0.05px（home.spec.ts:540-553） | 品牌居中 + 删 backSlot | **安全**：品牌 x 只依赖 `.header` 宽（三屏同为 min(--col,100%)）；比现状（左锚 + 86px 占位）更稳。注意：`.header` 宽度绝不可随内容变 |
| 3 | 清空按钮与转换同行、左于转换（home.spec.ts:308-320） | 列宽/按钮高 | **安全** |
| 4 | Firefox「改用富文本粘贴」click position (30,6) 避开 y≈672 死区（home.spec.ts:126-128） | 布局纵向位移 | **低风险，Firefox 必复跑**；若按钮顶部移入死区需调 click position |
| 5 | 标题/副标题 960/1180 单行（home.spec.ts:184-198） | subtitle 加宽 | **安全**（title 未动，subtitle 只加宽） |
| 6 | from=convert 返回「返回转换」（settings.spec.ts:179） | 文案映射 | **安全**（「← 返回转换」含子串，getByRole 默认子串匹配） |
| 7 | 「返回转换等待在途保存后再离开」（settings.spec.ts:595-615，goto 无 from） | 文案映射 | **需先改断言**：name「返回转换」→「返回」（或 /返回/）；URL 断言不受影响 |
| 8 | local-docs 进设置返回（local-docs.spec.ts:152-170，from=local-docs） | 文案映射 | **需先改断言**：name「返回转换」→「返回文档处理」 |
| 9 | 「启用 claude」uncheck（settings.spec.ts:548，claude 未检测到） | P1-2 强制禁用+不勾选 | **需先改断言**：改对已检测的 pi 做启停往返；并新增断言「启用 claude」`toBeDisabled()` + `not.toBeChecked()` |
| 10 | 输出卡 `card.getByText("目录选择只能在桌面应用中使用")`（settings.spec.ts:697） | P2-1 删输出卡重复文案 | **需先改断言**：改 `page.getByText(...)`（输入卡仍有）或断言输出按钮 `title`；输入卡断言（:773）不动 |
| 11 | theme.spec「the interface text uses the single collected UI weight」 | 按钮字重 | **约束**：所有按钮字重保持 `var(--weight-ui)`（=400），禁用 500 强调 |
| 12 | theme.spec 转换按钮 bg=accent、hover=accentDark（:43-47） | 禁用态换色 | **安全**（断言在 enabled 读取）；但禁用态规则须写在 `:hover:not(:disabled)` 体系内不覆盖 hover |
| 13 | local-docs「重新扫描与翻译产物同排」（local-docs.spec.ts:295-325） | 按钮高统一 36 | **安全**（同行居中关系不变） |
| 14 | local-docs「未勾选时表格紧贴操作区」<24px（local-docs.spec.ts:289-302） | hint 移位 | **安全**（无提示行时布局不变；表距由 table margin-top 14px 决定） |
| 15 | home/local-docs 按 role name「返回首页」「设置」「一键转换」定位 | DOM 扁平化 | **安全**（保留 aria-label 与按钮文案）；「已保存」文案不动（settings.spec 多处按文案定位） |
| 16 | （无断言，观感）结果区 `.result` 现为 shell 1180 全宽，比新表单列 880 更宽 | 范围外 | 本轮不动（不在 11 条）；若实测违和，后续把 `.result` 收进 `min(var(--col),100%)` 单独立项，勿混入本轮 |

---

## 实施注意事项

1. 先落 3 个 token（`--col`/`--control-h`/`--radius-control`），再逐条换值；除本规格列明处，不改任何色值与字重。
2. 品牌居中走「显式 grid-column」写法，`.header` 宽度固定 `min(var(--col),100%)`——这是 e2e 品牌 x ±0.05px 断言的生命线。
3. `.backSlot`/`.headerLeft`/`.backLink` 是删除项，不是改造项；删干净，避免死样式。
4. 禁用态弃 opacity 换色（§3.4），这是旧评审 P0-1 的直接教训；改完自测 primary/secondary 禁用各一眼。
5. placeholder 用 `#6b7484`（实测 4.71:1）；若被要求用 #767f8f，验收里如实记 4.04:1，勿写「达标」。
6. no-output 警示先上「warning 文字 + 移位 + 去设置 + aria-describedby」四件套；`--warning-soft` 底是 B 方案，实测再弱才开。
7. 返回文案映射落地前，先改 settings.spec:604 与 local-docs.spec:167 两处定位；settings.spec:548 与 :697 同批改（见 §7）。
8. 所有按钮字重锁 `var(--weight-ui)`，theme.spec 会拦 500。
9. 760px 断点只需删 `.entryCard { aspect-ratio: auto }` 死规则，其余断点行为不得动。
10. 改完跑全套 e2e（重点 Firefox + settings/local-docs 两个 spec），再交视觉复核。
