import { Telegraf } from 'telegraf';
import { config, validateConfig, initializeConfig } from './config';
import { checkTmuxAvailability } from './tmux/session';
import { loggingMiddleware, errorHandlingMiddleware } from './bot/middleware';
import {
  handleStart,
  handleHelp,
  handleFinish,
  createCommandHandler,
  handleUnknown,
  handleStatus,
  handleCancel,
  setupPRCallbacks,
} from './bot/handlers';
import { initializeCronTasks, stopCronJobs } from './scheduler';
import { taskManager } from './task-manager';
import { stopAllMonitors } from './monitor';
import type { Cron } from 'croner';
import type { Task, PRInfo } from './types';

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('VibeCodingBot - Telegram Bot Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  console.log('Loading configuration...');
  await initializeConfig();

  console.log('Validating configuration...');
  validateConfig();
  console.log('Configuration is valid');

  console.log('Checking tmux availability...');
  const tmuxAvailable = await checkTmuxAvailability();
  if (!tmuxAvailable) {
    console.error('Cannot start: tmux is not available');
    process.exit(1);
  }

  console.log('Initializing TaskManager...');
  taskManager.initialize();
  console.log('TaskManager initialized');

  console.log('Initializing Telegram bot...');
  const bot = new Telegraf(config.telegramBotToken);

  taskManager.setTelegramClient(bot.telegram);
  
  taskManager.setTaskCompletionCallback(async (task: Task, prInfo: PRInfo | null) => {
    if (task.chatId && prInfo) {
      try {
        await bot.telegram.sendMessage(
          task.chatId,
          `✅ 任务完成！\n\n` +
          `任务 ID: ${task.id}\n` +
          `PR: ${prInfo.url}\n` +
          `分支: ${prInfo.branchName}`
        );
      } catch (error) {
        console.error('[TaskManager] Failed to send PR notification:', error);
      }
    }
  });

  bot.use(loggingMiddleware());

  bot.command('start', handleStart);
  bot.command('help', handleHelp);
  bot.command('finish', handleFinish);
  bot.command('status', handleStatus);
  bot.command('cancel', handleCancel);

  const commandNames = Object.keys(config.commands);
  for (const commandName of commandNames) {
    const handler = createCommandHandler(commandName);
    bot.command(commandName, handler);
    console.log(`Registered command handler: /${commandName}`);
  }

  setupPRCallbacks(bot);

  bot.on('message', handleUnknown);

  bot.catch(errorHandlingMiddleware());

  let cronJobs: Cron[] = [];
  try {
    cronJobs = initializeCronTasks(bot);
  } catch (error) {
    console.error('Failed to initialize cron tasks:', error);
  }

  console.log('Starting bot with long-polling...');
  console.log(`Configured commands: ${commandNames.join(', ')}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    await bot.launch();
    console.log('Bot is running! Press Ctrl+C to stop.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('Failed to start bot:', errorMessage);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    process.exit(1);
  }

  process.once('SIGINT', () => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Received SIGINT, stopping bot...');
    stopCronJobs(cronJobs);
    stopAllMonitors();
    taskManager.cleanup();
    bot.stop('SIGINT');
  });

  process.once('SIGTERM', () => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Received SIGTERM, stopping bot...');
    stopCronJobs(cronJobs);
    stopAllMonitors();
    taskManager.cleanup();
    bot.stop('SIGTERM');
  });
}

main().catch((error: unknown) => {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('Fatal error:', error);
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(1);
});