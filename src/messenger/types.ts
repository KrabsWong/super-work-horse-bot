export type PlatformType = 'telegram' | 'discord';

export interface MessageResult {
  messageId: string;
  chatId: string;
}

export interface CommandContext {
  platform: PlatformType;
  userId: string;
  username: string;
  chatId: string;
  commandName: string;
  args: string;
  messenger: MessengerClient;
}

export type CommandHandler = (ctx: CommandContext) => Promise<void>;

export interface MessengerClient {
  readonly platform: PlatformType;
  sendMessage(chatId: string, message: string): Promise<MessageResult | null>;
  editMessage(chatId: string, messageId: string, message: string): Promise<boolean>;
  getNativeClient(): unknown;
}

export interface MessengerPlatform extends MessengerClient {
  start(): Promise<void>;
  stop(): Promise<void>;
  onCommand(commandName: string, handler: CommandHandler): void;
  onUnknown(handler: CommandHandler): void;
}

export interface PlatformConfig {
  token: string;
}

export interface PlatformsConfig {
  activePlatform: PlatformType;
  telegram: PlatformConfig;
  discord: PlatformConfig;
}