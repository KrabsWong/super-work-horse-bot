# 设计：OpenCode 用户交互确认机制

## 背景

当前系统通过 tmux 执行 OpenCode 命令，但在任务执行过程中如果遇到需要用户确认的环节（如权限请求、是否继续等），无法自动检测并通知用户，需要人工登录服务器处理。

## 目标

通过 OpenCode Server SDK 监听任务执行过程中的用户确认请求，并通过 Telegram 机器人转发给用户，让用户可以远程决策。

## 技术方案

### 1. 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Telegram Bot                              │
├─────────────────────────────────────────────────────────────────┤
│  handlers.ts │ task-manager │ monitor │ messenger                │
└──────┬────────────────────────────────────────────────┬─────────┘
       │                                                │
       │  ┌─────────────────────────────────────────────▼─────────┐
       │  │                   OpenCode Server                     │
       │  │                    (opencode serve)                   │
       │  │                                                      │
       │  │  ┌─────────┐  ┌─────────────┐  ┌──────────────────┐  │
       │  │  │ Session │  │   Events    │  │  Control API     │  │
       │  │  │ Manager │  │  (SSE)      │  │  (/tui/control/*)│  │
       │  │  └────┬────┘  └──────┬──────┘  └────────┬─────────┘  │
       │  │       │              │                  │            │
       │  │       └──────────────┼──────────────────┘            │
       │  │                      │                               │
       │  │              ┌───────▼───────┐                       │
       │  │              │  opencode CLI  │ (实际执行任务)        │
       │  │              └───────────────┘                       │
       │  └──────────────────────────────────────────────────────┘
       │
       │  ┌───────────────────────────────────────────────────────┐
       └──►│  InteractionManager (新增)                           │
           │  - 监听事件流                                         │
           │  - 管理待确认队列                                     │
           │  - 处理用户响应                                       │
           └───────────────────────────────────────────────────────┘
```

### 2. 新增文件结构

```
src/
├── opencode/                    # 新增模块
│   ├── client.ts                # OpenCode Server 连接管理
│   ├── events.ts                # 事件监听处理
│   ├── session.ts               # Session 管理
│   └── types.ts                 # 类型定义
├── interaction/                 # 新增模块
│   ├── index.ts                 # 主入口 (InteractionManager)
│   ├── queue.ts                 # 确认队列管理
│   ├── handlers.ts              # 用户响应处理
│   └── types.ts                 # 类型定义 & 消息模板
```

### 3. 核心类型定义

```typescript
// src/interaction/types.ts

export type InteractionType = 
  | 'permission'      // 权限确认
  | 'continue'        // 继续执行确认
  | 'custom';         // 自定义确认

export interface InteractionRequest {
  id: string;
  taskId: string;
  sessionId: string;
  type: InteractionType;
  message: string;          // 需要用户确认的内容
  options?: string[];        // 可选选项
  createdAt: number;
  expiresAt: number;         // 超时时间
  chatId: number;            // 通知的用户
}

export interface InteractionResponse {
  requestId: string;
  response: string;
  respondedAt: number;
}

// src/opencode/types.ts

export interface OpenCodeSession {
  id: string;
  status: 'idle' | 'running' | 'waiting' | 'completed';
  taskId: string;
  chatId: number;
}

export interface ControlRequest {
  type: string;
  message: string;
  sessionId: string;
  requestId: string;
}
```

### 4. 流程设计

#### 4.1 整体流程

```
用户发送 /research 命令
         │
         ▼
TaskManager 创建任务
         │
         ▼
启动 OpenCode Server (如果未启动)
         │
         ▼
通过 SDK 创建 Session 并执行任务
         │
         ▼
┌────────┼────────┐
│ 监听 Events 流  │
│  - session.started
│  - session.waiting  ◄── 检测到需要确认
│  - session.completed
│  - session.error
└────────┬────────┘
         │
         ▼
   检测到 waiting 事件
         │
         ▼
解析确认请求内容
         │
         ▼
通过 Telegram 发送确认消息给用户
         │
         ▼
等待用户响应 (/confirm /deny /skip)
         │
         ▼
调用 /tui/control/response 响应 OpenCode
         │
         ▼
任务继续执行直至完成
```

#### 4.2 OpenCode Server 事件映射

| OpenCode 事件 | 处理逻辑 |
|---------------|----------|
| `session.started` | 记录任务开始，更新状态为 running |
| `session.waiting` | 解析控制请求，发送到 Telegram 等待用户确认 |
| `session.completed` | 标记任务完成，清理资源 |
| `session.error` | 标记任务失败，发送错误通知 |

### 5. 核心接口设计

#### 5.1 InteractionManager

```typescript
// src/interaction/index.ts

export class InteractionManager {
  // 单例
  static getInstance(): InteractionManager;
  
  // 初始化 OpenCode Server 连接
  async initialize(config: OpenCodeServerConfig): Promise<void>;
  
  // 启动事件监听
  startEventListener(): Promise<void>;
  
  // 处理 OpenCode 发来的控制请求
  handleControlRequest(request: ControlRequest): Promise<void>;
  
  // 用户响应确认
  async respond(requestId: string, response: string): Promise<boolean>;
  
  // 取消超时请求
  cleanupExpiredRequests(): void;
  
  // 获取待确认列表
  getPendingRequests(chatId: number): InteractionRequest[];
}
```

#### 5.2 OpenCodeClient

```typescript
// src/opencode/client.ts

export class OpenCodeClient {
  // 单例
  static getInstance(): OpenCodeClient;
  
  // 初始化 (启动或连接 Server)
  async initialize(port?: number): Promise<number>;
  
  // 创建 Session 并执行任务
  async executeTask(prompt: string, config: TaskConfig): Promise<string>;
  
  // 响应控制请求
  async respondToControl(sessionId: string, body: string): Promise<boolean>;
  
  // 中止任务
  async abort(sessionId: string): Promise<boolean>;
  
  // 监听事件
  subscribeToEvents(callback: (event: Event) => void): void;
  
  // 关闭
  async dispose(): Promise<void>;
}
```

### 6. 用户交互命令

| 命令 | 格式 | 说明 |
|------|------|------|
| `/confirm <id>` | `/confirm abc123` | 确认并继续执行 |
| `/deny <id>` | `/deny abc123` | 拒绝并终止任务 |
| `/skip <id>` | `/skip abc123` | 跳过当前步骤 |
| `/interactions` | `/interactions` | 查看所有待确认请求 |

### 7. 消息模板

```
🔐 需要确认

任务: task-20260304_143022-abc1
─────────────────────
[OpenCode 发来的确认内容]

─────────────────────
请回复:
/confirm abc123 - 确认继续
/deny abc123 - 拒绝终止
/skip abc123 - 跳过此步骤
```

### 8. 异常处理

| 场景 | 处理方式 |
|------|----------|
| OpenCode Server 未启动 | 自动启动，端口冲突则递增尝试 |
| 用户超时未响应 | 5分钟超时后自动 deny 并终止任务 |
| OpenCode Server 崩溃 | 捕获事件流错误，通知用户任务异常 |
| 用户响应了不存在的请求 | 提示请求不存在或已过期 |

### 9. 配置扩展

```yaml
# config.yaml

opencodeServer:
  port: 4096              # Server 端口
  autoStart: true         # 是否自动启动
  timeout: 300000         # 用户确认超时 (5分钟)

commands:
  - name: research
    # ... 现有配置 ...
    confirmTimeout: 300   # 确认超时时间（秒）
```

### 10. 依赖项

```json
{
  "dependencies": {
    "@opencode-ai/sdk": "^1.0.0"
  }
}
```

### 11. 实现步骤

| 阶段 | 任务 | 预估工作量 |
|------|------|-----------|
| 1 | 创建 `src/opencode/` 模块，封装 SDK 连接和事件监听 | 1天 |
| 2 | 创建 `src/interaction/` 模块，处理确认队列和用户响应 | 1天 |
| 3 | 集成到 TaskManager，替换现有的 tmux 执行方式 | 1天 |
| 4 | Telegram handlers 添加 confirm/deny/skip/interactions 命令 | 0.5天 |
| 5 | 测试 & 调试 | 1天 |
| **合计** | | **4.5天** |

### 12. 风险与注意事项

1. **OpenCode SDK 稳定性**: 需要验证 SDK 与 Server 的兼容性
2. **事件延迟**: SSE 事件可能存在延迟，需监控实时性
3. **Session 生命周期**: 需要正确管理 Session，避免资源泄漏
4. **并发控制**: 多个任务同时执行时的确认队列管理
5. **向后兼容**: 保留现有的 tmux 执行方式作为 fallback

## 替代方案对比

| 方案 | 优点 | 缺点 |
|------|------|------|
| **方案A (当前)** | 官方 API，事件驱动 | 需要 Server 模式运行 |
| **方案B (tmux 监控)** | 无需 Server | 需解析输出，准确性低 |

## 相关文档

- [OpenCode Server 文档](https://opencode.ai/docs/server)
- [OpenCode SDK 文档](https://opencode.ai/docs/sdk)