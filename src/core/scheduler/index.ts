import { Cron } from 'croner';
import type { MessengerClient } from '../../interface/messenger/types';
import { taskManager } from '../task-manager';
import { TaskRegistry, type ScheduledTask } from './registry';
import { CronWatcher } from '../cron-manager/watcher';
import { TaskOrchestrator } from '../cron-manager/orchestrator';
import { TaskReporter } from '../cron-manager/reporter';
import type { CronTaskConfig } from '../cron-manager/types';
import { startMonitoring } from '../../infra/monitor';

export { taskRegistry, type ScheduledTask } from './registry';

async function executeMarkdownTask(
  taskConfig: CronTaskConfig,
  orchestrator: TaskOrchestrator,
  reporter: TaskReporter,
  registry: TaskRegistry
): Promise<void> {
  const timestamp = new Date().toISOString();

  console.log('━━━━━━━━━━━━━━');
  console.log(`[${timestamp}] Markdown cron task '${taskConfig.name}' triggered`);

  const startTime = Date.now();
  const messengerClient = registry.getMessengerClient();
  const chatId = taskConfig.messenger === 'telegram'
    ? registry.getDefaultChatId()
    : registry.getDefaultChatId();

  try {
    const context = {
      chatId,
      userId: 0,
      username: `cron:${taskConfig.name}`,
      messenger: messengerClient || undefined,
      enableMonitoring: true,
    };

    const result = await orchestrator.executeCronTask(taskConfig, context);

    if (result.success && result.taskId) {
      registry.updateLastRun(taskConfig.name);
      console.log(`Markdown task '${taskConfig.name}' started: ${result.taskId}`);

      const task = taskManager.getTask(result.taskId);
      if (task && messengerClient && chatId) {
        const startingReport = reporter.createStartingReport(
          taskConfig,
          result.plan,
          result.taskId,
          task.sessionName,
          task.branchName
        );
        const messageId = await reporter.sendReport(chatId, startingReport);

        if (task.status === 'running') {
          startMonitoring({
            taskId: result.taskId,
            sessionName: task.sessionName,
            statusFile: task.statusFile,
            messenger: messengerClient,
            chatId: chatId,
            taskName: taskConfig.name,
            branchName: task.branchName,
            args: taskConfig.description || '',
            startedAt: task.startedAt,
            messageId: messageId || undefined,
            onProgress: async (taskId, duration) => {
              const runningReport = reporter.createRunningReport(
                taskConfig,
                result.plan,
                taskId,
                task.startedAt || Date.now(),
                task.sessionName,
                task.branchName
              );
              runningReport.duration = duration;
              await reporter.sendReport(chatId, runningReport);
            },
            onCompletion: async (taskId, duration, killedCount) => {
              await taskManager.completeTask(taskId);
              const completedReport = reporter.createCompletedReport(
                taskConfig,
                task.startedAt || Date.now(),
                taskId,
                duration,
                killedCount,
                task.sessionName,
                task.branchName
              );
              await reporter.sendReport(chatId, completedReport);
            },
            onFailure: async (taskId, reason, duration, killedCount) => {
              await taskManager.failTask(taskId, `Task ended unexpectedly (${reason})`);
              const errorReport = reporter.createTimeoutReport(
                taskConfig,
                task.startedAt || Date.now(),
                taskId,
                duration,
                killedCount || 0,
                task.sessionName,
                task.branchName
              );
              await reporter.sendReport(chatId, errorReport);
            },
          });
        }
      }
    } else {
      const error = result.error || 'Unknown error';
      console.error(`Markdown task '${taskConfig.name}' failed: ${error}`);

      const failedReport = reporter.createFailedReport(taskConfig, startTime, error, 'unknown', undefined, undefined);
      if (messengerClient && chatId) {
        await reporter.sendReport(chatId, failedReport);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Markdown task '${taskConfig.name}' error:`, errorMessage);

    const failedReport = reporter.createFailedReport(taskConfig, startTime, errorMessage, 'unknown', undefined, undefined);
    if (messengerClient && chatId) {
      await reporter.sendReport(chatId, failedReport);
    }
  }

  console.log('━━━━━━━━━━━━━━');
}

export interface SchedulerConfig {
  messenger: MessengerClient;
  chatId: string | number;
  cronDir?: string;
}

export class Scheduler {
  private registry: TaskRegistry;
  private watcher: CronWatcher | null = null;
  private orchestrator: TaskOrchestrator;
  private reporter: TaskReporter;

  constructor() {
    this.registry = new TaskRegistry();
    this.orchestrator = new TaskOrchestrator(taskManager);
    this.reporter = new TaskReporter();
  }

  async initialize(config: SchedulerConfig): Promise<void> {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Initializing scheduler...');

    this.registry.setMessengerClient(config.messenger);
    this.registry.setDefaultChatId(config.chatId);
    this.reporter.setMessengerClient(config.messenger);

    const cronDir = config.cronDir || './cron';
    this.watcher = new CronWatcher(cronDir);

    this.watcher.onChange((tasks) => {
      this.handleTasksChange(tasks);
    });

    await this.watcher.start();

    console.log(`Scheduler initialized with ${this.registry.getTaskCount()} task(s)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  private handleTasksChange(tasks: Map<string, CronTaskConfig>): void {
    console.log(`[Scheduler] Tasks changed, updating registry...`);

    const currentNames = new Set(this.registry.listTasks());
    const newNames = new Set(tasks.keys());

    for (const name of currentNames) {
      if (!newNames.has(name)) {
        this.registry.clearJob(name);
        this.registry.unregisterTask(name);
      }
    }

    for (const [name, config] of tasks) {
      const existingTask = this.registry.getTask(name);
      
      if (!existingTask || JSON.stringify(existingTask.config) !== JSON.stringify(config)) {
        if (existingTask) {
          this.registry.clearJob(name);
        }
        
        this.registry.registerTask(config);
        
        if (config.enabled) {
          this.scheduleTask(name, config);
        }
      }
    }

    console.log(`[Scheduler] Registry updated: ${this.registry.getTaskCount()} tasks, ${this.registry.getEnabledTaskCount()} enabled`);
    console.log(this.registry.summarize());
  }

  private scheduleTask(name: string, config: CronTaskConfig): void {
    if (!config.cronExpression) {
      console.error(`[Scheduler] Task '${name}' has no valid cron expression`);
      return;
    }

    try {
      const job = new Cron(
        config.cronExpression,
        async () => {
          await executeMarkdownTask(config, this.orchestrator, this.reporter, this.registry);
        },
        {
          timezone: 'Asia/Shanghai',
          name: name,
        }
      );

      this.registry.setJob(name, job);
      const nextRun = job.nextRun();
      this.registry.updateNextRun(name, nextRun);

      console.log(`[Scheduler] Scheduled task '${name}':`);
      console.log(`  Schedule: ${config.schedule} (${config.cronExpression})`);
      console.log(`  Next run: ${nextRun ? nextRun.toLocaleString('zh-CN') : 'N/A'}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Scheduler] Failed to schedule task '${name}': ${errorMessage}`);
    }
  }

  async runTaskNow(name: string): Promise<boolean> {
    const task = this.registry.getTask(name);
    if (!task) {
      console.error(`[Scheduler] Task '${name}' not found`);
      return false;
    }

    console.log(`[Scheduler] Manually triggering task '${name}'`);
    await executeMarkdownTask(task.config, this.orchestrator, this.reporter, this.registry);
    return true;
  }

  stop(): void {
    console.log('[Scheduler] Stopping scheduler...');
    
    if (this.watcher) {
      this.watcher.stop();
    }
    
    this.registry.clearAllJobs();
    console.log('[Scheduler] Scheduler stopped');
  }

  getRegistry(): TaskRegistry {
    return this.registry;
  }

  getTask(name: string): ScheduledTask | undefined {
    return this.registry.getTask(name);
  }

  listTasks(): string[] {
    return this.registry.listTasks();
  }
}

export const scheduler = new Scheduler();
