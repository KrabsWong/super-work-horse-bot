import type { Context, Telegraf } from 'telegraf';

/**
 * Configuration for a single command
 */
export interface CommandConfig {
  dir: string;
  prompt: string;
  session: string;
  model?: string;
}

/**
 * Configuration for a cron task
 */
export interface CronTaskConfig {
  schedule: string;        // Cron expression (e.g., "0 9 * * *")
  dir: string;            // Working directory
  session: string;        // Tmux session name (distinct from manual commands)
  chatId: number;         // Telegram chat ID for notifications (must be a number, not string)
  commandName: string;    // Reference to base command config (e.g., "research")
  enabled: boolean;       // Whether this task is enabled
}

/**
 * Application configuration
 */
export interface Config {
  telegramBotToken: string;
  logLevel: string;
  commands: Record<string, CommandConfig>;
  cronTasks: Record<string, CronTaskConfig>;
}

/**
 * Bot instance type for scheduler
 */
export type BotInstance = Telegraf;

/**
 * Result of command execution
 */
export interface ExecutionResult {
  success: boolean;
  error?: string | null;
}

/**
 * Result of command validation
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Context for command execution
 */
export interface ExecutionContext {
  userId?: number;
  username?: string;
  chatId?: number;
}

/**
 * Result of a subprocess execution
 */
export interface SubprocessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Telegraf middleware next function type
 */
export type MiddlewareNext = () => Promise<void>;

/**
 * Telegraf context type alias
 */
export type BotContext = Context;
