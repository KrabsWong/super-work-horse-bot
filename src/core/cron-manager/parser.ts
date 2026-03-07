import yaml from 'js-yaml';
import type { ParsedTaskFile, CronTaskConfig } from './types';
import { parseTimeExpression } from './time-rules';

const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;

export function parseTaskFile(content: string, filename: string): ParsedTaskFile | null {
  const match = content.match(FRONTMATTER_REGEX);
  
  if (!match) {
    console.error(`[Parser] No frontmatter found in ${filename}`);
    return null;
  }
  
  const [, frontmatterStr, body] = match;
  
  try {
    const frontmatter = yaml.load(frontmatterStr) as Record<string, unknown>;
    
    if (!frontmatter || typeof frontmatter !== 'object') {
      console.error(`[Parser] Invalid frontmatter in ${filename}`);
      return null;
    }
    
    const name = frontmatter.name as string;
    const schedule = frontmatter.schedule as string;
    const messenger = (frontmatter.messenger as 'telegram' | 'discord') || 'telegram';
    const enabled = frontmatter.enabled !== false;
    
    if (!name || !schedule) {
      console.error(`[Parser] Missing required fields in ${filename}: name=${!!name}, schedule=${!!schedule}`);
      return null;
    }
    
    return {
      frontmatter: {
        name,
        schedule,
        messenger,
        enabled,
      },
      body: body.trim(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Parser] YAML parse error in ${filename}: ${message}`);
    return null;
  }
}

export function createTaskConfig(parsed: ParsedTaskFile, filename: string): CronTaskConfig | null {
  const { frontmatter, body } = parsed;
  const { name, schedule, messenger, enabled } = frontmatter;
  
  const { cronExpression, matched } = parseTimeExpression(schedule);
  
  if (!matched || !cronExpression) {
    console.error(`[Parser] Cannot parse schedule "${schedule}" in ${filename}`);
    return null;
  }
  
  return {
    name,
    schedule,
    messenger,
    enabled: enabled ?? true,
    description: body,
    cronExpression,
  };
}

export function extractTaskName(filename: string): string {
  const baseName = filename.replace(/\.md$/, '');
  return baseName;
}