export interface CronTaskConfig {
  name: string;
  schedule: string;
  messenger: 'telegram' | 'discord';
  enabled: boolean;
  description: string;
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
  };
  body: string;
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

export interface CronManagerOptions {
  cronDir: string;
  messenger: 'telegram' | 'discord';
  chatId: string;
}