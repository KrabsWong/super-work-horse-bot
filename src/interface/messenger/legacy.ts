import type { MessengerClient } from "./types";

export type TaskMessageStatus =
  | "starting"
  | "running"
  | "queued"
  | "completed"
  | "timeout"
  | "error";

export interface TaskMessageData {
  taskId: string;
  commandName: string;
  args: string;
  sessionName: string;
  branchName: string;
  status: TaskMessageStatus;
  duration?: number;
  killedCount?: number;
  error?: string;
  queuePosition?: number;
  startedAt?: number;
  completedAt?: number;
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

function formatRuntime(data: TaskMessageData): string {
  const start = formatTimestamp(data.startedAt);
  const end = data.completedAt ? formatTimestamp(data.completedAt) : "?";
  const totalSeconds = data.duration || 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const durationStr = minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;
  return `运行时间: ${start} ~ ${end} （耗时 ${durationStr}）`;
}

export function formatTaskMessage(data: TaskMessageData): string {
  const truncatedArgs =
    data.args.length > 100 ? data.args.substring(0, 50) + "..." : data.args;

  switch (data.status) {
    case "starting":
      return (
        `🔄 正在启动任务...\n\n` +
        `任务 ID: ${data.taskId}\n` +
        `命令: /${data.commandName}\n` +
        `内容: ${truncatedArgs}\n` +
        `Session: ${data.sessionName}\n` +
        `分支: ${data.branchName}\n` +
        `${formatRuntime(data)}\n\n` +
        `查看进度: tmux attach -t ${data.sessionName}`
      );

    case "running":
      return (
        `⏳ 任务运行中...\n\n` +
        `任务 ID: ${data.taskId}\n` +
        `命令: /${data.commandName}\n` +
        `内容: ${truncatedArgs}\n` +
        `Session: ${data.sessionName}\n` +
        `分支: ${data.branchName}\n` +
        `${formatRuntime(data)}\n\n` +
        `查看进度: tmux attach -t ${data.sessionName}`
      );

    case "queued":
      return (
        `📋 任务已排队\n\n` +
        `任务 ID: ${data.taskId}\n` +
        `命令: /${data.commandName}\n` +
        `内容: ${truncatedArgs}\n` +
        `队列位置: 第 ${data.queuePosition || 1} 位\n\n` +
        `等待执行中...`
      );

    case "completed":
      return (
        `✅ 任务完成\n\n` +
        `任务 ID: ${data.taskId}\n` +
        `命令: /${data.commandName}\n` +
        `内容: ${truncatedArgs}\n` +
        `Session: ${data.sessionName}\n` +
        `分支: ${data.branchName}\n` +
        `${formatRuntime(data)}\n` +
        `清理进程: ${data.killedCount || 0} 个`
      );

    case "timeout":
      return (
        `⏰ 任务超时，已强制停止\n\n` +
        `任务 ID: ${data.taskId}\n` +
        `命令: /${data.commandName}\n` +
        `内容: ${truncatedArgs}\n` +
        `Session: ${data.sessionName}\n` +
        `分支: ${data.branchName}\n` +
        `${formatRuntime(data)}\n` +
        `清理进程: ${data.killedCount || 0} 个\n\n` +
        `任务执行超过1小时，已强制终止。`
      );

    case "error":
      return (
        `⚠️ 任务异常结束\n\n` +
        `任务 ID: ${data.taskId}\n` +
        `命令: /${data.commandName}\n` +
        `内容: ${truncatedArgs}\n` +
        `Session: ${data.sessionName}\n` +
        `分支: ${data.branchName}\n` +
        `${formatRuntime(data)}\n\n` +
        `${data.error || "任务执行异常，未检测到完成标记。可能是任务被中断或出错。"}`
      );
  }
}

export async function sendTaskMessage(
  messenger: MessengerClient,
  chatId: string,
  data: TaskMessageData,
): Promise<string | null> {
  try {
    const message = formatTaskMessage(data);
    const result = await messenger.sendMessage(chatId, message);
    return result ? result.messageId : null;
  } catch (error) {
    console.error("[Messenger] Failed to send message:", error);
    return null;
  }
}

export async function updateTaskMessage(
  messenger: MessengerClient,
  chatId: string,
  messageId: string,
  data: TaskMessageData,
): Promise<boolean> {
  try {
    const message = formatTaskMessage(data);
    return await messenger.editMessage(chatId, messageId, message);
  } catch (error) {
    console.error("[Messenger] Failed to update message:", error);
    return false;
  }
}
