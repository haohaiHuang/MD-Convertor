# S2 — 主页面下载分叉（Spec / Plan / Tasks）

- 上游：`docs/features/default-save-path/FSD.md`
- 前置：S1（契约 + IPC + 输出卡片）已完成
- 状态：**待实施**
- feature_list id：`feat-041`

## Spec

**目标**：让主页面「下载」按钮按设置分叉——开启「使用默认目录」且桥接可用时直写文件并给用户反馈；其余情况保持 `0.3.5` 的浏览器下载行为一字不动。

**关键决定**：

1. **分叉条件是三重的**：`settings.output.useDefaultPath === true` && `settings.output.defaultPath` 非空 && `outputBridge()` 存在。三者缺一都走浏览器下载。浏览器/e2e 无桥接，天然走旧路径——既有 e2e 断言零改动。
2. **页面要留住 settings**：当前 `page.tsx` 首屏 `fetchSettings()` 只取了 `translation.defaultEnabled` 与 `languages.target` 两个标量。改为把整个 `Settings` 存入 state（`settingsState`），`translateEnabled` / `targetLanguage` 派生自它，`output` 从同一处读取。不额外发第二次请求。
3. **反馈条**：直写成功 → 结果区出现 `role="status"` 反馈「已保存到 <完整路径>」；直写失败 → 反馈「直接保存失败（<用户可读原因>），已改为浏览器下载」并**降级执行**浏览器下载。反馈在下一次转换开始时清除（与 `linkFetchFailed` 同款生命周期）。
4. **错误码用户化**：S1 的 `OUTPUT_CODE_MESSAGES` 复用到主页面（EACCES → 「没有写入权限」、ENOENT → 「目录不存在」、其余 → 通用失败文案）。
5. **文件名逻辑不动**：`translatedFilename()` 的译文后缀规则原样复用，直写与浏览器下载两条路径用同一个 `filename` 变量。

**非目标**：不新增「另存为」对话框（主进程 `dialog.showSaveDialog` 不引入——用户要的是「不再弹」，不是「换一种弹」）；不改翻译、转换管线；不动设置页。

## Plan

### 1. `src/app/page.tsx`

- state：`settingsState: Settings | null`；首屏 effect 里 `setSettingsState(loaded)`，`translateEnabled` / `targetLanguage` 仍用独立 state（行为不变，避免牵动翻译逻辑），仅在其后追加一行读取 output。
- 新增 `savedPathFeedback: string | null` state 与 `saveNotice` 渲染（结果区内、stats 之前，`role="status"`）。
- `downloadMarkdown()` 改造：

```ts
async function downloadMarkdown(): Promise<void> {
  // filename 计算保持不变
  const output = settingsState?.output;
  const bridge = outputBridge();                       // S1 已提供；无桥接返回 null
  if (output?.useDefaultPath && output.defaultPath && bridge) {
    const result = await bridge.saveFile(output.defaultPath, filename, activeMarkdown);
    if (result.ok) {
      setSavedPathFeedback(`已保存到 ${result.path}`);
      return;
    }
    setSavedPathFeedback(`直接保存失败（${outputCodeMessage(result.code)}），已改为浏览器下载。`);
    // 落到下面的浏览器下载，不 return
  }
  // ……现有 Blob/anchor 逻辑一字不动……
}
```

- `runConversion()` 开头 `setSavedPathFeedback(null)`。

### 2. `src/app/settings/client.ts`（小补充）

- 导出 `outputCodeMessage(code, fallback)`（若 S1 已导出则零改动）。

### 3. `src/app/page.module.css`

- 新增 `.saveNotice`（复用 `.translationNotice` 的视觉基调，不新起炉灶；间距/字号遵循现有 token）。

## Tasks

| id | 任务 | RED（先写失败测试） | 完成条件 | 验证 |
| --- | --- | --- | --- | --- |
| T2.1 | e2e：三态分叉用例 | `e2e/home.spec.ts` 新增：① mock 桥接 saveFile resolve + 设置 useDefaultPath → 点下载断言反馈条「已保存到 …」且无 anchor 下载触发；② mock reject（EACCES）→ 反馈条含「没有写入权限」且降级（无法直接断言系统对话框，断言反馈文案即可）；③ 无桥接（默认）→ 行为与旧断言一致（既有用例回归锁） | 三态 chromium 全绿 | 先 `npm run build`，`npx playwright test e2e/home.spec.ts --project=chromium` |
| T2.2 | 实现 settingsState + 分叉 + 反馈条 | T2.1 | T2.1 全绿；`translateEnabled` / `targetLanguage` 行为不变（翻译相关既有用例回归锁） | 同上 |
| T2.3 | 反馈条生命周期 | `e2e/home.spec.ts`：直写成功后再次转换 → 反馈条消失 | 全绿 | 同上 |
| T2.4 | 全量回归 | — | `npm run test:e2e` 三引擎全绿（新增用例 × 3 引擎计入总数）；`./init.sh` 全绿 | `npm run test:e2e`、`./init.sh` |
| T2.5 | 真机探针 | — | `npm run desktop:package` exit 0 → CDP：设置目录、开开关、转换、点下载 → `ls <目录>` 见文件、无系统对话框（人工确认）；关开关再走一遍 → 有对话框 | `npm run desktop:package` + 人工 |
| T2.6 | 阶段收尾 | — | `CHANGELOG.md`(+zh) `[Unreleased]` 记录；PROGRESS/feature_list 更新 | — |

## Handoff

- 结束时必须写清：分叉的三重条件、降级路径的存在（失败不吞、降级且告知）、反馈条的生命周期（下次转换清除）、真机两态探针的结果。
- 已知限制：e2e 无法真实断言「系统对话框弹出与否」，第三态（无桥接）的弹框行为由既有浏览器下载断言与真机人工确认共同覆盖；文件重名直接覆盖（FSD §6）。
