export interface CronTaskConfig {
  name: string;
  schedule: string;
  messenger: 'telegram' | 'discord';
  enabled: boolean;
  commandName: string;
  description?: string;
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
    command: string;
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