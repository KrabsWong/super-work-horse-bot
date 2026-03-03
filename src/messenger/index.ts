import type { TelegramClient } from '../types';

export type TaskMessageStatus = 'starting' | 'running' | 'queued' | 'completed' | 'timeout' | 'error';

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
}

export function formatTaskMessage(data: TaskMessageData): string {
  const truncatedArgs = data.args.length > 50 
    ? data.args.substring(0, 50) + '...' 
    : data.args;

  switch (data.status) {
    case 'starting':
      return (
        `🔄 正在启动任务...\n\n` +
        `任务 ID: ${data.taskId}\n` +
        `命令: /${data.commandName}\n` +
        `内容: ${truncatedArgs}\n` +
        `Session: ${data.sessionName}\n` +
        `分支: ${data.branchName}\n\n` +
        `查看进度: tmux attach -t ${data.sessionName}`
      );

    case 'running':
      return (
        `⏳ 任务运行中...\n\n` +
        `任务 ID: ${data.taskId}\n` +
        `命令: /${data.commandName}\n` +
        `内容: ${truncatedArgs}\n` +
        `运行时间: ${data.duration || 0} 分钟\n\n` +
        `查看进度: tmux attach -t ${data.sessionName}`
      );

    case 'queued':
      return (
        `📋 任务已排队\n\n` +
        `任务 ID: ${data.taskId}\n` +
        `命令: /${data.commandName}\n` +
        `内容: ${truncatedArgs}\n` +
        `队列位置: 第 ${data.queuePosition || 1} 位\n\n` +
        `等待执行中...`
      );

    case 'completed':
      return (
        `✅ 任务完成\n\n` +
        `任务 ID: ${data.taskId}\n` +
        `命令: /${data.commandName}\n` +
        `内容: ${truncatedArgs}\n` +
        `Session: ${data.sessionName}\n` +
        `分支: ${data.branchName}\n` +
        `耗时: ${data.duration || 0} 分钟\n` +
        `清理进程: ${data.killedCount || 0} 个`
      );

    case 'timeout':
      return (
        `⏰ 任务超时，已强制停止\n\n` +
        `任务 ID: ${data.taskId}\n` +
        `命令: /${data.commandName}\n` +
        `内容: ${truncatedArgs}\n` +
        `Session: ${data.sessionName}\n` +
        `分支: ${data.branchName}\n` +
        `运行时长: ${data.duration || 0} 分钟\n` +
        `清理进程: ${data.killedCount || 0} 个\n\n` +
        `任务执行超过1小时，已强制终止。`
      );

    case 'error':
      return (
        `⚠️ 任务异常结束\n\n` +
        `任务 ID: ${data.taskId}\n` +
        `命令: /${data.commandName}\n` +
        `内容: ${truncatedArgs}\n` +
        `Session: ${data.sessionName}\n` +
        `分支: ${data.branchName}\n` +
        `耗时: ${data.duration || 0} 分钟\n\n` +
        `${data.error || '任务执行异常，未检测到完成标记。可能是任务被中断或出错。'}`
      );
  }
}

export async function sendTaskMessage(
  telegram: TelegramClient,
  chatId: number,
  data: TaskMessageData
): Promise<number | null> {
  try {
    const message = formatTaskMessage(data);
    const result = await telegram.sendMessage(chatId, message);
    return result.message_id;
  } catch (error) {
    console.error('[Messenger] Failed to send message:', error);
    return null;
  }
}

export async function updateTaskMessage(
  telegram: TelegramClient,
  chatId: number,
  messageId: number,
  data: TaskMessageData
): Promise<boolean> {
  try {
    const message = formatTaskMessage(data);
    await telegram.editMessageText(chatId, messageId, undefined, message);
    return true;
  } catch (error) {
    console.error('[Messenger] Failed to update message:', error);
    return false;
  }
}