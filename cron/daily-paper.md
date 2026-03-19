---
name: daily-paper
schedule: 每天 09:00
messenger: telegram
enabled: true
command: auto-research
---

<!--
定时任务命令命名建议：
- 以 cron- 开头表示定时触发的任务，如: /cron-daily-report, /cron-weekly-sync
- 以 auto- 开头表示自动化工作流，如: /auto-github-trending, /auto-backup
- 使用 kebab-case 命名，清晰表达任务目的

下游服务（目标项目）根据 command 字段自行实现对应的业务逻辑。
-->

每天早上9点自动从 Hugging Face Papers 获取最新论文并进行深度解读。

任务流程：
1. 访问 https://huggingface.co/papers 获取最新论文列表
2. 选择最顶部（最新）的一篇论文，获取其详情页链接（如 https://huggingface.co/papers/2603.16669）
3. 在论文详情页面中找到对应的 arXiv Page 链接
4. 通过 arXiv 链接获取论文完整内容（PDF 或 HTML 版本）
5. 对论文进行详细解读和分析

分析内容应包括：
1. 论文标题、作者、机构等基本信息
2. 研究背景和动机（为什么做这项研究）
3. 核心贡献和创新点（与现有方法的区别）
4. 技术方法论详解（模型架构、算法流程、关键技术）
5. 实验设计和主要结果（数据集、评估指标、性能对比）
6. 论文的局限性和未来工作方向
7. 实际应用场景和潜在影响
8. 相关工作和领域背景

输出要求：
- 生成结构化的研究报告
- 包含关键图表和公式的解读
- 使用中文撰写，便于理解
- 最后附上论文的 Hugging Face 和 arXiv 链接
