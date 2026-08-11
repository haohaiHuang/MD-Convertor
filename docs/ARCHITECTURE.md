# Architecture

## 运行形态

第一阶段是 Apple Silicon Mac 桌面应用。Electron 提供原生窗口并在应用启动时创建仅监听 `127.0.0.1` 随机端口的 Next.js 本地服务；界面和 `POST /api/convert`、`POST /api/convert-paste` 只在本机通信，不需要公网服务器、域名或 Docker。

Electron 渲染进程启用沙箱与上下文隔离，关闭 Node.js 集成。应用每次启动生成 256 位随机会话令牌，由 Electron 网络层自动附加到本地请求，令牌不暴露给页面脚本。应用内导航限制在本地服务源，正文中的 HTTP/HTTPS 链接交由系统默认浏览器打开。

## 本地接口契约

界面通过同源 `POST /api/convert` 发送 `{ "url": string }`，或通过同源 `POST /api/convert-paste` 发送 `{ "html"?: string, "text"?: string, "sourceUrl"?: string }`。粘贴请求至少包含一个非空的 `html`/`text`；原始 JSON 请求体（包括 JSON 开销）最多 5 MiB，前端和服务端都按 UTF-8 字节数校验。`sourceUrl` 可为空；非空时只接受无凭据的 HTTP/HTTPS URL，用于来源展示以及解析相对链接/图片，不会触发来源网页抓取。

两个接口只供应用本机界面和测试使用，不是对外集成 API。生产环境要求 `application/json`、回环 Host、同源 Origin / `Sec-Fetch-Site` 和本次启动的会话令牌；缺少或错误令牌均拒绝。成功响应的 TypeScript 事实源为 `src/types/conversion.ts`，包含：

- `title`、`filename`、`markdown` 和 `warnings`。
- `meta.sourceUrl`、`convertedAt`、`extractionMode` 和 `outputBytes`；粘贴模式的 `sourceUrl` 可以是空字符串，`extractionMode` 为 `paste`。
- `meta.textChars`、`sourceImageCount`、`embeddedImageCount` 和 `omittedImageCount`。

错误状态固定使用 `400`、`403`、`413`、`422`、`429`、`502` 或 `504`，正文为简体中文错误信息。客户端主动停止在服务端内部记录为 `499 CLIENT_ABORTED`，浏览器端仍按“已停止转换”处理；服务端总时限使用 `504 CONVERSION_TIMEOUT`。技术提取模式保留在接口和诊断日志中，不在普通用户结果区展示。

## 转换管线

链接模式：

1. 校验 URL、协议、凭据、DNS 与公网 IP。
2. 固定已验证 IP 直接抓取 HTML；重定向逐跳重新校验。
3. 使用 JSDOM、Mozilla Readability 与 DOMPurify 提取并净化正文；微信公众号优先使用 `#js_content`，并在净化前把懒加载图片的 `data-src` 规范化为 `src`。
4. 直接结果不足 300 字符，或 HTML 含空 Mermaid 占位/仅渲染图信号时，使用 Playwright Chromium 渲染后重新提取。可见 Mermaid 图表截图为 PNG，并替换成请求内不可预测的可信占位 URL；仅当浏览器正文完整度足够时采用该结果。
5. 在正文提取前识别微信公众号验证页、删除页等访问拦截，避免将提示文案误判为文章。
6. 仍无正文时转换净化后的 `body`；少于 50 字符则失败。

富文本粘贴模式：

1. 接收用户主动复制的 `text/html` 与 `text/plain` 快照；先从完整 HTML 提取标题，再净化 `body`。
2. 通过 DOM 语义门控选择 HTML 或权威纯文本：强结构、有效富文本信号或至少两个正文段落走 HTML，否则使用请求中的纯文本。编辑后的内容由前端只提交纯文本。
3. 粘贴模式使用独立 DOMPurify 规则，移除脚本、样式、嵌入、表单、导航和事件属性，只定向保留图片所需的 `data-src`/`data-lazy-src`、`src` 与 `alt`。
4. 按 `data-src` → `data-lazy-src` → `src` 的 lazy-first 顺序处理图片；远程 HTTP(S) 图片复用 SSRF 安全下载，合规 `data:` 图片严格解码、用 Sharp 校验实际格式并按预算优化。粘贴模式不重新抓取来源网页。
5. Mermaid 源码在净化前规范化为 `code.language-mermaid`；仅有 Mermaid SVG 渲染结果时不启动浏览器执行粘贴内容，而是先移除脚本、事件、外部资源、`<style>`/内联 `style` 和危险属性，把 `foreignObject` 标签降为纯 SVG 文本，并写入固定浅色节点/连线/文字后由 Sharp 转为最长边不超过 2048px 的 PNG。超过 1 MiB、无有效尺寸/可见图元、超过 30 张或转换失败时返回占位、警告并计入省略统计；Canvas 仍只降级。

两种模式随后共用：

1. 最多四路并发下载、校验和优化图片，支持 JPEG、PNG、WebP、GIF、AVIF；超大或超尺寸图片转为 WebP。浏览器生成的 Mermaid PNG 只能通过本次转换的内存映射进入该管线；粘贴 Mermaid PNG 由本机清洗/栅格化后作为严格 Data URI 重新校验，网页自己的链接模式 Data URI 仍被拒绝。
2. 使用 Turndown/GFM 生成 Markdown；Mermaid 源码输出 fenced `mermaid`。若结果超过 20 MiB，从末张内嵌图片开始逐张降级，直到满足预算。纯正文自身超限才返回 `413 OUTPUT_TOO_LARGE`。
3. 返回文件字节数、正文字符数、源图片数、内嵌图片数、省略图片数及诊断用提取模式。

## 本地安全边界

- 本地服务只绑定 `127.0.0.1` 和系统分配的随机端口，不监听局域网或公网地址。
- 仅允许 HTTP/HTTPS，拒绝 URL 凭据、本机、私网、链路本地、保留地址与云元数据地址，避免目标网页借应用访问本机或局域网资源。
- 页面、每次重定向、动态页面子资源和图片均执行相同检查。Chromium 的 HTTP/HTTPS 流量必须经过一次性回环代理：每个 HTTP 请求或 HTTPS CONNECT 隧道都重新校验目标，并直接连接校验所得 IP，禁止 Chromium 在校验后再次解析域名。
- HTML 解压后最多 5 MiB；该限制也适用于动态渲染完成后序列化的 DOM，不等同于浏览器网络流量预算。单图最多 8 MiB，最多 30 张图，单次转换最多 45 秒。
- 每次动态浏览器回退最多代理 100 个 HTTP/CONNECT 请求，代理累计传输最多 50 MiB，单个 CONNECT 隧道最多 25 MiB。已声明 `Content-Length` 的超限 HTTP 响应在转发前拒绝，流式响应与加密隧道在累计超限时立即关闭；并发子资源共享同一预算。
- 动态浏览器上下文及其安全代理按请求创建并销毁，禁止下载，阻止媒体、字体、Google Fonts 样式表与 WebSocket 升级；页面自身样式表仍保留，以维持图表截图布局。
- 直接请求和动态浏览器使用一致的桌面 Chrome User-Agent，避免应用自定义标识触发站点的非浏览器拦截。
- 粘贴 HTML 是不可信剪贴板输入：Mermaid SVG 先经过专用白名单清洗并在本机栅格化，随后通用净化仍禁止 `script/style/iframe/object/embed/form/svg/math`、事件属性、`style`/`srcdoc` 和任意 `data-*`；`file:`、`javascript:`、`blob:` 等图片协议不发起请求。
- 粘贴请求的 5 MiB 限制同时检查声明的 `Content-Length` 和有界流实际字节数；鉴权、限流和请求体读取顺序保证未授权或超限请求不会进入转换管线。粘贴模式服务端总时限为 45 秒，客户端停止记录为 `499 CLIENT_ABORTED`。
- 登录态、临时签名、`blob:` 或需要 Cookie 的图片可能无法从剪贴板重新获取；此时保留替代文本并给出警告，不读取 Cookie，也不把限制升级为绕过访问控制。
- Markdown 预览不解析原始 HTML，只允许应用生成的栅格图片 Data URI；fenced Mermaid 只按代码显示，不在应用内执行渲染。
- 客户端停止转换时中止同源请求；请求信号继续传入直连抓取、动态浏览器和图片请求，及时释放本地资源。

## 数据与日志

应用代码不使用数据库、对象存储、Cookie、LocalStorage 或转换历史。剪贴板 HTML/纯文本、来源 URL 和转换结果只在当前本地请求中使用；结构化诊断日志不包含 URL、页面正文、粘贴 HTML 或图片。Electron 与 Chromium 会按运行时默认行为在本机创建缓存、偏好设置和临时浏览器数据；这些数据不用于恢复或同步转换结果，用户主动保存的 `.md` 文件不属于应用持久化数据。

## 构建与分发

- 使用 Electron Forge 生成 `darwin/arm64` 应用包和 ZIP 分发文件。
- 开发入口为 `npm run dev:desktop`。
- 本地应用目录构建为 `npm run desktop:package`；分发 ZIP 构建为 `npm run desktop:make`。
- 日常基线包含合成网页与固定 Markdown 的精确金标准测试；`npm run test:live` 以稳定 WalkingLabs 样本验证链接/粘贴 Mermaid，只作为发布前阻断门禁。微信公众号真实对照保留为 `npm run test:live:wechat`，但因上游验证与超时波动不阻断个人测试包发布。
- `./init.sh` 与发布脚本只接受 Node.js 24.x。v0.2 发布脚本还要求目标版本严格为 `0.2.0`，并在任何 `init.sh`、E2E、live 或 Forge 命令前校验 `main`/`v0.1.3^{}` 的固定提交、外部只读 0.1.3 归档和 0.1.0–0.1.3 四个历史 ZIP 的固定文件名与 SHA-256；命令成功或后续失败都会再次复核历史清单。`npm run desktop:release` 随后依次执行完整基线、Chromium/Firefox/WebKit E2E、真实网页门禁与 Apple Silicon ZIP 打包，并强制验证 ZIP 是本轮新产物、解压后包内应用版本为当前版本、包内可执行文件为 arm64且结构完整，最后输出大小与 SHA-256。
- E2E 使用 production standalone 服务；执行器会比较测试前后的 tracked diff，发现测试修改源码或项目文档时直接失败。
- 完整命令矩阵、环境变量、打包冒烟和人工验收步骤见 `docs/TESTING.md`。
- 第一阶段产物可不签名，仅用于开发和个人测试；对外分发前必须补充 Apple Developer ID 签名与 notarization。
- v0.2 产物仍只面向 Apple Silicon Mac 个人测试；T10 完成前不宣称已生成或验收新的 0.2.0 ZIP，0.1.3 正式 ZIP 和四个历史 ZIP 作为不可变回归基准。
- 第二台 Mac 验收确认未签名应用可能被 Gatekeeper 显示为“文件已经损坏”；个人测试时应先核对 ZIP SHA-256，再只移除 `com.apple.quarantine` 属性。该处理不等同于签名或 notarization，不扩大分发范围。
- 打包准备脚本把当前 Playwright 版本对应的 Apple Silicon Chromium Headless Shell 放入应用资源，并通过明确的可执行路径启动，避免依赖用户电脑上的浏览器缓存。
