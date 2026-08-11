# Tasks — Mermaid 图表保留（feat-013）

## T1 — 开工契约与基线

- **状态**：done
- **范围**：确认产品行为、安全边界、公共测试 seam、非目标和验证门禁；建立独立分支。
- **完成条件**：`feat-013` 为唯一 `in-progress` 事项，PLAN/TASK 与状态文档可供下一会话恢复。
- **验证证据**：2026-08-11 用户确认源码优先、链接动态 SVG 安全栅格化、粘贴 SVG 警告降级、不新增预览 Mermaid 渲染器；分支为 `codex/feat-013-mermaid`。Node.js 24.14.1 开工 `./init.sh` 通过 lint、typecheck、24 files / 287 tests、coverage 与 production build。

## T2 — Mermaid 源码与富文本安全处理

- **状态**：done
- **范围**：链接/粘贴 HTML 的 Mermaid 源码规范化、fenced code 输出、仅渲染 SVG 的富文本识别、栅格化或占位警告。
- **完成条件**：源码 fence、普通代码回归、恶意 SVG/script 清除、警告去重均有逐切片 RED/GREEN。
- **验证证据**：按 `convertUrlToMarkdown()` / `convertPastedContent()` seam 逐切片 RED/GREEN：`.mermaid` 源码由普通文本变为 fenced `mermaid`；Readability 移除 language 类的问题用内部 marker 恢复；既有 `language-mermaid` 代码块保持语言；容器 SVG 与独立 Mermaid SVG 从静默丢失先改为占位和 `MERMAID_RENDER_UNAVAILABLE`。用户随后以真实 WalkingLabs 粘贴内容复验发现只有渲染 SVG，新增独立清洗/Sharp 栅格化：脚本、事件、外部资源和原始 SVG 不泄漏，`foreignObject` 标签降为纯 SVG 文本，最长边限制 2048px，失败仍安全占位。专项 4 tests、粘贴相关 60 tests 与真实 WalkingLabs 粘贴门禁通过。

## T3 — 动态浏览器栅格化与可信图片交接

- **状态**：done
- **范围**：强制动态渲染信号、Mermaid 元素截图、内部可信资源映射、图片预算/统计/警告、取消和资源关闭。
- **完成条件**：本地动态 fixture 输出栅格 Data URI，HTML/Markdown 不含 SVG；普通链接模式 Data URI 仍拒绝。
- **验证证据**：按 `renderDynamicPage()` / `convertUrlToMarkdown()` seam 完成 RED/GREEN：容器与独立 SVG 截图、30 图、4096px、8 MiB、截图失败、取消/资源关闭；内部随机占位只接受本次浏览器生成的 PNG Data URI，畸形普通图片不影响可信图并继续按旧规则降级；正文充足但有空 Mermaid 仍启动浏览器，有可信截图时要求浏览器正文至少保留 95%。真实 WalkingLabs 页面暴露 Google Fonts CSS 挂起代理导航，新增失败回归后只拦截该字体样式表，真实页面恢复通过。

## T4 — 全量验证与交付

- **状态**：done
- **范围**：全量基线、三浏览器 E2E、WalkingLabs 真实样本、文档同步、0.2.0 打包和真实窗口验收。
- **完成条件**：PLAN Completion Criteria 全部满足；不修改 0.1.x 产物；用户确认最终应用行为。
- **验证证据**：链接路径曾通过 Node.js 24.14.1 `desktop:release`：26 files / 306 tests、三引擎 E2E 51/51、live 2/2、Forge 与 fresh ZIP。用户随后发现同一 WalkingLabs 页面经富文本粘贴仍缺图；真实 WalkingLabs 链接/深色粘贴门禁通过。用户提供实际黑图 Markdown 后，Data URI 诊断确认来源 CSS 丢失使 SVG presentation 属性回退为黑色；深色 fixture 先 RED 后改为固定浅色配色，真实页面生成图与重新打包应用人工验收通过。验收后质检再以四项 RED 复现并关闭动态多图跳过、纯源码误选、内联样式覆盖、31 图统计/警告，并修复小型生成 PNG 占位误判；聚焦 123/123，Node.js 24.14.1 `./init.sh` 27 files / 314 tests、coverage/build 通过。最新整改再次生成 0.2.0 / arm64 / macOS 12.0+ 本机 `.app`，用户复测正常。固定微信样本因上游 504 波动，经用户确认改为可单独运行的非阻断诊断项；发布仍以 WalkingLabs 链接/粘贴真实样本阻断。最终 Node.js 24.14.1 `desktop:release` 通过 27 files / 315 tests、E2E 51/51、WalkingLabs 2/2、Forge 与 fresh ZIP 校验；新 ZIP 为 354,631,314 bytes / `b212b359...7d505c`，版本 0.2.0、arm64。用户此前已在最新整改应用中确认真实 WalkingLabs 富文本转换正常。
