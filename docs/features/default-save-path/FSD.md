# FSD 总纲 — 默认 MD 保存路径（Default Save Path）

- 状态：**S1 已完成并提交（`ac8f91a`）、S2 已完成（2026-09-21，待提交）**；S3 待开工；目标版本 `0.3.6`
- 日期：2026-09-21
- 上游：用户口头需求（无 PRD 文档）；本文件是唯一事实源
- 阶段执行文档：`docs/features/default-save-path/S1-settings-and-ipc.md`（设置项 + IPC 通道）、`S2-download-flow.md`（下载逻辑改造）、`S3-release.md`（发布收口）
- feature_list id：`feat-041`
- 前置事实：`0.3.5` 已发布（tag `5f98307`），**任何代码改动前必须先把版本升到 `0.3.6`**（发布门禁硬校验目标版本）；升版本本身按既有 TDD 流程走（`scripts/release-guards.test.mjs` fixture 先 RED）

---

## 1. 需求原文与拆解

用户原话（2026-09-21）：

> 我想在设置里面增加一个默认的MD保存路径管理，这样就不需要每次都选位置了，而且可以选择是否默认这个目录，如果选择默认目录，则不需要弹出保存位置选择，如果没有选择默认目录，则弹出。

拆解为两条可验证的行为：

1. **设置页新增「输出」卡片**：可以浏览/选择一个默认保存目录，并有一个开关决定是否启用。
2. **主页面「下载」按钮行为分叉**：启用默认目录 → 文件直接写入该目录（无对话框、无浏览器下载弹窗）；未启用 → 保持现状（浏览器 `Blob` + `anchor.download`，在打包应用里表现为系统保存对话框）。

**一个重要的现状澄清（本轮侦察确认）**：主页面当前的 `downloadMarkdown()` 是纯浏览器下载（`Blob` + `<a download>`）。在 Electron 里这个行为落到系统的「另存为」对话框——这正是用户说的「每次都选位置」。所以本 feature 的「弹不弹」分叉点是：**走桥接直写 vs 走浏览器下载**，不是「两个对话框之间选择」。

---

## 2. 目标与非目标

**目标**：

1. `Settings` 契约新增 `output: { defaultPath: string | null, useDefaultPath: boolean }`，向后兼容（旧 `settings.json` 无 `output` 字段时的处理见 §4.1）。
2. Electron 主进程新增两个 IPC 通道（目录选择、文件直写），preload 暴露 `window.mdConvertor.output`。
3. 设置页新增「输出」卡片：路径展示（只读）、选择目录按钮、启用开关。
4. 主页面「下载」按开关分叉：直写成功时给用户可见的反馈（含落盘路径），失败时降级回浏览器下载并说明原因。
5. 全程 TDD（RED → GREEN → REFACTOR），证据写进 `feature_list.json`。

**非目标**（越界先回来改本文件）：

- 不改转换管线、翻译引擎、抓取安全策略。
- 不做「每个文件询问」的第三态（开关只有开/关两态，与用户原话一致）。
- 不做目录不存在时的自动创建以外的补救（直写前 `mkdir -p` 一次；目录被删且无法重建时报错降级，不引导用户去 Finder 修复）。
- 不做历史记录、最近文件、多目录轮换。
- 不改 Web 版行为（浏览器里没有桥接，永远走原有下载路径）。
- 不动 `assets/`、打包配置、签名策略。

---

## 3. 架构决定

### 3.1 设置存储与契约

`output` 挂在 `Settings` 根级（与 `translation` 平级），字段：

```ts
export type OutputSettings = {
  /** 绝对目录路径；null = 未设置。 */
  defaultPath: string | null;
  /** true = 下载直写 defaultPath，不再弹保存框。 */
  useDefaultPath: boolean;
};
```

默认值 `{ defaultPath: null, useDefaultPath: false }` —— 开关为 true 但路径为 null 是非法组合，由**两层**共同保证：契约校验（见下）+ 设置页 UI（关着开关才允许清路径）。

**版本策略（S1 的第一个关键决定）**：`SETTINGS_VERSION` 保持 `1` 不动。理由：`readSettings()` 对「校验失败」的处置是把整个文件改名备份并重置为默认值——如果旧文件（无 `output` 字段）触发 `readFields` 失败，用户会丢掉全部已配置的 Provider/语言/翻译设置，**不可接受**。因此校验规则改为：`output` 缺失时按默认值补齐（宽容读入、严格写出——写出的文件永远带 `output`）。这是对现有「严格校验」原则的一次有记录的放宽，仅限新增字段，不适用于任何既有字段。

### 3.2 IPC 通道与桥接

沿用 secrets 的三件套模式（`preload-contract.cjs` 定义通道名 → `preload.cjs` 自包含暴露 → `main.mjs` 注册 handler）：

| 通道 | 方向 | 载荷 | 语义 |
| --- | --- | --- | --- |
| `md-convertor:output:select-directory` | renderer → main | 无 | 弹 `dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] })`，返回 `{ ok, path? }` 或 `{ ok: false, code: "CANCELLED" }` |
| `md-convertor:output:save-file` | renderer → main | `{ dirPath, filename, content }` | `mkdir -p dirPath`（递归，已存在则跳过）→ 校验 `filename` 不含路径分隔符与 `..` → 写入 `path.join(dirPath, filename)`，返回 `{ ok, path }` 或 `{ ok: false, code }` |

安全边界（QA 关注点，实现时逐条落实）：

1. **文件名是渲染层传入的不可信输入**：主进程必须拒绝含 `/`、`\`、`..` 的 filename，杜绝目录穿越；文件名清洗/拒绝逻辑放主进程，渲染层只负责展示。
2. **内容不上日志**：`save-file` 的日志（如有）只记 `{requestId, status, code, bytes}`，与 QA-009 同款纪律。
3. **写入上限**：沿用转换产物量级（Markdown 文本），不设额外硬限，但要防 `content` 非 string 的类型攻击。
4. `dirPath` 只允许绝对路径且不得指向系统敏感目录的白名单校验**不做**（用户自己选的目录、单机个人应用、与 secrets 隔离），但 `~` 与相对路径必须拒绝（防渲染层 bug 写错地方）。

preload 的 `output` 桥接在**浏览器/e2e 环境不存在**——与 `secretsBridge()` 同款判定，主页面的分叉逻辑必须容忍桥接缺失（缺失 = 走浏览器下载，不报错）。

### 3.3 主页面下载分叉

`downloadMarkdown()` 改造（S2）：

```
启用 && 桥接存在 && defaultPath 非空
  → bridge.saveFile → 成功：反馈条「已保存到 <path>」（role=status，自动消失或常驻到下一次转换）
                    → 失败：降级浏览器下载 + 反馈条说明「直接保存失败（<code>），已改为浏览器下载」
否则
  → 现有浏览器下载逻辑（一字不动）
```

判定所用的设置快照来自页面已有的 `fetchSettings()`（首屏已拉过，需把它存进 state——当前只取了 `translation` 和 `languages` 两个字段，S2 要把 `output` 一起留下）。

### 3.4 验证策略

| 层 | 手段 |
| --- | --- |
| 契约 | `src/types/settings.test.ts` 扩用例：无 `output` 的旧文件宽容读入、非法组合（useDefaultPath=true + defaultPath=null 的读入处理见 S1 Spec）拒绝或规范化、写出永远带 output |
| IPC | `electron/output.test.mjs`（新）：filename 穿越/类型攻击矩阵、`~`/相对路径拒绝、CANCELLED 语义；`electron/preload.test.cjs` 扩：通道名契约一致 |
| 设置页 UI | `e2e/settings.spec.ts` 扩用例：卡片渲染、选择目录（mock 桥接）、开关与路径联动 |
| 下载分叉 | `e2e/home.spec.ts` 扩用例：mock 桥接 + 三态（直写成功/直写失败降级/无桥接走浏览器下载），断言反馈条文案与 anchor 是否出现 |
| 真机 | `npm run desktop:package` + CDP 探针：选目录 → 开开关 → 转换 → 下载 → `ls` 确认文件落盘且无对话框 |

---

## 4. 阶段划分

| 阶段 | 内容 | 交付 |
| --- | --- | --- |
| **S0（并入 S1 首个任务）** | 版本 `0.3.5` → `0.3.6`（TDD：release-guards fixture 先 RED） | 门禁允许的目标版本 |
| **S1** | 契约 + 存储 + IPC + preload + 设置页「输出」卡片 | 设置页可选目录、可开关、settings.json 正确落盘 |
| **S2** | 主页面下载分叉 + 反馈条 + 降级路径 | 开关控制弹不弹；全量回归绿 |
| **S3** | 发布：门禁 `npm run desktop:release`（Node 24.14.1/24.15.0）、安装、GitHub Release、文档收口 | ZIP + tag `v0.3.6` + 本机安装 |

S1 与 S2 分两次提交（关注点不同：前者是设置面与桥接，后者是转换页行为）；S3 单独提交。

**状态（2026-09-22）**：S1 done（提交 `ac8f91a`）、S2 done（提交 `f9b7534`）；S2 标 done 之后用户真机实测撞到「配好 iCloud 目录 + 开开关 → 点下载毫无反应」，根因是 `isAbsoluteDirPath` 把路径里任何 `~` 都当家目录简写拒掉（iCloud 云盘落在 `com~apple~CloudDocs` 下），叠加 preload 抛异常未被 `page.tsx` 捕获——两个缺陷均已按 TDD 修复并单独提交，详见 `S2-download-flow.md` 的「缺陷修复」。**S3 未开工**，前置条件：重新打包 + 用户真机两态复测签字 + 用户补跑 firefox e2e。

---

## 5. 验收标准（DoD 补充）

1. 每个任务都有先失败的测试（RED 证据进 `feature_list.json`）。
2. 旧 `settings.json`（无 `output` 字段）读入不丢任何既有配置——专项测试锁定。
3. filename 含 `/`、`\`、`..`、`~` 或相对路径时主进程拒绝且不落盘——专项测试锁定。
4. 关闭开关后行为与 `0.3.5` 完全一致（既有 `e2e/home.spec.ts` 下载相关断言零改动通过）。
5. 三引擎 e2e 与 `./init.sh` 全绿；真机探针确认「开=不弹框直写、关=弹框」两态。

---

## 6. 已知取舍与风险

| 项 | 说明 |
| --- | --- |
| 契约放宽 | `output` 缺失宽容读入是对严格校验的唯一例外，必须用测试钉死「仅此字段、仅缺失时」 |
| 目录失效 | 用户开启开关后把目录删了：直写时 `mkdir -p` 会在多数场景自愈（父目录还在时）；父目录也没了则报错降级浏览器下载——不追求更聪明的恢复 |
| 桥接缺失 | Web 版与 e2e 无 preload，`window.mdConvertor.output` 为 undefined，必须静默走浏览器下载 |
| 文件重名 | 同名文件直接覆盖（与浏览器「另存为」选同名文件的语义一致），不做 (1) (2) 后缀 |
| 版本节奏 | 若 S3 前还有别的 feature 插队升了版本，S3 的目标版本以当时 `feature_list.json` 的 `currentVersion` 为准顺延，不硬编码 `0.3.6` |
