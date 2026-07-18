# 多平台仓库规划

## 状态

- 批准日期：2026-07-18
- 当前仓库形态：macOS 单项目根目录
- 执行门槛：任何目录迁移或 Windows 初始化前，必须完成 `feat-010 — Personal Mac Release`。

## 目的

在同一 Git 仓库中管理 macOS 与 Windows，但不共享可变的项目状态、依赖、构建产物或平台实现代码。根目录只管理跨平台治理与稳定产品契约。

## 已确认决定

- 仅在当前 Apple Silicon Mac 版本完成第二台 Mac 验收后迁移。
- Windows 首版目标为 Windows 10/11 x64，并以 macOS 0.1.3 的用户功能为对等基线。
- Windows 继续采用 Electron、Next.js、Node.js、Readability、Turndown、Playwright Chromium 与 Sharp，但维护独立源代码和依赖锁文件。
- Windows 首个个人测试产物为免安装 ZIP，不需要 Microsoft Store、账号、公网服务器或 AI API。
- macOS 与 Windows 独立编号；Windows 从 `0.1.0` 开始，macOS 在自己的发布流程中维持或升级版本。
- 共享源码明确不在范围内；只有两个平台都证明某模块稳定且与平台无关后，才可单独提议抽取。

## 目标结构

```text
MD-Convertor/
├─ AGENTS.md
├─ README.md
├─ CHANGELOG.md
├─ PROGRESS.md
├─ feature_list.json
├─ session-handoff.md
├─ docs/
│  └─ contracts/
│     ├─ PRODUCT.md
│     ├─ OUTPUT.md
│     ├─ SECURITY-PRIVACY.md
│     └─ fixtures/
│        └─ golden-article.{html,md}
└─ apps/
   ├─ macos/
   │  ├─ AGENTS.md
   │  ├─ README.md
   │  ├─ CHANGELOG.md
   │  ├─ PROGRESS.md
   │  ├─ feature_list.json
   │  ├─ session-handoff.md
   │  ├─ package.json
   │  ├─ package-lock.json
   │  ├─ init.sh
   │  └─ docs/、src/、electron/、tests/ 与平台配置
   └─ windows/
      ├─ AGENTS.md
      ├─ README.md
      ├─ CHANGELOG.md
      ├─ PROGRESS.md
      ├─ feature_list.json
      ├─ session-handoff.md
      ├─ package.json
      ├─ package-lock.json
      ├─ init.sh
      └─ docs/、src/、electron/、tests/ 与平台配置
```

根目录不保留 `package.json`、锁文件、构建命令或 npm workspace。每个平台都从 `apps/<platform>/` 运行自己的命令。

## 所有权边界

| 位置 | 管理内容 | 不得包含 |
| --- | --- | --- |
| 仓库根目录 | 跨平台治理、迁移状态、稳定契约 | 平台依赖、源码、产物或发布状态 |
| `docs/contracts/` | 产品流程、Markdown/输出预算、隐私与 SSRF 要求、合成金标准 fixture | 平台打包、本地 API 接线、签名或真实网页验收证据 |
| `apps/macos/` | macOS 源码、测试、产物、发布与 Harness 状态 | Windows 状态、源码或发布文件 |
| `apps/windows/` | Windows 源码、测试、产物、发布与 Harness 状态 | macOS 状态、源码或发布文件 |

修改 `docs/contracts/` 时，必须在根目录 Changelog 记录，并在两个平台的 Progress 文件中注明影响。仅属于某个平台的改动不得触及另一平台的实现或 Harness 状态。

## 迁移步骤

1. 完成 `feat-010` 并记录第二台 Mac 验收结果；从干净 Git 工作区和已提交的 macOS 基线开始。
2. 创建独立分支，例如 `chore/multiplatform-layout`；移动跟踪文件前记录当前 macOS ZIP 哈希。
3. 使用 `git mv` 将所有已跟踪的 macOS 源码、配置、Harness、测试和文档迁入 `apps/macos/`。
4. 将根目录指令和状态文件替换为仓库级路由与迁移记录；稳定要求拆入 `docs/contracts/`，平台行为与证据保留在 `apps/macos/docs/`。
5. 将现有合成网页—Markdown 金标准 fixture 移至 `docs/contracts/fixtures/`，并让 macOS 测试通过相对路径读取它。
6. 更新 macOS 相对路径、脚本和文档，使所有工作从 `cd apps/macos` 开始。
7. 不自动删除当前根目录已忽略的构建目录（`node_modules`、`.next`、`.desktop`、`out`、coverage 或报告）；仅在迁移验证成功后再决定是否清理。
8. 将迁移作为纯结构变更提交；同一提交中不得创建 `apps/windows/`。

## Windows 初始化

迁移提交完成后，从该基线创建 `windows-bootstrap`。

- 仅创建 `apps/windows/` 及其独立 Harness、文档、包清单和锁文件。
- 在 Windows 架构与交接文档中记录作为行为参考的 macOS 提交。
- 实现 `win32/x64` ZIP 打包，并保留本机转换、SSRF、图片预算和隐私契约。
- 不得 import、软链接或修改 macOS 文件。若日后提议共享实现，必须单独获得批准并在两个平台通过测试。

## 验证门槛

只有在 `apps/macos/` 中通过以下命令，目录迁移才算完成：

```bash
./init.sh
npm run test:e2e
npm run desktop:package
```

打包后的 macOS 应用还必须完成一次公开网页冒烟，覆盖转换、停止、复制、下载和内嵌图片。Windows 需要自己的基线、E2E、金标准 fixture 与 Windows 10/11 x64 新机器验收；不得继承 macOS 发布证据。

## 当前唯一下一步

暂不创建、移动或编辑 Windows 应用文件。先完成 `feat-010` 的第二台 Apple Silicon Mac 安装验收，再开始上述结构迁移。
