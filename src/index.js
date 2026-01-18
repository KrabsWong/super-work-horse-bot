import { Telegraf } from 'telegraf';
import { config, validateConfig } from './config/env.js';
import { checkTmuxAvailability } from './tmux/session.js';
import { loggingMiddleware, errorHandlingMiddleware } from './bot/middleware.js';
import {
  handleStart,
  handleHelp,
  createCommandHandler,
  handleUnknown,
} from './bot/handlers.js';

/**
 * Initialize and start the Telegram bot
 */
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🤖 VibeCodingBot - Telegram Bot Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Validate configuration
  console.log('ℹ Validating configuration...');
  validateConfig();
  console.log('✓ Configuration is valid');
  
  // Check tmux availability
  console.log('ℹ Checking tmux availability...');
  const tmuxAvailable = await checkTmuxAvailability();
  if (!tmuxAvailable) {
    console.error('✗ Cannot start: tmux is not available');
    process.exit(1);
  }
  
  // Initialize bot
  console.log('ℹ Initializing Telegram bot...');
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
    console.log(`✓ Registered command handler: /${commandName}`);
  }
  
  // Handle unknown commands
  bot.on('message', handleUnknown);
  
  // Register error handler
  bot.catch(errorHandlingMiddleware());
  
  // Start bot with long-polling
  console.log('ℹ Starting bot with long-polling...');
  console.log(`ℹ Configured commands: ${commandNames.join(', ')}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    await bot.launch();
    console.log('✅ Bot is running! Press Ctrl+C to stop.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (error) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('✗ Failed to start bot:', error.message);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    process.exit(1);
  }
  
  // Enable graceful stop
  process.once('SIGINT', () => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('ℹ Received SIGINT, stopping bot...');
    bot.stop('SIGINT');
  });
  
  process.once('SIGTERM', () => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('ℹ Received SIGTERM, stopping bot...');
    bot.stop('SIGTERM');
  });
}

// Run the bot
main().catch((error) => {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('✗ Fatal error:', error);
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(1);
});
