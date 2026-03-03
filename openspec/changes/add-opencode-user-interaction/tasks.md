## 1. 创建 OpenCode SDK 封装模块

- [ ] 1.1 安装 @opencode-ai/sdk 依赖
- [ ] 1.2 创建 src/opencode/types.ts 类型定义
- [ ] 1.3 创建 src/opencode/client.ts OpenCode Server 连接管理
- [ ] 1.4 创建 src/opencode/events.ts 事件监听处理
- [ ] 1.5 创建 src/opencode/session.ts Session 管理

## 2. 创建用户交互模块

- [ ] 2.1 创建 src/interaction/types.ts 类型定义和消息模板
- [ ] 2.2 创建 src/interaction/queue.ts 确认队列管理
- [ ] 2.3 创建 src/interaction/handlers.ts 用户响应处理
- [ ] 2.4 创建 src/interaction/index.ts InteractionManager 主入口

## 3. 集成到 TaskManager

- [ ] 3.1 修改 TaskManager 支持 OpenCode 执行模式
- [ ] 3.2 实现 executeTask 替换现有的 tmux 执行逻辑
- [ ] 3.3 添加 fallback 机制（OpenCode 失败时回退到 tmux）

## 4. 扩展 Telegram 命令

- [ ] 4.1 添加 /confirm 命令处理
- [ ] 4.2 添加 /deny 命令处理
- [ ] 4.3 添加 /skip 命令处理
- [ ] 4.4 添加 /interactions 命令（查看待确认列表）

## 5. 配置扩展

- [ ] 5.1 更新 src/types/index.ts 添加 OpenCodeServerConfig 类型
- [ ] 5.2 更新 src/config/index.ts 支持 opencodeServer 配置解析
- [ ] 5.3 更新 config.yaml.example 添加配置示例

## 6. 测试 & 调试

- [ ] 6.1 编写单元测试（InteractionManager, OpenCodeClient）
- [ ] 6.2 本地测试 OpenCode Server 连接
- [ ] 6.3 端到端测试用户确认流程
- [ ] 6.4 超时场景测试
- [ ] 6.5 并发场景测试

## 7. 文档 & 清理

- [ ] 7.1 更新 openspec/specs/command-execution/spec.md
- [ ] 7.2 更新 README.md（如果需要）
- [ ] 7.3 代码审查 & 优化