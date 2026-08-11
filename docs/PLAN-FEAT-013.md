# Plan — Mermaid 图表保留（feat-013）

## Summary

在不放宽现有 SVG、脚本和主动内容安全边界的前提下，让链接转换与富文本转换尽量保留 Mermaid 图表：可获得源码时输出 fenced `mermaid` 代码块；链接页面只有客户端渲染结果时，由现有受控 Chromium 将图表栅格化并交给图片内嵌管线；富文本粘贴只有渲染 SVG、没有源码时，先清除主动内容和外部资源，再在本机安全栅格化，无法转换才保留占位文本并显示明确警告。

## Confirmed Product Behavior

- Mermaid 源码优先：`pre.mermaid`、带非空源码的 `.mermaid` 容器或 `code.language-mermaid` 统一生成 fenced `mermaid` 代码块。
- 链接模式发现空 Mermaid 占位或已渲染 Mermaid SVG 时，即使正文已足够，也启动动态浏览器。
- 动态浏览器只对可见 Mermaid 图表截图；生成的栅格图通过请求内可信资源映射交给既有格式校验、8 MiB 单图、30 图和 20 MiB 最终文件预算，不允许网页自行提供的任意 Data URI 借此进入链接模式。
- 富文本模式不在浏览器中执行粘贴 SVG。识别到 Mermaid SVG 时，移除脚本、事件、外部资源和危险属性，把 `foreignObject` 标签降为纯 SVG 文本，然后由 Sharp 在本机转为 PNG；超过 1 MiB、无法确定尺寸、没有可见图元、超过 30 张或栅格化失败时，保留“Mermaid 图表未能安全转换”的占位文本并返回中文警告。Canvas 仍只降级。
- 原始 SVG、脚本、样式、事件属性、外部资源和其他主动内容不得进入 Markdown、预览或下载文件。
- 本轮不在应用预览中引入 Mermaid 渲染器。源码型 Mermaid 在应用预览中显示为代码块；支持 Mermaid 的 Markdown 阅读器可自行渲染。

## Public Test Seams

用户已于 2026-08-11 确认以下 seam：

1. `convertUrlToMarkdown()`：验证源码优先、动态占位强制浏览器、栅格图统计/预算、失败警告和最终 Markdown。
2. `convertPastedContent()`：验证源码代码块、Mermaid SVG 安全栅格化/失败降级、统计、预算、警告和无主动内容泄漏。
3. `renderDynamicPage()`：验证受控 Chromium 截图、可信资源映射、数量/尺寸限制、取消及资源关闭。

内部 HTML 识别、规范化和 marker 处理不另设对外 seam，通过以上既有接口验证。

## Implementation Outline

1. 新增 Mermaid HTML 规范化模块：识别源码型、空占位和渲染型容器；源码型转换为标准 `pre > code.language-mermaid`，渲染型按模式返回信号或安全占位。
2. 链接转换在直接 HTML 含 Mermaid 信号时强制浏览器渲染；浏览器返回序列化 HTML、请求内可信栅格资源和警告。
3. 动态浏览器把可见 Mermaid 容器截图为 PNG，并替换为不可预测的内部占位 URL；截图最多 30 个，单边超过 4096px、截图超过 8 MiB或截图失败时改为占位文本和警告。
4. 图片管线只接受本次浏览器结果显式提供的内部占位 URL → Data URI 映射；其余链接模式 Data URI 行为保持不变。
5. 富文本预处理在 DOMPurify 前提取源码或识别仅渲染图；Mermaid SVG 不进入浏览器执行，而是经独立白名单清洗后由 Sharp 转为最长边不超过 2048px 的 PNG，再复用既有粘贴图片校验、统计与 20 MiB 预算；失败时降级并警告。
6. Markdown 继续复用 Turndown/GFM 的 fenced code 规则；补充 `mermaid` 语言与反引号冲突回归。

## Test Plan

- 单元：源码容器、`language-mermaid`、空容器、渲染 SVG、恶意 SVG/script、多个图表、普通代码块零回归。
- 浏览器：本地动态 fixture 将空 `.mermaid` 替换为 SVG；确认截图后 HTML 不含 SVG、可信资源映射只含栅格图；超尺寸、失败、取消和资源关闭。
- 编排：正文足够但含 Mermaid 仍启动浏览器；源码输出 fence；链接截图和粘贴栅格图均计入图片统计和预算；浏览器失败或粘贴 SVG 无法安全栅格化时显示明确警告。
- 回归：Node.js 24 `./init.sh`、三浏览器 E2E；真实 WalkingLabs 页面只作为联网验收，不进入日常单元测试。
- 交付：生成独立于 0.1.x 的 0.2.0 Apple Silicon 测试包，并在真实应用窗口检查链接和富文本两种路径。

## Non-goals

- 不从任意站点的 JavaScript bundle 逆向恢复 Mermaid 源码。
- 不把原始 SVG 或 Canvas 写入 Markdown。
- 不新增 Mermaid.js、预览渲染器、AI、Cookie、登录态或第三方代理。
- 不扩展到 PlantUML、Graphviz、数学公式或其他图表语法。
- 不修改 0.1.3 封版提交、标签、归档和历史 ZIP。

## Completion Criteria

- 三个公共 seam 均有先 RED 后 GREEN 的自动化证据。
- WalkingLabs 样本不再静默丢图：至少输出安全栅格图；失败时必须有明确警告。
- 富文本源码可生成 fenced `mermaid`；仅渲染 Mermaid SVG 可生成安全 PNG，无法转换时明确降级，且无原始 SVG/脚本泄漏。
- `./init.sh`、三浏览器 E2E、真实样本验证、打包应用冒烟和真实窗口验收通过。
- `feature_list.json`、`PROGRESS.md`、`session-handoff.md`、产品/架构/测试/质检和 Changelog 同步。
