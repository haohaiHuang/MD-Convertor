# S1 — 设置契约、IPC 通道与「输出」卡片（Spec / Plan / Tasks）

- 上游：`docs/features/default-save-path/FSD.md`
- 前置：无（本阶段首个任务顺带做版本升级 S0）
- 状态：**待实施**
- feature_list id：`feat-041`

## Spec

**目标**：让设置页能够选择并记住一个默认保存目录、开关「使用默认目录」，并打通渲染层可调用的目录选择/文件直写桥接。本阶段结束时**主页面行为不变**（分叉改造属 S2）。

**关键决定**（细节见 FSD §3）：

1. `Settings` 新增根级 `output: { defaultPath: string | null, useDefaultPath: boolean }`，默认 `{ defaultPath: null, useDefaultPath: false }`。
2. **`SETTINGS_VERSION` 保持 `1`**；`validateSettings` 对缺失的 `output` 宽容补默认值（仅此字段、仅缺失时放宽），写出永远带 `output`。理由：不放宽就会把旧文件判为损坏、触发整份备份重置，用户丢全部配置。
3. **非法组合的规范化**：读入 `useDefaultPath: true` 但 `defaultPath: null` 时**不报错**，规范化为 `{ defaultPath: null, useDefaultPath: false }`（开关与路径绑定，避免「开着开关却没有目录」的僵尸状态）。写盘前同样先规范化。
4. IPC 双通道：`md-convertor:output:select-directory`（对话框选择，返回选中目录或 CANCELLED）、`md-convertor:output:save-file`（`mkdir -p` + 路径穿越防护 + 写文件）。
5. preload 暴露 `window.mdConvertor.output.selectDirectory()` / `saveFile(dirPath, filename, content)`，自包含实现（沙箱 preload 不能 require 相对文件——`feat-018` 的既有教训，通道名常量在 preload.cjs 内复制一份，由 `electron/preload.test.cjs` 断言与 contract 一致）。
6. 设置页在「翻译」卡片之前插入「输出」卡片：只读路径展示（未设置时显示「未设置」）+「选择目录」按钮 +「使用默认目录」开关 + 一行说明文案。开关开启但未设目录时给出警告提示且不落盘。

**非目标**：主页面的下载分叉（S2）、发布动作（S3）。

## Plan

### 1. `src/types/settings.ts`

- 新增 `OutputSettings` 类型与 `OUTPUT_KEYS = ["defaultPath", "useDefaultPath"]`。
- `Settings` 加 `output: OutputSettings`；`DEFAULT_SETTINGS` 加默认值；`ROOT_KEYS` 加 `"output"`。
- `validateSettings`：
  - `root.output` 缺失 → 用默认值（唯一的宽容分支，注释写明理由）；
  - 存在 → `readFields(output, "output", OUTPUT_KEYS)` + `defaultPath` 走 nullable-string（非空校验）+ `useDefaultPath` 走 boolean；
  - 规范化：`useDefaultPath && !defaultPath` → 输出 `{ defaultPath: null, useDefaultPath: false }`。

### 2. `electron/preload-contract.cjs`

- `CHANNELS` 追加 `selectDirectory: "md-convertor:output:select-directory"` 与 `saveFile: "md-convertor:output:save-file"`。
- 新增 `isValidOutputFilename(value)`（非空 string、无 `/`、无 `\`、无 `..`、长度 ≤ 255）与 `isAbsoluteDirPath(value)`（`path.isAbsolute` 语义、拒绝 `~` 开头与相对路径——contract 内不引 node:path，用 `/` 开头 + 不含 `..` 段的轻量判定，测试里对齐）。

### 3. `electron/preload.cjs`

- 复制两个新通道名常量；`contextBridge.exposeInMainWorld` 的 `mdConvertor` 增加 `output: { selectDirectory(), saveFile(dirPath, filename, content) }`。
- 参数校验在 preload 层抛 TypeError（同 secrets 风格）：filename 过 `isValidOutputFilename` 语义的本地副本、dirPath 必须 `/` 开头、content 必须 string。

### 4. `electron/main.mjs`

- `import { dialog } from "electron"`（追加到现有 import）。
- `registerOutputIpc()`：
  - `select-directory`：`BrowserWindow.fromWebContents(event.sender)` 拿父窗口（拿不到也照弹，`showOpenDialog` 无窗口版可用）；`properties: ["openDirectory", "createDirectory"]`；canceled → `{ ok: false, code: "CANCELLED" }`。
  - `save-file`：主进程侧**重新**校验 dirPath/filename（不信任 preload——preload 可被绕过的场景虽然不存在，但主进程自校验是既有纪律）；`fs.mkdir(dirPath, { recursive: true })` → `path.join` → `fs.writeFile(filePath, content, "utf8")`；错误按 `error.code ?? "OUTPUT_SAVE_FAILED"` 返回。
  - 日志只记 code，不记 content、不记完整路径以外的用户数据。
- 在 `app.whenReady()` 的注册区调用 `registerOutputIpc()`。

### 5. `src/app/settings/client.ts`

- 新增 `OutputBridge` 类型与 `outputBridge(): OutputBridge | null`（模式复刻 `secretsBridge()`）。
- `SECRET_CODE_MESSAGES` 同款加 `OUTPUT_CODE_MESSAGES`（CANCELLED 不算错误，单独处理）。

### 6. `src/app/settings/page.tsx` + `page.module.css`

- 「输出」卡片（置于「翻译」卡片之前）：
  - 路径行：`<code>` 展示 `settings.output.defaultPath ?? "未设置"`；
  - 「选择目录」按钮：调 `outputBridge().selectDirectory()`，选中即 `save({...settings, output: {...settings.output, defaultPath: path, useDefaultPath: settings.output.useDefaultPath}})`；无桥接时按钮禁用并提示「目录选择只能在桌面应用中使用」；
  - 「使用默认目录」开关：开启时若 `defaultPath` 为空 → 警告「请先选择目录」且不落盘；否则 save；
  - 浏览器环境（无桥接）：整个卡片仍渲染（用户能看到当前配置），按钮禁用。

## Tasks

| id | 任务 | RED（先写失败测试） | 完成条件 | 验证 |
| --- | --- | --- | --- | --- |
| T1.0 | 版本升 `0.3.6`（S0） | `scripts/release-guards.test.mjs` fixture 改 `0.3.6` ⇒ 5 failed（`Release version must be 0.3.5.`） | `release-desktop.mjs`（两处）+ `package.json` + `package-lock.json`（两处）+ `feature_list.json` 的 `currentVersion` 同步 ⇒ 29 passed | `npm test -- release-guards` |
| T1.1 | 契约：类型 + 校验 + 规范化 | `src/types/settings.test.ts` 新用例：① 无 `output` 的完整旧文件读入成功且既有字段不丢；② `useDefaultPath:true + defaultPath:null` 规范化为全默认；③ 非法 output 字段名仍拒绝 | 全部 passed 且既有 45 用例不红 | `npx vitest run src/types/settings.test.ts` |
| T1.2 | contract：通道名 + filename/dirPath 校验 | `electron/preload-contract.test.cjs`（或并入既有 preload 测试）：新通道名存在、穿越样本（`../x.md`、`a/b.md`、`a\\b.md`、`~/.md`、`""`）全部被拒 | 校验函数落地且矩阵全绿 | `node --test electron/`（或项目既有 runner） |
| T1.3 | preload 暴露 output 桥接 | `electron/preload.test.cjs` 扩：通道名与 contract 一致、参数校验抛 TypeError | 断言全绿 | 同上 |
| T1.4 | main 注册 IPC handler | `electron/output.test.mjs`（新）：select-directory 的 CANCELLED 语义（mock dialog）、save-file 的穿越拒绝/`..` 目录拒绝/正常写入/mkdir 自愈 | handler 全绿 | 同上 |
| T1.5 | 设置页「输出」卡片 | `e2e/settings.spec.ts` 扩 3 用例：卡片渲染与文案；mock 桥接下选目录 → 路径回显 + PUT body 含 output；开开关未设目录 → 警告且无 PUT | chromium 全绿 | 先 `npm run build`，再 `npx playwright test e2e/settings.spec.ts --project=chromium` |
| T1.6 | 阶段收尾 | — | `./init.sh` 全绿；旧 settings.json 兼容性专项（T1.1①）已锁 | `./init.sh` |

## Handoff

- 结束时必须写清：`SETTINGS_VERSION` 仍为 `1` 且 `output` 缺失宽容读入是唯一放宽点；`useDefaultPath:true + defaultPath:null` 的读入规范化规则；两个新通道名；preload 层与 main 层各自做了哪些重复校验（双层防御，谁也不能删）。
- 已知限制：本阶段结束时主页面「下载」仍走浏览器路径（S2 才分叉）；真机上「选择目录」后的直写尚未发生过（S2 真机探针覆盖）。
