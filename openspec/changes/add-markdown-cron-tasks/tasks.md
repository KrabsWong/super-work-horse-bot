## 0. 目录结构重组

- [x] 0.1 创建 `src/infra/` 目录结构
- [x] 0.2 移动 `tmux/` → `infra/tmux/`
- [x] 0.3 移动 `git/` → `infra/git/`
- [x] 0.4 移动 `cli/` → `infra/cli/`
- [x] 0.5 移动 `monitor/` → `infra/monitor/`
- [x] 0.6 创建 `src/core/` 目录结构
- [x] 0.7 移动 `task-manager/` → `core/task-manager/`
- [x] 0.8 移动 `scheduler/` → `core/scheduler/`
- [x] 0.9 创建 `src/interface/` 目录结构
- [x] 0.10 移动 `messenger/` → `interface/messenger/`
- [x] 0.11 移动 `commands/` → `interface/commands/`
- [x] 0.12 更新所有 import 路径

## 1. 定时任务管理模块

- [x] 1.1 创建 `src/core/cron-manager/types.ts` 定义任务配置类型
- [x] 1.2 创建 `src/core/cron-manager/parser.ts` 解析 Markdown + YAML frontmatter
- [x] 1.3 创建 `src/core/cron-manager/time-rules.ts` 时间表达式规则引擎
- [x] 1.4 创建 `src/core/cron-manager/validator.ts` 配置验证器
- [x] 1.5 创建 `src/core/cron-manager/watcher.ts` 文件变更监听

## 2. 定时任务执行

- [ ] 1.6 创建 `src/core/cron-manager/planner.ts` LLM 规划器
- [ ] 1.7 创建 `src/core/cron-manager/orchestrator.ts` 多步骤执行器（调用 task-manager）
- [ ] 1.8 创建 `src/core/cron-manager/reporter.ts` 报告生成与发送

## 3. 调度器重构

- [ ] 3.1 创建 `src/core/scheduler/registry.ts` 任务注册表
- [ ] 3.2 重构 `src/core/scheduler/index.ts` 支持 Markdown 任务配置
- [ ] 3.3 移除对 `config.yaml` 中 `cronTasks` 的依赖

## 4. 命令系统重构

- [ ] 4.1 创建 `src/interface/commands/job-commands.ts` 实现 `/jobs` 相关命令
- [ ] 4.2 创建 `src/interface/commands/cron-commands.ts` 实现 `/cron` 相关命令
- [ ] 4.3 创建 `src/interface/commands/run-command.ts` 实现 `/run` 命令
- [ ] 4.4 重构 `src/interface/messenger/telegram/handlers.ts` 注册新命令
- [ ] 4.5 重构 `src/interface/messenger/discord/index.ts` 注册新命令
- [ ] 4.6 移除旧命令 `/status`, `/finish`, 动态命令注册

## 5. 配置迁移

- [ ] 5.1 更新 `config.yaml.example` 移除 `cronTasks`
- [ ] 5.2 创建 `cron/` 目录结构
- [ ] 5.3 创建示例任务文件 `cron/daily-research.md`
- [ ] 5.4 更新 `src/index.ts` 入口文件 import 路径

## 6. 测试与验证

- [ ] 6.1 手动测试 `/run` 命令执行
- [ ] 6.2 手动测试 `/jobs` 命令查看状态
- [ ] 6.3 手动测试 `/jobs stop/cancel` 命令
- [ ] 6.4 手动测试 `/cron` 命令查看定时任务
- [ ] 6.5 手动测试 `/cron run` 手动触发任务
- [ ] 6.6 手动测试定时任务自动触发
- [ ] 6.7 手动测试任务文件热更新