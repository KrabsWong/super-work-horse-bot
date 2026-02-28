import type { Context, Telegraf, Telegram } from 'telegraf';

/**
 * CLI tool type
 */
export type CliType = 'opencode' | 'claude';

/**
 * CLI-specific configuration options
 */
export interface CliConfig {
  /** CLI tool type: 'opencode' (default) or 'claude' */
  type: CliType;
  /** Skip permission checks (claude only). Use with caution in trusted environments. */
  skipPermissions?: boolean;
}

/**
 * Configuration for a single command
 */
export interface CommandConfig {
  dir: string;
  prompt: string;
  session: string;
  model?: string;
  /** CLI tool configuration. Defaults to opencode if not specified */
  cli?: CliConfig;
}

/**
 * Configuration for a cron task
 */
export interface CronTaskConfig {
  schedule: string;
  dir: string;
  session: string;
  chatId: number;
  commandName: string;
  enabled: boolean;
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
 * Telegram API client type (for sending messages)
 */
export type TelegramClient = Telegram | Telegraf['telegram'];

/**
 * Result of command execution
 */
export interface ExecutionResult {
  success: boolean;
  error?: string | null;
  statusFile?: string;
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
  telegram?: TelegramClient;
  enableMonitoring?: boolean;
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