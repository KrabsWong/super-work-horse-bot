import { Telegraf } from 'telegraf';
import { config, validateConfig } from './config/env';
import { checkTmuxAvailability } from './tmux/session';
import { loggingMiddleware, errorHandlingMiddleware } from './bot/middleware';
import {
  handleStart,
  handleHelp,
  createCommandHandler,
  handleUnknown,
} from './bot/handlers';

/**
 * Initialize and start the Telegram bot
 */
async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('VibeCodingBot - Telegram Bot Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Validate configuration
  console.log('Validating configuration...');
  validateConfig();
  console.log('Configuration is valid');
  
  // Check tmux availability
  console.log('Checking tmux availability...');
  const tmuxAvailable = await checkTmuxAvailability();
  if (!tmuxAvailable) {
    console.error('Cannot start: tmux is not available');
    process.exit(1);
  }
  
  // Initialize bot
  console.log('Initializing Telegram bot...');
  const bot = new Telegraf(config.telegramBotToken);
  
  // Register middleware
  bot.use(loggingMiddleware());
  
  // Register static command handlers
  bot.command('start', handleStart);
  bot.command('help', handleHelp);
  
  // Dynamically register command handlers from config
  const commandNames = Object.keys(config.commands);
  for (const commandName of commandNames) {
    const handler = createCommandHandler(commandName);
    bot.command(commandName, handler);
    console.log(`Registered command handler: /${commandName}`);
  }
  
  // Handle unknown commands
  bot.on('message', handleUnknown);
  
  // Register error handler
  bot.catch(errorHandlingMiddleware());
  
  // Start bot with long-polling
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
  
  // Enable graceful stop
  process.once('SIGINT', () => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Received SIGINT, stopping bot...');
    bot.stop('SIGINT');
  });
  
  process.once('SIGTERM', () => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Received SIGTERM, stopping bot...');
    bot.stop('SIGTERM');
  });
}

// Run the bot
main().catch((error: unknown) => {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('Fatal error:', error);
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(1);
});
