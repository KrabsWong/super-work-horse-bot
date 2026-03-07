import type { MessengerClient, TaskId } from "../../types";
import { hasOpencodeProcess, killOpencodeInSession, killSession } from "../tmux/session";

const MONITOR_INTERVAL_MS = 10000;
const MAX_MONITOR_DURATION_MS = 60 * 60 * 1000;

interface ActiveMonitor {
  taskId: TaskId;
  sessionName: string;
  statusFile: string;
  startTime: number;
  intervalId: Timer;
  taskName: string;
  branchName: string;
  messageId?: number | string;
  args: string;
  startedAt: number;
}

const activeMonitors = new Map<TaskId, ActiveMonitor>();

export interface MonitorOptions {
  taskId: TaskId;
  sessionName: string;
  statusFile: string;
  messenger: MessengerClient;
  chatId: number | string;
  taskName: string;
  branchName: string;
  messageId?: number | string;
  args: string;
  startedAt?: number;
  onProgress?: (
    taskId: TaskId,
    duration: number,
  ) => Promise<void>;
  onCompletion?: (
    taskId: TaskId,
    duration: number,
    killedCount: number,
  ) => Promise<void>;
  onFailure?: (
    taskId: TaskId,
    reason: 'timeout' | 'unexpected_exit',
    duration: number,
    killedCount?: number,
  ) => Promise<void>;
}

export interface CommandWithStatus {
  command: string;
  statusFile: string;
}

export function generateStatusFilePath(
  taskIdOrSession: TaskId | string,
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `/tmp/opencode-${taskIdOrSession}-${timestamp}-${random}.done`;
}

export function buildCompletionInstruction(statusFile: string): string {
  return `
7. **CRITICAL COMPLETION SEQUENCE** - You MUST follow this exact order:

   a) Complete ALL your tasks including:
      - Research and analysis
      - File creation/modification
      - Git commit (if applicable)
      - Git push to remote (if applicable)
      - Any other operations

   b) ONLY AFTER everything is done, execute:
      touch ${statusFile}

   c) This signal tells the system you have FULLY completed. Do NOT touch the file before all operations finish!

   IMPORTANT: If you commit and push to GitHub, make sure the push completes successfully BEFORE touching the status file.
`;
}

async function checkStatusFileExists(statusFile: string): Promise<boolean> {
  try {
    const file = Bun.file(statusFile);
    return await file.exists();
  } catch {
    return false;
  }
}

async function cleanupStatusFile(statusFile: string): Promise<void> {
  try {
    const exitCode = await Bun.spawn(["rm", "-f", statusFile]).exited;
    if (exitCode === 0) {
      console.log(`[Monitor] Cleaned up status file: ${statusFile}`);
    }
  } catch (error) {
    console.error(
      `[Monitor] Failed to cleanup status file ${statusFile}:`,
      error,
    );
  }
}

export function startMonitoring(options: MonitorOptions): void {
  const {
    taskId,
    sessionName,
    statusFile,
    taskName,
    branchName,
    messageId,
    args,
    startedAt,
    onProgress,
    onCompletion,
    onFailure,
  } = options;

  if (activeMonitors.has(taskId)) {
    const existing = activeMonitors.get(taskId)!;
    clearInterval(existing.intervalId);
    activeMonitors.delete(taskId);
    console.log(`[Monitor] Stopped existing monitor for task ${taskId}`);
  }

  const startTime = Date.now();

  const intervalId = setInterval(async () => {
    const elapsed = Date.now() - startTime;
    const monitor = activeMonitors.get(taskId);

    if (!monitor) {
      clearInterval(intervalId);
      return;
    }

    if (elapsed > MAX_MONITOR_DURATION_MS) {
      clearInterval(intervalId);
      activeMonitors.delete(taskId);
      console.log(
        `[Monitor] Task ${taskId} exceeded max duration (1h), force stopping`,
      );

      const killedCount = await killOpencodeInSession(sessionName);
      await cleanupStatusFile(statusFile);
      await killSession(sessionName);

      const durationSeconds = Math.round(elapsed / 1000);

      if (onFailure) {
        try {
          await onFailure(taskId, 'timeout', durationSeconds, killedCount);
        } catch (cbError) {
          console.error('[Monitor] onFailure callback error (timeout):', cbError);
        }
      }
      return;
    }

    const statusFileExists = await checkStatusFileExists(statusFile);

    if (statusFileExists) {
      console.log(
        `[Monitor] Status file detected for task ${taskId}, task completed`,
      );

      clearInterval(intervalId);
      activeMonitors.delete(taskId);

      const killedCount = await killOpencodeInSession(sessionName);
      await cleanupStatusFile(statusFile);
      await killSession(sessionName);

      const durationSeconds = Math.round(elapsed / 1000);

      if (onCompletion) {
        try {
          await onCompletion(taskId, durationSeconds, killedCount);
        } catch (cbError) {
          console.error('[Monitor] onCompletion callback error:', cbError);
        }
      }
      return;
    }

    const hasProcess = await hasOpencodeProcess(sessionName);
    const durationSeconds2 = Math.round(elapsed / 1000);

    if (hasProcess && onProgress) {
      try {
        await onProgress(taskId, durationSeconds2);
      } catch (error) {
        console.error("[Monitor] Failed to update progress:", error);
      }
    }

    if (!hasProcess && elapsed > 60000) {
      console.log(
        `[Monitor] No opencode process in ${sessionName}, but no status file. Task may have ended unexpectedly.`,
      );

      clearInterval(intervalId);
      activeMonitors.delete(taskId);

      const durationSeconds3 = Math.round(elapsed / 1000);

      if (onFailure) {
        try {
          await onFailure(taskId, 'unexpected_exit', durationSeconds3);
        } catch (cbError) {
          console.error('[Monitor] onFailure callback error (unexpected_exit):', cbError);
        }
      }
    }
  }, MONITOR_INTERVAL_MS);

  activeMonitors.set(taskId, {
    taskId,
    sessionName,
    statusFile,
    startTime,
    intervalId,
    taskName,
    branchName,
    messageId,
    args,
    startedAt: startedAt || startTime,
  });

  console.log(
    `[Monitor] Started monitoring for task ${taskId}, session: ${sessionName}, status file: ${statusFile}`,
  );
}

export function stopMonitoring(taskId: TaskId): boolean {
  const monitor = activeMonitors.get(taskId);
  if (monitor) {
    clearInterval(monitor.intervalId);
    activeMonitors.delete(taskId);
    console.log(`[Monitor] Stopped monitoring for task ${taskId}`);
    return true;
  }
  return false;
}

export function stopAllMonitors(): void {
  for (const [taskId, monitor] of activeMonitors) {
    clearInterval(monitor.intervalId);
    console.log(`[Monitor] Stopped monitoring for task ${taskId}`);
  }
  activeMonitors.clear();
  console.log("[Monitor] All monitors stopped");
}

export function getActiveMonitors(): TaskId[] {
  return Array.from(activeMonitors.keys());
}

export function getMonitor(taskId: TaskId): ActiveMonitor | undefined {
  return activeMonitors.get(taskId);
}
