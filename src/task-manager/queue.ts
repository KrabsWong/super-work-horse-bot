import type { TaskId } from '../types';
import type { TaskQueueItem } from './types';

export class TaskQueue {
  private queue: TaskQueueItem[] = [];

  enqueue(item: TaskQueueItem): number {
    this.queue.push(item);
    const position = this.queue.length;
    console.log(`[TaskQueue] Enqueued task ${item.taskId}, position: ${position}`);
    return position;
  }

  dequeue(): TaskQueueItem | null {
    const item = this.queue.shift();
    if (item) {
      console.log(`[TaskQueue] Dequeued task ${item.taskId}`);
    }
    return item || null;
  }

  peek(): TaskQueueItem | null {
    return this.queue[0] || null;
  }

  getPosition(taskId: TaskId): number {
    const index = this.queue.findIndex(item => item.taskId === taskId);
    return index === -1 ? -1 : index + 1;
  }

  remove(taskId: TaskId): TaskQueueItem | null {
    const index = this.queue.findIndex(item => item.taskId === taskId);
    if (index === -1) {
      return null;
    }
    const item = this.queue.splice(index, 1)[0];
    console.log(`[TaskQueue] Removed task ${taskId} from queue`);
    return item;
  }

  getLength(): number {
    return this.queue.length;
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  getAll(): TaskQueueItem[] {
    return [...this.queue];
  }

  getByTaskId(taskId: TaskId): TaskQueueItem | undefined {
    return this.queue.find(item => item.taskId === taskId);
  }

  clear(): void {
    this.queue = [];
    console.log('[TaskQueue] Cleared queue');
  }
}