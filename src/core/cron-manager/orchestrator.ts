import type { CronTaskConfig } from './types';
import type { ExecutionPlan } from './planner';
import type { TaskManager } from '../task-manager';
import type { ExecutionContext } from '../../types';

export interface OrchestratorResult {
  success: boolean;
  taskId?: string;
  error?: string;
  plan: ExecutionPlan;
}

export class TaskOrchestrator {
  private taskManager: TaskManager;

  constructor(taskManager: TaskManager) {
    this.taskManager = taskManager;
  }

  async executeCronTask(
    taskConfig: CronTaskConfig,
    context: ExecutionContext
  ): Promise<OrchestratorResult> {
    console.log(`[TaskOrchestrator] Executing cron task: ${taskConfig.name}`);

    try {
      const fullArgs = taskConfig.description
        ? `${taskConfig.autoCommand} ${taskConfig.description}`
        : taskConfig.autoCommand;

      const plan: ExecutionPlan = {
        steps: [{
          type: 'command',
          command: 'execute',
          args: fullArgs,
        }],
        description: taskConfig.description || taskConfig.autoCommand,
      };

      console.log(`[TaskOrchestrator] Executing: ${taskConfig.autoCommand}`);

      return await this.executeSingleStep(plan, context);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[TaskOrchestrator] Error executing task: ${message}`);
      return {
        success: false,
        error: message,
        plan: { steps: [], description: taskConfig.description || taskConfig.autoCommand },
      };
    }
  }

  private async executeSingleStep(
    plan: ExecutionPlan,
    context: ExecutionContext
  ): Promise<OrchestratorResult> {
    const step = plan.steps[0];
    const args = step.args || '';

    console.log(`[TaskOrchestrator] Executing single step: ${args}`);

    try {
      const result = await this.taskManager.createTask('research', args, context);

      return {
        success: true,
        taskId: result.taskId,
        plan,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[TaskOrchestrator] Error in single step execution: ${message}`);
      return {
        success: false,
        error: message,
        plan,
      };
    }
  }
}
