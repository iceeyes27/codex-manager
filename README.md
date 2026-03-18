# Codex Manager

多账号 **OpenAI/Codex CLI** 桌面管理器：**一键切换账号**，并为每个账号**独立保留 `~/.codex/sessions` 会话历史**（不丢上下文）。

[![Release](https://img.shields.io/github/v/release/davaded/codex-manager?display_name=tag&sort=semver)](https://github.com/davaded/codex-manager/releases)
[![Downloads](https://img.shields.io/github/downloads/davaded/codex-manager/total)](https://github.com/davaded/codex-manager/releases)
[![License](https://img.shields.io/github/license/davaded/codex-manager)](./LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/davaded/codex-manager/release.yml?branch=main)](https://github.com/davaded/codex-manager/actions)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)](#installation)

![Codex Manager Preview](./docs/preview.png)

## Why（为什么做这个）

如果你有多个 Codex/OpenAI 账号（工作/个人/不同配额窗口），在 Codex CLI 间切换通常会带来两件很烦的事：

- 账号切过去了，但 **历史 sessions 跟着乱**（上下文丢失/串号）
- 想对比各账号 **真实配额**，需要反复登录网页或靠猜

Codex Manager 把这两件事做成“按钮级”的操作。

## Features（你会用到的）

- ✅ **OAuth 添加账号**：不需要手动粘贴 `auth.json`
- ✅ **切换账号不丢历史**：每个账号有独立 sessions 快照与还原
- ✅ **原子切换 + 回滚**：快照 → 还原 → 写入 `auth.json`，中途失败会尽量回滚
- ✅ **自动识别当前活跃账号**（读取当前机器的 `~/.codex/auth.json`）
- ✅ **真实配额读取**：展示 5 小时 / 每周已使用百分比，支持刷新
- ✅ **导出备份 / 导入配置**
- ✅ 设置持久化：主题、自动刷新频率、代理

## Installation

> 推荐：直接从 GitHub Releases 下载对应平台安装包。

- **Windows**：下载 `.msi`（或 `.exe`）安装
- **macOS**：下载 `.dmg`
- **Linux**：下载 `.AppImage` / `.deb` / `.rpm`（取决于发布的 target）

Releases：https://github.com/davaded/codex-manager/releases

### Notes

- 首次运行如果遇到系统安全提示（尤其是 macOS），需要在系统设置里允许打开。
- 切换账号会读写 `~/.codex/auth.json` 与 `~/.codex/sessions`，请确保 Codex CLI 已正确安装并能正常运行。

## How it works（核心机制）

切换流程由 Tauri 后端串行执行（见：[`src-tauri/src/commands/sessions.rs`](./src-tauri/src/commands/sessions.rs)）：

1) 快照当前 `~/.codex/sessions`
2) 还原目标账号对应的 sessions 快照
3) 写入目标账号的 `~/.codex/auth.json`

稳定性处理包括：

- 全局锁避免并发切换互相覆盖
- 快照采用“临时目录写入 → 成功后替换”，避免损坏上一份可用备份
- Phase 2/3 失败会尝试回滚（sessions 与 auth）
- 前端避免把“切换成功但保存本地配置失败”误报为“切换失败”

## Quota source（配额数据从哪来）

配额不是估算值，也不是前端 mock。

应用会使用每个账号自己的 `access_token + ChatGPT-Account-Id` 请求网页侧用量接口，读取真实配额窗口与重置时间。
如果某账号拉取失败，会明确显示失败原因，而不是展示“看起来对”的假数据。

## Data & Paths（数据在哪里）

应用数据保存在系统 App Data 目录（不同平台路径略有差异）。主要包括：

- `accounts.json`：账号列表与 UI 状态
- `settings.json`：主题、代理、自动刷新等设置
- `credentials/<account-id>.json`：每账号凭证（本地保存）
- `sessions/<account-id>/`：每账号 sessions 快照

Codex CLI 的实时目录仍然是：

- `~/.codex/auth.json`：当前生效账号
- `~/.codex/sessions`：当前活跃会话目录

## Development（本地开发）

前置依赖：

- Node.js 18+
- Rust stable
- Tauri v2 构建环境

安装依赖：

```bash
npm install
```

启动开发（Tauri）：

```bash
npm run tauri dev
```

仅前端预览：

```bash
npm run dev
```

生产构建检查：

```bash
npm run build
cd src-tauri
cargo check
```

## Roadmap（路线图）

- [ ] macOS / Linux 实机验证与打包
- [ ] OAuth 打开浏览器：从 `tauri-plugin-shell` 迁移到 `tauri-plugin-opener`
- [ ] 更完善的错误诊断（端口占用、权限不足、sessions 目录异常等）
- [ ] 更清晰的备份格式版本化与兼容策略

## Contributing（贡献）

欢迎 PR / Issue。

建议你在提交前做这些检查：

- `npm run build`
- `cargo check`（在 `src-tauri` 目录）

如果你要改切换逻辑/数据迁移，请在 PR 描述里补充：

- 失败场景如何回滚
- 是否影响现有本地数据结构

## Security notes（安全说明）

- 本项目会在本机保存账号凭证，**不应在不信任的机器上使用**。
- 项目不主动把凭证上传到任何第三方；配额读取会请求 OpenAI 官方相关接口。
- 如果你不希望本地保存凭证，请不要添加账号。

## Known limitations（已知限制）

- 目前主要在 Windows 环境验证；macOS / Linux 仍需补实机测试
- 纯浏览器预览模式仍保留 mock fallback（仅用于看界面）
