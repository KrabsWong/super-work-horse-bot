## Context

当前系统使用 YAML 格式在 `config.yaml` 中配置定时任务，存在以下限制：
1. 配置结构化，描述能力有限
2. 任务与主配置耦合
3. 无法自然语言描述任务意图
4. 需要手动重启才能更新配置

新方案通过 Markdown 文件配置任务，支持自然语言描述，LLM 理解意图并规划执行。

## Goals / Non-Goals

### Goals
- 支持 Markdown 格式的任务配置文件
- 支持自然语言时间表达式
- 支持 LLM 规划任务执行步骤
- 支持文件变更自动生效
- 统一命令系统，提升可用性
- **重组目录结构为分层架构**

### Non-Goals
- 不支持复杂的 DAG 依赖调度
- 不支持分布式任务调度
- 不支持任务持久化存储（仅内存）

## Decisions

### 1. 任务配置格式

**决定**: 采用 YAML frontmatter + Markdown body 格式，存放在 `cron/` 目录

```markdown
---
name: baba-daily-report
schedule: 每天 08:00
messenger: telegram
enabled: true
---

每天早上8点，使用 /fff skill 获取 BABA 昨日股市数据，
生成走势分析报告和今日预期，发送到 Telegram。
```

**理由**: 
- frontmatter 提供结构化元数据
- body 支持自然语言描述
- 与现有 Markdown 生态兼容
- `cron/` 目录名与 `/cron` 命令一致

### 2. 时间表达式解析

**决定**: 使用规则引擎匹配 + 正则转换

```typescript
const timeRules = {
  "每天 (\\d{1,2}):(\\d{2})": "0 $2 $1 * *",
  "每周一 (\\d{1,2}):(\\d{2})": "0 $2 $1 * * 1",
  "工作日 (\\d{1,2}):(\\d{2})": "0 $2 $1 * * 1-5",
};
```

**理由**: 
- 覆盖常见场景，确定性高
- 实现简单，无需 LLM
- 可扩展规则库

### 3. LLM 规划器

**决定**: 任务触发时调用 LLM 解析任务描述，生成执行计划

**执行计划格式**:
```json
{
  "steps": [
    {"command": "fff", "args": "获取 BABA 昨日数据", "output": "data.json"},
    {"command": "fff", "args": "生成分析报告", "input": "data.json", "output": "report.md"},
    {"action": "send_file", "file": "report.md"}
  ]
}
```

**理由**: 
- 灵活理解自然语言意图
- 支持多步骤任务编排
- 上下文传递

### 4. 命令系统设计

**决定**: 按功能域分组命令

| 域 | 命令前缀 | 说明 |
|----|----------|------|
| 执行 | `/run` | 执行命令 |
| 状态 | `/jobs` | 任务状态管理 |
| 定时 | `/cron` | 定时任务管理 |

**理由**: 
- 语义清晰，避免混淆
- 层级结构，易于理解
- 避免 `/tasks` 与 `/jobs` 歧义

### 5. 结果输出

**决定**: 简报 + 文件附件发送到 Telegram/Discord

**理由**: 
- 无需持久化存储
- 直接可用
- 支持长文本

## Risks / Trade-offs

### Risk 1: LLM 规划不稳定
- **缓解**: 规划结果可缓存，相同任务复用
- **备选**: 提供 `plan` 字段手动指定步骤

### Risk 2: 时间解析歧义
- **缓解**: 启动时打印所有任务的下一次执行时间
- **备选**: 支持 cron 表达式作为 fallback

### Risk 3: 文件监听性能
- **缓解**: 使用 debounce，避免频繁重载
- **备选**: 仅在访问时检查文件修改时间

### Risk 4: 目录重组影响
- **缓解**: 逐步迁移，每步验证
- **备选**: 使用 IDE 重构工具批量更新 import

## Migration Plan

1. **目录重组**：创建 infra/core/interface 层级，移动现有模块
2. 更新所有 import 路径
3. 创建 `cron/` 目录
4. 将现有 `cronTasks` 迁移为 Markdown 文件
5. 移除 `config.yaml` 中的 `cronTasks` 配置
6. 更新命令系统

**回滚**: 保留 `cronTasks` 配置解析，标记为 deprecated

## Directory Structure (Final)

```
src/
├── infra/                    # 基础设施层
│   ├── tmux/                 # tmux 会话管理
│   ├── git/                  # git worktree 操作
│   ├── cli/                  # CLI 命令构建
│   └── monitor/              # 任务监控
│
├── core/                     # 核心业务层
│   ├── task-manager/         # 任务管理
│   ├── cron-manager/         # 定时任务管理（新增）
│   └── scheduler/            # 调度器
│
├── interface/                # 接口层
│   ├── messenger/            # 消息平台
│   └── commands/             # 命令处理器
│
├── config/                   # 配置
├── types/                    # 类型定义
└── index.ts                  # 入口

cron/                         # 定时任务配置目录
├── baba-daily-report.md
└── daily-research.md
```

## Open Questions

1. 是否需要支持任务执行历史查询？
2. 是否需要任务执行失败重试机制？
3. LLM 规划器使用哪个模型？是否需要配置？
