import { Telegraf, Context } from 'telegraf';
import type { Update, Message } from 'telegraf/types';
import type { MessengerPlatform, MessengerClient, CommandHandler, MessageResult } from '../types';

export class TelegramMessenger implements MessengerPlatform {
  readonly platform = 'telegram' as const;
  private bot: Telegraf;
  private commandHandlers: Map<string, CommandHandler> = new Map();

  constructor(token: string) {
    this.bot = new Telegraf(token);
  }

  async start(): Promise<void> {
    await this.bot.launch();
  }

  async stop(): Promise<void> {
    this.bot.stop('shutdown');
  }

  onCommand(commandName: string, handler: CommandHandler): void {
    this.commandHandlers.set(commandName, handler);
    
    this.bot.command(commandName, async (ctx: Context<Update>) => {
      const msg = ctx.message as Message.TextMessage;
      const message = msg.text;
      const pattern = new RegExp(`^\\/${commandName}(@\\w+)?\\s*`, 'i');
      const args = message.replace(pattern, '').trim();
      
      const commandContext = {
        platform: 'telegram' as const,
        userId: String(ctx.from?.id || 0),
        username: ctx.from?.username || ctx.from?.first_name || 'unknown',
        chatId: String(ctx.chat?.id || 0),
        commandName,
        args,
        messenger: this.createClient(),
      };
      
      await handler(commandContext);
    });
  }

  onUnknown(handler: CommandHandler): void {
    this.bot.on('message', async (ctx: Context<Update>) => {
      const msg = ctx.message as Message.TextMessage;
      if (msg?.text && !msg.text.startsWith('/')) {
        const commandContext = {
          platform: 'telegram' as const,
          userId: String(ctx.from?.id || 0),
          username: ctx.from?.username || ctx.from?.first_name || 'unknown',
          chatId: String(ctx.chat?.id || 0),
          commandName: '',
          args: msg.text,
          messenger: this.createClient(),
        };
        
        await handler(commandContext);
      }
    });
  }

  async sendMessage(chatId: string, message: string): Promise<MessageResult | null> {
    try {
      const result = await this.bot.telegram.sendMessage(Number(chatId), message);
      return {
        messageId: String(result.message_id),
        chatId: String(result.chat.id),
      };
    } catch (error) {
      console.error('[TelegramMessenger] Failed to send message:', error);
      return null;
    }
  }

  async editMessage(chatId: string, messageId: string, message: string): Promise<boolean> {
    try {
      await this.bot.telegram.editMessageText(
        Number(chatId),
        Number(messageId),
        undefined,
        message
      );
      return true;
    } catch (error) {
      console.error('[TelegramMessenger] Failed to edit message:', error);
      return false;
    }
  }

  getNativeClient(): Telegraf['telegram'] {
    return this.bot.telegram;
  }

  private createClient(): MessengerClient {
    return {
      platform: this.platform,
      sendMessage: this.sendMessage.bind(this),
      editMessage: this.editMessage.bind(this),
      getNativeClient: this.getNativeClient.bind(this),
    };
  }
}