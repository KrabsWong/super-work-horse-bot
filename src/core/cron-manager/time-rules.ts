import type { TimeRule } from './types';

export const timeRules: TimeRule[] = [
  {
    pattern: /^每天\s*(\d{1,2}):(\d{2})$/,
    convert: (match) => {
      const hour = match[1].padStart(2, '0');
      const minute = match[2];
      return `${minute} ${hour} * * *`;
    },
    description: '每天 HH:MM',
  },
  {
    pattern: /^每周([一二三四五六日])\s*(\d{1,2}):(\d{2})$/,
    convert: (match) => {
      const dayMap: Record<string, string> = {
        '一': '1',
        '二': '2',
        '三': '3',
        '四': '4',
        '五': '5',
        '六': '6',
        '日': '0',
      };
      const day = dayMap[match[1]] || '1';
      const hour = match[2].padStart(2, '0');
      const minute = match[3];
      return `${minute} ${hour} * * ${day}`;
    },
    description: '每周X HH:MM',
  },
  {
    pattern: /^工作日\s*(\d{1,2}):(\d{2})$/,
    convert: (match) => {
      const hour = match[1].padStart(2, '0');
      const minute = match[2];
      return `${minute} ${hour} * * 1-5`;
    },
    description: '工作日 HH:MM',
  },
  {
    pattern: /^每周末\s*(\d{1,2}):(\d{2})$/,
    convert: (match) => {
      const hour = match[1].padStart(2, '0');
      const minute = match[2];
      return `${minute} ${hour} * * 0,6`;
    },
    description: '每周末 HH:MM',
  },
  {
    pattern: /^每小时$/,
    convert: () => '0 * * * *',
    description: '每小时执行',
  },
  {
    pattern: /^每(\d{1,2})小时$/,
    convert: (match) => {
      const hours = match[1];
      return `0 */${hours} * * *`;
    },
    description: '每N小时执行',
  },
  {
    pattern: /^每天(\d{1,2}):(\d{2})$/,
    convert: (match) => {
      const hour = match[1].padStart(2, '0');
      const minute = match[2];
      return `${minute} ${hour} * * *`;
    },
    description: '每天HH:MM（无空格）',
  },
];

export function parseTimeExpression(expression: string): { 
  cronExpression: string | null; 
  matched: boolean;
  description?: string;
} {
  const trimmed = expression.trim();
  
  if (isValidCronExpression(trimmed)) {
    return { cronExpression: trimmed, matched: true, description: '标准 cron 表达式' };
  }
  
  for (const rule of timeRules) {
    const match = trimmed.match(rule.pattern);
    if (match) {
      const cronExpression = rule.convert(match);
      return { cronExpression, matched: true, description: rule.description };
    }
  }
  
  return { cronExpression: null, matched: false };
}

function isValidCronExpression(expression: string): boolean {
  const parts = expression.split(/\s+/);
  return parts.length >= 5 && parts.length <= 6;
}

export function getNextRunDescription(cronExpression: string): string {
  return `Cron: ${cronExpression}`;
}