# Architecture

## 运行形态

第一阶段是 Apple Silicon Mac 桌面应用。Electron 提供原生窗口并在应用启动时创建仅监听 `127.0.0.1` 随机端口的 Next.js 本地服务；界面和 `POST /api/convert` 只在本机通信，不需要公网服务器、域名或 Docker。

Electron 渲染进程启用沙箱与上下文隔离，关闭 Node.js 集成。应用每次启动生成 256 位随机会话令牌，由 Electron 网络层自动附加到本地请求，令牌不暴露给页面脚本。应用内导航限制在本地服务源，正文中的 HTTP/HTTPS 链接交由系统默认浏览器打开。

## 本地接口契约

界面通过同源 `POST /api/convert` 发送 `{ "url": string }`。该接口只供应用本机界面和测试使用，不是对外集成 API。生产环境要求 `application/json`、回环 Host、同源 Origin / `Sec-Fetch-Site` 和本次启动的会话令牌；缺少或错误令牌均拒绝。成功响应的 TypeScript 事实源为 `src/types/conversion.ts`，包含：

- `title`、`filename`、`markdown` 和 `warnings`。
- `meta.sourceUrl`、`convertedAt`、`extractionMode` 和 `outputBytes`。
- `meta.textChars`、`sourceImageCount`、`embeddedImageCount` 和 `omittedImageCount`。

错误状态固定使用 `400`、`403`、`413`、`422`、`429`、`502` 或 `504`，正文为简体中文错误信息。客户端主动停止在服务端内部记录为 `499 CLIENT_ABORTED`，浏览器端仍按“已停止转换”处理；服务端总时限使用 `504 CONVERSION_TIMEOUT`。技术提取模式保留在接口和诊断日志中，不在普通用户结果区展示。

## 转换管线

1. 校验 URL、协议、凭据、DNS 与公网 IP。
2. 固定已验证 IP 直接抓取 HTML；重定向逐跳重新校验。
3. 使用 JSDOM、Mozilla Readability 与 DOMPurify 提取并净化正文；微信公众号优先使用 `#js_content`，并在净化前把懒加载图片的 `data-src` 规范化为 `src`。
4. 直接结果不足 300 字符时，使用 Playwright Chromium 渲染后重新提取。
5. 在正文提取前识别微信公众号验证页、删除页等访问拦截，避免将提示文案误判为文章。
6. 仍无正文时转换净化后的 `body`；少于 50 字符则失败。
7. 最多四路并发下载、校验和优化图片，支持 JPEG、PNG、WebP、GIF、AVIF；超大或超尺寸图片转为 WebP。
8. 使用 Turndown/GFM 生成 Markdown；若结果超过 20 MiB，从末张内嵌图片开始逐张降级，直到满足预算。纯正文自身超限才返回 `413 OUTPUT_TOO_LARGE`。
9. 返回文件字节数、正文字符数、源图片数、内嵌图片数、省略图片数及诊断用提取模式。

## 本地安全边界

- 本地服务只绑定 `127.0.0.1` 和系统分配的随机端口，不监听局域网或公网地址。
- 仅允许 HTTP/HTTPS，拒绝 URL 凭据、本机、私网、链路本地、保留地址与云元数据地址，避免目标网页借应用访问本机或局域网资源。
- 页面、每次重定向、动态页面子资源和图片均执行相同检查。Chromium 的 HTTP/HTTPS 流量必须经过一次性回环代理：每个 HTTP 请求或 HTTPS CONNECT 隧道都重新校验目标，并直接连接校验所得 IP，禁止 Chromium 在校验后再次解析域名。
- HTML 解压后最多 5 MiB；该限制也适用于动态渲染完成后序列化的 DOM，不等同于浏览器网络流量预算。单图最多 8 MiB，最多 30 张图，单次转换最多 45 秒。
- 每次动态浏览器回退最多代理 100 个 HTTP/CONNECT 请求，代理累计传输最多 50 MiB，单个 CONNECT 隧道最多 25 MiB。已声明 `Content-Length` 的超限 HTTP 响应在转发前拒绝，流式响应与加密隧道在累计超限时立即关闭；并发子资源共享同一预算。
- 动态浏览器上下文及其安全代理按请求创建并销毁，禁止下载，阻止媒体、字体与 WebSocket 升级。
- 直接请求和动态浏览器使用一致的桌面 Chrome User-Agent，避免应用自定义标识触发站点的非浏览器拦截。
- Markdown 预览不解析原始 HTML，只允许应用生成的栅格图片 Data URI。
- 客户端停止转换时中止同源请求；请求信号继续传入直连抓取、动态浏览器和图片请求，及时释放本地资源。

## 数据与日志

应用代码不使用数据库、对象存储、Cookie、LocalStorage 或转换历史。Electron 与 Chromium 会按运行时默认行为在本机创建缓存、偏好设置和临时浏览器数据；这些数据不用于恢复或同步转换结果。结构化诊断日志不包含 URL、页面正文或图片，用户主动保存的 `.md` 文件不属于应用持久化数据。

## 构建与分发

- 使用 Electron Forge 生成 `darwin/arm64` 应用包和 ZIP 分发文件。
- 开发入口为 `npm run dev:desktop`。
- 本地应用目录构建为 `npm run desktop:package`；分发 ZIP 构建为 `npm run desktop:make`。
- 日常基线包含合成网页与固定 Markdown 的精确金标准测试；`npm run test:live` 在同一轮独立读取真实网页并对照转换结果，只作为发布前阻断门禁。
- `./init.sh` 与发布脚本只接受 Node.js 24.x。`npm run desktop:release` 依次执行完整基线、Chromium/Firefox/WebKit E2E、真实网页门禁与 Apple Silicon ZIP 打包，并强制验证 ZIP 是本轮新产物、应用版本为当前版本、可执行文件为 arm64、ZIP 包含预期应用结构，最后输出大小与 SHA-256。
- E2E 使用 production standalone 服务；执行器会比较测试前后的 tracked diff，发现测试修改源码或项目文档时直接失败。
- 完整命令矩阵、环境变量、打包冒烟和人工验收步骤见 `docs/TESTING.md`。
- 第一阶段产物可不签名，仅用于开发和个人测试；对外分发前必须补充 Apple Developer ID 签名与 notarization。
- 第二台 Mac 验收确认未签名应用可能被 Gatekeeper 显示为“文件已经损坏”；个人测试时应先核对 ZIP SHA-256，再只移除 `com.apple.quarantine` 属性。该处理不等同于签名或 notarization，不扩大分发范围。
- 打包准备脚本把当前 Playwright 版本对应的 Apple Silicon Chromium Headless Shell 放入应用资源，并通过明确的可执行路径启动，避免依赖用户电脑上的浏览器缓存。
