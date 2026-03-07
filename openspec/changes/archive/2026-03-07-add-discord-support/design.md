# Design: Discord Support with Platform Abstraction

## Context

当前项目是 Telegram Bot，使用 Telegraf 框架实现。用户需要 Discord 对等能力。

关键约束：
- 必须支持同时运行双平台
- 配置统一管理
- 架构需要抽象层便于未来扩展

## Goals / Non-Goals

**Goals:**
- 实现 Discord Bot，对齐 Telegram 所有能力
- 创建平台抽象层，统一消息接口
- 支持配置灵活开关平台
- 共享核心业务逻辑（任务管理、命令执行、定时任务）

**Non-Goals:**
- 不实现 Discord 特有的高级功能（如 Slash Commands 注册、Buttons、Modals）
- 不实现多服务器/多频道管理
- 不改变现有 Git Worktree、tmux、监控等核心逻辑

## Decisions

### 1. 平台抽象层设计

```
src/messenger/
├── index.ts           # 导出统一接口
├── types.ts           # 平台无关类型定义
├── manager.ts         # MessengerManager，管理多平台实例
├── telegram/          # Telegram 实现
│   ├── index.ts       # TelegramMessenger 类
│   └── adapter.ts     # Telegraf 适配器
└── discord/           # Discord 实现
    ├── index.ts       # DiscordMessenger 类
    └── adapter.ts     # discord.js 适配器
```

**核心接口：**
```typescript
interface MessengerPlatform {
  name: 'telegram' | 'discord';
  start(): Promise<void>;
  stop(): Promise<void>;
  sendMessage(chatId: string, message: string): Promise<MessageResult>;
  editMessage(chatId: string, messageId: string, message: string): Promise<boolean>;
  onCommand(handler: CommandHandler): void;
}
```

**理由：** 
- 最小化接口设计，聚焦核心能力
- 每平台独立实现，互不干扰
- Manager 统一管理生命周期

### 2. 命令处理器重构

当前 `src/bot/handlers.ts` 直接依赖 Telegraf Context，改为：

```typescript
// src/commands/handlers.ts (新文件)
interface CommandContext {
  platform: 'telegram' | 'discord';
  userId: string;
  username: string;
  chatId: string;
  args: string;
  messenger: MessengerPlatform;
}

async function handleResearch(ctx: CommandContext): Promise<void> {
  // 平台无关的实现
}
```

**理由：**
- 命令逻辑与平台解耦
- 平台适配器负责将平台特定 Context 转换为 CommandContext

### 3. 配置结构

```yaml
platforms:
  telegram:
    enabled: true
    token: "xxx"
  discord:
    enabled: true
    token: "xxx"
    # Discord 特有配置
    intents: ["Guilds", "GuildMessages", "DirectMessages"]

# 向后兼容
telegramBotToken: "xxx"  # 等价于 platforms.telegram.token
```

**理由：**
- 统一配置便于管理
- 向后兼容减少迁移成本
- 每平台可独立配置特有选项

### 4. 启动流程

```typescript
// src/index.ts
const messengerManager = new MessengerManager(config);

if (config.platforms.telegram.enabled) {
  messengerManager.register(new TelegramMessenger(config.platforms.telegram));
}
if (config.platforms.discord.enabled) {
  messengerManager.register(new DiscordMessenger(config.platforms.discord));
}

await messengerManager.startAll();
```

**理由：**
- 按需启动，配置灵活
- 统一生命周期管理

## Risks / Trade-offs

### 风险 1: Discord.js 体积较大
- **影响:** 安装包增大约 10MB
- **缓解:** Discord Bot 按需启用，不启用则不加载

### 风险 2: 平台 API 差异
- **影响:** 某些功能在 Discord 上表现不同（如消息编辑）
- **缓解:** 抽象层封装差异，提供降级方案

### 风险 3: 现有代码重构
- **影响:** handlers.ts 需要重构为平台无关
- **缓解:** 保持向后兼容，增量迁移

## Migration Plan

1. **Phase 1: 基础抽象层**
   - 创建 MessengerPlatform 接口
   - 实现 TelegramMessenger（封装现有 Telegraf 代码）
   - 验证功能不变

2. **Phase 2: Discord 实现**
   - 添加 discord.js 依赖
   - 实现 DiscordMessenger
   - 实现命令处理器适配

3. **Phase 3: 配置更新**
   - 新增 platforms 配置块
   - 保持向后兼容
   - 更新文档

4. **Phase 4: 集成测试**
   - 双平台同时运行测试
   - 任务队列共享测试
   - 定时任务通知测试

**回滚方案:** 
- 配置文件支持旧格式
- `platforms.telegram.enabled: false` 时行为等同于旧版本
- 可随时回退到旧代码

## Open Questions

1. Discord 的 chatId 如何处理？
   - 建议: Discord 使用 `channelId` 作为 chatId，统一为 string 类型

2. 任务状态消息在 Discord 上的展示？
   - 建议: 使用 Embed 格式增强可读性（可选优化）

3. Discord Slash Commands 是否需要？
   - 建议: 暂不实现，保持与 Telegram 一致的命令格式（`/research xxx`）