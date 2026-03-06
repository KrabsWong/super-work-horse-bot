import type { MessengerPlatform, CommandHandler, PlatformType } from './types';

export class MessengerManager {
  private platforms: Map<PlatformType, MessengerPlatform> = new Map();
  private commandHandlers: Map<string, CommandHandler> = new Map();
  private unknownHandler: CommandHandler | null = null;

  register(platform: MessengerPlatform): void {
    this.platforms.set(platform.platform, platform);
    console.log(`[MessengerManager] Registered platform: ${platform.platform}`);
  }

  async startAll(): Promise<void> {
    const enabledPlatforms = Array.from(this.platforms.values());
    
    if (enabledPlatforms.length === 0) {
      console.warn('[MessengerManager] No platforms registered');
      return;
    }

    console.log(`[MessengerManager] Starting ${enabledPlatforms.length} platform(s)...`);

    for (const platform of enabledPlatforms) {
      try {
        for (const [commandName, handler] of this.commandHandlers) {
          platform.onCommand(commandName, handler);
        }
        
        if (this.unknownHandler) {
          platform.onUnknown(this.unknownHandler);
        }

        await platform.start();
        console.log(`[MessengerManager] Started platform: ${platform.platform}`);
      } catch (error) {
        console.error(`[MessengerManager] Failed to start platform ${platform.platform}:`, error);
      }
    }
  }

  async stopAll(): Promise<void> {
    console.log('[MessengerManager] Stopping all platforms...');
    
    for (const platform of this.platforms.values()) {
      try {
        await platform.stop();
        console.log(`[MessengerManager] Stopped platform: ${platform.platform}`);
      } catch (error) {
        console.error(`[MessengerManager] Failed to stop platform ${platform.platform}:`, error);
      }
    }
    
    this.platforms.clear();
  }

  onCommand(commandName: string, handler: CommandHandler): void {
    this.commandHandlers.set(commandName, handler);
    
    for (const platform of this.platforms.values()) {
      platform.onCommand(commandName, handler);
    }
  }

  onUnknown(handler: CommandHandler): void {
    this.unknownHandler = handler;
    
    for (const platform of this.platforms.values()) {
      platform.onUnknown(handler);
    }
  }

  getPlatform(platformType: PlatformType): MessengerPlatform | undefined {
    return this.platforms.get(platformType);
  }

  getEnabledPlatforms(): PlatformType[] {
    return Array.from(this.platforms.keys());
  }
}