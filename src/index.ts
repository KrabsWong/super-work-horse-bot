import { config, validateConfig, initializeConfig } from './config';
import { checkTmuxAvailability } from './infra/tmux/session';
import {
  handleStart,
  handleHelp,
  handleFinish,
  handleUnknown,
  createCommandHandler,
} from './interface/messenger/telegram/handlers';
import { handleJobs } from './interface/commands/job-commands';
import { handleCron } from './interface/commands/cron-commands';
import { handleRun } from './interface/commands/run-command';
import { scheduler } from './core/scheduler';
import { taskManager } from './core/task-manager';
import { stopAllMonitors } from './infra/monitor';
import { MessengerManager, TelegramMessenger, DiscordMessenger } from './interface/messenger';

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
  
  messengerManager.onCommand('run', handleRun);
  console.log('Registered command handler: /run');
  
  messengerManager.onCommand('jobs', handleJobs);
  console.log('Registered command handler: /jobs');
  
  messengerManager.onCommand('cron', handleCron);
  console.log('Registered command handler: /cron');

  messengerManager.onCommand('finish', async (ctx) => {
    const reply = (msg: string) => ctx.messenger.sendMessage(ctx.chatId, msg);
    await handleFinish({ ...ctx, reply } as any);
  });
  console.log('Registered command handler: /finish');

  for (const commandName of commandNames) {
    messengerManager.onCommand(commandName, createCommandHandler(commandName));
    console.log(`Registered command handler: /${commandName}`);
  }

  messengerManager.onUnknown(async (ctx) => {
    const reply = (msg: string) => ctx.messenger.sendMessage(ctx.chatId, msg);
    await handleUnknown({ ...ctx, reply } as any);
  });

  try {
    const activeMessenger = messengerManager.getPlatform(config.platforms.activePlatform);
    
    if (activeMessenger) {
      const taskNames = Object.keys(config.cronTasks);
      let defaultChatId = '0';
      if (taskNames.length > 0) {
        const firstTask = config.cronTasks[taskNames[0]];
        defaultChatId = String(firstTask.chatId);
      }
      
      await scheduler.initialize({
        messenger: activeMessenger,
        chatId: defaultChatId,
        cronDir: './cron',
      });
    }
  } catch (error) {
    console.error('Failed to initialize scheduler:', error);
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
    scheduler.stop();
    stopAllMonitors();
    taskManager.cleanup();
    messengerManager.stopAll();
  });

  process.once('SIGTERM', () => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Received SIGTERM, stopping bot...');
    scheduler.stop();
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