# Tasks — 快速返回与链接清空（feat-016）

## T1 — 状态契约

- **状态**：done
- **完成条件**：公开纯函数清除链接与共享输出、保留富文本输入，loading 时保持原状态。
- **验证**：缺少 `clearLinkInput` 与 loading 守卫分别 RED；最小实现后 `src/lib/paste-client.test.ts` 21/21 GREEN。

## T2 — 链接清空交互

- **状态**：done
- **完成条件**：链接非空时提供可访问入口；点击清除 URL、校验和旧结果；loading 时禁用。
- **验证**：Chromium 先因缺少“清空链接”按钮 RED，接入后清校验与清结果 8/8 GREEN；loading 禁用断言再 RED，加入禁用态后聚焦 GREEN。

## T3 — 返回顶部交互

- **状态**：done
- **完成条件**：滚动约 500px 后显示固定入口；点击平滑返回顶部且保留当前内容；桌面和窄屏位置可用。
- **验证**：390px 用例先因缺按钮 RED；接入被动滚动监听和固定入口后，390px / 1180px Chromium 2/2 GREEN，验证平滑滚动、视口位置及 URL/结果保留。

## T4 — 收口

- **状态**：done
- **完成条件**：React/CSS 复核、Node.js 24 基线、三浏览器 E2E、Harness 与 Changelog 同步通过；不运行 live、不打包、不合并。
- **验证**：Node.js 24.14.1 `./init.sh` 通过 27 files / 317 tests、coverage gate 与 production build；`npm run test:e2e` 三引擎 60/60、tracked-file check passed；用户在当前源码的真实 Electron 窗口确认清空链接与返回顶部均正常。用户随后授权发布，`desktop:release` 再次通过 317 tests、60/60 E2E、WalkingLabs live 2/2、Forge 与 fresh ZIP 校验；新包为 354,636,241 bytes / `5becae36...16485`。
