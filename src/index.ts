import { config, validateConfig, initializeConfig } from './config';
import { checkTmuxAvailability } from './infra/tmux/session';
import {
  handleStart,
  handleHelp,
  handleFinish,
  createCommandHandler,
  handleUnknown,
  handleStatus,
  handleCancel,
} from './interface/messenger/telegram/handlers';
import { initializeCronTasks, stopCronJobs } from './core/scheduler';
import { taskManager } from './core/task-manager';
import { stopAllMonitors } from './infra/monitor';
import { MessengerManager, TelegramMessenger, DiscordMessenger } from './interface/messenger';
import type { Cron } from 'croner';

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('VibeCodingBot - Multi-Platform Bot Server');
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

  console.log('Initializing Messenger platforms...');
  const messengerManager = new MessengerManager();

  const { activePlatform, telegram, discord } = config.platforms;

  if (activePlatform === 'telegram') {
    console.log('Registering Telegram platform...');
    const telegramMessenger = new TelegramMessenger(telegram.token);
    messengerManager.register(telegramMessenger);
  } else if (activePlatform === 'discord') {
    console.log('Registering Discord platform...');
    const discordMessenger = new DiscordMessenger(discord.token);
    messengerManager.register(discordMessenger);
  }

  // Register command handlers (platform-agnostic)
  const commandNames = Object.keys(config.commands);
  
  messengerManager.onCommand('start', async (ctx) => {
    const reply = (msg: string) => ctx.messenger.sendMessage(ctx.chatId, msg);
    await handleStart({ ...ctx, reply } as any);
  });
  
  messengerManager.onCommand('help', async (ctx) => {
    const reply = (msg: string) => ctx.messenger.sendMessage(ctx.chatId, msg);
    await handleHelp({ ...ctx, reply } as any);
  });
  
  messengerManager.onCommand('finish', async (ctx) => {
    const reply = (msg: string) => ctx.messenger.sendMessage(ctx.chatId, msg);
    await handleFinish({ ...ctx, reply } as any);
  });
  
  messengerManager.onCommand('status', async (ctx) => {
    const reply = (msg: string) => ctx.messenger.sendMessage(ctx.chatId, msg);
    await handleStatus({ ...ctx, reply } as any);
  });
  
  messengerManager.onCommand('cancel', async (ctx) => {
    const reply = (msg: string) => ctx.messenger.sendMessage(ctx.chatId, msg);
    await handleCancel({ ...ctx, reply } as any);
  });

  for (const commandName of commandNames) {
    messengerManager.onCommand(commandName, createCommandHandler(commandName));
    console.log(`Registered command handler: /${commandName}`);
  }

  messengerManager.onUnknown(async (ctx) => {
    const reply = (msg: string) => ctx.messenger.sendMessage(ctx.chatId, msg);
    await handleUnknown({ ...ctx, reply } as any);
  });

  let cronJobs: Cron[] = [];
  try {
    const activeMessenger = messengerManager.getPlatform(config.platforms.activePlatform);
    
    if (activeMessenger) {
      const taskNames = Object.keys(config.cronTasks);
      if (taskNames.length > 0) {
        const firstTask = config.cronTasks[taskNames[0]];
        cronJobs = initializeCronTasks({
          messenger: activeMessenger,
          chatId: String(firstTask.chatId),
        });
      }
    }
  } catch (error) {
    console.error('Failed to initialize cron tasks:', error);
  }

  console.log('Starting bot platforms...');
  console.log(`Configured commands: ${commandNames.join(', ')}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    await messengerManager.startAll();
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
    messengerManager.stopAll();
  });

  process.once('SIGTERM', () => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Received SIGTERM, stopping bot...');
    stopCronJobs(cronJobs);
    stopAllMonitors();
    taskManager.cleanup();
    messengerManager.stopAll();
  });
}

main().catch((error: unknown) => {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('Fatal error:', error);
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(1);
});