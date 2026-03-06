import type { Context, Telegraf } from 'telegraf';
import type { PlatformsConfig, MessengerClient } from '../messenger/types';

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
  /** Maximum concurrent tasks for this command. Defaults to 3 */
  maxConcurrent: number;
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

export interface Config {
  logLevel: string;
  worktreeBaseDir?: string;
  commands: Record<string, CommandConfig>;
  cronTasks: Record<string, CronTaskConfig>;
  platforms: PlatformsConfig;
}

/**
 * Bot instance type for scheduler
 */
export type BotInstance = Telegraf;

export type { MessengerClient } from '../messenger/types';

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
  chatId?: number | string;
  messenger?: MessengerClient;
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

// ============================================================================
// Task Management Types
// ============================================================================

/**
 * Task unique identifier type
 * Format: task-{YYYYMMDD_HHMMSS}-{random}
 * Example: task-20260302_230718-abc1
 */
export type TaskId = string;

/**
 * Task status enumeration
 */
export enum TaskStatus {
  /** Task is waiting in queue */
  PENDING = 'pending',
  /** Task is currently running */
  RUNNING = 'running',
  /** Task completed successfully */
  COMPLETED = 'completed',
  /** Task failed with error */
  FAILED = 'failed',
  /** Task was cancelled by user */
  CANCELLED = 'cancelled',
}

/**
 * Task interface
 */
export interface Task {
  /** Unique task identifier */
  id: TaskId;
  /** Command name (e.g., 'research') */
  commandName: string;
  /** User-provided arguments */
  args: string;
  /** Current status */
  status: TaskStatus;
  /** tmux session name */
  sessionName: string;
  /** Git branch name */
  branchName: string;
  /** Git worktree path (isolated working directory for this task) */
  worktreePath: string;
  /** Status file path for completion detection */
  statusFile: string;
  /** Base working directory (repository root) */
  dir: string;
  /** Task creation timestamp */
  createdAt: number;
  /** Task start timestamp (when running) */
  startedAt?: number;
  /** Task completion timestamp */
  completedAt?: number;
  /** User ID who created the task */
  userId?: number;
  /** Username who created the task */
  username?: string;
  /** Chat ID for notifications */
  chatId?: number | string;
  /** Message ID for status updates (used for editing) */
  messageId?: number | string;
  /** Error message if failed */
  error?: string;
}

/**
 * Slot information for concurrent task management
 */
export interface Slot {
  /** Task ID occupying this slot */
  taskId: TaskId;
  /** tmux session name */
  sessionName: string;
  /** Git branch name */
  branchName: string;
  /** Task start timestamp */
  startTime: number;
  /** Status file path */
  statusFile: string;
}

/**
 * Task manager configuration
 */
export interface TaskManagerConfig {
  /** Maximum concurrent tasks per command */
  maxConcurrent: number;
}

/**
 * Result of task creation
 */
export interface TaskResult {
  /** Task ID */
  taskId: TaskId;
  /** Task status (running or queued) */
  status: 'running' | 'queued';
  /** Queue position (if queued) */
  queuePosition?: number;
  /** tmux session name */
  sessionName: string;
  /** Git branch name */
  branchName: string;
}