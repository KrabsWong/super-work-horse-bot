import type { MessengerClient, TaskId } from "../../types";
import { hasOpencodeProcess, killOpencodeInSession, killSession } from "../tmux/session";
import { checkRemoteBranchExists } from "../git/sync";

const MONITOR_INTERVAL_MS = 10000;
const MAX_MONITOR_DURATION_MS = 60 * 60 * 1000;
const GIT_VERIFY_TIMEOUT_MS = 5 * 60 * 1000;

interface ActiveMonitor {
  taskId: TaskId;
  sessionName: string;
  statusFile: string;
  startTime: number;
  intervalId: Timer;
  taskName: string;
  branchName: string;
  workDir: string;
  messageId?: number | string;
  args: string;
  startedAt: number;
  statusFileDetected: boolean;
  statusFileDetectedAt?: number;
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
  workDir: string;
  messageId?: number | string;
  args: string;
  startedAt?: number;
  verifyGitPush?: boolean;
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
    reason: 'timeout' | 'unexpected_exit' | 'git_push_failed',
    duration: number,
    killedCount?: number,
  ) => Promise<void>;
}

export function generateStatusFilePath(
  taskIdOrSession: TaskId | string,
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `/tmp/opencode-${taskIdOrSession}-${timestamp}-${random}.done`;
}

export function buildCompletionInstruction(statusFile: string): string {
  return ` --status-file=${statusFile}`;
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
    workDir,
    messageId,
    args,
    startedAt,
    verifyGitPush = true,
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

    if (!monitor.statusFileDetected && statusFileExists) {
      monitor.statusFileDetected = true;
      monitor.statusFileDetectedAt = Date.now();
      console.log(
        `[Monitor] Status file detected for task ${taskId}, waiting for git push verification`,
      );
    }

    if (monitor.statusFileDetected && verifyGitPush) {
      const gitVerifyElapsed = Date.now() - (monitor.statusFileDetectedAt || 0);
      
      if (gitVerifyElapsed > GIT_VERIFY_TIMEOUT_MS) {
        console.error(
          `[Monitor] Git push verification timeout for task ${taskId}. ` +
          `Remote branch ${branchName} not found within ${GIT_VERIFY_TIMEOUT_MS}ms`
        );

        clearInterval(intervalId);
        activeMonitors.delete(taskId);

        const killedCount = await killOpencodeInSession(sessionName);
        await cleanupStatusFile(statusFile);
        await killSession(sessionName);

        const durationSeconds = Math.round(elapsed / 1000);

        if (onFailure) {
          try {
            await onFailure(taskId, 'git_push_failed', durationSeconds, killedCount);
          } catch (cbError) {
            console.error('[Monitor] onFailure callback error (git_push_failed):', cbError);
          }
        }
        return;
      }

      const remoteExists = await checkRemoteBranchExists(workDir, branchName);

      if (remoteExists) {
        console.log(
          `[Monitor] Status file and remote branch ${branchName} both verified, task completed`
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

      console.log(
        `[Monitor] Status file detected but remote branch ${branchName} not yet available, ` +
        `retrying in ${MONITOR_INTERVAL_MS}ms... (${Math.round(gitVerifyElapsed / 1000)}s elapsed)`
      );
      return;
    }

    if (monitor.statusFileDetected && !verifyGitPush) {
      console.log(
        `[Monitor] Status file detected for task ${taskId} (git verification disabled), task completed`
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
    workDir,
    messageId,
    args,
    startedAt: startedAt || startTime,
    statusFileDetected: false,
  });

  console.log(
    `[Monitor] Started monitoring for task ${taskId}, session: ${sessionName}, status file: ${statusFile}`,
  );
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
