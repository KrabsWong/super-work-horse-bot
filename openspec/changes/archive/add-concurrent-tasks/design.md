# Design: 并发任务管理系统

## Context

### 背景

当前的 Telegram bot 系统对每个命令类型（如 `/research`）使用固定的 tmux session 名称（如 `research-bot`）。这意味着：

1. 同一时间只能运行一个该类型的任务
2. 新请求会覆盖正在运行的任务
3. 用户无法查看任务队列状态
4. 多任务并发时 git 操作会产生冲突

### 约束

- **单服务器部署**：所有任务在同一台服务器上运行
- **同一代码仓库**：多个任务可能同时对同一个仓库进行 git 操作
- **tmux 依赖**：需要保持 tmux 作为任务执行环境
- **向后兼容**：现有配置文件应继续工作

### 利益相关者

- **Bot 用户**：需要并发执行多个研究任务
- **系统管理员**：需要控制并发数量以避免资源耗尽
- **运维人员**：需要监控任务状态和审查变更

---

## Goals / Non-Goals

### Goals

1. 支持同一命令类型的多个任务并发执行
2. 可配置的最大并发数
3. 任务队列管理（入队、出队、状态查询）
4. 分支隔离策略，每个任务独立分支，无 git 冲突
5. 自动创建 PR，支持配置合并策略
6. 任务启动前同步本地 main 分支
7. 用户可见的任务状态和队列位置
8. Telegram 交互式 PR 操作

### Non-Goals

1. 分布式任务调度（超出单服务器部署范围）
2. 任务持久化存储（重启后队列丢失是可接受的）
3. 跨命令类型的全局并发控制（每个命令类型独立管理）
4. 优先级队列（FIFO 足够）

---

## Decisions

### Decision 1: 动态 Session 命名

**选择**：每个任务使用独立的 tmux session，格式为 `{baseSession}-{taskId}`

**原因**：
- 完全隔离每个任务的执行环境
- 便于独立监控和清理
- 用户可以通过 `tmux attach -t research-bot-abc123` 查看特定任务

**替代方案**：
- 使用 tmux windows（同一 session 内）：难以独立管理和清理
- 固定数量的 session 池：限制了灵活性，需要预分配

### Decision 2: 分支隔离策略（核心变更）

**选择**：每个任务从 main 创建独立分支，完成后提交 PR

**原因**：
- 完全隔离各任务的 git 操作，无冲突风险
- 支持完全并发，无序列化瓶颈
- 每个任务的变更可追溯、可审查
- 灵活的合并策略（手动/自动）

**实现流程**：
```
任务启动:
1. git fetch origin main
2. git checkout main
3. git reset --hard origin/main (同步本地 main)
4. git checkout -b task-{taskId}

任务完成:
1. git add -A
2. git commit -m "task: {task description}"
3. git push -u origin task-{taskId}
4. gh pr create --base main --title "Task: {description}" --body "{task info}"
5. 发送 Telegram 消息，附带 PR 链接和操作按钮
```

**分支命名**：`task-{taskId}`（如 `task-1709123456789-abc123`）

**替代方案**：
- Git Push Queue：序列化 push，有瓶颈，可能产生 merge 冲突
- Git Worktree：每个任务独立工作树，磁盘开销大

### Decision 3: PR 合并策略配置

**选择**：支持配置合并策略，默认手动

**配置项**：
```yaml
commands:
  - name: research
    prMergeStrategy: manual  # manual | auto
```

**策略说明**：
- `manual`（默认）：PR 创建后需用户手动合并，Telegram 显示合并按钮
- `auto`：PR 创建后自动合并，适合低风险任务

**Telegram 按钮**（manual 模式）：
```
✅ 任务完成！

任务 ID: task-abc123
PR: https://github.com/xxx/yyy/pull/42

[合并 PR] [关闭 PR] [查看详情]
```

### Decision 4: Task ID 格式

**选择**：`task-{timestamp}-{randomHex}`

示例：`task-1709123456789-abc123`

**原因**：
- 时间戳保证大致有序
- 随机部分避免冲突
- 可读性好，便于用户引用
- 直接用作分支名

### Decision 5: 槽位管理策略

**选择**：内存中的 Map 结构，以 taskId 为 key

**原因**：
- 快速查找和更新
- 无需持久化（重启后重新开始）
- 简单实现

**数据结构**：
```typescript
interface Slot {
  taskId: TaskId;
  sessionName: string;
  branchName: string;
  startTime: number;
  statusFile: string;
}

// Map<taskId, Slot>
const activeSlots = new Map<TaskId, Slot>();
```

### Decision 6: Main 分支同步机制

**选择**：每个任务启动前强制同步本地 main 与远程

**原因**：
- 确保每个任务都基于最新代码
- 避免基于过时代码工作
- 减少后续 PR 合并冲突

**实现**：
```bash
git fetch origin main
git checkout main
git reset --hard origin/main
```

---

## Risks / Trade-offs

### Risk 1: 资源耗尽

**风险**：并发任务过多导致服务器资源（CPU、内存、磁盘 I/O）耗尽

**缓解措施**：
- 默认 `maxConcurrent` 设为保守值（3）
- 管理员可根据服务器配置调整
- 监控资源使用情况（后续可添加告警）

### Risk 2: 分支数量增长

**风险**：长期运行后分支数量过多

**缓解措施**：
- PR 合并/关闭后自动删除远程分支
- 定期清理本地已合并分支（`git branch -d`）
- 可选：添加分支生命周期管理

### Risk 3: PR 合并冲突

**风险**：多个任务修改同一文件，PR 合并时产生冲突

**缓解措施**：
- 从最新 main 创建分支，减少冲突概率
- 冲突时提示用户手动解决
- 可选：检测冲突并自动 rebase

### Risk 4: 进程清理不完整

**风险**：任务取消或超时后，opencode 进程未完全清理

**缓解措施**：
- 复用现有的 `killOpencodeInSession()` 逻辑
- 清理 tmux session
- 删除状态文件
- 清理未提交的分支（可选）

### Trade-off: 队列不持久化

**权衡**：Bot 重启后队列丢失

**接受原因**：
- 研究任务通常是即时性的
- 重启频率低
- 实现复杂度显著降低

---

## Migration Plan

### Phase 1: 添加新模块（无破坏性变更）

1. 创建 `src/task-manager/` 模块
2. 创建 `src/git/` 模块（sync, branch）
3. 更新类型定义
4. 更新配置验证

### Phase 2: 集成 TaskManager

1. 修改 `executor.ts` 调用 TaskManager
2. 更新 `monitor/index.ts` 使用 taskId
3. 更新 `handlers.ts` 显示任务信息

### Phase 3: Git 操作集成

1. 实现任务启动前的 main 同步
2. 实现任务完成后的分支创建和 PR 提交
3. 实现 PR 管理（创建、查询、合并、关闭）

### Phase 4: Telegram 交互

1. 实现 PR 完成通知
2. 实现交互式按钮（合并、关闭、查看）
3. 实现 `/status` 和 `/cancel` 命令

### Rollback Plan

如果出现问题，可以通过配置文件将 `maxConcurrent` 设为 1，恢复单任务行为。

---

## Open Questions

1. **PR 描述模板**：PR 描述应包含哪些信息？（任务描述、执行时间、文件变更摘要）
2. **分支清理策略**：PR 关闭后是否立即删除分支，还是保留一段时间？
3. **冲突处理**：PR 合并冲突时，是否尝试自动 rebase？

---

## API Design

### TaskManager Public API

```typescript
class TaskManager {
  // 初始化
  initialize(): Promise<void>;
  
  // 任务管理
  createTask(commandName: string, args: string, context: ExecutionContext): Promise<TaskResult>;
  cancelTask(taskId: TaskId): Promise<boolean>;
  
  // 状态查询
  getTask(taskId: TaskId): Task | undefined;
  getRunningTasks(): Task[];
  getQueuedTasks(): Task[];
  getQueuePosition(taskId: TaskId): number;
  
  // 生命周期
  completeTask(taskId: TaskId): Promise<void>;
  failTask(taskId: TaskId, error: string): Promise<void>;
  
  // 清理
  cleanup(): void;
}

interface TaskResult {
  taskId: TaskId;
  status: 'running' | 'queued';
  queuePosition?: number;
  sessionName: string;
  branchName: string;
}
```

### PRManager Public API

```typescript
class PRManager {
  // PR 操作
  createPR(taskId: TaskId, title: string, body: string): Promise<PRInfo>;
  getPR(prNumber: number): Promise<PRInfo>;
  mergePR(prNumber: number): Promise<boolean>;
  closePR(prNumber: number): Promise<boolean>;
  
  // 分支操作
  createBranch(taskId: TaskId): Promise<string>;
  deleteBranch(branchName: string): Promise<void>;
}

interface PRInfo {
  number: number;
  url: string;
  title: string;
  state: 'open' | 'merged' | 'closed';
  branchName: string;
}
```

### Git Sync API

```typescript
class GitSync {
  // Main 分支同步
  syncMainBranch(): Promise<void>;
  
  // 状态检查
  isMainSynced(): Promise<boolean>;
  
  // 分支操作
  createTaskBranch(taskId: TaskId): Promise<string>;
  commitTaskChanges(taskId: TaskId, message: string): Promise<void>;
  pushTaskBranch(branchName: string): Promise<void>;
}
```

### Bot Commands

```
/research <text>  - 执行研究任务（返回任务 ID）
/status           - 显示所有运行中和排队的任务
/cancel <taskId>  - 取消指定任务
```

### Response Examples

**任务启动**：
```
✅ 任务已启动

任务 ID: task-1709123456789-abc123
分支: task-1709123456789-abc123
Session: research-bot-task-1709123456789-abc123

查看进度: tmux attach -t research-bot-task-1709123456789-abc123
```

**任务排队**：
```
⏳ 任务已排队

任务 ID: task-1709123456790-def456
队列位置: 第 2 位

当前有 3 个任务运行中，等待执行...
使用 /status 查看进度
```

**任务完成（manual 模式）**：
```
✅ 任务完成！

任务 ID: task-abc123
PR: https://github.com/xxx/yyy/pull/42

[合并 PR] [关闭 PR] [查看详情]
```

**任务完成（auto 模式）**：
```
✅ 任务完成并已自动合并！

任务 ID: task-abc123
PR: https://github.com/xxx/yyy/pull/42 (已合并)
```

**状态查询**：
```
📊 任务状态

运行中 (3/3):
• task-abc123: "研究新能源..." (运行 15 分钟)
  分支: task-abc123
• task-xyz789: "分析 Tesla..." (运行 8 分钟)
  分支: task-xyz789
• task-qwe456: "调研 AI..." (运行 3 分钟)
  分支: task-qwe456

排队中 (2 等待):
• task-def456: "分析 Apple..."
• task-rty789: "研究量子..."
```