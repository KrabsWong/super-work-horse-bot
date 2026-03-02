export {
  type TaskId,
  type Task,
  type Slot,
  type PRInfo,
  type TaskManagerConfig,
  type TaskResult,
  TaskStatus,
  PRMergeStrategy,
} from '../types';

export interface TaskQueueItem {
  taskId: TaskId;
  commandName: string;
  args: string;
  context: {
    userId?: number;
    username?: string;
    chatId?: number;
    dir: string;
  };
  createdAt: number;
}

import type { TaskId } from '../types';