import { Client, GatewayIntentBits, Events, Message, TextChannel } from 'discord.js';
import type { MessengerPlatform, MessengerClient, CommandHandler, MessageResult } from '../types';

export class DiscordMessenger implements MessengerPlatform {
  readonly platform = 'discord' as const;
  private client: Client;
  private token: string;
  private commandHandlers: Map<string, CommandHandler> = new Map();

  constructor(token: string) {
    this.token = token;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
    });
  }

  async start(): Promise<void> {
    this.setupEventHandlers();
    await this.client.login(this.token);
  }

  async stop(): Promise<void> {
    this.client.destroy();
  }

  private setupEventHandlers(): void {
    this.client.once(Events.ClientReady, (readyClient) => {
      console.log(`[DiscordMessenger] Logged in as ${readyClient.user.tag}`);
    });

    this.client.on(Events.MessageCreate, async (message: Message) => {
      if (message.author.bot) return;
      if (!message.content.startsWith('/')) return;

      const parts = message.content.slice(1).split(/\s+/);
      const commandName = parts[0]?.toLowerCase();
      const args = parts.slice(1).join(' ');

      if (!commandName) return;

      console.log(`[DiscordMessenger] Received command: '${commandName}', registered handlers: ${Array.from(this.commandHandlers.keys()).join(', ')}`);
      
      const handler = this.commandHandlers.get(commandName);
      if (handler) {
        const commandContext = {
          platform: 'discord' as const,
          userId: message.author.id,
          username: message.author.username,
          chatId: message.channelId,
          commandName,
          args,
          messenger: this.createClient(),
        };

        await handler(commandContext);
      } else {
        console.log(`[DiscordMessenger] No handler found for command: '${commandName}'`);
      }
    });
  }

  onCommand(commandName: string, handler: CommandHandler): void {
    console.log(`[DiscordMessenger] Registering command: '${commandName}' -> '${commandName.toLowerCase()}'`);
    this.commandHandlers.set(commandName.toLowerCase(), handler);
    console.log(`[DiscordMessenger] Registered commands: ${Array.from(this.commandHandlers.keys()).join(', ')}`);
  }

  onUnknown(handler: CommandHandler): void {
    this.client.on(Events.MessageCreate, async (message: Message) => {
      if (message.author.bot) return;
      if (message.content.startsWith('/')) return;

      const commandContext = {
        platform: 'discord' as const,
        userId: message.author.id,
        username: message.author.username,
        chatId: message.channelId,
        commandName: '',
        args: message.content,
        messenger: this.createClient(),
      };

      await handler(commandContext);
    });
  }

  async sendMessage(chatId: string, message: string): Promise<MessageResult | null> {
    try {
      console.log(`[DiscordMessenger] Attempting to send message to channel: ${chatId}`);
      const channel = await this.client.channels.fetch(chatId);
      if (!channel) {
        console.error(`[DiscordMessenger] Channel ${chatId} not found`);
        return null;
      }
      if (!('send' in channel)) {
        console.error(`[DiscordMessenger] Channel ${chatId} does not support sending messages (type: ${channel.type})`);
        return null;
      }

      const result = await (channel as any).send(message);
      
      return {
        messageId: result.id,
        chatId: result.channelId,
      };
    } catch (error) {
      console.error('[DiscordMessenger] Failed to send message:', error);
      return null;
    }
  }

  async editMessage(chatId: string, messageId: string, message: string): Promise<boolean> {
    try {
      const channel = await this.client.channels.fetch(chatId);
      if (!channel || !channel.isTextBased()) {
        console.error('[DiscordMessenger] Channel not found or not text-based');
        return false;
      }

      const textChannel = channel as TextChannel;
      const msg = await textChannel.messages.fetch(messageId);
      await msg.edit(message);
      
      return true;
    } catch (error) {
      console.error('[DiscordMessenger] Failed to edit message:', error);
      return false;
    }
  }

  getNativeClient(): Client {
    return this.client;
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