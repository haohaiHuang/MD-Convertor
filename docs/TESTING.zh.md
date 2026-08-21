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

## 覆盖范围

日常基线覆盖：

- URL、DNS、重定向、SSRF、代理、请求/流量预算、取消和超时
- Readability 提取、body fallback、微信验证页识别和 Markdown 金标准
- 普通/多节点代码块、表格、列表、链接和 Mermaid 保留
- 富文本语义门控、净化、HTML/纯文本降级和 5 MiB 请求上限
- 图片格式、懒加载、Data URI、8 MiB 单图、30 图、优化和 20 MiB 正文优先降级
- 复制、下载、清空、停止、统计、响应式布局和返回顶部

E2E 使用 production standalone 服务，并在测试后检查 tracked 文件未变化。

## 发布保护

`npm run desktop:release` 要求：

- package 版本严格为 `0.2.1`
- Node.js 24.x
- `~/Downloads/MD-Convertor-archive/releases/` 中历史 ZIP 的固定哈希不变
- ZIP 必须由本轮命令新生成
- 包内版本为 `0.2.1`
- 可执行文件为 arm64，应用结构完整

成功和失败路径都会再次校验历史产物。Forge 未生成新 ZIP 即使退出也必须判为失败。

## 已验证的 0.2.1 产物

- 路径：`out/make/zip/darwin/arm64/MD-Convertor-darwin-arm64-0.2.1.zip`
- 大小：`354,635,067` bytes
- SHA-256：`32c1d96af58a7701e6d2fe0bf619be0f8f224803355c6ef63aad43c85569463e`
- 包：版本 `0.2.1`、arm64、macOS 12.0+
- 自动证据：322 tests、三引擎 E2E 60/60、稳定 live 2/2
- 微信诊断：12/12 代码块、279 行内存对照一致

## 人工验收

1. 解压 ZIP，把 `MD-Convertor.app` 拖入“应用程序”。
2. 绕过任何 Gatekeeper 提示前先校验 SHA-256。
3. 启动应用，分别测试一个公开链接和一份富文本粘贴。
4. 确认清空、停止、复制、下载、统计、内嵌图片、代码块、Mermaid 和返回顶部。
5. 使用目标 Markdown 阅读器打开下载文件。

当前包未签名、未 notarize；配置 Apple Developer ID 签名和 notarization 前，只批准个人测试。
