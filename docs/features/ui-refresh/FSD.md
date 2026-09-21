# FSD 总纲 — 视觉刷新（v0.3.5）

- 状态：**S1 / S2 / S3 均已完成（2026-09-21）**：S1 提交 `972ff4a`、S2 提交 `fae16bc`（S2 经真机复核后 `--weight-body` 回退为 400）、S3 发布 `0.3.5`
- 日期：2026-09-21
- 上游：`docs/PLAN-next-phase.md`（方向与已定决策以路线图为准，本文件只定技术方案）
- 阶段执行文档：`docs/features/ui-refresh/S1-color-system.md`、`S2-weight.md`、`S3-release.md`（每份含 Spec / Plan / Tasks / Handoff，可独立会话执行）
- 设计稿：`docs/features/ui-refresh/design/ui-refresh.html`（可交互预演，含旧/新皮肤与字重切换）
- feature_list id：`feat-039`

---

## 1. 目标与非目标

**目标**：把「墨绿 + 暖米白」换成「海军蓝 + 冷灰白」，把界面字重从 10 个手调值收敛为 2 个变量，并启用抗锯齿（Q6）统一渲染平滑。

**目标版本**：`0.3.5`。

**非目标**（越界须先回改路线图）：

- 不改 HTML 结构、交互逻辑、文案。
- 不改间距 / 圆角 / 边框宽度 / 阴影形状。
- 不改字体家族，不 vendored 新字体。
- Markdown 预览区的字号、字族、字重（Q4；渲染平滑按 Q6 一并改变，见 §2.4）。
- 语义色（`--warning*` / `--danger*`）与错误态配色。
- 端点策略、密钥存储、翻译引擎、打包配置、应用图标（`assets/icon.icns`）。

---

## 2. 架构决定

### 2.1 结构性决定：只改 CSS

`src/app/` 下的 TSX **零处**颜色字面量与字重字面量（已 grep 确认）。因此本 feature **不新增、不修改任何 TSX**，全部改动落在 3 份 CSS + 1 个 SVG 上：

| 文件 | 角色 |
| --- | --- |
| `src/app/globals.css` | **唯一的颜色源头**：13 个 token + `body` 两层渐变 + `::selection` |
| `src/app/page.module.css` | 消费方 + 少量硬编码残留（占位符灰、代码块、引用左边线等） |
| `src/app/settings/page.module.css` | 消费方 + 2 处硬编码残留 + 1 个孤立 token 引用 |
| `src/app/icon.svg` | 网页 favicon（**不是**打包应用图标） |

选择理由：结构冻结使 e2e 选择器完全不受影响，本 feature 的回归面只有「计算样式」与「像素级对齐」两类既有断言。

### 2.2 「绿色残留」= 染色型字面量，不只是三个 token

绿在本项目是**染色式**的：半透明阴影、聚焦环、绿黑遮罩、绿白半透明底，以及三个绿灰中性 token（`--ink` / `--muted` / `--line`）。路线图 Q1 = B 的意思是：这些**全部**按同一色族重算，不留夹生感。

### 2.3 字重收敛的机制

新增 2 个 token 替代现有 10 个手调值：

```css
--weight-body: 400;  /* 正文 / 说明文字 */
--weight-ui: 400;    /* 标题 / 按钮 / 链接 / 标签 */
```

`body` 用 `--weight-body`，其余 19 个受限选择器（含 `.brand`，其值本就 400，改用变量后零行为变化）统一用 `--weight-ui`。两个 token 当前同值（锚都是 400），拆开是为了留一个只影响正文的旋钮：**真机复核认定 300 识别度不足，`--weight-body` 已从 300 回退到 400**（2026-09-21），因此 S2 最终不改正文粗细。

**关键守卫**：Markdown 阅读区 `.preview` 显式写 `font-weight: var(--weight-ui)`，把阅读区钉在界面字重上（`--weight-body` 以后再调也进不去，Q4）。`.preview` 内的 `h1/h2/h3/h4/strong/th` 无显式字重，保留浏览器默认 bold，**不动**。

### 2.4 抗锯齿开关（Q6）

应用原本**没有**设 `-webkit-font-smoothing`（`globals.css` 只设了 `text-rendering: optimizeLegibility`）。macOS 上 Chromium 默认走次像素抗锯齿，笔画会被加粗一档 —— 实测在 60px 的 hero 标题上，780→400 的观感差异明显小于预期值；这一项当初是为让细体读得出来而加，细体回退后仍保留，作用是统一渲染平滑。

因此新增一行：

```css
body, button, input, textarea, select { -webkit-font-smoothing: antialiased; }
```

效果与代价（2026-09-21 用真实构建做过 5 态对照）：

- 观感上 400 更接近真 Light，是整套改动里「花钱最少的一档」；但真机复核判定细体小字识别度不足，因此正文最终回退到 400。
- **它是全局渲染开关，Markdown 预览区会一并变细** —— 这是对 Q4 的显式修订：Q4 冻结的是预览区的字号 / 字族 / 字重，不含渲染平滑。
- 只在 Retina 屏上是纯收益；非 Retina 屏会更虚（本项目只交付 `darwin/arm64`，接受）。
- 属性在 Chromium 上可通过 `getComputedStyle(document.body).webkitFontSmoothing` 断言，Firefox / WebKit 不支持该属性 → 该项 e2e 断言**必须只跑 chromium**。

### 2.5 验证策略：机器可查

- **静态守卫**（新增单测 `tests/palette.test.ts`）：三个 CSS 文件中的每个 `#hex` 与 `rgb()/rgba()` 字面量都必须落在「新调色板白名单」内。作用：防止绿色残留复发，也让「改完还有没有绿」不靠肉眼。
- **e2e 计算样式断言**（新增 `e2e/theme.spec.ts`）：对主色、背景、正文/UI 字重断言 `getComputedStyle` 实际值。本项目已有先例（`e2e/settings.spec.ts` 就在断言 `rgb(138, 90, 18)`）。
- **回归**：`e2e/home.spec.ts` 与 `e2e/settings.spec.ts` 里的 `boundingBox()` 像素级断言必须重跑（字重变化会改变文字宽度）。

---

## 3. 阶段划分

| 阶段 | 内容 | 交付 |
| --- | --- | --- |
| **S1** | 色彩系统：token 重算 + 染色型字面量替换 + favicon | 全站无绿色残留，白名单守卫转绿 |
| **S2** | 字重收敛：2 个变量 + 19 处替换 + `.preview` 守卫 + 抗锯齿开关 | 10 个手调字重收敛为一档、阅读区排版不变 |
| **S3** | 发布：版本 `0.3.5`、门禁、文档与状态同步 | ZIP + tag + 本机安装 |

S1 与 S2 都改同一批文件，**但必须分两次提交**：两者视觉后果不同（配色 vs 粗细），混在一起无法回滚其中一项。

---

## 4. 验收标准（DoD 补充）

除 `AGENTS.md` 的通用 DoD 外，本 feature 额外要求：

1. `tests/palette.test.ts` 与 `e2e/theme.spec.ts` 全绿，且**先证明过它们会失败**（RED 证据写进 `feature_list.json`）。
2. `e2e/home.spec.ts`、`e2e/settings.spec.ts` 的既有像素级断言全绿（三浏览器）。
3. 设计稿 `docs/features/ui-refresh/design/ui-refresh.html` 的机器门（`design_audit`）无 BLOCK 级 error。
4. `CHANGELOG.md` / `CHANGELOG.zh.md` 的 `[Unreleased]` 按用户可见变化更新。

---

## 5. 已知取舍

| 项 | 说明 |
| --- | --- |
| `--muted` 对比度余量 | `#6A7280` on `#f9fafb` = 4.64:1（旧值 4.74:1），仍过 4.5 但余量变小；**真机复核后按预设方案加深一档到 `#565E6B` = 6.26:1（卡片 6.54:1）**，设计稿已同步 |
| 占位符灰 | `#939BA9` ≈ 2.8:1，表单占位符，记录为已知豁免 |
| hero 标题观感 | `.title` 从 780 降到 400（64px 处最明显），是本 feature 最大的单点视觉变化 |
| Inter 不是仓库资产 | 本机装的是完整家族；换机器若缺 Inter Light 会走 PingFang SC Light / 系统合成 |
| 正文粗细 | 初版把正文压到 300（界面细体）；真机复核认定小字识别度不足，`--weight-body` 已回退到 400。要再调只改这一个变量，抗锯齿那行是第二个旋钮 |
| 抗锯齿是全局的 | `-webkit-font-smoothing: antialiased` 会一并改变 Markdown 预览区的渲染（Q4 已按 Q6 修订）；两者不可分开作用 |
| 方向验收方式 | 施工前用「真实构建截图 + 注入 S1/S2 终态变量」做前后对照（5 态：现状 / 只换色 / 只换字重 / 都换 / 再加抗锯齿）；施工后直接对照两个版本的真实构建 |
