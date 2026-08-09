# Plan — v0.2 富文本粘贴转换（feat-012）

- Status: **approved 2026-08-06；reviewed and amended 2026-08-09**（用户确认：data: URI 经校验处理后内嵌 / 来源可选填 / 复用 Turndown / 尊重复制范围 / HTML 与纯文本双通道 / 编辑后降级纯文本 / 扩大语义门控 / 无标题使用正文首行 / 接受登录态图片限制 / live 仅作发布门禁）
- Version target: `0.2.0`
- Author date: 2026-08-06
- Predecessor: 0.1.3 个人 Mac 基线（`ce041c9`）

## 1. 背景与动机

0.1.x 只接受公开 HTTP/HTTPS 链接。实测中，需要登录、付费墙、验证码或反爬拦截的网页无法通过 URL 抓取转换，这是当前产品最大的可用性缺口。

v0.2 采用折衷方案：**用户在有权限的浏览器中手动复制网页富文本，粘贴到应用内转换为 Markdown**。应用不绕过任何访问限制，只处理用户主动提供的剪贴板内容。参考实现为 MiaoYan（`/Users/huanghaohai/Downloads/MiaoYan-main.zip`，`Helpers/HtmlToMarkdown.swift` + `MiaoYanTests/HtmlToMarkdownTests.swift`）。

## 2. 目标

- 用户在「富文本转换」模式粘贴带格式的网页内容（`text/html`），可转换为与链接模式同规格的 Markdown 文件（标题、统计、预览、复制、下载）。
- 粘贴内容同时保留剪贴板 `text/html` 与 `text/plain`：检测到受支持的语义结构时按 HTML 转换；只有无语义包装时才使用权威纯文本，避免垃圾输出又不丢失普通文章的段落、链接和图片。
- 粘贴内容中的远程图片沿用现有 SSRF 防护下载内嵌；`data:` URI 不发起网络请求，但仍须解码、校验实际格式并执行现有尺寸、压缩和预算规则后才能内嵌。
- 输出复用现有预算规则：30 图 / 单图 8 MiB / 最终 20 MiB / 正文优先降级。

## 3. 非目标

- 不恢复 Windows、多平台迁移（用户 2026-07-21 取消，未重新授权）。
- 不绕过登录、付费墙、验证码或访问限制；不自动抓取受保护页面。
- 不支持粘贴图片文件（二进制）、PDF、音视频等非 HTML 剪贴板类型。
- 不对粘贴内容做 Readability 二次正文提取：尊重用户复制的范围，仅做标签清洗与结构门控。
- 不新增 AI 能力、账号、历史记录或云同步。
- **不引入第三方代理抓取通道（如 Jina Reader 等 `r.jina.ai` 类服务）**：网页内容经第三方服务器违反本产品隐私承诺（"本机处理 · 内容不上传第三方"），且此类服务对登录墙/付费墙无效。**该事项作为后续迭代讨论项保留**，触发条件与评估见第 13 节。

## 4. MiaoYan 能力盘点与采用矩阵

### 4.1 MiaoYan 实现要点（已读源码确认）

| 能力 | 实现方式 |
|---|---|
| 结构门控 | `convertIfStructured()`：HTML 含 `<h1-6/table/ul/ol/blockquote/pre>` 才转 MD，否则返回 nil，纯文本粘贴保持权威 |
| 容错解析 | Foundation `XMLDocument` + `.documentTidyHTML`，无第三方依赖 |
| UTF-8 声明 | 显式声明 charset，规避 Tidy 默认 Latin-1 导致的中文乱码 |
| 清洗 | 丢弃 `script/style/head/meta/link/title/svg/button/nav`；未知标签透传子节点（lossy by design） |
| 块级 | 标题→`#`；`hr`→`---`；引用→`>`；`pre`→围栏代码块（提取 `language-*`、反引号冲突加长围栏）；列表→嵌套缩进、块元素保持文档顺序；表格→GFM（列补齐、`\|` 转义、无表头用首行） |
| 行内 | `strong/em/del/code/a/img` 标准 GFM；`br`→换行；行内 code 处理边界反引号；`data:` 图片丢弃 |
| 文本 | 空白规范化；空行折叠但保留代码围栏内空行 |
| 测试 | 21 项：结构门控、块/行内、CJK 回归（Chrome 短 charset 声明、Safari 裸片段）、表格转义、代码块空行、列表内代码顺序 |

### 4.2 采用决策（针对本项目 TypeScript 栈）

本项目已有 **Turndown + turndown-plugin-gfm + jsdom + DOMPurify**（0.1.x 生产验证）。不重复实现手写转换器，按以下矩阵移植：

| MiaoYan 能力 | 采用方式 | 理由 |
|---|---|---|
| 结构门控 | **采纳目标，调整实现**：基于解析后的 DOM 识别强结构、富文本信号与多段落 | 避免字符串误判，同时保留普通文章的链接、格式和图片 |
| 纯文本降级 | **采纳** | 剪贴板无 HTML 或 HTML 无结构时按纯文本转换 |
| Tidy 容错解析 | **不移植**，用现有 jsdom 解析 | JS 字符串天然 UTF-8，无 Tidy 编码问题 |
| 标签清洗 | **采纳规则，独立配置**：新增粘贴模式净化器，不修改链接模式私有实现 | 只定向保留 lazy 图片属性，保证 0.1.3 行为零变化 |
| 块级/行内渲染 | **复用 Turndown + GFM** | 现有依赖，0.1.x 验证；必要时为 `div`→段落补充 custom rule |
| 细节正确性规格 | **转测试金标准**：移植 MiaoYan 21 项用例语义，验证 Turndown 输出等价 | 以测试固化规格 |
| `data:` 图片丢弃 | **偏离，改为校验处理后内嵌** | 不发起网络请求，但仍执行实际格式、尺寸、压缩和预算规则 |
| 远程图片 | **复用现有 `embedImages` 管线**（含 SSRF 防护） | 关键安全差异：MiaoYan 不联网，本项目粘贴内容含远程图 URL 时必须走 `fetchPublicResource` 白名单校验 |

## 5. 方案设计

### 5.1 新增 API 端点

`POST /api/convert-paste`

- 请求：`application/json`，`{ "html"?: string, "text"?: string, "sourceUrl"?: string }`；`html` 与 `text` 至少一个非空。原始请求体（包含 JSON 开销）上限 **5 MiB**，既检查声明的 Content-Length，也使用有上限的读取过程验证实际 UTF-8 字节数，不能只信任请求头。
- 鉴权：复用 `validateConvertApiCaller`（回环 Host、同源、令牌、Content-Type）。
- 限流：复用 `acquireConversionSlot`；总时限 45 秒沿用。
- `sourceUrl` 为空时省略来源行；非空时只接受无凭据 HTTP/HTTPS URL。它只用于来源展示和相对链接/图片解析，不主动抓取来源页面。
- 响应：与 `ConvertResponse` 同结构，`meta.extractionMode = "paste"`；`meta.sourceUrl` 允许空字符串。
- 错误码沿用 `400/403/413/422/429/502/504`。

### 5.2 新增服务端模块 `src/lib/paste.ts`

- `detectStructuredHtml(html): boolean`：基于解析后的 DOM 判断语义，不对原字符串做宽泛正则匹配。以下任一条件成立即使用 HTML：
  - 强结构：`h1-h6/table/ul/ol/blockquote/pre/img`；
  - 富文本信号：有效链接、粗体、斜体、删除线、行内代码；
  - 至少两个正文段落。
  单个仅含普通文字的 `<p>` 以及只有 `div/span/font` 的无语义包装不触发，保留 MiaoYan 的 `an ultimate ulterior plan` 反例。
- `preparePastedContent({ html?, text? }): { mode: "html" | "text"; html: string; text: string; title: string; textLength: number }`：
  1. 解析完整 HTML，在丢弃 `<head>` 前按 `<title>` → `og:title` → 第一个 `h1` 提取标题；
  2. 无上述标题时取权威纯文本第一行有效内容并规范化，仍无标题时使用显示标题 `"粘贴内容"`；
  3. 取 `body` 后使用**粘贴模式独立净化配置**，不修改 0.1.3 链接模式的私有 `sanitizeHtml`；禁用任意 `data-*`，但显式保留图片处理需要的 `data-src` 与 `data-lazy-src`，并保留 `src/alt`；
  4. 有语义结构时返回净化 HTML；否则使用请求中的 `text` 作为权威纯文本，保留换行并 trim；
  5. `textLength` 按最终选中的正文文本计算。
- 若正文为空且只包含无法使用的资源，返回 `422 NO_USABLE_CONTENT`。无有效标题时，下载文件名使用 `粘贴内容-时间戳.md`，避免反复下载同名文件。

### 5.3 转换与输出头部（扩展 `src/lib/markdown.ts`）

- 新增粘贴模式 Markdown 渲染入口，接收区分后的 HTML 或纯文本内容；HTML 复用 Turndown 配置（atx / `-` / fenced / `*` / `**` / inlined + GFM），纯文本路径保留用户换行并转义会改变字面含义的 Markdown 控制字符。
- 头部规则（与链接模式对齐）：
  - `# 标题`
  - `> 转换时间：…`
  - 来源行：**默认省略**；若 API 同时收到可选 `sourceUrl`（用户填写或剪贴板自带）则输出 `> 来源：[url](url)`。
- 链接模式现有函数与行为不变。
- 粘贴正文首个 `h1` 与输出标题相同时沿用现有去重规则。无 `sourceUrl` 时只保留绝对 HTTP/HTTPS 链接；相对链接降级为普通文本。有 `sourceUrl` 时安全解析相对链接。

### 5.4 图片策略（改造 `src/lib/images.ts`）

**关键前提——懒加载图片在剪贴板中的形态**：浏览器复制网页时，剪贴板 HTML 是当前 DOM 快照。懒加载图（微信 `data-src` 模式、`loading="lazy"` 未加载等）的 `src` 常为占位符（典型 1×1 透明 gif 的 `data:` URI），真实地址在 `data-src` / `data-lazy-src` 属性中。若沿用链接模式「`src` 优先」取源，会把占位图当正文内嵌、丢失真图。

**粘贴模式取源优先级（与链接模式相反）**：`data-src` → `data-lazy-src` → `src`，通过给 `prepareImage` 增加策略参数（如 `sourcePriority: "src-first" | "lazy-first"`）区分两种模式；**链接模式保持现状不变**（微信路径已由 `extract.ts` 提升 `data-src`→`src`）。

具体规则（粘贴模式）：

| 图片源形态 | 处理 |
|---|---|
| 有 `data-src`/`data-lazy-src`，值为 http(s) | 走 `fetchPublicResource` 下载内嵌（SSRF + 8 MiB + 类型校验），失败 → 替代文本 + 警告，不回退到占位 `src` |
| 有 `data-src`/`data-lazy-src`，值为 `data:` | 校验格式后保留内嵌 |
| 有 `data-src`/`data-lazy-src`，其他值 | 替代文本 + 警告 |
| 无懒加载源，`src` 为 http(s) | 走下载管线（同现有行为） |
| 无懒加载源，`src` 为 `data:` | 校验格式后保留内嵌；**解码后 < 1 KiB 判定为占位图 → 替代文本 + 警告**（提示「图片未在浏览器中加载，请滚动到图片位置后重新复制」） |
| 无 `src` 或非法协议（`file:` 等） | 替代文本 + 警告 |

其他策略：

- `data:` URI 图片：粘贴模式允许 `data:image/(png\|jpeg\|webp\|gif\|avif);base64,`，但不能只检查前缀或原样透传。必须严格解码 Base64、按解码字节数执行 8 MiB 上限、用 Sharp 校验实际格式与元数据，并执行 2 MiB / 2048px / 动图首帧规则后重新生成规范 Data URI。**该变更仅作用于粘贴模式**，链接模式 data: 行为保持现状。
- 预算：30 图上限、单图 8 MiB（data: URI 按解码后字节数计）、20 MiB 降级逻辑全部沿用。
- `sourceUrl` 为空时不得把空字符串传给 JSDOM URL 或 `new URL(relative, base)`；绝对公网 HTTP/HTTPS 图片正常处理，相对图片降级为替代文本并给出明确警告。
- 图片管线使用显式的区分联合参数（链接模式 `src-first` / 粘贴模式 `lazy-first + data-uri`），两个调用方都必须指定模式，禁止依赖容易误用的默认值。
- 已知边界（文档说明）：原生 `loading="lazy"` 且尚未加载的图片，剪贴板中不存在真实 URL，无法恢复；登录态、临时签名、`blob:` 或需要 Cookie 的远程图片也可能无法由应用重新获取。上述情况保留替代文本并提示用户滚动加载或接受图片省略。

### 5.5 前端 UI（扩展 `src/app/page.tsx` + CSS）

- 双模式 Tab：「链接转换」（现状）与「富文本转换」（新增）。
- 富文本模式：`textarea`；`onPaste` 同时读取 `event.clipboardData.getData("text/html")` 与 `text/plain`，textarea 展示纯文本，内部单独保存 HTML。
  - 有 HTML → 状态提示「已识别富文本内容（约 N 字符），将转换为 Markdown」；
  - 无 HTML 只有文本 → 提示「未检测到富文本格式，将按纯文本转换」；
  - 可选来源 URL 输入框（空则省略来源行）。
- 用户手工编辑 textarea 后立即丢弃此前捕获的 HTML，并提示「内容已修改，将按纯文本转换」；再次粘贴时整体替换当前内容与 HTML，不尝试合并多个富文本片段。
- 两个模式分别保留各自输入；切换模式会清空结果和错误状态。转换中禁用模式切换，用户可先停止后切换。
- 转换中可停止（图片下载可中止，复用 AbortController）；结果区完全复用现有统计/复制/下载/预览/警告组件。
- 提交体：`{ html?, text, sourceUrl? }`，前端按实际 UTF-8 JSON 字节数拦截超过 5 MiB 的内容并提示；服务端独立重复校验。

### 5.6 类型与统计

`src/types/conversion.ts`：

- `ExtractionMode` 增加 `"paste"`。
- `ConvertResponse.meta.sourceUrl` 语义放宽为「可为空」；`textChars` 沿用正文文本长度。
- 图片统计语义不变（源图/内嵌/省略），data: URI 计入内嵌。

## 6. 安全边界（粘贴模式）

- 剪贴板 HTML 视为不可信输入：粘贴模式独立 DOMPurify 清洗（禁 script/style/iframe/object/embed/form/svg/math + `button/nav`，禁 style/srcdoc 与事件属性）；只显式保留图片管线需要的两个 lazy data 属性，不开放任意 `data-*`。
- 远程图片 URL 必须经 `fetchPublicResource`（协议/IP/DNS 校验，拒绝本机、私网、链路本地、云元数据地址）——防止恶意网页诱导用户复制含内网图片的 HTML 后借应用探测内网。
- `data:` URI 无网络请求，允许；`file:`、`javascript:` 等协议一律拒绝。
- Markdown 预览安全策略不变（只放行应用生成的栅格图 Data URI）。
- 粘贴请求体上限 5 MiB；路由同时校验 Content-Length 和实际有界读取字节数，字段解析后再验证类型与至少一个非空内容字段。
- 不新增日志字段；诊断日志仍不含正文。

## 7. 测试计划

### 7.1 单元测试（新增/扩展）

- `src/lib/paste.test.ts`：强结构/富文本信号/多段落门控与负例（含 MiaoYan 的「`<p>an ultimate ulterior plan</p>` 不触发」回归）、标题提取顺序与首行回退、净化、lazy 属性定向保留、权威纯文本降级。
- `src/lib/markdown.test.ts`：金标准移植——标题/段落、有序+嵌套无序列表、引用、代码围栏（含 language 类与反引号冲突）、GFM 表格（含 `\|` 转义、无表头）、`hr`、行内混合、链接（含锚点链接去链接）、data: 图片保留、script/style 丢弃、空白折叠、实体解码、CJK 全流程、代码块内空行保留、列表内代码顺序。
- `src/lib/images.test.ts`：data: URI 严格解码、实际格式与元数据验证、8 MiB/2 MiB/2048px/动图规则、非法 data/file/blob 拒绝、预算计入、**懒加载取源优先级（data-src/lazy-src 优先于占位 src）**、占位 data: 图（< 1 KiB）降级、无 base 时绝对图成功/相对图降级、链接模式 data: 行为回归不变。
- `src/app/api/convert-paste/route.test.ts`：鉴权、声明与实际请求体超限 413、html/text 均缺失 400、纯文本降级、sourceUrl 校验、`extractionMode === "paste"`。
- `src/lib/convert-paste-orchestration.test.ts`（或并入 route）：编排、图片降级、超时。

### 7.2 安全测试

- 粘贴 HTML 含内网图片 URL（`http://127.0.0.1/…`、`http://192.168.0.1/…`、云元数据地址）→ 拒绝/替代文本。
- `file:` 图片 → 替代文本 + 警告。
- DOMPurify 清洗回归（script/style 不进入输出）。

### 7.3 E2E（三浏览器）

- 富文本 Tab 粘贴（Playwright 注入 `clipboardData` 模拟 `text/html`）→ 转换 → 统计正确 → 复制/下载可用。
- 纯文本粘贴 → 降级转换提示可见。
- 超过 5 MiB 粘贴 → 前端/服务端 413 提示。
- 停止转换保留输入内容。
- 富文本粘贴后编辑 → 明确降级纯文本；再次粘贴整体替换；来源 URL 为空和有效两种输出头部。

### 7.4 发布门禁

里程碑门禁统一为：T5 运行 `./init.sh`；T8 运行 `./init.sh` + 三浏览器 `npm run test:e2e`；只有 T10 运行包含 live 的 `npm run desktop:release`。发布流程在 Node.js 24.x 下通过且版本号为 `0.2.0`。真实打包窗口人工验收：链接模式回归 + 富文本模式全流程。

## 8. 交付物清单（文档同步）

- `docs/PRODUCT.md`：支持范围加入「富文本粘贴」，非目标同步调整。
- `docs/ARCHITECTURE.md`：新增 `/api/convert-paste` 契约、粘贴管线、安全边界。
- `docs/TESTING.md`：新增粘贴模式的测试与验收步骤。
- `docs/QUALITY-AUDIT.md`：追加 v0.2 审计轮次（如适用）。
- `README.md`：使用说明（两种模式）。
- `CHANGELOG.md`：`[Unreleased]` 记录。
- `feature_list.json`：`feat-012` 状态与证据。
- `PROGRESS.md` / `session-handoff.md`：状态与交接更新。

## 9. 任务分解

- **任务级事实源见独立文件 `docs/TASKS-V0.2.md`**（Harness：PLAN 与 TASK 分离）。本 PLAN 只保留方案，不承载任务状态。
- 任务序列：`T3 → T4 → T5 → T6A → T6B → T7A → T7B → T8 → T9A → T9B → T10`（依赖关系与每个 Task 的边界/完成条件/验证证据见 TASKS 文件）。
- 执行规则：一次只推进一个 `in-progress` Task；所有代码 Task 遵循 TDD（RED → GREEN → REFACTOR），先写失败测试再实现。

## 10. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 剪贴板 HTML 来源多样，质量参差 | 结构门控降级纯文本；金标准测试固化常见来源行为 |
| 懒加载图 `src` 为占位符，真图在 `data-src` | 粘贴模式取源优先级反转为 lazy-first；占位 data: 图（< 1 KiB）降级替代文本并提示重新复制 |
| 原生 `loading="lazy"` 未加载图无真实 URL | 文档说明限制，提示滚动加载后重新复制 |
| Turndown 对 div 包裹文本段落感弱 | 金标准对照，必要时补充 custom rule（div→段落） |
| data: URI 大图挤占 20 MiB 预算 | 按解码字节数计入，沿用末图降级 |
| 恶意 HTML 诱导内网图片请求 | 远程图强制走 SSRF 防护管线 |
| 富文本显示内容被用户编辑后仍提交旧 HTML | 首次手工编辑立即丢弃 HTML，并把状态切换为纯文本 |
| 登录态/临时图片地址没有可复用 Cookie | 明确作为已知限制；失败时替代文本 + 警告，不引入 Cookie 读取 |
| 只有段落/链接/图片的普通文章被错误降级 | 使用 DOM 语义门控：强结构、富文本信号或多段落均可进入 HTML 路径 |
| 与链接模式行为漂移 | 头部规则/统计口径共用同一实现与测试；图片管线用策略参数隔离两种模式，链接模式零改动 |
| **v0.2 构建破坏 0.1.3 正式产物/功能** | 见第 12 节「版本隔离与 0.1 正式版保护」 |

## 11. 完成条件（Definition of Done）

- 富文本粘贴转换全流程（粘贴→转换→预览→复制→下载）在打包应用中可用。
- DOM 语义门控、HTML/text 降级、data: URI 完整图片处理和 SSRF 图片拒绝均有自动化测试证据。
- 三浏览器 E2E、覆盖率门禁、`desktop:release` 在 Node.js 24.x 全通过，版本 `0.2.0`。
- 上述 8 项交付物文档全部同步，feature_list.json 记录验证证据。
- 链接模式 0.1.x 行为回归通过（头部、图片、统计不变）。
- 0.1.3 正式产物未被覆盖或删除，其 SHA-256 与归档记录一致（见第 12 节）。

## 12. 版本隔离与 0.1 正式版保护

0.1.3 已作为正式版本交付验收（第二台 Mac 验收、SHA-256 固定），v0.2 开发不得以任何方式破坏它。

- **正式产物归档**：0.1.3 ZIP（`239,281,512` bytes）已归档于 `~/Downloads/MD-Convertor-0.1.3-release/`，SHA-256 `66909aa8759ec41fdde875204773958d32b33a2c903e7b4eb0858a50fb1bdf89`。该副本只读，作为 v0.2 期间的可复现正式版基准。
- **版本号隔离**：v0.2 分支建立时即把 `package.json` 与锁文件版本号改为 `0.2.0`，不得等到发布阶段才修改；Forge 输出文件名带版本号（`MD-Convertor-darwin-arm64-0.2.0.zip`），与 0.1.x ZIP 天然不冲突。`out/make/zip/darwin/arm64/` 下历史 ZIP（0.1.0–0.1.3）一律不得删除、覆盖或修改。
- **`.app` 目录覆盖**：`out/MD-Convertor-darwin-arm64/MD-Convertor.app` 会被 Forge 重建覆盖，属预期行为；正式版恢复以归档 ZIP 为准，不依赖 `out/` 下的 `.app`。
- **源码可复现**：0.1.3 源码基线为 git 提交 `ce041c9`，并以 Git 标签 `v0.1.3` 固定；v0.2 只在 `codex/feat-012-v0.2` 分支开发，完整验收并经用户确认前不得合并到 `main`。
- **回归门禁**：T5 运行 `./init.sh`，T8 追加完整三浏览器 E2E，T10 执行包含真实网页 live 的完整发布门禁；0.1.3 既有 93 tests 与 21 项链接模式 E2E 必须始终作为扩展后测试集的一部分保持通过。任何破坏 0.1.3 行为或产物的变更不得进入 `main`。
- **自动封版校验**：T10 前扩展发布 guard，自动验证 `main` 与 `v0.1.3^{}` 仍为 `ce041c9`、外部只读归档存在且 SHA-256 为固定值，并在打包前后核对 0.1.x ZIP 哈希不变。

## 13. 技术选型评估：Agent-Reach 与第三方抓取通道（2026-08-07）

### 背景

用户提供开源项目 Agent-Reach（github.com/Panniantong/agent-reach，MIT，370 commits）并询问：能否借鉴其"通过 Jina 或其他形式获取受限网站信息"的实现方式。已读源码（`channels/web.py`、`channels/twitter.py`、`backends/opencli.py`）、两份本地分析报告，并核对 GitHub 原仓库最新状态。

### 结论：v0.2 不引入；Jina 保留为后续迭代讨论项（用户保留意见）

维持 v0.2 既定方案（用户手动复制富文本 → 粘贴 → 转换）。理由：

1. **Jina Reader（`GET https://r.jina.ai/<URL>`）对登录墙/付费墙无效**——它没有用户登录态，Agent-Reach 自己的平台表也承认 X/小红书/Reddit/Facebook/Instagram 全部必须依赖用户登录态（OpenCLI 复用浏览器会话 / Cookie-Editor 导出）。它只能解决 403 反爬与 JS 渲染（后者本产品已有 Playwright 兜底）。
2. **隐私硬冲突**：内容先经第三方服务器，违背本产品"本机处理 · 内容不上传第三方"的承诺与 UI 卖点。
3. **破坏图片内嵌**：Jina 返回 Markdown 文本，拿不到原始 HTML，Base64 内嵌 30 图 / 20 MiB 预算管线全部失效。
4. **登录态路线（OpenCLI/Cookie）越过 v0.2 非目标**：应用直接操作浏览器会话，安全边界复杂（防恶意页面借通道访问用户浏览器内其他站点），存在账号/封号风险（Agent-Reach 自身建议专用小号）。

### 可借鉴工程模式（后续设计吸收，不改变 v0.2 边界）

| 模式 | Agent-Reach 实现 | 本产品落地建议 |
|---|---|---|
| 多后端降级路由 | 有序候选列表 + 两段式 check（先全收集、第一个 ok 获胜、无 ok 取 warn） | v0.2 图片取源优先级（lazy-first）已应用同类思想；未来任何"可选抓取通道"用此骨架 |
| 能力探测三段式 | `--version` 快路径 → loopback status → 磁盘证据；区分 missing/broken/ok | 打包应用健康检查（Playwright/Sharp 可用性）可参考 |
| 故障隔离 | 单渠道异常降级为 error 条目，不拖垮整体报告 | warnings 数组结构化分级可参考 |
| 最小权限凭据 | cookie 字段白名单 + 子进程注入 + 配置防 symlink + 原子写 | 未来凭据功能的强制安全基线 |
| 只读观察纪律 | 体检绝不跑有副作用命令 | 冒烟/健康检查纪律可参考 |

### Jina 讨论项的触发条件（后续迭代）

若用户重新评估并希望覆盖"公开但反爬严格"（如 403）场景，讨论要点：

- 隐私取舍：是否接受"用户显式开启的可选 Jina 通道（默认关，开启时明确告知内容经第三方）"？需要重新授权修改隐私承诺与非目标。
- 架构：Jina 通道在现有 SSRF 防护体系中的位置（代理抓取外包后，SSRF 风险转移给第三方；本地仍需校验用户提供的 URL）。
- 替代顺序：先确认 Playwright 兜底对目标站点的实际失败模式，再判断 Jina 是否真有增量价值。
- 图片：Jina 返回 Markdown 无原始 HTML，需明确图片内嵌在 Jina 通道下的降级策略。
