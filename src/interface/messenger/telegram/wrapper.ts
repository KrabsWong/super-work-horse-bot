import type { Telegram } from 'telegraf';
import type { MessengerClient, MessageResult, InlineButton } from '../types';

export function wrapTelegramAsMessenger(telegram: Telegram): MessengerClient {
  return {
    platform: 'telegram',
    async sendMessage(chatId: string, message: string): Promise<MessageResult | null> {
      try {
        const result = await telegram.sendMessage(Number(chatId), message);
        return {
          messageId: String(result.message_id),
          chatId: String(result.chat.id),
        };
      } catch (error) {
        console.error('[TelegramWrapper] Failed to send message:', error);
        return null;
      }
    },
    async sendMessageWithButtons(
      chatId: string,
      message: string,
      _buttons: InlineButton[][]
    ): Promise<MessageResult | null> {
      try {
        console.log('[TelegramWrapper] Note: Buttons not supported in wrapper mode, sending plain text');
        const result = await telegram.sendMessage(Number(chatId), message);
        return {
          messageId: String(result.message_id),
          chatId: String(result.chat.id),
        };
      } catch (error) {
        console.error('[TelegramWrapper] Failed to send message:', error);
        return null;
      }
    },
    async editMessage(chatId: string, messageId: string, message: string): Promise<boolean> {
      try {
        await telegram.editMessageText(Number(chatId), Number(messageId), undefined, message);
        return true;
      } catch (error) {
        console.error('[TelegramWrapper] Failed to edit message:', error);
        return false;
      }
    },
    async editMessageWithButtons(
      chatId: string,
      messageId: string,
      message: string,
      _buttons: InlineButton[][]
    ): Promise<boolean> {
      try {
        console.log('[TelegramWrapper] Note: Buttons not supported in wrapper mode, editing plain text');
        await telegram.editMessageText(Number(chatId), Number(messageId), undefined, message);
        return true;
      } catch (error) {
        console.error('[TelegramWrapper] Failed to edit message:', error);
        return false;
      }
    },
    getNativeClient(): Telegram {
      return telegram;
    },
  };
}