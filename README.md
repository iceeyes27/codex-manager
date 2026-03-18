# Codex Manager

桌面版多账号 Codex 管理器。目标是解决两个问题：

- 多个 OpenAI/Codex 账号之间快速切换
- 切换账号时保留每个账号各自的 `~/.codex/sessions` 会话历史

当前实现基于 `React + Vite + Tauri v2`，前端负责账号面板、配额展示和交互，后端负责本地凭证、会话快照和真实配额拉取。

## 当前能力

- OAuth 添加账号，不需要手动粘贴 `auth.json`
- 每账号单独保存凭证到应用数据目录
- 切换账号时自动：
  - 快照当前 `~/.codex/sessions`
  - 还原目标账号历史会话
  - 写入目标账号 `~/.codex/auth.json`
- 切换流程带回滚
- 自动识别当前正在使用的账号
- 读取真实配额并展示 5 小时 / 每周已使用百分比
- 支持整页刷新配额和单卡片刷新配额
- 支持导出备份 / 导入配置
- 设置持久化：主题、自动刷新频率、代理

## 配额来源

当前版本的配额不是估算值，也不是前端 mock。

桌面端会使用每个账号自己的 `access_token + ChatGPT-Account-Id` 请求网页侧用量接口，读取真实配额窗口和重置时间。这样能按账号隔离配额，不会把多个账号读成同一份数据。

如果某个账号没有拿到官方数据，界面会明确显示失败原因，而不是回退成假数据。

## 当前账号识别

应用会读取当前机器上的 `~/.codex/auth.json`，优先按以下顺序判断哪张卡是当前活跃账号：

1. `auth.json` 中解析出的 `email`
2. `auth.json` 中解析出的 `userId`
3. 已保存凭证中的 `chatgpt_account_id`
4. `refresh_token / access_token / id_token`

这样即使某张卡片对应的本地凭证文件没有刚好同步刷新，只要当前 `auth.json` 的身份信息能对应上，也能识别出真正活跃的账号。

## 切换逻辑

切换流程由 Tauri 后端串行执行，核心文件是 [sessions.rs](./src-tauri/src/commands/sessions.rs)。

当前实现：

1. 为当前账号生成会话快照
2. 还原目标账号历史会话
3. 写入目标账号 `auth.json`

补充的稳态处理：

- 切换操作带全局锁，避免并发切换互相覆盖
- 快照写入先落临时目录，成功后再替换旧快照，避免失败时损坏上一份可用备份
- 还原失败和写入 `auth.json` 失败都会尝试回滚
- 前端不会再把“切换已成功，但本地 `accounts.json` 保存失败”误报成“切换失败”

## 目录结构

```text
src/
  components/        前端界面
  hooks/             交互逻辑
  store/             Zustand 状态
  utils/             账号识别、配额映射、备份导入导出

src-tauri/src/
  commands/          Tauri 后端命令
  models.rs          前后端共享数据结构
```

## 本地运行

前置依赖：

- Node.js 18+
- Rust stable
- Tauri v2 构建环境

安装依赖：

```bash
npm install
```

开发模式：

```bash
npm run tauri dev
```

前端单独预览：

```bash
npm run dev
```

生产构建：

```bash
npm run build
cd src-tauri
cargo check
```

## 数据位置

应用数据默认保存在：

```text
%APPDATA%/com.codex-manager.app
```

主要文件：

- `accounts.json`：账号列表和 UI 状态
- `settings.json`：主题、代理、自动刷新设置
- `credentials/<account-id>.json`：每个账号保存的凭证
- `sessions/<account-id>/`：每个账号独立会话快照

实时使用的 Codex 目录仍然是：

```text
~/.codex
```

其中：

- `~/.codex/auth.json` 是当前生效账号
- `~/.codex/sessions` 是当前活跃会话目录

## 已知限制

- OAuth 打开浏览器的实现目前仍使用 `tauri-plugin-shell` 的已弃用 `open` 接口，后续建议迁移到 `tauri-plugin-opener`
- 当前主要在 Windows 环境下完成验证，虽然代码按跨平台路径编写，但 macOS / Linux 还需要补实机验证
- README 描述的是桌面版真实能力；纯浏览器预览模式仍保留 mock fallback，仅用于看界面
