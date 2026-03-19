# Codex Manager

一个用于切换多个 OpenAI/Codex 账号的桌面管理器，重点是切号时不打断当前 Codex 会话流程。

[English](./README.en.md)

[![Release](https://img.shields.io/github/v/release/davaded/codex-manager?display_name=tag&sort=semver)](https://github.com/davaded/codex-manager/releases)
[![Downloads](https://img.shields.io/github/downloads/davaded/codex-manager/total)](https://github.com/davaded/codex-manager/releases)
[![License](https://img.shields.io/github/license/davaded/codex-manager)](./LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/davaded/codex-manager/release.yml?branch=main)](https://github.com/davaded/codex-manager/actions)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)](#installation)

## UI Preview

主窗口：

![Codex Manager Preview](./docs/preview.png)

托盘快速面板（小窗快速切号 / 刷新用量）：

![Tray Panel Demo](./docs/tray-panel-demo.png)

## 为什么做这个

如果你有多个 Codex/OpenAI 账号，很快会遇到两个问题：

- 很难确认当前到底用了哪一个账号
- 很难比较各账号的真实配额

Codex Manager 把这些操作收成主窗口和托盘悬浮窗里的几个动作。

## 核心能力

- 通过 OAuth 添加账号，或导入当前 `~/.codex/auth.json`
- 切换账号时保持共享 `~/.codex/sessions` 工作集不变
- 读取真实 5 小时 / 每周配额数据
- 支持整页刷新和单账号刷新
- 支持按真实配额执行智能切换
- 提供半透明托盘快速切换悬浮窗
- 支持切换后自动重启 Codex 桌面应用
- 支持导出备份并持久化设置

## Installation

> 推荐直接从 GitHub Releases 下载打包产物。

- Windows：`.msi` 或 `.exe`
- macOS：`.dmg`
- Linux：`.AppImage`、`.deb` 或 `.rpm`，取决于发布目标

Releases：https://github.com/davaded/codex-manager/releases

### Notes

- 首次运行时，如果系统弹出安全提示，按系统提示允许打开即可。
- 应用会读写 `~/.codex/auth.json`，请先确保 Codex CLI 已正确安装并可正常运行。

## 快速开始

1. 启动 Codex Manager
2. 导入当前授权，或通过 OAuth 添加账号
3. 刷新用量
4. 手动切换，或直接使用智能切换

## 当前账号识别

应用会读取当前机器上的 `~/.codex/auth.json`，按以下顺序识别活跃账号：

1. `email`
2. `userId`
3. 已保存凭证中的 `chatgpt_account_id`
4. `refresh_token / access_token / id_token`

这样即使某份本地凭证稍微滞后，也能尽量识别出真正活跃的账号。

## 导入当前授权

“导入当前授权”不会重新发起 OAuth，而是直接读取当前机器上已经生效的 `~/.codex/auth.json`，把这份登录态登记成一个可管理账号。

导入时会：

1. 读取当前 `auth.json`
2. 解析 `email / userId / accountId`
3. 匹配已有账号，避免重复导入
4. 保存凭证并刷新配额

如果当前授权本来就属于某个已有账号，则更新该账号，而不是创建重复卡片。

## 智能切换

“智能切换”会先刷新配额，再在拥有有效数据的账号中选择最合适的候选。

当前规则：

- 优先选择 `5h` 已使用比例最低的账号
- 如果 `5h` 相同，则比较 `week` 已使用比例
- 如果当前账号已经是最佳选择，则不重复切换

## 托盘快速面板

桌面端会创建系统托盘图标，并提供一块快速面板。

当前行为：

- 左键点击托盘图标可打开 / 收起快速面板
- 点击快速面板外部会自动收起
- 托盘菜单操作不会再次误触发面板弹出
- 悬浮窗会按平台策略贴近托盘区域定位，Windows 下优先贴近任务栏边缘
- 菜单支持：
  - 打开快速面板
  - 打开主窗口
  - 收起快速面板
  - 退出应用
- 面板内支持：
  - 导入当前授权
  - 智能切换
  - 刷新用量
  - 查看所有账号并快速切换
  - 用更轻量的双列卡片查看账号状态与配额

它是一个轻量半透明悬浮窗，适合快速切号和看配额，不替代主窗口的完整管理视图。

## 工作原理

切换流程由 Tauri 后端串行执行，核心逻辑在 [`src-tauri/src/commands/sessions.rs`](./src-tauri/src/commands/sessions.rs)。

当前流程：

1. 读取当前共享 `~/.codex/sessions` 状态
2. 写入目标账号的 `auth.json`
3. 保持当前共享会话工作集不变
4. 如果设置开启，则在切换完成后自动重启 Codex 桌面应用

稳定性处理包括：

- 全局锁避免并发切换
- 写入 `auth.json` 失败会回滚
- 本地保存失败不会把切换误报成失败
- 自动重启前会先弹确认框
- 自动重启失败不会回滚账号切换

## 配额数据来源

配额不是估算值。

应用会使用每个账号自己的 `access_token + ChatGPT-Account-Id` 请求网页侧配额接口，读取真实窗口和重置时间。

如果请求失败，界面会直接显示失败原因。

## 数据与目录

应用数据保存在系统 App Data 目录。主要文件包括：

- `accounts.json`：账号列表和 UI 状态
- `settings.json`：主题、代理、自动刷新、切换后自动重启设置
- `credentials/<account-id>.json`：每个账号保存的凭证
- `sessions/<account-id>/`：旧版兼容快照目录

实时使用的 Codex 目录仍然是：

- `~/.codex/auth.json`：当前生效账号
- `~/.codex/sessions`：CLI 与桌面应用共享的当前活跃会话目录

## 本地开发

前置依赖：

- Node.js 18+
- Rust stable
- Tauri v2 构建环境

安装依赖：

```bash
npm install
```

启动 Tauri 开发：

```bash
npm run tauri dev
```

仅运行前端预览：

```bash
npm run dev
```

构建检查：

```bash
npm run build
cd src-tauri
cargo check
```

## 路线图

- macOS / Linux 实机验证与打包
- OAuth 打开浏览器从 `tauri-plugin-shell` 迁移到 `tauri-plugin-opener`
- 更完善的错误诊断（端口占用、权限不足、auth/sessions 目录异常等）
- 更细的托盘定位和平台特化体验

## 贡献

欢迎提 PR 或 Issue。

建议提交前先跑：

- `npm run build`
- `cargo check`（在 `src-tauri` 目录）

如果你改了切换逻辑或数据迁移，请在 PR 描述里补充：

- 失败场景如何回滚
- 是否影响现有本地数据结构

## 安全说明

- 本项目会在本机保存账号凭证，不建议在不受信任的机器上使用
- 项目不会主动把凭证上传到第三方；配额读取只会请求 OpenAI 官方相关接口
- 如果你不希望本地保存凭证，请不要添加账号

## 已知限制

- OAuth 打开浏览器目前仍使用已弃用的 `tauri-plugin-shell` `open` 接口
- 自动重启 Codex 桌面应用目前只在 Windows 下实现并验证
- 当前主要在 Windows 环境下完成验证，macOS / Linux 仍需要更多实机测试
- 纯浏览器预览模式仍保留 mock fallback，只用于看界面
