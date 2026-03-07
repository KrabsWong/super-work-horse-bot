# Change: Add Markdown-based Cron Task Configuration

## Why

当前定时任务配置在 `config.yaml` 中以 YAML 结构化方式定义，存在以下问题：
- 配置不够直观，描述能力有限
- 任务与主配置混在一起，不便于管理
- 无法使用自然语言描述任务意图

需要一种更直观、更灵活的定时任务配置方式，支持：
- 自然语言描述任务意图
- 独立的任务文件管理
- 文件变更自动生效
- LLM 理解任务并规划执行步骤

## What Changes

- **ADDED** Markdown 格式的定时任务配置支持
- **ADDED** `cron/` 目录用于存放独立任务配置文件
- **ADDED** 时间规则引擎，支持自然语言时间表达式（如"每天 08:00"）
- **ADDED** LLM 规划器，解析任务描述生成执行计划
- **ADDED** 多步骤任务执行支持
- **ADDED** 新命令系统：`/run`, `/jobs`, `/cron`
- **MODIFIED** 移除 `config.yaml` 中的 `cronTasks` 配置项
- **MODIFIED** 重构现有命令系统，统一命令命名规范

## Impact

- Affected specs: `command-execution`, 新增 `cron-tasks`
- Affected code:
  - 目录结构重组为分层架构（infra/core/interface）
  - `src/scheduler/index.ts` - 调度器重构
  - `src/config/index.ts` - 移除 cronTasks 解析
  - `src/messenger/telegram/handlers.ts` - 命令处理器重构
  - `src/messenger/discord/index.ts` - 命令注册重构
  - 新增 `src/core/cron-manager/` - 定时任务管理（与 task-manager 并列）
    - 配置解析、时间规则、LLM 规划、执行编排
  - 所有模块按层级重新组织
