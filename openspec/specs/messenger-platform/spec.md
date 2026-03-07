# messenger-platform Specification

## Purpose
提供统一的消息平台抽象层，支持 Telegram 和 Discord，为未来扩展其他平台奠定基础。

## Requirements

### Requirement: Platform Abstraction Interface

系统 SHALL 提供统一的消息平台抽象接口，屏蔽 Telegram 和 Discord 的实现差异。

#### Scenario: Send message through abstraction

- **WHEN** 业务代码调用 `messenger.sendMessage(chatId, message)`
- **THEN** 系统 SHALL 通过配置的平台发送消息
- **AND** 返回统一格式的 MessageResult

#### Scenario: Edit message through abstraction

- **WHEN** 业务代码调用 `messenger.editMessage(chatId, messageId, message)`
- **THEN** 系统 SHALL 编辑指定消息
- **AND** 返回成功/失败状态

#### Scenario: Platform not enabled

- **WHEN** 尝试调用未启用平台的方法
- **THEN** 系统 SHALL 抛出 PlatformNotEnabledError
- **AND** 日志记录警告信息

### Requirement: Multi-Platform Management

系统 SHALL 支持同时运行多个消息平台，通过配置灵活控制。

#### Scenario: Start multiple platforms

- **WHEN** 配置中 `telegram.enabled: true` 且 `discord.enabled: true`
- **THEN** 系统 SHALL 同时启动 Telegram 和 Discord Bot
- **AND** 两个平台独立运行，互不干扰

#### Scenario: Start single platform

- **WHEN** 配置中只有 `telegram.enabled: true`
- **THEN** 系统 SHALL 只启动 Telegram Bot
- **AND** Discord Bot 不初始化

#### Scenario: Stop all platforms

- **WHEN** 调用 `messengerManager.stopAll()`
- **THEN** 系统 SHALL 优雅停止所有运行中的平台
- **AND** 清理资源

### Requirement: Command Handler Registration

系统 SHALL 提供统一的命令处理器注册接口，支持跨平台命令处理。

#### Scenario: Register command handler

- **WHEN** 调用 `messenger.onCommand('research', handler)`
- **THEN** 系统 SHALL 在所有启用的平台上注册该命令处理器
- **AND** 命令触发时调用统一的 handler

#### Scenario: Command with platform context

- **WHEN** 用户在任何平台发送 `/research <args>`
- **THEN** 系统 SHALL 调用 handler 并传入 CommandContext
- **AND** CommandContext 包含平台标识、用户信息、参数等

### Requirement: Configuration Management

系统 SHALL 支持统一的配置管理，包括平台开关和认证信息。

#### Scenario: Load platform configuration

- **WHEN** 系统启动时读取配置文件
- **THEN** 系统 SHALL 解析 `platforms` 配置块
- **AND** 为每个启用的平台创建对应实例

#### Scenario: Backward compatibility

- **WHEN** 配置文件包含旧格式 `telegramBotToken`
- **THEN** 系统 SHALL 自动映射到 `platforms.telegram.token`
- **AND** 正常启动 Telegram Bot

### Requirement: Discord Bot Implementation

系统 SHALL 实现完整的 Discord Bot 功能，对齐 Telegram 所有能力。

#### Scenario: Discord command handling

- **WHEN** 用户在 Discord 发送 `/research <args>`
- **THEN** 系统 SHALL 解析命令和参数
- **AND** 触发与 Telegram 相同的业务逻辑

#### Scenario: Discord message formatting

- **WHEN** 任务状态更新时
- **THEN** 系统 SHALL 在 Discord 发送格式化的状态消息
- **AND** 支持消息编辑更新状态

#### Scenario: Discord notification

- **WHEN** 定时任务或监控事件触发
- **THEN** 系统 SHALL 通过 Discord 发送通知
- **AND** 使用配置的 channelId

### Requirement: Error Handling

系统 SHALL 优雅处理平台特定的错误，不影响其他平台运行。

#### Scenario: Platform connection failure

- **WHEN** 某个平台连接失败（如 token 无效）
- **THEN** 系统 SHALL 记录错误日志
- **AND** 其他正常平台继续运行
- **AND** 启动流程不中断

#### Scenario: API rate limit

- **WHEN** 某个平台触发 API 限流
- **THEN** 系统 SHALL 实现指数退避重试
- **AND** 不影响其他平台