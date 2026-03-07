## 1. Core Infrastructure

- [x] 1.1 在 `src/types/index.ts` 中 Task 接口添加 `messageId?: number` 字段
- [x] 1.2 创建 `src/messenger/index.ts` 消息状态管理模块
  - `MessageTracker` 类：管理消息 ID 与任务的映射
  - `sendTaskMessage()`: 发送初始消息并返回 message_id
  - `updateTaskMessage()`: 编辑现有消息更新状态
  - `formatTaskStatus()`: 格式化不同状态的消息内容

## 2. Handler 修改

- [x] 2.1 修改 `src/bot/handlers.ts` 中的 `createCommandHandler()`
  - 发送单条初始消息（包含任务信息）
  - 保存返回的 message_id 到 task
  - 移除重复的"任务已启动"消息

## 3. Monitor 修改

- [x] 3.1 修改 `src/monitor/index.ts` 中的 `startMonitoring()`
  - 接收 messageId 参数
  - 使用 `editMessageText` 更新消息而非发送新消息
  - 更新消息格式：运行中 → 完成/超时/异常

## 4. 清理重复通知

- [x] 4.1 移除 `src/index.ts` 中的 `taskManager.setTaskCompletionCallback()` 
  - 该回调发送的完成通知与监控器重复

## 5. 验证

- [x] 5.1 运行 `bun run --bun tsc --noEmit` 验证类型检查
- [x] 5.2 运行 `openspec validate update-telegram-message-flow --strict` 验证规范