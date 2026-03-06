# Change: Add Discord Bot Support with Platform Abstraction Layer

## Why

项目目前只支持 Telegram，用户需要在 Discord 上拥有对等能力。通过平台抽象层设计，可以：
- 同时支持 Telegram 和 Discord，通过配置灵活控制
- 为未来扩展其他消息平台（如 Slack、企业微信）奠定架构基础
- 统一业务逻辑，减少平台特定代码的重复

## What Changes

### 新增能力
- Discord Bot 完整实现，对齐 Telegram 所有命令和能力
- 平台抽象层（Messenger Platform），统一消息发送、命令处理接口
- 配置扩展支持双平台 token 和开关

### 架构变更
- 重构 `src/messenger/` 为平台抽象层
- 新增 `src/messenger/telegram/` 和 `src/messenger/discord/` 实现
- `src/bot/handlers.ts` 改为平台无关的命令处理器
- 配置文件新增 `platforms` 配置块

### 依赖变更
- 新增 `discord.js` 依赖

## Impact

- Affected specs: `telegram-bot`, `command-execution`, 新增 `messenger-platform`
- Affected code:
  - `src/index.ts` - 启动逻辑
  - `src/bot/` - handlers 和 middleware
  - `src/messenger/` - 消息发送抽象
  - `src/config/` - 配置加载
  - `src/types/` - 类型定义
  - `src/scheduler/` - 定时任务通知
  - `src/task-manager/` - 任务状态更新

## Migration

配置文件格式变更，需要更新 `config.yaml`：

```yaml
# 旧格式
telegramBotToken: xxx

# 新格式
platforms:
  telegram:
    enabled: true
    token: xxx
  discord:
    enabled: true
    token: xxx
```

向后兼容：保留 `telegramBotToken` 字段支持，自动映射到新格式。