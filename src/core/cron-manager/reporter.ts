import type { CronTaskConfig } from './types';
import type { ExecutionPlan } from './planner';
import type { MessengerClient } from '../../interface/messenger/types';

export interface TaskReport {
  taskName: string;
  status: 'starting' | 'running' | 'completed' | 'failed' | 'timeout' | 'error';
  taskId: string;
  startTime: number;
  endTime?: number;
  plan?: ExecutionPlan;
  error?: string;
  duration?: number;
  killedCount?: number;
  sessionName?: string;
  branchName?: string;
  description?: string;
  messageId?: string;
}

function formatTimestamp(timestamp: number | undefined): string {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}分${seconds}秒`;
  }
  return `${seconds}秒`;
}

function formatRuntime(data: TaskReport): string {
  const start = formatTimestamp(data.startTime);
  const end = data.endTime ? formatTimestamp(data.endTime) : "?";
  const durationSeconds = data.duration || 0;
  return `运行时间: ${start} ~ ${end} （耗时 ${formatDuration(Math.round(durationSeconds))}）`;
}

export class TaskReporter {
  private messengerClient: MessengerClient | null = null;
  private messageIds: Map<string, string> = new Map();
  private messageStatuses: Map<string, TaskReport['status']> = new Map();
  private lastMessageContent: Map<string, string> = new Map();

  private readonly statusPriority: Record<TaskReport['status'], number> = {
    'starting': 1,
    'running': 2,
    'completed': 3,
    'failed': 3,
    'timeout': 3,
    'error': 3
  };

  setMessengerClient(client: MessengerClient): void {
    this.messengerClient = client;
  }

  private getTruncatedDescription(description: string | undefined): string {
    if (!description) return "";
    return description.length > 100 ? description.substring(0, 50) + "..." : description;
  }

  private formatReport(report: TaskReport): string {
    const truncatedDesc = this.getTruncatedDescription(report.description);

    switch (report.status) {
      case "starting":
        return (
          `🔄 正在启动任务...\n\n` +
          `任务 ID: ${report.taskId}\n` +
          `任务: ${report.taskName}\n` +
          `内容: ${truncatedDesc}\n` +
          `Session: ${report.sessionName || "-"}\n` +
          `分支: ${report.branchName || "-"}\n` +
          `启动时间: ${formatTimestamp(report.startTime)}\n\n` +
          `查看进度: tmux attach -t ${report.sessionName || ""}`
        );

      case "running":
        const runningSeconds = report.duration || 0;
        const runningMinutes = Math.floor(runningSeconds / 60);
        const runningSecs = runningSeconds % 60;
        const runningTimeStr = runningMinutes > 0 
          ? `${runningMinutes}分${runningSecs}秒`
          : `${runningSecs}秒`;
        return (
          `⏳ 任务运行中...\n\n` +
          `任务 ID: ${report.taskId}\n` +
          `任务: ${report.taskName}\n` +
          `内容: ${truncatedDesc}\n` +
          `Session: ${report.sessionName || "-"}\n` +
          `分支: ${report.branchName || "-"}\n` +
          `运行时间: ${formatTimestamp(report.startTime)} ~ ? （已运行 ${runningTimeStr}）\n\n` +
          `查看进度: tmux attach -t ${report.sessionName || ""}`
        );

      case "completed":
        return (
          `✅ 任务完成\n\n` +
          `任务 ID: ${report.taskId}\n` +
          `任务: ${report.taskName}\n` +
          `内容: ${truncatedDesc}\n` +
          `Session: ${report.sessionName || "-"}\n` +
          `分支: ${report.branchName || "-"}\n` +
          `${formatRuntime(report)}\n` +
          `清理进程: ${report.killedCount || 0} 个`
        );

      case "failed":
        return (
          `❌ 任务失败\n\n` +
          `任务 ID: ${report.taskId}\n` +
          `任务: ${report.taskName}\n` +
          `内容: ${truncatedDesc}\n` +
          `Session: ${report.sessionName || "-"}\n` +
          `分支: ${report.branchName || "-"}\n` +
          `${formatRuntime(report)}\n\n` +
          `错误: ${report.error || "任务执行失败"}`
        );

      case "timeout":
        return (
          `⏰ 任务超时，已强制停止\n\n` +
          `任务 ID: ${report.taskId}\n` +
          `任务: ${report.taskName}\n` +
          `内容: ${truncatedDesc}\n` +
          `Session: ${report.sessionName || "-"}\n` +
          `分支: ${report.branchName || "-"}\n` +
          `${formatRuntime(report)}\n` +
          `清理进程: ${report.killedCount || 0} 个\n\n` +
          `任务执行超过1小时，已强制终止。`
        );

      case "error":
        return (
          `⚠️ 任务异常结束\n\n` +
          `任务 ID: ${report.taskId}\n` +
          `任务: ${report.taskName}\n` +
          `内容: ${truncatedDesc}\n` +
          `Session: ${report.sessionName || "-"}\n` +
          `分支: ${report.branchName || "-"}\n` +
          `${formatRuntime(report)}\n\n` +
          `${report.error || "任务执行异常，未检测到完成标记。可能是任务被中断或出错。"}`
        );
    }
  }

  async sendReport(chatId: string | number, report: TaskReport): Promise<string | null> {
    if (!this.messengerClient) {
      console.error('[TaskReporter] No messenger client set');
      return null;
    }

    const chatIdStr = typeof chatId === 'string' ? chatId : String(chatId);
    const message = this.formatReport(report);
    const taskKey = report.taskId;
    const existingMessageId = this.messageIds.get(taskKey);

    const currentStatus = this.messageStatuses.get(taskKey);
    const newStatus = report.status;
    if (currentStatus && this.statusPriority[newStatus] < this.statusPriority[currentStatus]) {
      console.log(`[TaskReporter] Skipping update from ${currentStatus} to ${newStatus} for task ${report.taskId}`);
      return existingMessageId || null;
    }

    const lastContent = this.lastMessageContent.get(taskKey);
    if (lastContent === message) {
      console.log(`[TaskReporter] Message content unchanged for task ${report.taskId}, skipping update`);
      return existingMessageId || null;
    }

    try {
      if (existingMessageId) {
        const success = await this.messengerClient.editMessage(chatIdStr, existingMessageId, message);
        if (success) {
          console.log(`[TaskReporter] Report updated for task ${report.taskId}`);
          this.messageStatuses.set(taskKey, newStatus);
          this.lastMessageContent.set(taskKey, message);
          return existingMessageId;
        } else {
          console.warn(`[TaskReporter] Failed to edit message`);
          return existingMessageId;
        }
      } else {
        const result = await this.messengerClient.sendMessage(chatIdStr, message);
        if (result?.messageId) {
          this.messageIds.set(taskKey, result.messageId);
          this.messageStatuses.set(taskKey, newStatus);
          this.lastMessageContent.set(taskKey, message);
          console.log(`[TaskReporter] Report sent to ${chatIdStr}, messageId: ${result.messageId}`);
        }
        return result?.messageId || null;
      }
    } catch (error) {
      console.error('[TaskReporter] Failed to send report:', error);
      return null;
    }
  }

  getMessageId(taskId: string): string | undefined {
    return this.messageIds.get(taskId);
  }

  createStartingReport(
    taskConfig: CronTaskConfig,
    plan: ExecutionPlan,
    taskId: string,
    sessionName?: string,
    branchName?: string
  ): TaskReport {
    return {
      taskName: taskConfig.name,
      status: 'starting',
      taskId,
      startTime: Date.now(),
      plan,
      description: taskConfig.description,
      sessionName,
      branchName,
    };
  }

  createRunningReport(
    taskConfig: CronTaskConfig,
    plan: ExecutionPlan,
    taskId: string,
    startTime: number,
    sessionName?: string,
    branchName?: string
  ): TaskReport {
    return {
      taskName: taskConfig.name,
      status: 'running',
      taskId,
      startTime,
      plan,
      description: taskConfig.description,
      sessionName,
      branchName,
    };
  }

  createCompletedReport(
    taskConfig: CronTaskConfig,
    startTime: number,
    taskId: string,
    duration: number,
    killedCount: number,
    sessionName?: string,
    branchName?: string
  ): TaskReport {
    return {
      taskName: taskConfig.name,
      status: 'completed',
      taskId,
      startTime,
      endTime: Date.now(),
      duration,
      killedCount,
      description: taskConfig.description,
      sessionName,
      branchName,
    };
  }

  createFailedReport(
    taskConfig: CronTaskConfig,
    startTime: number,
    error: string,
    taskId: string,
    sessionName?: string,
    branchName?: string
  ): TaskReport {
    return {
      taskName: taskConfig.name,
      status: 'failed',
      taskId,
      startTime,
      endTime: Date.now(),
      error,
      description: taskConfig.description,
      sessionName,
      branchName,
    };
  }

  createTimeoutReport(
    taskConfig: CronTaskConfig,
    startTime: number,
    taskId: string,
    duration: number,
    killedCount: number,
    sessionName?: string,
    branchName?: string
  ): TaskReport {
    return {
      taskName: taskConfig.name,
      status: 'timeout',
      taskId,
      startTime,
      endTime: Date.now(),
      duration,
      killedCount,
      description: taskConfig.description,
      sessionName,
      branchName,
    };
  }

  createErrorReport(
    taskConfig: CronTaskConfig,
    startTime: number,
    error: string,
    taskId: string,
    duration: number,
    sessionName?: string,
    branchName?: string
  ): TaskReport {
    return {
      taskName: taskConfig.name,
      status: 'error',
      taskId,
      startTime,
      endTime: Date.now(),
      error,
      duration,
      description: taskConfig.description,
      sessionName,
      branchName,
    };
  }
}

export const taskReporter = new TaskReporter();
