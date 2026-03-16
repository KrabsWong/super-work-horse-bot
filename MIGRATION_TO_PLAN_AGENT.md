# temp-dir 适配 Plan Agent 迁移指南

## 当前问题

temp-dir 目前使用的是旧的 OpenSpec 命令 `/opsx:propose`，需要适配新的 Plan Agent 架构 `/research`。

## 需要修改的文件

### 1. config.yaml.example（配置模板）

**当前配置：**
```yaml
commands:
  - name: research
    dir: ~/workspace/research
    prompt: /opsx:propose  # ❌ 旧的 OpenSpec 命令
    session: research-bot
    model: opencode/glm-4.7-free
```

**修改为：**
```yaml
commands:
  - name: research
    dir: ~/workspace/research
    prompt: /research      # ✅ 新的 Plan Agent 命令
    session: research-bot
    model: opencode/glm-4.7-free
    maxConcurrent: 3
```

### 2. src/core/task-manager/index.ts（任务执行器）

**需要修改 executeTask 方法中的 prompt 构造逻辑（第 149-201 行）：**

**当前代码（第 170-185 行）：**
```typescript
} else {
  // 正常模式：使用 openspec 流程
  let additionalInstructions = `
IMPORTANT INSTRUCTIONS:
1. This is a RESEARCH task.
2. **STEP 1**: Read 'openspec/project.md'.
3. **STEP 2 (Routing)**: Based on my request, CHOOSE the most appropriate template from the Template Selection Strategy section.
   - If I asked for features/pricing -> Use 'product-requirement-standard.md'
   - If I asked for feasibility/integration -> 'Use tech-feasibility-standard.md'
4. **Action**: Create the directory and generated files strictly following the chosen template's structure.
5. **Language**: Report content in CHINESE (中文).
6. **Output**: Start by stating: 'Identifying Intent... Selected Template: [Template Name]'.
`;

  additionalInstructions += buildCompletionInstruction(task.statusFile);
  fullPrompt = `${cmdConfig.prompt} ${task.args}${additionalInstructions}`;
}
```

**修改为：**
```typescript
} else {
  // 正常模式：使用 Plan Agent 流程
  let additionalInstructions = `

【系统指令 - Plan Agent 工作流】
你是一个专业的研究助手。请按照以下 Plan Agent 工作流程处理用户请求：

1. **规划阶段** (/content-plan):
   - 分析用户研究意图
   - 从 templates/metadata.yaml 中选择最佳模板
   - 规划所需模块（根据复杂度动态裁剪）
   - 生成执行计划并等待用户确认

2. **生成阶段** (/content-create):
   - 创建目录结构：content/research/YYYY-MM-DD_<topic>/
   - 生成所有模块文件
   - 填充研究内容（必须遵循模板的质量标准）
   
3. **质量标准**（强制执行）：
   - 每模块 ≥3 个子章节，每子章节 ≥200 字
   - 每 300 字 1+ 数据点
   - 每模块 3-5 个高质量引用
   - 每模块 ≥1 个 Mermaid 图表
   - 必须包含优势与局限分析

4. **提交阶段** (/content-commit):
   - Git 提交（可选，等待用户确认）

可用模板（根据请求自动选择）：
- tech-solution: 技术方案研究
- tech-feasibility: 技术可行性与集成
- tech-comparison: 技术对比与选型
- financial-report: 财报分析
- financial-mechanism: 金融机制分析（ETF/期权/期货）
- financial-correlation: 资产相关性分析
- academic-paper: 学术论文研究
- automotive-history: 汽车历史研究
- sports-racing: 运动赛事研究
- product-requirement: 产品需求与报价
- goal-planning: 目标规划与路线图
- auto-research: 硅基写手（单文件快速研究）

输出要求：
- 所有内容使用中文（技术术语保留英文）
- 首先输出执行计划，等待用户确认后再继续
- 遵循选定模板的具体要求
`;

  additionalInstructions += buildCompletionInstruction(task.statusFile);
  fullPrompt = `${cmdConfig.prompt} ${task.args}${additionalInstructions}`;
}
```

### 3. README.md（文档更新）

**第 126-127 行的示例命令需要更新：**

**当前：**
```bash
cd ~/workspace/research && opencode --model="opencode/glm-4.7-free" --prompt="/opsx:propose 帮我生成一份研究报告..."
```

**修改为：**
```bash
cd ~/workspace/research && opencode --model="opencode/glm-4.7-free" --prompt="/research 帮我生成一份研究报告..."
```

**第 61 行的配置示例：**

**当前：**
```yaml
prompt: /opsx:propose
```

**修改为：**
```yaml
prompt: /research
```

**第 231 和 249 行的配置示例同样需要修改。**

### 4. src/core/task-manager/index.ts（测试模式提示）

**第 160-167 行的测试模式提示也需要更新：**

**当前：**
```typescript
const testModeInstructions = `
[TEST MODE]
You are in test mode. The user has prefixed their request with "大哥测试下".
Please read 'openspec/project.md' to understand the project structure and execution flow.
Then respond to the user's request directly without following the full research workflow.
`;
```

**修改为：**
```typescript
const testModeInstructions = `
[TEST MODE]
You are in test mode. The user has prefixed their request with "大哥测试下".
Please read the project files to understand the structure and execution flow.
Then respond to the user's request directly without following the full research workflow.
Note: OpenSpec has been deprecated. Use the new Plan Agent workflow for normal tasks.
`;
```

## 迁移步骤

### 步骤 1: 更新配置文件

```bash
# 备份现有配置
cp config.yaml config.yaml.backup

# 修改配置
sed -i '' 's|/opsx:propose|/research|g' config.yaml
```

### 步骤 2: 更新代码文件

修改 `src/core/task-manager/index.ts`：
- 更新正常模式的 additionalInstructions
- 更新测试模式的 testModeInstructions

### 步骤 3: 更新文档

修改 `README.md`：
- 更新所有 `/opsx:propose` 为 `/research`
- 更新配置示例

### 步骤 4: 重启服务

```bash
bun start
```

## 快速应用补丁

如果你想一次性应用所有修改，可以运行：

```bash
# 1. 更新 config.yaml
sed -i '' 's|prompt: /opsx:propose|prompt: /research|g' config.yaml

# 2. 重启服务
bun start
```

## 验证

发送测试消息到 Telegram：
```
/research 研究 React Server Components
```

期望行为：
1. Bot 接收消息
2. 构造包含 `/research` 的 prompt
3. 启动 opencode 执行 Plan Agent 工作流
4. 在目标目录生成研究内容

## 注意事项

1. **路径更新**：确保 `config.yaml` 中的 `dir` 指向正确的 vibe-research 目录
2. **模板路径**：Plan Agent 会自动读取 `templates/metadata.yaml`，无需额外配置
3. **权限**：确保 bot 有权限在目标目录创建文件
4. **备份**：修改前备份 `config.yaml`

## 新工作流对比

| 阶段 | 旧 (OpenSpec) | 新 (Plan Agent) |
|------|--------------|-----------------|
| 规划 | `/opsx:propose` → 人工选择模板 | `/content-plan` → AI 自动选择 |
| 生成 | `/opsx:apply` 执行变更 | `/content-create` 生成内容 |
| 提交 | `/opsx:archive` 归档 | `/content-commit` 简化提交 |
| 完整命令 | `/opsx:propose` + `/opsx:apply` + `/opsx:archive` | `/research` (一体化) |

新工作流更简单、更智能！
