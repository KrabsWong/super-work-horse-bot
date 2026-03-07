# Change: Telegram 消息流优化 - 使用编辑更新替代多条消息

## Why

当前 `/research` 命令执行时会发送多条独立消息，导致用户体验混乱：
1. "Executing your command..." - 命令收到时
2. "✅ 任务已启动" - 任务创建后
3. "✅ 任务执行完成" - 监控检测完成
4. "✅ 任务完成！" - TaskManager 完成回调（重复）

用户希望看到一条消息随任务进度实时更新，而不是多条碎片化消息。

## What Changes

- **ADDED**: 消息状态追踪模块 (`MessageTracker`)，管理消息 ID 和状态
- **MODIFIED**: Task 类型添加 `messageId` 字段用于追踪
- **MODIFIED**: 命令处理器发送初始消息后保存 message_id
- **MODIFIED**: 监控器使用 `editMessageText` 更新现有消息而非发送新消息
- **REMOVED**: TaskManager 的重复完成通知（与监控器重复）

## Impact

- **Affected specs**: `telegram-bot`
- **Affected code**:
  - `src/types/index.ts` - 添加 messageId 字段
  - `src/bot/handlers.ts` - 修改消息发送逻辑
  - `src/monitor/index.ts` - 使用消息编辑
  - `src/index.ts` - 移除重复的完成回调
  - `src/messenger/` - 新建消息状态管理模块

## User Experience Change

**Before** (4 messages):
```
[Bot] Executing your command...
[Bot] ✅ 任务已启动
      任务 ID: task-xxx
      ...
[Bot] ✅ 任务执行完成
      任务 ID: task-xxx
      ...
[Bot] ✅ 任务完成！
      任务 ID: task-xxx
```

**After** (1 message, updated 3 times):
```
[Bot] 🔄 正在执行任务...
      任务 ID: task-xxx
      命令: /research
      ...
      
      ↓ (edited to)
      
[Bot] ⏳ 任务运行中...
      任务 ID: task-xxx
      运行时间: 5 分钟
      
      ↓ (edited to)
      
[Bot] ✅ 任务完成
      任务 ID: task-xxx
      耗时: 16 分钟
```