export interface CronTaskConfig {
  name: string;
  schedule: string;
  messenger: 'telegram' | 'discord';
  enabled: boolean;
  autoCommand: string;      // 显式声明的自动化命令（如 /auto-daily-research）
  description?: string;     // 可选的任务描述（仅用于文档说明）
  cronExpression?: string;
  lastRun?: number;
  nextRun?: number;
}

export interface ParsedTaskFile {
  frontmatter: {
    name: string;
    schedule: string;
    messenger: 'telegram' | 'discord';
    enabled?: boolean;
    autoCommand: string;
  };
  body: string | undefined;
}

export interface TimeRule {
  pattern: RegExp;
  convert: (match: RegExpMatchArray) => string;
  description: string;
}

export interface TaskValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}