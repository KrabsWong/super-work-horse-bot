import type { CronTaskConfig } from '../cron-manager/types';
import type { MessengerClient } from '../../interface/messenger/types';
import { Cron } from 'croner';

export interface ScheduledTask {
  config: CronTaskConfig;
  job: Cron | null;
  lastRun: number | null;
  nextRun: Date | null;
  enabled: boolean;
}

export class TaskRegistry {
  private tasks: Map<string, ScheduledTask> = new Map();
  private messengerClient: MessengerClient | null = null;
  private defaultChatId: string = '';

  setMessengerClient(client: MessengerClient): void {
    this.messengerClient = client;
  }

  setDefaultChatId(chatId: string | number): void {
    this.defaultChatId = typeof chatId === 'string' ? chatId : String(chatId);
  }

  registerTask(config: CronTaskConfig): boolean {
    if (this.tasks.has(config.name)) {
      console.warn(`[TaskRegistry] Task '${config.name}' already exists, updating...`);
    }

    const scheduledTask: ScheduledTask = {
      config,
      job: null,
      lastRun: null,
      nextRun: null,
      enabled: config.enabled,
    };

    this.tasks.set(config.name, scheduledTask);
    console.log(`[TaskRegistry] Registered task: ${config.name}`);
    return true;
  }

  unregisterTask(name: string): boolean {
    const task = this.tasks.get(name);
    if (!task) {
      return false;
    }

    if (task.job) {
      task.job.stop();
    }

    this.tasks.delete(name);
    console.log(`[TaskRegistry] Unregistered task: ${name}`);
    return true;
  }

  getTask(name: string): ScheduledTask | undefined {
    return this.tasks.get(name);
  }

  getAllTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  getEnabledTasks(): ScheduledTask[] {
    return this.getAllTasks().filter(t => t.enabled);
  }

  enableTask(name: string): boolean {
    const task = this.tasks.get(name);
    if (!task) {
      return false;
    }

    task.enabled = true;
    task.config.enabled = true;
    console.log(`[TaskRegistry] Enabled task: ${name}`);
    return true;
  }

  disableTask(name: string): boolean {
    const task = this.tasks.get(name);
    if (!task) {
      return false;
    }

    task.enabled = false;
    task.config.enabled = false;
    console.log(`[TaskRegistry] Disabled task: ${name}`);
    return true;
  }

  updateLastRun(name: string): void {
    const task = this.tasks.get(name);
    if (task) {
      task.lastRun = Date.now();
    }
  }

  updateNextRun(name: string, nextRun: Date | null): void {
    const task = this.tasks.get(name);
    if (task) {
      task.nextRun = nextRun;
    }
  }

  setJob(name: string, job: Cron): void {
    const task = this.tasks.get(name);
    if (task) {
      task.job = job;
      task.nextRun = job.nextRun();
    }
  }

  clearJob(name: string): void {
    const task = this.tasks.get(name);
    if (task && task.job) {
      task.job.stop();
      task.job = null;
      task.nextRun = null;
    }
  }

  clearAllJobs(): void {
    for (const task of this.tasks.values()) {
      if (task.job) {
        task.job.stop();
        task.job = null;
        task.nextRun = null;
      }
    }
    console.log('[TaskRegistry] Cleared all jobs');
  }

  getTaskCount(): number {
    return this.tasks.size;
  }

  getEnabledTaskCount(): number {
    return this.getEnabledTasks().length;
  }

  getMessengerClient(): MessengerClient | null {
    return this.messengerClient;
  }

  getDefaultChatId(): string {
    return this.defaultChatId;
  }

  listTasks(): string[] {
    return Array.from(this.tasks.keys());
  }

  summarize(): string {
    const lines: string[] = [];
    lines.push(`Total tasks: ${this.tasks.size}`);
    lines.push(`Enabled tasks: ${this.getEnabledTaskCount()}`);
    lines.push('');
    
    for (const [name, task] of this.tasks) {
      const status = task.enabled ? '✅' : '❌';
      const schedule = task.config.schedule;
      const nextRun = task.nextRun 
        ? task.nextRun.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
        : 'N/A';
      lines.push(`${status} ${name}: ${schedule} (next: ${nextRun})`);
    }

    return lines.join('\n');
  }
}

export const taskRegistry = new TaskRegistry();
