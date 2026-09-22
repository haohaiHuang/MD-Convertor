# S2 — 主页面下载分叉（Spec / Plan / Tasks）

- 上游：`docs/features/default-save-path/FSD.md`
- 前置：S1（契约 + IPC + 输出卡片）已完成
- 状态：**已完成**（2026-09-21）
- feature_list id：`feat-041`

## Spec

**目标**：让主页面「下载」按钮按设置分叉——开启「使用默认目录」且桥接可用时直写文件并给用户反馈；其余情况保持 `0.3.5` 的浏览器下载行为一字不动。

**关键决定**：

1. **分叉条件是三重的**：`settings.output.useDefaultPath === true` && `settings.output.defaultPath` 非空 && `outputBridge()` 存在。三者缺一都走浏览器下载。浏览器/e2e 无桥接，天然走旧路径——既有 e2e 断言零改动。
2. **页面要留住 settings**：当前 `page.tsx` 首屏 `fetchSettings()` 只取了 `translation.defaultEnabled` 与 `languages.target` 两个标量。改为把整个 `Settings` 存入 state（`settingsState`），`translateEnabled` / `targetLanguage` 派生自它，`output` 从同一处读取。不额外发第二次请求。
3. **反馈条**：直写成功 → 结果区出现 `role="status"` 反馈「已保存到 <完整路径>」；直写失败 → 反馈「直接保存失败：<用户可读原因>已改为浏览器下载。」并**降级执行**浏览器下载。反馈在下一次转换开始时清除（与 `linkFetchFailed` 同款生命周期）。
4. **错误码用户化**（**本节曾与实现冲突，2026-09-21 已决策——见下方「决策记录」**）：`OUTPUT_CODE_MESSAGES` 补 `EACCES` / `EPERM` / `ENOENT` / `ENOTDIR` / `ENOSPC` / `EROFS` 六个真实文件系统码，与 S1 已有的六个业务码共用一张表。
5. **文件名逻辑不动**：`translatedFilename()` 的译文后缀规则原样复用，直写与浏览器下载两条路径用同一个 `filename` 变量。

**非目标**：不新增「另存为」对话框（主进程 `dialog.showSaveDialog` 不引入——用户要的是「不再弹」，不是「换一种弹」）；不改翻译、转换管线；不动设置页。

## 决策记录（2026-09-21，T2.2 落地时）

**冲突**：本节原第 4 条声称 `EACCES → 「没有写入权限」`、`ENOENT → 「目录不存在」`，但 S1 交付的 `OUTPUT_CODE_MESSAGES` 只有业务码（`INVALID_*` / `CANCELLED` / `OUTPUT_SAVE_FAILED` / `IPC_FAILED`），而 `electron/output.mjs` 的 catch 分支是 `error.code ?? "OUTPUT_SAVE_FAILED"`——即 Node fs 的真实错误码被原样回传。也就是说原第 4 条当时不成立，真实 `EACCES` 会落到兜底文案。

**选择：方案 (a) 补映射**（否决 (b) 改文档用笼统文案）。理由：

- 直写失败后页面**已经降级**为浏览器下载，用户看到的文件照样落盘；此时「为什么没直写」是这条反馈条唯一的信息量。笼统文案等于把这一格信息丢掉。
- 归一化放主进程会越权：S1 已定「失败映射 `error.code`」，且 warn 日志只记 code——为了文案改主进程等于把展示口径下沉到 IPC 契约里。
- 补表是纯增量（一张字符串表），不动契约、不动 IPC、不动版本号，代价与收益严重不对称。

**顺带的两处实现偏差**（均已在代码注释中说明）：

1. 除 `EACCES`/`ENOENT` 外，同时补了 `EPERM`（macOS 在部分沙箱场景返回它）/ `ENOTDIR` / `ENOSPC` / `EROFS`，均有专项单测。
2. 失败文案的连接词改用冒号而非括号：`直接保存失败：{reason}已改为浏览器下载。`。原因是映射表里的每条都是**完整句子**（末尾带「。」，设置页「选择目录」失败时直接整句展示），塞进 `（…）` 会出现「（没有写入权限。）」这种嵌套句号。冒号句式可以原样复用句子，不引入去尾标点的字符串处理。e2e 只断言「已改为浏览器下载」与「没有写入权限」两个子串，对连接词不敏感。

## Plan

### 1. `src/app/page.tsx`

- state：`settingsState: Settings | null`；首屏 effect 里 `setSettingsState(settings)`，`translateEnabled` / `targetLanguage` 仍是独立 state（行为不变，不动翻译逻辑），从同一份响应里各取所需、不额外发请求。
- 新增 `saveNotice: string | null` state，渲染在结果区内、`.stats` **之前**，`role="status"`；样式 `.saveNotice` 复用 `.translationNotice` 的基调（`max-width: 820px` / `color: var(--muted)` / `font-size: 14px`）。
- `downloadMarkdown()` 改造（**实际落地版本（含 2026-09-22 真机缺陷修复，见文末「缺陷修复」）**，与上一版草图的差别见「决策记录」）：

```ts
async function downloadMarkdown(): Promise<void> {
  const currentResult = clientState.output.result;
  if (!currentResult) return;
  const filename = /* 见下：译文后缀规则原样复用 */;
  // 三重条件：开关开 && 目录非空 && 桥接存在
  const configured = settingsState?.output;
  const bridge = outputBridge();
  if (configured?.useDefaultPath && configured.defaultPath && bridge) {
    // preload 的参数校验是「抛异常」而不是 resolve `{ ok: false }`，
    // 所以必须把拒绝折进同一条失败分支；否则异常会被 void 吞掉，点下载毫无反应。
    const result = await bridge
      .saveFile(configured.defaultPath, filename, activeMarkdown)
      .catch(() => null);
    if (result?.ok) {
      setSaveNotice(`已保存到 ${result.path ?? `${configured.defaultPath}/${filename}`}`);
      return;
    }
    // 不吞错：报原因，然后照样把文件交给用户
    const reason = result ? outputCodeMessage(result.code, "文件写入失败。") : "默认保存设置不可用。";
    setSaveNotice(`直接保存失败：${reason}已改为浏览器下载。`);
  }
  // ……现有 Blob/anchor 逻辑一字不动……
}
```

- 按钮必须同步改成 `onClick={() => void downloadMarkdown()}`（本仓库既有惯例就是 `() => void asyncFn()`；写死 `onClick={downloadMarkdown}` 会把 Promise 当 handler 传，属既有的 React 反模式）。
- `runConversion()` 开头 `setSaveNotice(null)`。

### 2. `src/app/settings/client.ts`（小补充）

- 导出 `outputCodeMessage(code, fallback)`（若 S1 已导出则零改动）——S1 已导出，本阶段只补错误码表条目（见「决策记录」）。

### 3. `src/app/page.module.css`

- 新增 `.saveNotice`（复用 `.translationNotice` 的视觉基调，不新起炉灶；间距/字号遵循现有 token）。

## Tasks

| id | 任务 | RED（先写失败测试） | 完成条件 | 验证 |
| --- | --- | --- | --- | --- |
| T2.1 | e2e：三态分叉用例 | `e2e/home.spec.ts` 新增：① mock 桥接 saveFile resolve + 设置 useDefaultPath → 点下载断言反馈条「已保存到 …」且无 anchor 下载触发；② mock reject（EACCES）→ 反馈条含「没有写入权限」且降级（无法直接断言系统对话框，断言反馈文案即可）；③ 无桥接（默认）→ 行为与旧断言一致（既有用例回归锁） | 三态 chromium 全绿 | 先 `npm run build`，`npx playwright test e2e/home.spec.ts --project=chromium` |
| T2.2 | 实现 settingsState + 分叉 + 反馈条 | T2.1；另加 `src/app/settings/client.test.ts`（新）：四个真实 fs 码 + 未知码 + 无码共 6 例（RED 4 failed / 2 passed） | T2.1 全绿；`translateEnabled` / `targetLanguage` 行为不变（翻译相关既有用例回归锁） | 同上 + `npx vitest run src/app/settings/client.test.ts` |
| T2.3 | 反馈条生命周期 | `e2e/home.spec.ts`：直写成功后再次转换 → 反馈条消失 | 全绿 | 同上 |
| T2.4 | 全量回归 | — | `npm run test:e2e` 三引擎全绿（新增用例 × 3 引擎计入总数）；`./init.sh` 全绿 | `npm run test:e2e`、`./init.sh` |
| T2.5 | 真机探针 | — | `npm run desktop:package` exit 0 → CDP：设置目录、开开关、转换、点下载 → `ls <目录>` 见文件、无系统对话框（人工确认）；关开关再走一遍 → 有对话框 | `npm run desktop:package` + 人工 |
| T2.6 | 阶段收尾 | — | `CHANGELOG.md`(+zh) `[Unreleased]` 记录；PROGRESS/feature_list 更新 | — |

## Handoff

- 结束时必须写清：分叉的三重条件、降级路径的存在（失败不吞、降级且告知）、反馈条的生命周期（下次转换清除）、真机两态探针的结果。
- 已知限制：e2e 无法真实断言「系统对话框弹出与否」，第三态（无桥接）的弹框行为由既有浏览器下载断言与真机人工确认共同覆盖；文件重名直接覆盖（FSD §6）。
- e2e 定式（复用者请注意）：① 桥接用 `page.addInitScript` 注入，**必须在 `goto` 之前**；② 设置用 `route.fetch()` 拿真实响应后只改写 `output` 再 `fulfill`——**不要**用 PUT 写真设置，e2e server 的设置目录是全 project 共享的，泄漏会连坐 firefox/webkit；③ 负向断言「没走浏览器下载」用 `page.on("download")` 计数器 + 包裹 `URL.createObjectURL` 计数，不要用 `waitForEvent` 超时；④ 断言前先等一次 `/api/settings` 响应，否则与首屏 fetch 竞态。

## 缺陷修复（2026-09-22，S2 标 done 之后，用户真机实测报障）

**现象**：设置页「输出」卡片的勾选能力正常，但配好 iCloud 云盘目录 + 打开开关后，点「下载」**完全没有反应**——不直写、不浏览器下载、不报错。

**两个叠加缺陷**：

1. **路径校验把 iCloud 目录判为非法**。`isAbsoluteDirPath`（`electron/preload-contract.cjs`，以及 `electron/preload.cjs` 里那份等价副本）当时是 `value.includes("~") → false`，即**路径中任何位置出现 `~` 都拒绝**。但 `~` 只在**位于路径段开头**时才是家目录简写；iCloud 云盘的数据落在 `com~apple~CloudDocs` 下，所以用户选的 `/Users/…/com~apple~CloudDocs/Note/未归档` 被拒。这是 S1 T1.2 的原始设计（本文档决策记录里写作 `leading /, no ~, no .. segment`）被字面执行的结果。
   修法：`!value.split("/").some((s) => s === ".." || s.startsWith("~"))`，并把 iCloud 场景写进函数注释。**不要改回 `includes("~")`**。

2. **preload 抛异常，调用处没接**。preload 的 `assert*` 是**抛 `TypeError`**，不是 resolve `{ ok: false }`；第 1 点里的拒绝正是以异常形式抛出，而 `page.tsx` 当时是裸 `await bridge.saveFile(...)`，异常冒泡后被 `onClick={() => void downloadMarkdown()}` 吞掉 → 完全无声。上面的 Plan 代码块已更新为修复后的形态。
   为什么 e2e 抓不到：桩永远 resolve，从不抛。新增用例把桩扩成 `{ ok: true } | { ok: false; code } | { ok: false; rejects: true }`，第三种**真的抛**。

**TDD 证据**：RED —— `preload-contract.test.cjs` +2 accept（真实 iCloud 路径、`/Users/someone/My~Backup`）/+1 reject（`/Users/someone/~/notes`），`preload.test.cjs` 同步 dirCases，`output.test.mjs` 加同名拒绝用例 + 一条真的写进 `com~apple~CloudDocs/Note` 的测试，`e2e/home.spec.ts` 加「桥接层拒绝时给出反馈并降级为浏览器下载」；模块测试 4 failed / 86 passed、e2e chromium 3 failed / 16 passed。GREEN —— 模块 89 passed（1 条既有环境噪声 `CODEBUDDY_BROKER_DENY`，干净版代码同样复现）、e2e chromium+webkit 158 passed / 2 skipped、`tsc --noEmit` + `eslint .` 全绿。

**未定论**：用户实测后留下的 `settings.json` 里 `output.defaultPath` 已是 iCloud 目录（说明「选择目录」持久化正常），但 `output.useDefaultPath: false`，与「我打开了开关」不符。`toggleUseDefaultPath` 是乐观更新（先改 state、PUT 失败再回滚并提示「设置保存失败」），且**开关若是关的，页面根本不会进入桥接分支**——这本身也能解释「点了没反应」。复测时需确认开关是否稳定持久化；若复现回滚，那是一个独立缺陷，要查 PUT 响应。

### 真机复验（2026-09-22，重新打包后，通过）

修完并 `npm run desktop:package`（Node 24.14.1，exit 0）之后，在**打包应用的真实渲染层**上用 CDP 复验，两条都过：

- **开关持久化正常，缺陷不可复现**：在设置页点「使用默认目录」→ 真实 `PUT /api/settings` 落盘，`settings.json` 的 `useDefaultPath` 从 `false` 变成 `true`。上面那条「未定论」因此**不是可复现缺陷**（机制本身是好的），但用户那次为什么留下 `false` 仍未查明。
- **直写落到带 `~` 的真实目录**：开关打开 + 目录为 `…/com~apple~CloudDocs/Note/未归档` → 转换、点「下载」→ 反馈条 `已保存到 /Users/…/com~apple~CloudDocs/Note/未归档/<文件名>.md`、`download` 事件 0、`createObjectURL` 0、文件**真的落盘**（134 B）。这正是修复前必然失败的那条路径。

**真机探针的硬约束（踩过，务必记住）**：**`MD_CONVERTOR_USER_DATA` 无法隔离打包应用**。`electron/env.mjs` 的 `buildServerEnv()` 里 `MD_CONVERTOR_USER_DATA: userDataDir` 是**无条件覆盖**的（注释写明「the MD_CONVERTOR_* keys are always authoritative」），主进程算出来的 `userDataDir` 永远赢；启动时给应用设这个变量**不生效**。后果：任何真机探针都会读写**用户真实的 `settings.json`**，并把文件写进**开关当前指向的真实目录**。
因此探针必须：① 先把真实 `settings.json` 备份到 `/tmp`；② 跑完把 `output` 之外的字段逐个比对确认未被改动（探针的 PUT 是整份替换）；③ 恢复 `useDefaultPath` / `defaultPath` 到原值；④ 删掉落在真实目录里的探针文件。本次复验已全部执行，用户目录与设置回到原样。
