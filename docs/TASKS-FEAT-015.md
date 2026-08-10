# Tasks — 一键清空富文本内容（feat-015）

## T1 — 状态契约

- **状态**：done
- **完成条件**：公开纯函数一次清除富文本 draft 与共享输出，loading 时保持原状态。
- **验证**：`paste-client.test.ts` 先因缺少 seam 与 loading guard 分别 RED，最小实现后 19/19 GREEN。

## T2 — 页面交互

- **状态**：done
- **完成条件**：“清空”按钮按计划显示、禁用和重置；链接模式不变。
- **验证**：Chromium 用例先因找不到“清空”按钮 RED；接入页面后 10/10 GREEN，随后三引擎 30/30。

## T3 — 收口

- **状态**：done
- **完成条件**：`./init.sh`、三浏览器关键 E2E、文档同步与 Git 提交通过；不打包、不运行 live、不合并。
- **验证**：Node.js 24.14.1 `./init.sh` 通过 24 files / 287 tests、coverage 与 build；富文本三浏览器 E2E 30/30，tracked-file check 通过；用户在当前源码的真实 Electron 窗口人工验收通过。
