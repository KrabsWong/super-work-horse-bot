import type { TaskId, Slot } from '../types';

export class SlotManager {
  private maxSlots: number;
  private activeSlots: Map<TaskId, Slot> = new Map();

  constructor(maxSlots: number = 3) {
    this.maxSlots = maxSlots;
  }

  setMaxSlots(maxSlots: number): void {
    this.maxSlots = maxSlots;
  }

  getMaxSlots(): number {
    return this.maxSlots;
  }

  acquireSlot(
    taskId: TaskId,
    sessionName: string,
    branchName: string,
    statusFile: string
  ): Slot | null {
    if (this.activeSlots.size >= this.maxSlots) {
      return null;
    }

    const slot: Slot = {
      taskId,
      sessionName,
      branchName,
      startTime: Date.now(),
      statusFile,
    };

    this.activeSlots.set(taskId, slot);
    console.log(`[SlotManager] Acquired slot for task ${taskId}, active: ${this.activeSlots.size}/${this.maxSlots}`);
    return slot;
  }

  releaseSlot(taskId: TaskId): Slot | null {
    const slot = this.activeSlots.get(taskId);
    if (slot) {
      this.activeSlots.delete(taskId);
      console.log(`[SlotManager] Released slot for task ${taskId}, active: ${this.activeSlots.size}/${this.maxSlots}`);
    }
    return slot || null;
  }

  getAvailableSlots(): number {
    return Math.max(0, this.maxSlots - this.activeSlots.size);
  }

  getRunningTaskIds(): TaskId[] {
    return Array.from(this.activeSlots.keys());
  }

  getRunningTasks(): Slot[] {
    return Array.from(this.activeSlots.values());
  }

  getSlot(taskId: TaskId): Slot | undefined {
    return this.activeSlots.get(taskId);
  }

  hasSlot(taskId: TaskId): boolean {
    return this.activeSlots.has(taskId);
  }

  clear(): void {
    this.activeSlots.clear();
    console.log('[SlotManager] Cleared all slots');
  }
}