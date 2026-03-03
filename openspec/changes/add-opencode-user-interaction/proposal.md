# Change: 添加 OpenCode 用户交互确认机制

## Why

当前系统通过 tmux 执行 OpenCode 命令，无法自动检测和处理任务执行过程中的用户确认请求（如权限请求、是否继续等），需要人工登录服务器处理。

通过 OpenCode Server SDK 监听任务执行事件，实现用户远程决策。

## What Changes

- 新增 `src/opencode/` 模块：封装 OpenCode Server SDK 连接、事件监听、Session 管理
- 新增 `src/interaction/` 模块：确认队列管理、用户响应处理、超时控制
- 扩展 Telegram 命令：添加 `/confirm`, `/deny`, `/skip`, `/interactions`
- 集成到 TaskManager：替换现有的 tmux 执行方式
- 配置扩展：新增 `opencodeServer` 配置项

## Impact

- Affected specs: command-execution
- Affected code: 
  - `src/task-manager/index.ts` (执行逻辑变更)
  - `src/bot/handlers.ts` (新增命令)
  - 新增 `src/opencode/`, `src/interaction/` 目录

## Breaking Changes

- 任务执行方式从 tmux 切换到 OpenCode Server SDK
- 保留 tmux 模式作为 fallback