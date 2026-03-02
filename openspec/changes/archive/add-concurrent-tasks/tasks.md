# Implementation Tasks

## 1. 类型定义与配置

- [x] 1.1 在 `src/types/index.ts` 中添加任务相关类型
  - `TaskId` - 任务唯一标识符类型
  - `TaskStatus` - 任务状态枚举（pending, running, completed, failed, cancelled）
  - `Task` - 任务接口定义
  - `TaskManagerConfig` - 任务管理器配置接口
  - `PRMergeStrategy` - PR 合并策略枚举（manual, auto）
  - `PRInfo` - PR 信息接口
- [x] 1.2 在 `src/config/index.ts` 中添加配置字段
  - 更新 `RawCommandConfig` 接口，添加 `maxConcurrent`, `prMergeStrategy`
  - 更新 `CommandConfig` 接口
  - 更新 `validateCommandConfig` 函数
  - `maxConcurrent` 默认值设为 3
  - `prMergeStrategy` 默认值设为 `manual`

## 2. Git 模块

- [x] 2.1 创建 `src/git/sync.ts`
  - `syncMainBranch()` - 同步本地 main 分支与远程
  - `isMainSynced()` - 检查 main 是否已同步
  - `fetchOrigin()` - 执行 git fetch
- [x] 2.2 创建 `src/git/branch.ts`
  - `createTaskBranch(taskId)` - 创建任务分支
  - `commitChanges(message)` - 提交变更
  - `pushBranch(branchName)` - 推送分支到远程
  - `deleteBranch(branchName)` - 删除分支
  - `getBranchName(taskId)` - 生成分支名称

## 3. TaskManager 核心模块

- [x] 3.1 创建 `src/task-manager/types.ts`
  - 定义 `Task` 接口
  - 定义 `TaskStatus` 枚举
  - 定义 `Slot` 接口（包含 branchName）
  - 定义 `TaskQueue` 接口
  - 定义 `PRMergeStrategy` 枚举
- [x] 3.2 创建 `src/task-manager/slot-manager.ts`
  - `SlotManager` 类
  - `acquireSlot()` - 获取可用槽位
  - `releaseSlot()` - 释放槽位
  - `getAvailableSlots()` - 查询可用槽位数
  - `getRunningTasks()` - 获取运行中任务列表
- [x] 3.3 创建 `src/task-manager/queue.ts`
  - `TaskQueue` 类
  - `enqueue()` - 任务入队
  - `dequeue()` - 任务出队
  - `peek()` - 查看队首任务
  - `getPosition()` - 获取任务队列位置
  - `remove()` - 移除指定任务
- [x] 3.4 创建 `src/task-manager/pr-manager.ts`
  - `PRManager` 类
  - `createPR()` - 创建 PR
  - `getPR()` - 获取 PR 信息
  - `mergePR()` - 合并 PR
  - `closePR()` - 关闭 PR
  - `deleteBranchAfterMerge()` - 合并后删除分支

## 4. TaskManager 主模块

- [x] 4.1 创建 `src/task-manager/index.ts`
  - `TaskManager` 类
  - `initialize()` - 初始化任务管理器
  - `createTask()` - 创建新任务（包含 git sync 和分支创建）
  - `cancelTask()` - 取消任务
  - `getTaskStatus()` - 获取任务状态
  - `getRunningTasks()` - 获取所有运行中任务
  - `getQueuedTasks()` - 获取所有排队中任务
  - `completeTask()` - 完成任务（创建 PR）
  - `cleanup()` - 清理已完成任务
- [x] 4.2 实现任务生命周期管理
  - 任务创建 → Git 同步 → 创建分支 → 槽位检查 → 执行/入队
  - 任务完成 → 提交变更 → 创建 PR → 释放槽位 → 处理队列
  - 任务失败/取消 → 清理资源

## 5. 集成现有模块

- [x] 5.1 修改 `src/tmux/session.ts`
  - 更新 `executeInTmux()` 支持 `sessionName` 参数动态传入
  - 新增 `createSessionWithId()` 创建带 ID 的 session
  - 新增 `killSession()` 清理指定 session
- [x] 5.2 修改 `src/monitor/index.ts`
  - `activeMonitors` Map 改为以 `taskId` 为 key
  - 更新 `startMonitoring()` 接受 `taskId` 和 `branchName` 参数
  - 更新 `stopMonitoring()` 接受 `taskId` 参数
  - 任务完成时调用 `TaskManager.completeTask()`
- [x] 5.3 修改 `src/commands/executor.ts`
  - 移除直接的 tmux 调用
  - 改为调用 `TaskManager.createTask()`
  - 返回任务 ID、分支名和队列位置
- [x] 5.4 修改 `src/bot/handlers.ts`
  - 更新 `createCommandHandler()` 显示任务 ID、分支名和队列位置
  - 新增 `handleStatus()` 处理 `/status` 命令
  - 新增 `handleCancel()` 处理 `/cancel` 命令
  - 新增 PR 交互按钮处理（合并、关闭、查看）

## 6. Telegram 交互集成

- [x] 6.1 实现 PR 完成通知
  - 发送任务完成消息
  - 包含 PR 链接
  - 根据 `prMergeStrategy` 决定是否显示按钮
- [x] 6.2 实现交互按钮
  - 合并 PR 按钮（调用 `PRManager.mergePR()`）
  - 关闭 PR 按钮（调用 `PRManager.closePR()`）
  - 查看详情按钮（打开 PR 链接）
- [x] 6.3 实现自动合并模式
  - 当 `prMergeStrategy: auto` 时，PR 创建后自动合并
  - 发送已合并通知

## 7. 初始化与入口

- [x] 7.1 修改 `src/index.ts`
  - 导入并初始化 TaskManager
  - 在启动时验证配置
  - 在关闭时清理资源
  - 注册 Telegram 回调处理器

## 8. 测试与验证

- [x] 8.1 手动测试：同时发送多个 /research 命令
- [x] 8.2 验证队列功能：发送超过 maxConcurrent 数量的命令
- [x] 8.3 验证 Git 同步：确认每个任务都基于最新 main
- [x] 8.4 验证分支创建：确认每个任务创建独立分支
- [x] 8.5 验证 PR 创建：确认任务完成后正确创建 PR
- [x] 8.6 验证 PR 按钮：确认合并/关闭按钮正常工作
- [x] 8.7 验证 /status 命令：正确显示运行中和排队的任务
- [x] 8.8 验证任务取消：取消排队中的任务
- [x] 8.9 验证资源清理：任务完成后 tmux session 和监控正确清理
- [x] 8.10 验证分支清理：PR 合并/关闭后分支正确删除