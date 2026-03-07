import type { CronTaskConfig, TaskValidationResult } from './types';

export function validateTaskConfig(config: CronTaskConfig): TaskValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!config.name || config.name.trim() === '') {
    errors.push('Task name is required');
  }
  
  if (config.name && !/^[a-zA-Z0-9_-]+$/.test(config.name)) {
    errors.push('Task name must contain only letters, numbers, underscores, and hyphens');
  }
  
  if (!config.schedule || config.schedule.trim() === '') {
    errors.push('Schedule is required');
  }
  
  if (!config.cronExpression) {
    errors.push('Invalid schedule expression');
  }
  
  if (!config.description || config.description.trim() === '') {
    warnings.push('Task description is empty');
  }
  
  if (!['telegram', 'discord'].includes(config.messenger)) {
    errors.push(`Invalid messenger: ${config.messenger}. Must be 'telegram' or 'discord'`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateCronExpression(expression: string): boolean {
  const parts = expression.split(/\s+/);
  
  if (parts.length < 5 || parts.length > 6) {
    return false;
  }
  
  return true;
}