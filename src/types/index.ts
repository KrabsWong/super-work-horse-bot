import type { Context } from 'telegraf';

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
 * Application configuration
 */
export interface Config {
  telegramBotToken: string;
  logLevel: string;
  commands: Record<string, CommandConfig>;
}

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
