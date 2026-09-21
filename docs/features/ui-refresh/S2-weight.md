# S2 — 字重收敛（Spec / Plan / Tasks）

- 上游：`docs/PLAN-next-phase.md`、`docs/features/ui-refresh/FSD.md`
- 前置：S1（色彩系统）已完成
- 状态：**已完成（2026-09-21，提交 `fae16bc`）**；真机复核后 `--weight-body` 由 300 回退到 400（见 Spec 第 3 条与 Handoff）
- feature_list id：`feat-039`

## Spec

**目标**：把三份 CSS 里散落的 **10 个手调字重**（400 / 500 / 560 / 680 / 700 / 720 / 730 / 750 / 760 / 780）收敛为 **2 个变量**，并把界面字重收敛到同一档，同时统一渲染平滑。

**关键决定**（细节见 FSD §2.3）：

1. 新增两个 token：`--weight-body: 400`（正文/说明）、`--weight-ui: 400`（标题/按钮/链接/标签）。**`--weight-body` 初版为 `300`（正文细体），真机复核认定细体识别度不足，已回退为 `400`**（2026-09-21）；因此 S2 最终**不改变正文粗细**，保留该 token 只是留一个旋钮。
2. `body` 用 `--weight-body`；19 个受限选择器统一用 `--weight-ui`。
3. **`.brand` 也改成 `var(--weight-ui)`**：它的现值本就是 400，改后零行为变化，换来「无特例」——Michroma 只有 400 一个字重，跟着改细只会触发合成加粗。
4. **Markdown 预览区保持原样**（路线图 Q4）：`.preview` 显式写 `font-weight: var(--weight-ui)`，把阅读区钉在界面字重上（`--weight-body` 以后再调也进不去）；`.preview` 内的 `h1/h2/h3/h4/strong/th` **无显式字重**，保留浏览器默认 bold，**不加规则**。
5. 未被任何规则显式设重的文本（含 `.stats dt` 这类次要标签）一律落 `--weight-body`（400）。
6. 留变量而不是写死字面量是刻意的：字重在真实屏幕上受字体回退与抗锯齿影响，一次调不准，留一个旋钮比回头改 19 处便宜。
7. **启用抗锯齿（Q6）**：`body, button, input, textarea, select { -webkit-font-smoothing: antialiased; }` —— 统一渲染平滑，让字面在任何 mac 上一致（该开关当初是为让细体读得出来而加，细体回退后仍保留）。代价：这是全局开关，Markdown 预览区的渲染也会变（**Q4 已按 Q6 修订为「预览区的字号 / 字族 / 字重不变」，不含渲染平滑**）。理由与证据见 FSD §2.4。

**非目标**：颜色（S1）、结构、间距/圆角/边框/阴影、字体家族、Markdown 阅读区的字号 / 字族 / 字重（渲染平滑按 Q6 一并改变）。

## Plan

### 1. `src/app/globals.css`

新增两个 token，`body` 改用变量：

```css
--weight-body: 400;
--weight-ui: 400;
/* body { font-weight: var(--weight-body) } */
```

### 2. `src/app/page.module.css`（16 处）

| 行 | 选择器 | 现在 | 改为 | 用在哪 |
| --- | --- | --- | --- | --- |
| 24 | `.brand` | 400 | `var(--weight-ui)` | 品牌字（值不变） |
| 38 | `.settingsLink` | 560 | `var(--weight-ui)` | 设置入口 |
| 58 | `.eyebrow` | 750 | `var(--weight-ui)` | 小标签 |
| 67 | `.title` | 780 | `var(--weight-ui)` | hero 标题（**视觉变化最大**） |
| 105 | `.modeTab` | 720 | `var(--weight-ui)` | 模式切换 |
| 195 | `.sourceRow label` | 700 | `var(--weight-ui)` | 字段标签 |
| 200 | `.sourceRow label span` | 500 | `var(--weight-ui)` | 字段副标签 |
| 280 | `.clearAction` | 700 | `var(--weight-ui)` | 清空按钮 |
| 299 | `.submit` | 700 | `var(--weight-ui)` | 主按钮 |
| 338 | `.hintRow span::before` | 750 | `var(--weight-ui)` | 提示标签 |
| 395 | `.errorHintAction` | 700 | `var(--weight-ui)` | 改用粘贴链接 |
| 457 | `.resultLabel` | 760 | `var(--weight-ui)` | 结果区标签 |
| 482 | `.translationNotice a` | 700 | `var(--weight-ui)` | 设置链接 |
| 546 | `.stats dd` | 730 | `var(--weight-ui)` | 统计数字 |
| 556 | `.action` | 680 | `var(--weight-ui)` | 复制/下载 |
| 665 | `.backToTop` | 700 | `var(--weight-ui)` | 回到顶部 |

### 3. `src/app/settings/page.module.css`（3 处）

| 行 | 选择器 | 现在 | 改为 |
| --- | --- | --- | --- |
| 24 | `.brand` | 400 | `var(--weight-ui)`（值不变） |
| 35 | `.backLink` | 560 | `var(--weight-ui)` |
| 173 | `.radioRow` | 560 | `var(--weight-ui)` |

### 4. 新增守卫

```css
/* page.module.css，紧邻 .preview 规则 */
.preview { font-weight: var(--weight-ui); }
```

### 5. 不动的字重

| 选择器 | 原因 |
| --- | --- |
| `.preview h1/h2/h3/h4/strong/th` | 无显式字重 = 浏览器默认 bold；Q4 要求阅读区标题粗度原样 |

### 6. `src/app/globals.css` —— 抗锯齿开关（Q6）

```css
body, button, input, textarea, select { -webkit-font-smoothing: antialiased; }
```

放在 `globals.css` 的 `body` 规则区，与 `text-rendering: optimizeLegibility` 同处。**不要**写到 `.preview` 上或反着写在 `.preview` 里禁掉 —— 该属性不可按区域开关，写了也只会误导后来人。

## Tasks

| id | 任务 | RED（先写失败测试） | 完成条件 | 验证 |
| --- | --- | --- | --- | --- |
| T2.1 | 写 e2e 字重断言 | `e2e/theme.spec.ts` | `.submit` / `.sourceRow label` = `400`；`.stats dt` 落 `400`（继承）；`.preview p` = `400`（守卫）；`.preview h2` 仍是 bold（回归锁） | `npx playwright test e2e/theme.spec.ts --project=chromium` |
| T2.2 | 写品牌字回归锁 | `e2e/theme.spec.ts` | `.brand` 计算字重 = `400` 且字体族命中 `/michroma/i`（**先绿**，防误伤） | 同上 |
| T2.3 | 加 token 与 `body` 字重 | T2.1 | 两个 token 都落 `400` | 同上 |
| T2.4 | 替换 19 处选择器字重 | T2.1 | 全部改为 `var(--weight-ui)`；无残留字面量字重 | 同上 |
| T2.5 | 加 `.preview` 守卫 | T2.1 | 阅读区正文/标题不变；守卫先写会失败再实现 | 同上 |
| T2.6 | 加抗锯齿开关（Q6） | `e2e/theme.spec.ts`（**chromium-only**） | `getComputedStyle(document.body).webkitFontSmoothing === "antialiased"`；Firefox / WebKit 不支持该属性，用例必须 `test.skip(browserName !== "chromium")` | `npx playwright test e2e/theme.spec.ts --project=chromium` |
| T2.7 | 回归像素级断言 | `e2e/home.spec.ts`、`e2e/settings.spec.ts` | 粘贴/来源/提交右边缘对齐差值 < 4px；按钮 `boundingBox()` 顺序断言全绿（字重变化会改文字宽度） | `npm run test:e2e` |
| T2.8 | 阶段收尾 | — | `./init.sh` 全绿；设计稿字重章节与实际实现一致；PROGRESS/feature_list 更新 | `./init.sh` |

## Handoff

- 结束时必须写清：`--weight-body` / `--weight-ui` 的最终值、`body` 与 `.preview` 的级联关系、抗锯齿那一行是否存在、以及「还想调粗细从哪里下手」（先改 `--weight-body` 一个变量，再考虑抗锯齿那行）。
- 已知限制：字重的观感受字体回退与抗锯齿影响，e2e 只能断言计算值，**真实观感必须目视**（对照 `docs/features/ui-refresh/design/ui-refresh.html` 的字重实样，或按 FSD §2.4 的对照方法重做真实构建前后对照）。
