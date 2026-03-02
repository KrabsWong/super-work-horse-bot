# Change: 支持多个 /research 任务并发执行

## Why

当前系统对每个命令类型（如 `/research`）只能处理一个任务，新请求会覆盖正在运行的任务。用户需要能够同时运行多个研究任务，并且需要解决多个任务同时操作 git 时的冲突问题。

## What Changes

### 核心变更

- **任务管理系统**：新增 TaskManager 模块，管理任务队列和并发槽位
- **动态 Session 命名**：每个任务获得独立的 tmux session（`research-bot-{taskId}`）
- **分支隔离策略**：每个任务从 main 创建独立分支，完成后提交 PR
- **Git 同步机制**：任务启动前自动同步本地 main 分支与远程
- **PR 管理**：自动创建 PR，支持配置合并策略（手动/自动）
- **Telegram 交互**：PR 完成后发送消息，包含 PR 链接和操作按钮
- **可配置并发数**：管理员可通过配置控制最大并发任务数
- **任务状态追踪**：用户可查看任务队列位置和运行状态

### 新增功能

- `/status` 命令：查看当前运行中的任务和排队中的任务
- `/cancel` 命令：取消排队中的任务
- 任务 ID 追踪：每个任务获得唯一标识符
- 队列通知：当任务排队时，告知用户当前队列位置
- PR 操作按钮：合并、关闭、查看详情

## Impact

- **Affected specs**: 新增 `task-management` capability
- **Affected code**:
  - `src/types/index.ts` - 新增任务和 PR 相关类型
  - `src/config/index.ts` - 新增 `maxConcurrent`, `prMergeStrategy` 配置
  - `src/commands/executor.ts` - 集成 TaskManager
  - `src/tmux/session.ts` - 支持动态 session 名称
  - `src/monitor/index.ts` - 按 taskId 管理监控
  - `src/bot/handlers.ts` - 新增 `/status`, `/cancel` 命令，PR 交互按钮
  - `src/index.ts` - 初始化 TaskManager
- **New modules**:
  - `src/task-manager/index.ts`
  - `src/task-manager/types.ts`
  - `src/task-manager/slot-manager.ts`
  - `src/task-manager/pr-manager.ts`
  - `src/task-manager/queue.ts`
  - `src/git/sync.ts`
  - `src/git/branch.ts`