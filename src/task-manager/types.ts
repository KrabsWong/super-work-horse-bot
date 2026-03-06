export {
  type TaskId,
  type Task,
  type Slot,
  type TaskManagerConfig,
  type TaskResult,
  TaskStatus,
} from '../types';

export interface TaskQueueItem {
  taskId: TaskId;
  commandName: string;
  args: string;
  context: {
    userId?: number;
    username?: string;
    chatId?: number | string;
    dir: string;
  };
  createdAt: number;
}

import type { TaskId } from '../types';