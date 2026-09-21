# 测试与发布手册

[English](TESTING.md) | **简体中文**

## 环境

- Apple Silicon Mac
- Node.js 24.x 与 npm
- 使用 `npx playwright install chromium firefox webkit` 安装 Chromium、Firefox、WebKit
- 真实网页检查及首次下载 Electron/Chromium 依赖时需要联网

干净检出后使用 `npm ci` 恢复依赖。

## 命令

| 命令 | 用途 | 是否阻断发布 |
|---|---|---|
| `./init.sh` | Harness、lint、typecheck、覆盖率测试、生产构建 | 是 |
| `npm run test:e2e` | Chromium、Firefox、WebKit 界面回归 | 是 |
| `npm run test:live` | 稳定 WalkingLabs 链接/粘贴对照 | 仅发布时 |
| `npm run test:live:wechat` | 完整微信公众号内存对照 | 诊断 |
| `npm run desktop:package` | 构建未压缩 arm64 应用 | 否 |
| `npm run desktop:make` | 构建未签名 ZIP | 否 |
| `npm run desktop:release` | 完整门禁并生成全新、已校验 ZIP | 是 |

真实网页对照不保存或打印网页正文。只按测试源码中记录的环境变量替换样本，禁止提交私有或受版权保护的页面内容。

翻译测试不需要联网也不需要密钥：`scripts/start-e2e-server.mjs` 会设置 `MD_CONVERTOR_TEST_PROVIDER=1`，让 `/api/translate/*` 使用进程内伪模型。未设置该标志时分支不存在，因此生产环境在未配置模型时仍返回 409 `TRANSLATE_NOT_CONFIGURED`。不要把该标志带入任何生产或发布命令。

## 覆盖范围

日常基线覆盖：

- URL、DNS、重定向、SSRF、代理、请求/流量预算、取消和超时
- Readability 提取、body fallback、微信验证页识别和 Markdown 金标准
- 普通/多节点代码块、表格、列表、链接和 Mermaid 保留
- 富文本语义门控、净化、HTML/纯文本降级和 5 MiB 请求上限
- 图片格式、懒加载、Data URI、8 MiB 单图、30 图、优化和 20 MiB 正文优先降级
- 复制、下载、清空、停止、统计、响应式布局和返回顶部
- 设置契约与 `settings.json` 存储、密钥加密与 preload 桥、Provider 端点策略、模型拉取、本地 CLI 扫描/模型、语言预置
- 翻译分段与重组、prompt 契约与解析、Provider 适配器、限额与错误码、语言占比决策、非目标语言逐字节保真
- 翻译任务预算：`translateTaskTimeoutMs(batchCount)` 返回 `max(120s, 批次数 × 180s + 30s)`，两个端点都按真实批次数决定 deadline（段数多的长文不再被固定 120s 切断）
- 翻译勾选框、原文/译文 Tab、按 Tab 分流的复制与下载、进度、取消、重试与占比弹窗

`vitest.config.ts` 把覆盖率限定在 `src/lib/**/*.ts` 与 convert、translate 路由，排除测试文件与 `src/types/**`，并为每个文件设置门槛。`src/lib/translate/**` 的每个模块都有自己的门槛（95/90/100/95，`segment.ts` 为 90/75/100/90）。当前覆盖率为 64 files / 866 tests、statements 95.28%。

E2E 使用 production standalone 服务，并在测试后检查 tracked 文件未变化。`playwright.config.ts` 设 `workers: 1`，因为翻译引擎持有一个进程级任务槽，并行 worker 会互相撞出 429 `TRANSLATE_BUSY`。

转换类的 spec 全部在浏览器里拦截 `**/api/convert` 或 `**/api/convert-paste`，因此 `e2e/convert-api.spec.ts` 是唯一触达真实路由处理器的用例：它提交一个回环链接并期待 403 `PRIVATE_TARGET`（无需联网，但只有在该路由成功加载其 Playwright 依赖后才可能返回），并通过真实的 paste 路由提取一次真实粘贴内容。`next.config.ts` 用 `outputFileTracingIncludes` 把 `node_modules/playwright-core/browsers.json`（Next.js 会遗漏的数据文件）加进追踪，使该依赖始终可加载；缺少它时 standalone 服务对任何链接都返回 500，而这正是打包流程曾经用「重新整包拷贝」掩盖掉的问题。

## 发布保护

`npm run desktop:release` 要求：

- package 版本严格为 `0.3.5`
- Node.js 24.x，但 **24.16.0 不可用**：该补丁在 `yauzl` 解压 Electron 归档时会卡住，`electron-forge make` 永远不产出 ZIP。24.14.1 与 24.15.0 均可完整跑过门禁
- 历史归档集合：清单中仍然存在的 ZIP 必须保持固定 SHA-256，`~/Downloads/MD-Convertor-archive/releases/` 中不得出现未登记的发布 ZIP
- ZIP 必须由本轮命令新生成
- 包内版本为 `0.3.5`
- 可执行文件为 arm64，应用结构完整

成功和失败路径都会再次校验历史产物。Forge 未生成新 ZIP 即使退出也必须判为失败。

桌面准备集成回归要求最终 server 不包含 `node_modules/electron`，同时保留 Playwright、Playwright Core、Sharp arm64 包和内置 Chromium Headless Shell；全新未压缩应用只能包含外层 Electron Runtime。`0.3.3` 一轮（`feat-034`，2026-09-20）正是引入这次裁剪：分发 ZIP 从 `358,726,788` 降到 `232,947,408` bytes（小 120 MiB），运行时行为无变化，证据为完整门禁加安装后应用的打包冒烟测试。

0.1.3 只读归档副本与 0.1.0–0.2.0 的 ZIP 已从本机丢失且无法恢复，因此守卫对缺失项改为「退役」：为每个缺失文件打印一条 `Historical Archive Notice` 后继续发布。任何仍然存在的文件依然要过哈希校验，被改动或可写的文件仍然会中断发布，未登记的发布 ZIP 仍然被拒绝。`0.2.1` 已于 2026-09-18 从 GitHub release 重新下载并逐字节匹配其记录哈希，因此该条目重新受到强制校验。`v0.1.3` 源码标签仍是硬前置条件。

`0.3.0` 门禁已于 2026-09-18 完整通过（基线、三引擎 E2E、live、打包）。

`0.3.1` 门禁已于 2026-09-20 以同样的步骤完整通过。

`0.3.2` 门禁同样于 2026-09-20 通过，新增内容是一处小修：打包后的应用改用包内 `MD-Convertor Helper` 启动本地服务，而不是应用自身的可执行文件（`electron/server-binary.mjs`，3 个单测），从而消除运行期间程序坞上多出的跳动 `exec` 图标。

`0.3.5` 门禁于 2026-09-21 完整通过。它包含视觉刷新（`feat-039`，纯 CSS）：强调色由墨绿改为海军蓝（`#176b5d` → `#2a395c`），十处手调界面字重收敛为一个 `--weight-ui` token，并开启 `-webkit-font-smoothing: antialiased`。`tests/palette.test.ts` 会在出现白名单外的颜色字面量时失败，`e2e/theme.spec.ts` 直接读两个页面上的 computed 样式，因此旧调色板或漏改的字重都无法静默通过。

`0.3.4` 门禁于 2026-09-21 完整通过。它包含 `feat-036`（链接抓取失败时在错误卡片下提示改用富文本粘贴）、`feat-037`（云端卡片「清除」改为整卡重置）与应用图标：`assets/icon.icns` 取代 Electron 默认图标，`assets/` 被排除在 asar 之外。`tests/app-icon.test.ts` 守住图标（1024px 透明母版、必需 icns 类型、`forge.config.cjs` 的接线陷阱与排除规则），包内 `electron.icns` 与仓库文件按 SHA-256 比对一致。

之后新增的长文翻译超时修复（`feat-024`，2026-09-18）把任务预算改为按批次数动态计算。更后一轮（`feat-029`，2026-09-18）让云端 Provider 保存时四项必填、允许设置页用未保存的草稿拉取模型（拉取不写设置），并把已保存密钥的输入框改为八个黑点占位；覆盖它的单测见 `src/lib/settings/provider-form.test.ts` 与 `src/app/api/provider/models/route.test.ts`，另有 3 个新增设置页 e2e 用例与 3 个改写用例（原先「拉取模型先保存草稿」的断言已不成立）。另一轮把单次调用上限从 60s 调高到 180s（`feat-027`）并修掉了「超时被误报成无法识别的回答」，同时删除了设置页「当前生效」标签（`feat-028`）。这些改动已通过单元测试、`./init.sh` 全量基线、三浏览器 e2e 与真机探针（用户云端 Provider 上一个原本撞 60s 上限失败的 121 块文档现在返回 200）。版本决策已定为 `0.3.1`：`package.json`、锁文件、`feature_list.json` 与发布门禁都已改为 `0.3.1`（门禁测试先改到 RED，再回到 29 passed）。之后一轮（`feat-031`，2026-09-20）把 `next` 升到 16.3.5、`sharp` 升到 0.35.4，使 `npm audit --omit=dev` 不再报生产依赖公告；同时去掉页头齿轮图标、把两个转换按钮改名为「转换」、让富文本面板的转换按钮右边缘与上方粘贴框对齐，并在已保存密钥时把密钥输入框设为只读。最后一轮（`feat-032`，2026-09-20）去掉绿色「MD」方块并把品牌字改为 Michroma，字体与 OFL 许可证随仓库放在 `public/fonts/`，用 `next/font/local` 加载；`tests/brand-font.test.ts` 守住这两个文件，e2e 的品牌用例按 SHA-256 比对页面实际加载的 woff2 与仓库文件，并在拒绝全部网络（`sandbox-exec … (deny network*) npm run build`，exit 0）的条件下重跑构建以证明不再访问 Google。下文记录的产物是修复**前**的 `0.3.0` 构建（保留为历史）；`feat-024` 之后的所有改动依次包含在 `0.3.1`–`0.3.5` 产物中。

## 通过门禁的产物（0.3.5）

- 路径：`out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.5.zip`
- 大小：`237,335,837` bytes
- SHA-256：`313bbbc341c94da0a5ca92f668f2df06cea9f734e47d7af65880500aa192d45f`
- 包：版本 `0.3.5`、arm64、macOS 12.0+
- 自动证据：64 files / 866 tests、statements 95.28%、三引擎 E2E 206 passed / 4 skipped、live 2/2
- 包内视觉刷新：实际服务的 CSS 含 `--accent:#2a395c`、`--accent-soft:#eef1f6`、`--muted:#565e6b`、`--paper:#f9fafb`、`--weight-body:400`、`--weight-ui:400` 与 `font-smoothing:antialiased`，且已退役调色板（`176b5d`、`0f5147`、`dcece7`、`202a28`）零命中。安装后的构建另经 CDP 复核：页面背景 `rgb(249, 250, 251)`，「转换」与「设置」字重均为 `400`。
- 图标：与 `0.3.4` 相同；`Contents/Resources/electron.icns` 哈希仍为 `e8cbc7e7…48bf`
- 包内运行时：`server/node_modules/electron` 仍为 0 条；asar 内无 `/assets` 条目
- 打包冒烟：在安装后的构建上通过 preload 桥与运行时密钥往返
- 已发布：[GitHub Release `v0.3.5`](https://github.com/haohaiHuang/MD-Convertor/releases/tag/v0.3.5)
- 签名：未做 Developer ID 签名与 notarization，产物仅适合个人测试

## 历史产物（0.3.4）

- 路径：`out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.4.zip`
- 大小：`237,272,966` bytes
- SHA-256：`6910120e004170cc1ff91d29315f883226a852cd012c3e9a1e335e6056b42704`
- 包：版本 `0.3.4`、arm64、macOS 12.0+
- 自动证据：63 files / 863 tests、statements 95.28%、三引擎 E2E 187 passed / 2 skipped、live 2/2
- 图标：`assets/icon.icns`（`972,218` bytes，`e8cbc7e7…48bf`）与 `assets/icon-1024.png`；包内 `Contents/Resources/electron.icns` 与仓库文件哈希相同
- 包内运行时：`server/node_modules/electron` 仍为 0 条；asar 共 230 条，`/assets` 下 0 条
- 打包冒烟：在安装后的构建上通过 preload 桥与运行时密钥往返
- 已发布：[GitHub Release `v0.3.4`](https://github.com/haohaiHuang/MD-Convertor/releases/tag/v0.3.4)，标签指向 `e251267`（该 ZIP 正是由这个提交的源码构建），服务端资产大小与本地产物一致
- 签名：未做 Developer ID 签名与 notarization，产物仅适合个人测试

体积比 `0.3.3` 大出约 4.3 MB，与图标改动无关：本次构建的 Next.js 输出追踪多带上了可选的 `@img/sharp-wasm32`、`@emnapi/runtime` 回退包与 3 个 build-hash 静态文件。图标本身没有让应用变大：`electron.icns` 由 Electron 默认的 272 KB 换成 972 KB 的自定义图标，而 `assets/` 不再随 asar 分发。

## 历史产物（0.3.3）

- 路径：`out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.3.zip`（已不在 `out/`；留档于 GitHub Release 资产与 `/tmp/s19/`）
- 大小：`232,947,408` bytes
- SHA-256：`1bf807dfe294860c24345efe5caf2b0fcbd54f88476df7085c9bd03b47b37a72`
- 包：版本 `0.3.3`、arm64、macOS 12.0+
- 自动证据：62 files / 859 tests、statements 95.28%、三引擎 E2E 178 passed / 2 skipped、live 2/2
- 打包冒烟：在安装后的构建上通过 preload 桥与运行时密钥往返（未压缩应用 539 MB，原先 843 MB）
- 已发布：[GitHub Release `v0.3.3`](https://github.com/haohaiHuang/MD-Convertor/releases/tag/v0.3.3)，标签指向 `3897cd1` —— 该 ZIP 正是由这个提交的源码构建（GitHub 服务端的资产大小与 SHA-256 均与本地逐字节一致）
- 签名：未做 Developer ID 签名与 notarization，产物仅适合个人测试

## 历史产物（0.3.2）

- 路径：`out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.2.zip`
- 大小：`358,726,788` bytes
- SHA-256：`8fb7a93f33a07bb03b0b8558df4ff0c2abe40a14eee13fd9dc0348fedcc7f1ba`
- 包：版本 `0.3.2`、arm64、macOS 12.0+
- 自动证据：62 files / 858 tests、statements 95.28%、三引擎 E2E 178 passed / 2 skipped、live 2/2
- 已发布：[GitHub Release `v0.3.2`](https://github.com/haohaiHuang/MD-Convertor/releases/tag/v0.3.2)，标签指向 `1c3ed80` —— 该 ZIP 正是由这个提交的源码构建（资产大小与本地逐字节一致）
- 签名：未做 Developer ID 签名与 notarization，产物仅适合个人测试

## 历史产物（0.3.1）

- 路径：`out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.1.zip`
- 大小：`358,723,706` bytes
- SHA-256：`c7411c587b3842a76f79118ecdc6d061993a0a99c98e4801c14ff947f10e161b`
- 包：版本 `0.3.1`、arm64、macOS 12.0+
- 自动证据：61 files / 855 tests、statements 95.28%、三引擎 E2E 178 passed / 2 skipped、live 2/2
- 已发布：[GitHub Release `v0.3.1`](https://github.com/haohaiHuang/MD-Convertor/releases/tag/v0.3.1)，标签指向 `af7f6db` —— 该 ZIP 正是由这个提交的源码构建

## 历史产物（0.3.0，保留为历史）

- 路径：`out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.3.0.zip`
- 大小：`358,562,540` bytes
- SHA-256：`2a0e236e97e51d97fd24c7002a923ef5703ad8245234531f2eb3aa1350c81147`
- 包：版本 `0.3.0`、arm64、macOS 12.0+
- 自动证据：58 files / 835 tests、statements 95.25%、三引擎 E2E 142 passed / 2 skipped、live 2/2
- 打包冒烟：preload 桥与运行时密钥往返均通过
- 签名：未做 Developer ID 签名与 notarization，产物仅适合个人测试

## 历史锚点（0.2.1）

- 路径：`~/Downloads/MD-Convertor-archive/releases/MD-Convertor-darwin-arm64-0.2.1.zip`
- 大小：`354,635,067` bytes
- SHA-256：`32c1d96af58a7701e6d2fe0bf619be0f8f224803355c6ef63aad43c85569463e`
- 包：版本 `0.2.1`、arm64、macOS 12.0+
- 自动证据：322 tests、三引擎 E2E 60/60、稳定 live 2/2
- 微信诊断：12/12 代码块、279 行内存对照一致

## 打包冒烟测试

用以下环境变量运行打包后的应用，即可在无人点击的情况下验证 preload 桥与密钥链路：

```bash
ELECTRON_SMOKE_TEST=1 ELECTRON_SMOKE_TEST_SECRETS=1 \
  out/MD-Convertor-darwin-arm64/MD-Convertor.app/Contents/MacOS/MD-Convertor
```

- `ELECTRON_SMOKE_TEST=1`：检查 `window.mdConvertor.secrets` 存在且 `safeStorage` 报告加密可用。
- `ELECTRON_SMOKE_TEST_SECRETS=1`：额外验证密钥链路——无密钥的 Provider 返回 409 `TRANSLATE_NOT_CONFIGURED`；保存密钥后无需重启即可让运行中的服务访问该端点（对测试地址为 502 `TRANSLATE_PROVIDER_ERROR`）；删除密钥后回到 409。冒烟结束前会删除该密钥并还原设置。已经不能再用环境变量提供 Provider 密钥，因此冒烟只通过 preload 桥写入。

## 核验包内内容

只读归档，不要解包；更不要在仓库里解包（坑见本节末尾）：

```bash
APP=out/MD-Convertor-darwin-arm64/MD-Convertor.app
A="$APP/Contents/Resources/app.asar"
npx asar list "$A" | grep -c node_modules/electron    # 0.3.3 裁剪后为 0
npx asar list "$A" | grep -c '^/\.next'              # 0：构建后的前端不在 asar 里
LC_ALL=C grep -c "<本次改动里的一段字符串>" "$A"
```

asar 里装的是**源码树**（`/src`、`/docs`、`/AGENTS.md`、`/.pi/todos`、`/brand`、`CHANGELOG*`；0.3.3 共 241 条，没有 `node_modules`、也没有 `.next`），运行中的应用并不使用这份副本：构建后的前端与其 server `node_modules` 位于 `Contents/Resources/server/`（通过 `extraResource` 装载）。因此在 asar 里命中或落空都**不能**说明前端是否打进包；按「各层实际负责什么」分别核验：

```bash
npx asar list "$A" | grep settings/page.tsx              # asar：只有源码副本
strings "$A" | grep -c resolveServerBinary              # asar：Electron 代码里的 ASCII 字符串
grep -rl "<本次改动里的一段字符串>" "$APP/Contents/Resources/server/.next" | head
test -f "$APP/Contents/Resources/server/node_modules/playwright-core/browsers.json" && echo present
```

在 asar 里搜索时有两个坑：

- macOS 的 BSD grep 对**二进制文件里的多字节模式会返回 0**，除非加 `LC_ALL=C`（`grep -c "中文串" app.asar` 看起来就像完全没匹配到）；`strings` 对任何非 ASCII 内容同样看不见。要真正放心，就解到 `/tmp` 再 grep 整棵树。
- `npx asar extract-file <asar> <path> /tmp/out` 的第三个参数会被忽略，文件会按 basename 落在当前目录（`page.tsx`），stdout 为空。请解到 `/tmp`，或只用上面的只读命令。细节见 `~/.pi/agent/TROUBLESHOOTING.md` §4。

## 人工验收

1. 解压 ZIP，把 `MD-Convertor.app` 拖入“应用程序”。
2. 绕过任何 Gatekeeper 提示前先校验 SHA-256。
3. 启动应用，分别测试一个公开链接和一份富文本粘贴。
4. 确认清空、停止、复制、下载、统计、内嵌图片、代码块、Mermaid 和返回顶部。
5. 使用目标 Markdown 阅读器打开下载文件。

当前包未签名、未 notarize；配置 Apple Developer ID 签名和 notarization 前，只批准个人测试。
