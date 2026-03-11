// Platform abstraction layer
export * from './types';
export * from './manager';
export { TelegramMessenger } from './telegram';
export { DiscordMessenger } from './discord';

// Legacy exports for backward compatibility
export {
  formatTaskMessage,
  sendTaskMessage,
  updateTaskMessage,
  type TaskMessageData,
  type TaskMessageStatus
} from './legacy';
