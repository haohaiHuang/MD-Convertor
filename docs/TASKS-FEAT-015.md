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

## T4 — 重新发布验证

- **状态**：done
- **完成条件**：完整发布门禁生成包含 feat-015 的 fresh 0.2.0 arm64 ZIP，并通过打包应用冒烟和真实窗口验收。
- **验证**：Node.js 24.14.1 `desktop:release` 通过 287 tests、三引擎 51/51、真实微信门禁、Forge、fresh ZIP 与包内版本/架构校验；打包应用启动和 `example.com` 转换冒烟通过，用户确认“一键清空”无问题。ZIP 为 354,603,624 bytes，SHA-256 `7f6f39873056a34414706362356cb461d1617cb1cb73c9b76952fe587dd658c6`。
