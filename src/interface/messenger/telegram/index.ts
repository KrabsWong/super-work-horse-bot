import { Telegraf, Context, Markup } from 'telegraf';
import type { Update, Message } from 'telegraf/types';
import type { MessengerPlatform, MessengerClient, CommandHandler, MessageResult, InlineButton } from '../types';

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

  onCallbackQuery(pattern: RegExp, handler: CommandHandler): void {
    this.bot.on('callback_query', async (ctx: Context<Update>) => {
      const callbackQuery = ctx.callbackQuery;
      if (!callbackQuery || !('data' in callbackQuery)) return;

      const data = callbackQuery.data;
      if (!pattern.test(data)) return;

      await ctx.answerCbQuery();

      const commandContext = {
        platform: 'telegram' as const,
        userId: String(ctx.from?.id || 0),
        username: ctx.from?.username || ctx.from?.first_name || 'unknown',
        chatId: String(callbackQuery.message?.chat.id || 0),
        commandName: 'callback',
        args: data,
        messenger: this.createClient(),
        messageId: callbackQuery.message ? String(callbackQuery.message.message_id) : undefined,
      };

      await handler(commandContext);
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

  async sendMessageWithButtons(
    chatId: string,
    message: string,
    buttons: InlineButton[][]
  ): Promise<MessageResult | null> {
    try {
      const keyboard = Markup.inlineKeyboard(
        buttons.map(row =>
          row.map(btn => Markup.button.callback(btn.text, btn.callbackData))
        )
      );
      const result = await this.bot.telegram.sendMessage(Number(chatId), message, {
        parse_mode: 'HTML',
        ...keyboard,
      });
      return {
        messageId: String(result.message_id),
        chatId: String(result.chat.id),
      };
    } catch (error) {
      console.error('[TelegramMessenger] Failed to send message with buttons:', error);
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

  async editMessageWithButtons(
    chatId: string,
    messageId: string,
    message: string,
    buttons: InlineButton[][]
  ): Promise<boolean> {
    try {
      const keyboard = Markup.inlineKeyboard(
        buttons.map(row =>
          row.map(btn => Markup.button.callback(btn.text, btn.callbackData))
        )
      );
      await this.bot.telegram.editMessageText(
        Number(chatId),
        Number(messageId),
        undefined,
        message,
        {
          parse_mode: 'HTML',
          ...keyboard,
        }
      );
      return true;
    } catch (error) {
      console.error('[TelegramMessenger] Failed to edit message with buttons:', error);
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
      sendMessageWithButtons: this.sendMessageWithButtons.bind(this),
      editMessage: this.editMessage.bind(this),
      editMessageWithButtons: this.editMessageWithButtons.bind(this),
      getNativeClient: this.getNativeClient.bind(this),
    };
  }
}