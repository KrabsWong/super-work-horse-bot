import type { CronTaskConfig } from './types';
import type { ExecutionPlan } from './planner';
import type { MessengerClient } from '../../interface/messenger/types';

export interface TaskReport {
  taskName: string;
  status: 'started' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  plan?: ExecutionPlan;
  taskId?: string;
  error?: string;
}

export class TaskReporter {
  private messengerClient: MessengerClient | null = null;

  setMessengerClient(client: MessengerClient): void {
    this.messengerClient = client;
  }

  async sendReport(chatId: string | number, report: TaskReport): Promise<void> {
    if (!this.messengerClient) {
      console.error('[TaskReporter] No messenger client set');
      return;
    }

    const chatIdStr = typeof chatId === 'string' ? chatId : String(chatId);
    const message = this.formatReport(report);

    try {
      await this.messengerClient.sendMessage(chatIdStr, message);
      console.log(`[TaskReporter] Report sent to ${chatIdStr}`);
    } catch (error) {
      console.error('[TaskReporter] Failed to send report:', error);
    }
  }

  private formatReport(report: TaskReport): string {
    const lines: string[] = [];
    const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push(`📋 定时任务报告: ${report.taskName}`);
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    switch (report.status) {
      case 'started':
        lines.push('▶️ 状态: 任务已启动');
        lines.push(`⏰ 时间: ${now}`);
        if (report.taskId) {
          lines.push(`🆔 任务ID: ${report.taskId}`);
        }
        if (report.plan && report.plan.steps.length > 0) {
          lines.push('');
          lines.push('📝 执行计划:');
          report.plan.steps.forEach((step, index) => {
            const num = index + 1;
            if (step.type === 'command') {
              lines.push(`  ${num}. ${step.args || step.command}`);
            } else {
              lines.push(`  ${num}. [Action] ${step.action}`);
            }
          });
        }
        break;

      case 'completed':
        lines.push('✅ 状态: 任务已完成');
        lines.push(`⏰ 完成时间: ${now}`);
        if (report.taskId) {
          lines.push(`🆔 任务ID: ${report.taskId}`);
        }
        if (report.endTime && report.startTime) {
          const duration = Math.round((report.endTime - report.startTime) / 1000);
          lines.push(`⏱️ 执行时长: ${duration} 秒`);
        }
        break;

      case 'failed':
        lines.push('❌ 状态: 任务失败');
        lines.push(`⏰ 失败时间: ${now}`);
        if (report.taskId) {
          lines.push(`🆔 任务ID: ${report.taskId}`);
        }
        if (report.error) {
          lines.push('');
          lines.push(`❗ 错误信息:`);
          lines.push(`  ${report.error}`);
        }
        break;
    }

    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return lines.join('\n');
  }

  createStartedReport(
    taskConfig: CronTaskConfig,
    plan: ExecutionPlan,
    taskId?: string
  ): TaskReport {
    return {
      taskName: taskConfig.name,
      status: 'started',
      startTime: Date.now(),
      plan,
      taskId,
    };
  }

  createCompletedReport(
    taskConfig: CronTaskConfig,
    startTime: number,
    taskId?: string
  ): TaskReport {
    return {
      taskName: taskConfig.name,
      status: 'completed',
      startTime,
      endTime: Date.now(),
      taskId,
    };
  }

  createFailedReport(
    taskConfig: CronTaskConfig,
    startTime: number,
    error: string,
    taskId?: string
  ): TaskReport {
    return {
      taskName: taskConfig.name,
      status: 'failed',
      startTime,
      endTime: Date.now(),
      error,
      taskId,
    };
  }
}

export const taskReporter = new TaskReporter();
