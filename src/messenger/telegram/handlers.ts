import type { CommandContext } from '../types';
import { executeCommand } from '../../commands/executor';
import { config } from '../../config';
import { sendCtrlC } from '../../tmux/session';
import { taskManager } from '../../task-manager';

interface PlatformContext {
  username?: string;
  args?: string;
  reply: (message: string) => Promise<unknown>;
}

export async function handleStart(ctx: PlatformContext): Promise<void> {
  const username = ctx.username || 'there';
  const commandNames = Object.keys(config.commands);
  const commandList = commandNames.map(cmd => `/${cmd} <text> - Execute opencode in configured workspace`).join('\n');

  await ctx.reply(
    `Hello @${username}!\n\n` +
    `I'm VibeCodingBot, your server command assistant.\n\n` +
    `Available commands:\n` +
    `${commandList}\n` +
    `/status - 查看当前运行中和排队的任务\n` +
    `/cancel <taskId> - 取消排队中的任务\n` +
    `/finish - 终止 research 命令的 opencode 进程\n` +
    `/help - Show this help message\n\n` +
    `Example:\n` +
    `/${commandNames[0] || 'command'} 帮我生成一份研究报告，介绍新能源汽车领域涉及到哪些技术`
  );
}

export async function handleHelp(ctx: PlatformContext): Promise<void> {
  const commandNames = Object.keys(config.commands);
  let commandDetails = '';
  
  for (const cmdName of commandNames) {
    const cmdConfig = config.commands[cmdName];
    commandDetails += `/${cmdName} <text>\n`;
    commandDetails += `  Working directory: ${cmdConfig.dir}\n`;
    commandDetails += `  Prompt format: ${cmdConfig.prompt}\n`;
    commandDetails += `  Session: ${cmdConfig.session}\n`;
    commandDetails += `  Max concurrent: ${cmdConfig.maxConcurrent}\n\n`;
  }
  
  await ctx.reply(
    `Help - Available Commands\n\n` +
    `${commandDetails}` +
    `/status\n` +
    `  查看当前运行中和排队的任务\n\n` +
    `/cancel <taskId>\n` +
    `  取消排队中的任务\n\n` +
    `/finish\n` +
    `  终止 research 命令的 opencode 进程\n\n` +
    `/help\n` +
    `  Show this help message\n\n` +
    `/start\n` +
    `  Show welcome message\n\n` +
    `Example:\n` +
    `/${commandNames[0] || 'command'} 帮我生成一份研究报告，介绍新能源汽车领域涉及到哪些技术\n\n` +
    `This will execute opencode in the configured workspace directory.`
  );
}

export function createCommandHandler(commandName: string): (ctx: CommandContext) => Promise<void> {
  return async function(ctx: CommandContext): Promise<void> {
    const args = ctx.args?.trim();
    
    if (!args) {
      await ctx.messenger.sendMessage(ctx.chatId,
        `Please provide text for the command.\n\n` +
        `Usage: /${commandName} <your text here>\n\n` +
        `Example:\n` +
        `/${commandName} 帮我生成一份研究报告，介绍新能源汽车领域涉及到哪些技术`
      );
      return;
    }
    
    const context = {
      userId: Number(ctx.userId),
      username: ctx.username,
      chatId: ctx.chatId,
      messenger: ctx.messenger,
      enableMonitoring: true,
    };
    
    const result = await executeCommand(commandName, args, context);
    
    if (!result.success) {
      await ctx.messenger.sendMessage(ctx.chatId,
        `Command execution failed\n\n` +
        `Error: ${result.error}`
      );
    }
  };
}

export async function handleStatus(ctx: PlatformContext): Promise<void> {
  const runningTasks = taskManager.getRunningTasks();
  const queuedTasks = taskManager.getQueuedTasks();
  
  if (runningTasks.length === 0 && queuedTasks.length === 0) {
    await ctx.reply('📊 当前没有运行中或排队的任务');
    return;
  }
  
  let message = '📊 任务状态\n\n';
  
  if (runningTasks.length > 0) {
    const cmdConfig = config.commands[runningTasks[0].commandName];
    message += `运行中 (${runningTasks.length}/${cmdConfig.maxConcurrent}):\n`;
    
    for (const task of runningTasks) {
      const duration = task.startedAt ? Math.round((Date.now() - task.startedAt) / 1000 / 60) : 0;
      message += `• ${task.id}\n`;
      message += `  "${task.args.substring(0, 30)}${task.args.length > 30 ? '...' : ''}"\n`;
      message += `  分支: ${task.branchName}\n`;
      message += `  运行: ${duration} 分钟\n\n`;
    }
  }
  
  if (queuedTasks.length > 0) {
    message += `排队中 (${queuedTasks.length} 等待):\n`;
    
    for (const task of queuedTasks) {
      const position = taskManager.getQueuePosition(task.id);
      message += `• ${task.id}\n`;
      message += `  "${task.args.substring(0, 30)}${task.args.length > 30 ? '...' : ''}"\n`;
      message += `  位置: 第 ${position} 位\n\n`;
    }
  }
  
  await ctx.reply(message);
}

export async function handleCancel(ctx: PlatformContext): Promise<void> {
  const taskId = ctx.args?.trim();
  
  if (!taskId) {
    await ctx.reply(
      `请提供任务 ID\n\n` +
      `Usage: /cancel <taskId>\n\n` +
      `使用 /status 查看所有任务的 ID`
    );
    return;
  }
  
  const task = taskManager.getTask(taskId);
  
  if (!task) {
    await ctx.reply(`❌ 任务 ${taskId} 不存在`);
    return;
  }
  
  if (task.status === 'running') {
    await ctx.reply(
      `❌ 无法取消运行中的任务\n\n` +
      `任务 ${taskId} 正在运行中，无法取消。\n` +
      `请使用 /finish 命令停止当前任务。`
    );
    return;
  }
  
  const cancelled = taskManager.cancelTask(taskId);
  
  if (cancelled) {
    await ctx.reply(
      `✅ 任务已取消\n\n` +
      `任务 ID: ${taskId}`
    );
  } else {
    await ctx.reply(
      `❌ 取消任务失败\n\n` +
      `任务 ID: ${taskId}`
    );
  }
}

export async function handleFinish(ctx: PlatformContext): Promise<void> {
  const runningTasks = taskManager.getRunningTasks();
  
  if (runningTasks.length === 0) {
    await ctx.reply('❌ 没有运行中的任务');
    return;
  }
  
  await ctx.reply(`正在停止 ${runningTasks.length} 个运行中的任务... ⏳`);
  
  let stopped = 0;
  let failed = 0;
  
  for (const task of runningTasks) {
    const cmdConfig = config.commands[task.commandName];
    if (!cmdConfig) continue;
    
    const sessionName = `${cmdConfig.session}-${task.id}`;
    const success = await sendCtrlC(sessionName);
    
    if (success) {
      stopped++;
      console.log(`[Finish] Stopped task ${task.id} in session ${sessionName}`);
    } else {
      failed++;
      console.log(`[Finish] Failed to stop task ${task.id} in session ${sessionName}`);
    }
  }
  
  if (failed === 0) {
    await ctx.reply(`✅ 已停止 ${stopped} 个任务`);
  } else {
    await ctx.reply(`⚠️ 停止完成: ${stopped} 成功, ${failed} 失败`);
  }
}

export async function handleUnknown(ctx: PlatformContext): Promise<void> {
  await ctx.reply(
    'Unknown command.\n\n' +
    'Use /help to see available commands.'
  );
}