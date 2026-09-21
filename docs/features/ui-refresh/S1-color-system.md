# S1 — 色彩系统（Spec / Plan / Tasks）

- 上游：`docs/PLAN-next-phase.md`、`docs/features/ui-refresh/FSD.md`
- 状态：**S1 已实施（2026-09-21）**；S2 / S3 待开工
- feature_list id：`feat-039`（本阶段为其实施起点）

## Spec

**目标**：把墨绿族整体换成海军蓝族 —— 三个 accent token、四个中性 token、`--shadow`、`body` 两层渐变、`::selection`，以及所有**染色型字面量**（半透明阴影 / 聚焦环 / 遮罩 / 半透明底）与网页 favicon。改完全站无绿色残留。

**关键决定**（细节见 FSD §2）：

1. **源头在 `src/app/globals.css`**。两个 module.css 基本只是消费方（`var(--accent*)` 共 31 次），按作废文档去改它们什么都不会发生。
2. **中性 token 也要冷化**（路线图 Q1=B）：`--ink` / `--muted` / `--line` 是绿灰底子，留在冷背景上会读作「脏」。
3. **染色型字面量按同一色族重算**，alpha 一律不变，避免改变视觉分量。
4. **深色代码块冷化**（Q2）：底色与前景一起换，保持对比度关系。
5. **favicon 一起换**（Q5）：`src/app/icon.svg` 里写死绿色，浏览器标签页上会直接看到残留。注意这是**网页 favicon**，与打包应用图标 `assets/icon.icns` 是两件事，后者不动。
6. **孤立 token 不新增**：`settings/page.module.css` 引用 `var(--surface-muted, #fbfbfa)`，但该变量从未定义，一直靠兜底值工作。改用 `var(--paper)`，不新增变量。

**非目标**：字重（S2）、结构、间距/圆角/边框宽度/阴影形状、语义色、字体。

## Plan

### 1. `src/app/globals.css`（源头，一处改全站生效）

| 变量 | 现值 | 新值 |
| --- | --- | --- |
| `--paper` | `#f7f5ef` | `#f9fafb` |
| `--surface` | `#fffefa` | `#ffffff` |
| `--ink` | `#17201f` | `#1C2230` |
| `--muted` | `#65706d` | `#565E6B`（真机复核后从 `#6A7280` 加深一档） |
| `--line` | `#d8dcd5` | `#DBDFE7` |
| `--accent` | `#176b5d` | `#2A395C` |
| `--accent-dark` | `#0f5147` | `#232F4E` |
| `--accent-soft` | `#dcece7` | `#EEF1F6` |
| `--shadow` | `0 22px 60px rgb(34 50 45 / 10%)` | `0 22px 60px rgb(30 35 50 / 10%)` |
| `::selection` background | `#bfe3da` | `var(--accent-soft)` |
| `body` 径向渐变 | `rgb(23 107 93 / 9%)` | `rgb(42 57 92 / 9%)` |
| `body` 线性渐变起点 | `#fbfaf6` | `#fbfbfd` |

不变的：`--warning` / `--warning-soft` / `--danger` / `--danger-soft`。

> 线性渐变起点必须跟背景同族，否则暖冷两截相接。

### 2. `src/app/page.module.css`（残留）

**`rgb()` / `rgba()` / 十六进制字面量**：

| 行 | 现值 | 新值 | 用在哪 |
| --- | --- | --- | --- |
| 112 | `rgb(34 50 45 / 8%)` | `rgb(30 35 50 / 8%)` | `.modeTab` 阴影 |
| 162 | `rgb(247 250 248 / 90%)` | `rgb(249 250 251 / 90%)` | `.textarea` 底 |
| 173 | `rgb(23 107 93 / …)` | `rgb(42 57 92 / …)` | 聚焦 / 强调底 |
| 169, 218, 256 | `#929b98` | `#939BA9` | 三处 placeholder |
| 223 | `rgb(23 107 93 / …)` | `rgb(42 57 92 / …)` | 强调 |
| 261 | 同上 | 同上 | 强调 |
| 285 | `#aab4b0` | `#A9B1BF` | 清除按钮 hover 边框 |
| 286 | `#f7f9f8` | `#F4F6F9` | 清除按钮 hover 底 |
| 300 | `0 8px 18px rgb(23 107 93 / 20%)` | `rgb(42 57 92 / 20%)` | `.submit` 阴影 |
| 356 | `#c8dfd8` | `var(--line)` | `.statusCard` 边框 |
| 430 | `2px solid rgb(23 107 93 / 22%)` | `rgb(42 57 92 / 22%)` | `.spinner` |
| 492, 496 | `rgba(22,34,28,.22/.45)` | `rgba(20,24,36,0.22/0.45)` | `.confirmDialog` 遮罩 |
| 567 | `rgb(34 50 45 / 10%)` | `rgb(30 35 50 / 10%)` | `.action:hover` 阴影 |
| 613 | `#a7c9c0` | `#A9B3C6` | `.preview blockquote` 左边线（Q4：只换色，字重不动） |
| 614 | `#202a28` / `#edf4f1` | `#1E222B` / `#EDEFF4` | `.preview pre` 深色代码块（Q2） |
| 662 | `0 10px 24px rgb(23 107 93 / 28%)` | `rgb(42 57 92 / 28%)` | `.backToTop` |
| 671 | `0 12px 28px rgb(23 107 93 / 34%)` | `rgb(42 57 92 / 34%)` | `.backToTop:hover` |

**明确不动**：`#dfaaa3`(315)、`#edc8c2`(362)、`#eed79c`(581) —— 均为错误/警告态语义边框。

### 3. `src/app/settings/page.module.css`

| 行 | 现值 | 新值 |
| --- | --- | --- |
| 142 | `var(--surface-muted, #fbfbfa)` | `var(--paper)` |
| 237 | `rgb(23 107 93 / 18%)` | `rgb(42 57 92 / 18%)`（聚焦环） |

**明确不动**：`#fbe9e7`(61)、`#8d3b2f`(62)（密钥警告底/文字，属语义色）、`#fff`(230, 250)。

### 4. `src/app/icon.svg`

`#176b5d` → `#2A395C`；`#ffffff` 不动。

### 5. 需要重算但**本期不动**的对照关系

`.fallbackBox { background: white }` 已是纯白，与 `--surface: #ffffff` 一致，不改。

## Tasks

| id | 任务 | RED（先写失败测试） | 完成条件 | 验证 |
| --- | --- | --- | --- | --- |
| T1.1 | 登记 `feat-039` 为 `in-progress`；写调色板白名单守卫 | `tests/palette.test.ts` | 三份 CSS 的所有 hex/rgb 字面量都在白名单内；白名单外的绿色字面量导致失败 | `npx vitest run tests/palette.test.ts` |
| T1.2 | 写 e2e 计算样式断言（主色 / 背景 / 选中态） | `e2e/theme.spec.ts` | `.submit` 背景 = `rgb(42, 57, 92)`；hover = `rgb(35, 47, 78)`；`--accent-soft` 底 = `rgb(238, 241, 246)`；`body`/`html` 背景 = `rgb(249, 250, 251)` | `npx playwright test e2e/theme.spec.ts --project=chromium` |
| T1.3 | 改 `globals.css` 的 token + 渐变 + `::selection` | T1.1/T1.2 | 上述断言转绿；语义色未被动到 | 同上 |
| T1.4 | 改 `page.module.css` 的残留字面量 | T1.1 | 白名单守卫不再报绿色；`.preview pre` 为冷色深底 | `npx vitest run tests/palette.test.ts` |
| T1.5 | 改 `settings/page.module.css` 与 `icon.svg` | T1.1 | 孤立 token 引用消除；favicon 为新主色 | 同上 |
| T1.6 | 回归既有像素级断言 | `e2e/home.spec.ts`、`e2e/settings.spec.ts` | 转换按钮/RSS 对齐断言与按钮 `boundingBox()` 顺序断言全绿；`rgb(138, 90, 18)` 警告色断言**保持绿**（若变红说明误伤语义色） | `npm run test:e2e` |
| T1.7 | 阶段收尾 | — | `./init.sh` 全绿；对比度工具复核（`design_contrast`）；PROGRESS/feature_list 更新 | `./init.sh` |

## Handoff

- 结束时必须写清：三个文件的最终 token 值、白名单守卫覆盖到的字面量集合、以及 S2 需要保留的接口（`--weight-*` 尚未引入，S2 才加）。
- 已知限制：`tests/palette.test.ts` 是**静态**守卫，只能防止字面量层面的绿色回归；`color-mix()` / 运行时计算出的颜色不在覆盖范围内（本期不使用这两类语法）。
