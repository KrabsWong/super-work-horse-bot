import type { Context, NarrowedContext } from 'telegraf';
import type { Update, Message } from 'telegraf/types';
import { Markup } from 'telegraf';
import { executeCommand } from '../commands/executor';
import { config } from '../config';
import { sendCtrlC } from '../tmux/session';
import { taskManager } from '../task-manager';
import { PRMergeStrategy } from '../types';
import type { Task, PRInfo } from '../types';

type TextMessageContext = NarrowedContext<Context<Update>, Update.MessageUpdate<Message.TextMessage>>;

export async function handleStart(ctx: TextMessageContext): Promise<void> {
  const username = ctx.from.username || ctx.from.first_name || 'there';
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

export async function handleHelp(ctx: TextMessageContext): Promise<void> {
  const commandNames = Object.keys(config.commands);
  let commandDetails = '';
  
  for (const cmdName of commandNames) {
    const cmdConfig = config.commands[cmdName];
    commandDetails += `/${cmdName} <text>\n`;
    commandDetails += `  Working directory: ${cmdConfig.dir}\n`;
    commandDetails += `  Prompt format: ${cmdConfig.prompt}\n`;
    commandDetails += `  Session: ${cmdConfig.session}\n`;
    commandDetails += `  Max concurrent: ${cmdConfig.maxConcurrent}\n`;
    commandDetails += `  PR merge strategy: ${cmdConfig.prMergeStrategy}\n\n`;
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

export function createCommandHandler(commandName: string): (ctx: TextMessageContext) => Promise<void> {
  return async function(ctx: TextMessageContext): Promise<void> {
    const message = ctx.message.text;
    const pattern = new RegExp(`^\\/${commandName}(@\\w+)?\\s*`, 'i');
    const args = message.replace(pattern, '').trim();
    
    if (!args) {
      await ctx.reply(
        `Please provide text for the command.\n\n` +
        `Usage: /${commandName} <your text here>\n\n` +
        `Example:\n` +
        `/${commandName} 帮我生成一份研究报告，介绍新能源汽车领域涉及到哪些技术`
      );
      return;
    }
    
    const cmdConfig = config.commands[commandName];
    await ctx.reply(
      `Executing your command...\n\n` +
      `Command: ${commandName}\n` +
      `Directory: ${cmdConfig.dir}\n` +
      `Text: ${args.substring(0, 100)}${args.length > 100 ? '...' : ''}`
    );
    
    const context = {
      userId: ctx.from.id,
      username: ctx.from.username,
      chatId: ctx.chat.id,
      telegram: ctx.telegram,
      enableMonitoring: true,
    };
    
    const result = await executeCommand(commandName, args, context);
    
    if (result.success && result.taskResult) {
      const taskResult = result.taskResult;
      
      if (taskResult.status === 'running') {
        await ctx.reply(
          `✅ 任务已启动\n\n` +
          `任务 ID: ${taskResult.taskId}\n` +
          `分支: ${taskResult.branchName}\n` +
          `Session: ${taskResult.sessionName}\n\n` +
          `查看进度: tmux attach -t ${taskResult.sessionName}`
        );
      } else if (taskResult.status === 'queued') {
        await ctx.reply(
          `⏳ 任务已排队\n\n` +
          `任务 ID: ${taskResult.taskId}\n` +
          `队列位置: 第 ${taskResult.queuePosition} 位\n\n` +
          `当前有 ${cmdConfig.maxConcurrent} 个任务运行中，等待执行...\n` +
          `使用 /status 查看进度`
        );
      }
    } else {
      await ctx.reply(
        `Command execution failed\n\n` +
        `Error: ${result.error}`
      );
    }
  };
}

export async function handleStatus(ctx: TextMessageContext): Promise<void> {
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

export async function handleCancel(ctx: TextMessageContext): Promise<void> {
  const message = ctx.message.text;
  const taskId = message.replace(/^\/cancel(@\w+)?\s*/i, '').trim();
  
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

export async function handleFinish(ctx: TextMessageContext): Promise<void> {
  const researchConfig = config.commands['research'];

  if (!researchConfig) {
    await ctx.reply('❌ 未配置 research 命令');
    return;
  }

  await ctx.reply('正在发送停止信号... ⏳');

  const success = await sendCtrlC(researchConfig.session);

  if (success) {
    await ctx.reply(`✅ 已向 research session (${researchConfig.session}) 发送 Ctrl+C`);
  } else {
    await ctx.reply(`❌ 发送失败，session (${researchConfig.session}) 可能不存在`);
  }
}

export async function handleUnknown(ctx: Context<Update>): Promise<void> {
  await ctx.reply(
    'Unknown command.\n\n' +
    'Use /help to see available commands.'
  );
}

export async function sendPRNotification(
  ctx: Context,
  chatId: number,
  task: Task,
  prInfo: PRInfo
): Promise<void> {
  const cmdConfig = config.commands[task.commandName];
  
  if (prInfo.state === 'merged') {
    await ctx.telegram.sendMessage(
      chatId,
      `✅ 任务完成并已自动合并！\n\n` +
      `任务 ID: ${task.id}\n` +
      `PR: ${prInfo.url} (已合并)\n` +
      `分支: ${prInfo.branchName}`
    );
    return;
  }
  
  const message = 
    `✅ 任务完成！\n\n` +
    `任务 ID: ${task.id}\n` +
    `PR: ${prInfo.url}\n` +
    `分支: ${prInfo.branchName}\n\n` +
    `请选择操作:`;
  
  if (cmdConfig.prMergeStrategy === PRMergeStrategy.MANUAL) {
    await ctx.telegram.sendMessage(
      chatId,
      message,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ 合并 PR', `merge_pr:${prInfo.number}:${task.commandName}`),
          Markup.button.callback('❌ 关闭 PR', `close_pr:${prInfo.number}:${task.commandName}`),
        ],
        [
          Markup.button.url('🔗 查看详情', prInfo.url),
        ],
      ])
    );
  } else {
    await ctx.telegram.sendMessage(
      chatId,
      message + '\n\nPR 已自动合并。'
    );
  }
}

export function setupPRCallbacks(bot: import('telegraf').Telegraf): void {
  bot.action(/merge_pr:(\d+):(.+)/, async (ctx) => {
    const prNumber = parseInt(ctx.match[1], 10);
    const commandName = ctx.match[2];
    
    await ctx.answerCbQuery('正在合并 PR...');
    
    const cmdConfig = config.commands[commandName];
    if (!cmdConfig) {
      await ctx.editMessageText('❌ 命令配置不存在');
      return;
    }
    
    const { PRManager } = await import('../task-manager/pr-manager');
    const prManager = new PRManager(cmdConfig.dir);
    
    const success = await prManager.mergePR(prNumber);
    
    if (success) {
      await ctx.editMessageText(
        `✅ PR #${prNumber} 已合并\n\n` +
        `分支已自动删除。`
      );
    } else {
      await ctx.editMessageText(`❌ 合并 PR #${prNumber} 失败`);
    }
  });
  
  bot.action(/close_pr:(\d+):(.+)/, async (ctx) => {
    const prNumber = parseInt(ctx.match[1], 10);
    const commandName = ctx.match[2];
    
    await ctx.answerCbQuery('正在关闭 PR...');
    
    const cmdConfig = config.commands[commandName];
    if (!cmdConfig) {
      await ctx.editMessageText('❌ 命令配置不存在');
      return;
    }
    
    const { PRManager } = await import('../task-manager/pr-manager');
    const prManager = new PRManager(cmdConfig.dir);
    
    const success = await prManager.closePR(prNumber);
    
    if (success) {
      await ctx.editMessageText(
        `✅ PR #${prNumber} 已关闭\n\n` +
        `如需删除分支，请手动操作。`
      );
    } else {
      await ctx.editMessageText(`❌ 关闭 PR #${prNumber} 失败`);
    }
  });
}