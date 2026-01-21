import type { Context, MiddlewareFn } from 'telegraf';
import type { Message, Update } from 'telegraf/types';

/**
 * Logging middleware for Telegraf bot
 * Logs all incoming messages with relevant details
 */
export function loggingMiddleware(): MiddlewareFn<Context<Update>> {
  return async (ctx, next) => {
    const timestamp = new Date().toISOString();
    const from = ctx.from;
    const chat = ctx.chat;
    const message = ctx.message as Message.TextMessage | undefined;
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`[${timestamp}] Incoming message`);
    
    if (from) {
      console.log(`  From: @${from.username || 'unknown'} (ID: ${from.id})`);
    }
    
    if (chat) {
      console.log(`  Chat: ${chat.type} (ID: ${chat.id})`);
    }
    
    if (message?.text) {
      console.log(`  Text: ${message.text}`);
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Continue to next middleware/handler
    await next();
  };
}

/**
 * Error handling middleware for Telegraf bot
 * Catches and logs errors, prevents bot from crashing
 */
export function errorHandlingMiddleware(): (error: unknown, ctx: Context<Update>) => Promise<void> {
  return async (err: unknown, ctx: Context<Update>) => {
    const error = err instanceof Error ? err : new Error(String(err));
    const timestamp = new Date().toISOString();
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`[${timestamp}] Error occurred`);
    console.error(`  Error: ${error.message}`);
    console.error(`  Stack: ${error.stack}`);
    
    if (ctx?.from) {
      console.error(`  User: @${ctx.from.username || 'unknown'} (ID: ${ctx.from.id})`);
    }
    
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Send generic error message to user (don't leak system details)
    try {
      await ctx.reply(
        'Sorry, an error occurred while processing your request. Please try again later.'
      );
    } catch (replyError) {
      const replyErrorMessage = replyError instanceof Error ? replyError.message : 'Unknown error';
      console.error(`Failed to send error message to user: ${replyErrorMessage}`);
    }
  };
}
