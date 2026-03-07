import type { TaskId, Slot } from '../../types';

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

  private logActiveSlots(operation: string): void {
    const slots = Array.from(this.activeSlots.entries());
    console.log(`[SlotManager] ${operation} - Active slots (${this.activeSlots.size}/${this.maxSlots}):`);
    if (slots.length === 0) {
      console.log(`[SlotManager]   (none)`);
    } else {
      slots.forEach(([taskId, slot]) => {
        console.log(`[SlotManager]   - ${taskId}: branch=${slot.branchName}, session=${slot.sessionName}`);
      });
    }
  }

  acquireSlot(
    taskId: TaskId,
    sessionName: string,
    branchName: string,
    statusFile: string
  ): Slot | null {
    console.log(`[SlotManager] ========== ACQUIRE SLOT ==========`);
    console.log(`[SlotManager] Requesting slot for: ${taskId}`);
    console.log(`[SlotManager]   - sessionName: ${sessionName}`);
    console.log(`[SlotManager]   - branchName: ${branchName}`);
    
    this.logActiveSlots('Before acquire');
    
    if (this.activeSlots.size >= this.maxSlots) {
      console.log(`[SlotManager] REJECTED: No available slots (max: ${this.maxSlots})`);
      console.log(`[SlotManager] ========== ACQUIRE END (REJECTED) ==========`);
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
    console.log(`[SlotManager] SUCCESS: Acquired slot for ${taskId}`);
    this.logActiveSlots('After acquire');
    console.log(`[SlotManager] ========== ACQUIRE END ==========`);
    return slot;
  }

  releaseSlot(taskId: TaskId): Slot | null {
    console.log(`[SlotManager] ========== RELEASE SLOT ==========`);
    console.log(`[SlotManager] Requesting release for: ${taskId}`);
    
    this.logActiveSlots('Before release');
    
    const slot = this.activeSlots.get(taskId);
    if (slot) {
      console.log(`[SlotManager] Found slot to release:`);
      console.log(`[SlotManager]   - taskId: ${slot.taskId}`);
      console.log(`[SlotManager]   - branchName: ${slot.branchName}`);
      console.log(`[SlotManager]   - sessionName: ${slot.sessionName}`);
      
      this.activeSlots.delete(taskId);
      console.log(`[SlotManager] SUCCESS: Released slot for ${taskId}`);
      this.logActiveSlots('After release');
    } else {
      console.log(`[SlotManager] WARNING: Slot not found for ${taskId}`);
      console.log(`[SlotManager] This may indicate a race condition or double-release`);
    }
    
    console.log(`[SlotManager] ========== RELEASE END ==========`);
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
    console.log(`[SlotManager] Clearing all slots (${this.activeSlots.size} slots)`);
    this.activeSlots.clear();
    console.log('[SlotManager] All slots cleared');
  }
}