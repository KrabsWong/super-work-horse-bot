# Tasks: Add Discord Support

## 1. 基础设施

- [ ] 1.1 添加 `discord.js` 依赖到 `package.json`
- [ ] 1.2 创建 `src/messenger/types.ts` 定义平台抽象接口
- [ ] 1.3 创建 `src/messenger/manager.ts` 实现 MessengerManager

## 2. Telegram 适配器（重构现有代码）

- [ ] 2.1 创建 `src/messenger/telegram/index.ts` 实现 TelegramMessenger 类
- [ ] 2.2 创建 `src/messenger/telegram/adapter.ts` 实现 Telegraf 适配器
- [ ] 2.3 重构 `src/bot/handlers.ts` 为平台无关命令处理器
- [ ] 2.4 创建 `src/commands/handlers.ts` 存放平台无关命令逻辑
- [ ] 2.5 更新 `src/index.ts` 使用 MessengerManager

## 3. Discord 实现

- [ ] 3.1 创建 `src/messenger/discord/index.ts` 实现 DiscordMessenger 类
- [ ] 3.2 创建 `src/messenger/discord/adapter.ts` 实现 discord.js 适配器
- [ ] 3.3 实现 Discord 命令解析（/research, /status, /cancel, /finish 等）
- [ ] 3.4 实现 Discord 消息发送和编辑

## 4. 配置更新

- [ ] 4.1 更新 `src/types/index.ts` 添加 PlatformConfig 类型
- [ ] 4.2 更新 `src/config/index.ts` 支持新配置格式
- [ ] 4.3 保持向后兼容（telegramBotToken 字段）
- [ ] 4.4 更新 `config.yaml.example`

## 5. 类型定义更新

- [ ] 5.1 更新 TelegramClient 类型为 MessengerClient
- [ ] 5.2 更新 ExecutionContext 适配新架构
- [ ] 5.3 更新 Task 类型支持平台标识

## 6. 集成更新

- [ ] 6.1 更新 `src/task-manager/index.ts` 使用 MessengerClient
- [ ] 6.2 更新 `src/scheduler/index.ts` 使用 MessengerManager
- [ ] 6.3 更新 `src/monitor/index.ts` 使用 MessengerClient

## 7. 测试与验证

- [ ] 7.1 验证 Telegram 单独运行正常
- [ ] 7.2 验证 Discord 单独运行正常
- [ ] 7.3 验证双平台同时运行正常
- [ ] 7.4 验证向后兼容（旧配置格式）

## 8. 文档更新

- [ ] 8.1 更新 `README.md` 添加 Discord 配置说明
- [ ] 8.2 更新 `openspec/project.md`