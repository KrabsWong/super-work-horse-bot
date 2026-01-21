import type { Context, NarrowedContext } from 'telegraf';
import type { Update, Message } from 'telegraf/types';
import { executeCommand } from '../commands/executor';
import { config } from '../config/env';

type TextMessageContext = NarrowedContext<Context<Update>, Update.MessageUpdate<Message.TextMessage>>;

/**
 * Handler for /start command
 */
export async function handleStart(ctx: TextMessageContext): Promise<void> {
  const username = ctx.from.username || ctx.from.first_name || 'there';
  const commandNames = Object.keys(config.commands);
  const commandList = commandNames.map(cmd => `/${cmd} <text> - Execute opencode in configured workspace`).join('\n');
  
  await ctx.reply(
    `Hello @${username}!\n\n` +
    `I'm VibeCodingBot, your server command assistant.\n\n` +
    `Available commands:\n` +
    `${commandList}\n` +
    `/help - Show this help message\n\n` +
    `Example:\n` +
    `/${commandNames[0] || 'command'} 帮我生成一份研究报告，介绍新能源汽车领域涉及到哪些技术`
  );
}

/**
 * Handler for /help command
 */
export async function handleHelp(ctx: TextMessageContext): Promise<void> {
  const commandNames = Object.keys(config.commands);
  let commandDetails = '';
  
  for (const cmdName of commandNames) {
    const cmdConfig = config.commands[cmdName];
    commandDetails += `/${cmdName} <text>\n`;
    commandDetails += `  Working directory: ${cmdConfig.dir}\n`;
    commandDetails += `  Prompt format: ${cmdConfig.prompt}\n`;
    commandDetails += `  Session: ${cmdConfig.session}\n\n`;
  }
  
  await ctx.reply(
    `Help - Available Commands\n\n` +
    `${commandDetails}` +
    `/help\n` +
    `  Show this help message\n\n` +
    `/start\n` +
    `  Show welcome message\n\n` +
    `Example:\n` +
    `/${commandNames[0] || 'command'} 帮我生成一份研究报告，介绍新能源汽车领域涉及到哪些技术\n\n` +
    `This will execute opencode in the configured workspace directory.`
  );
}

/**
 * Create a generic command handler
 */
export function createCommandHandler(commandName: string): (ctx: TextMessageContext) => Promise<void> {
  return async function(ctx: TextMessageContext): Promise<void> {
    // Extract the command arguments
    const message = ctx.message.text;
    const pattern = new RegExp(`^\\/${commandName}(@\\w+)?\\s*`, 'i');
    const args = message.replace(pattern, '').trim();
    
    // Validate that arguments are provided
    if (!args) {
      await ctx.reply(
        `Please provide text for the command.\n\n` +
        `Usage: /${commandName} <your text here>\n\n` +
        `Example:\n` +
        `/${commandName} 帮我生成一份研究报告，介绍新能源汽车领域涉及到哪些技术`
      );
      return;
    }
    
    // Send immediate acknowledgment
    const cmdConfig = config.commands[commandName];
    await ctx.reply(
      `Executing your command...\n\n` +
      `Command: ${commandName}\n` +
      `Directory: ${cmdConfig.dir}\n` +
      `Text: ${args.substring(0, 100)}${args.length > 100 ? '...' : ''}`
    );
    
    // Execute the command
    const context = {
      userId: ctx.from.id,
      username: ctx.from.username,
      chatId: ctx.chat.id,
    };
    
    const result = await executeCommand(commandName, args, context);
    
    // Send result to user
    if (result.success) {
      await ctx.reply(
        `Command executed successfully!\n\n` +
        `The command is running in tmux session '${cmdConfig.session}'.\n` +
        `You can attach to see the output:\n` +
        `tmux attach -t ${cmdConfig.session}`
      );
    } else {
      await ctx.reply(
        `Command execution failed\n\n` +
        `Error: ${result.error}`
      );
    }
  };
}

/**
 * Handler for unknown commands
 */
export async function handleUnknown(ctx: Context<Update>): Promise<void> {
  await ctx.reply(
    'Unknown command.\n\n' +
    'Use /help to see available commands.'
  );
}
