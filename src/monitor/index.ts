import type { TelegramClient } from '../types';
import { hasOpencodeProcess, killOpencodeInSession } from '../tmux/session';

const MONITOR_INTERVAL_MS = 60000;
const MAX_MONITOR_DURATION_MS = 60 * 60 * 1000; // 1 hour

interface ActiveMonitor {
  sessionName: string;
  statusFile: string;
  startTime: number;
  intervalId: Timer;
  taskName: string;
}

const activeMonitors = new Map<string, ActiveMonitor>();

export interface MonitorOptions {
  sessionName: string;
  statusFile: string;
  telegram: TelegramClient;
  chatId: number;
  taskName: string;
  onCompletion?: (sessionName: string, duration: number, killedCount: number) => Promise<void>;
}

export interface CommandWithStatus {
  command: string;
  statusFile: string;
}

export function generateStatusFilePath(sessionName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `/tmp/opencode-${sessionName}-${timestamp}-${random}.done`;
}

export function buildCompletionInstruction(statusFile: string): string {
  return `
7. **COMPLETION**: After completing all tasks, execute the following command to signal completion:
   touch ${statusFile}
   This is CRITICAL - you MUST execute this command when done.
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
    const exitCode = await Bun.spawn(['rm', '-f', statusFile]).exited;
    if (exitCode === 0) {
      console.log(`[Monitor] Cleaned up status file: ${statusFile}`);
    }
  } catch (error) {
    console.error(`[Monitor] Failed to cleanup status file ${statusFile}:`, error);
  }
}

export function startMonitoring(options: MonitorOptions): void {
  const { sessionName, statusFile, telegram, chatId, taskName, onCompletion } = options;

  if (activeMonitors.has(sessionName)) {
    const existing = activeMonitors.get(sessionName)!;
    clearInterval(existing.intervalId);
    activeMonitors.delete(sessionName);
    console.log(`[Monitor] Stopped existing monitor for ${sessionName}`);
  }

  const startTime = Date.now();

  const intervalId = setInterval(async () => {
    const elapsed = Date.now() - startTime;
    const monitor = activeMonitors.get(sessionName);

    if (!monitor) {
      clearInterval(intervalId);
      return;
    }

    if (elapsed > MAX_MONITOR_DURATION_MS) {
      clearInterval(intervalId);
      activeMonitors.delete(sessionName);
      console.log(`[Monitor] ${sessionName} exceeded max duration (1h), force stopping`);

      const killedCount = await killOpencodeInSession(sessionName);
      await cleanupStatusFile(statusFile);

      const durationMinutes = Math.round(elapsed / 1000 / 60);

      try {
        await telegram.sendMessage(
          chatId,
          `⏰ 任务超时，已强制停止\n\n任务: ${taskName}\nSession: ${sessionName}\n运行时长: ${durationMinutes} 分钟\n清理进程: ${killedCount} 个\n\n任务执行超过1小时，已强制终止。`
        );
      } catch (error) {
        console.error('[Monitor] Failed to send timeout notification:', error);
      }
      return;
    }

    const statusFileExists = await checkStatusFileExists(statusFile);
    const hasProcess = await hasOpencodeProcess(sessionName);

    if (statusFileExists) {
      console.log(`[Monitor] Status file detected for ${sessionName}, task completed`);

      clearInterval(intervalId);
      activeMonitors.delete(sessionName);

      const killedCount = await killOpencodeInSession(sessionName);
      await cleanupStatusFile(statusFile);

      const durationMinutes = Math.round(elapsed / 1000 / 60);

      if (onCompletion) {
        await onCompletion(sessionName, durationMinutes, killedCount);
      }

      try {
        await telegram.sendMessage(
          chatId,
          `✅ 任务完成\n\n任务: ${taskName}\nSession: ${sessionName}\n耗时: ${durationMinutes} 分钟\n清理进程: ${killedCount} 个\n\n任务已成功完成并清理。`
        );
      } catch (error) {
        console.error('[Monitor] Failed to send completion notification:', error);
      }
      return;
    }

    if (!hasProcess && elapsed > 60000) {
      console.log(`[Monitor] No opencode process in ${sessionName}, but no status file. Task may have ended unexpectedly.`);

      clearInterval(intervalId);
      activeMonitors.delete(sessionName);

      const durationMinutes = Math.round(elapsed / 1000 / 60);

      try {
        await telegram.sendMessage(
          chatId,
          `⚠️ 任务异常结束\n\n任务: ${taskName}\nSession: ${sessionName}\n耗时: ${durationMinutes} 分钟\n\nopencode 进程已结束，但未检测到完成标记。可能是任务被中断或出错。`
        );
      } catch (error) {
        console.error('[Monitor] Failed to send unexpected end notification:', error);
      }
    }
  }, MONITOR_INTERVAL_MS);

  activeMonitors.set(sessionName, {
    sessionName,
    statusFile,
    startTime,
    intervalId,
    taskName,
  });

  console.log(`[Monitor] Started monitoring for ${sessionName}, status file: ${statusFile}`);
}

export function stopMonitoring(sessionName: string): boolean {
  const monitor = activeMonitors.get(sessionName);
  if (monitor) {
    clearInterval(monitor.intervalId);
    activeMonitors.delete(sessionName);
    console.log(`[Monitor] Stopped monitoring for ${sessionName}`);
    return true;
  }
  return false;
}

export function stopAllMonitors(): void {
  for (const [sessionName, monitor] of activeMonitors) {
    clearInterval(monitor.intervalId);
    console.log(`[Monitor] Stopped monitoring for ${sessionName}`);
  }
  activeMonitors.clear();
  console.log('[Monitor] All monitors stopped');
}

export function getActiveMonitors(): string[] {
  return Array.from(activeMonitors.keys());
}
