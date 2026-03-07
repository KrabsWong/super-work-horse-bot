import type { CronTaskConfig } from './types';
import { TaskPlanner, type ExecutionPlan, type ExecutionStep } from './planner';
import type { TaskManager, TaskCompletionCallback } from '../task-manager';
import type { ExecutionContext, MessengerClient } from '../../types';

export interface OrchestratorResult {
  success: boolean;
  taskId?: string;
  error?: string;
  plan: ExecutionPlan;
}

export class TaskOrchestrator {
  private planner: TaskPlanner;
  private taskManager: TaskManager;
  private messengerClient: MessengerClient | null = null;

  constructor(taskManager: TaskManager, planner?: TaskPlanner) {
    this.taskManager = taskManager;
    this.planner = planner || new TaskPlanner();
  }

  setMessengerClient(client: MessengerClient): void {
    this.messengerClient = client;
  }

  async executeCronTask(
    taskConfig: CronTaskConfig,
    context: ExecutionContext
  ): Promise<OrchestratorResult> {
    console.log(`[TaskOrchestrator] Executing cron task: ${taskConfig.name}`);

    try {
      const plan = await this.planner.plan(taskConfig.description);

      console.log(`[TaskOrchestrator] Generated plan with ${plan.steps.length} steps`);
      console.log(this.planner.summarizePlan(plan));

      if (!this.planner.validatePlan(plan)) {
        return {
          success: false,
          error: 'Invalid execution plan',
          plan,
        };
      }

      if (plan.steps.length === 1 && plan.steps[0].type === 'command') {
        return await this.executeSingleStep(plan, context);
      } else {
        return await this.executeMultiStep(plan, context);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[TaskOrchestrator] Error executing task: ${message}`);
      return {
        success: false,
        error: message,
        plan: { steps: [], description: taskConfig.description },
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

  private async executeMultiStep(
    plan: ExecutionPlan,
    context: ExecutionContext
  ): Promise<OrchestratorResult> {
    console.log(`[TaskOrchestrator] Executing multi-step plan`);

    const results: { step: ExecutionStep; success: boolean; error?: string }[] = [];

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      console.log(`[TaskOrchestrator] Executing step ${i + 1}/${plan.steps.length}`);

      try {
        if (step.type === 'command') {
          const args = this.buildStepArgs(step, results);
          const result = await this.taskManager.createTask('research', args, context);

          results.push({
            step,
            success: true,
          });

          console.log(`[TaskOrchestrator] Step ${i + 1} started: ${result.taskId}`);
        } else if (step.type === 'action') {
          const success = await this.executeAction(step, context);
          results.push({
            step,
            success,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[TaskOrchestrator] Step ${i + 1} failed: ${message}`);
        results.push({
          step,
          success: false,
          error: message,
        });

        return {
          success: false,
          error: `Step ${i + 1} failed: ${message}`,
          plan,
        };
      }
    }

    const allSuccess = results.every(r => r.success);
    return {
      success: allSuccess,
      plan,
    };
  }

  private buildStepArgs(
    step: ExecutionStep,
    previousResults: { step: ExecutionStep; success: boolean; error?: string }[]
  ): string {
    let args = step.args || '';

    if (step.input && previousResults.length > 0) {
      const inputStep = previousResults.find(r => r.step.output === step.input);
      if (inputStep) {
        args += `\nInput from previous step: ${step.input}`;
      }
    }

    return args;
  }

  private async executeAction(step: ExecutionStep, context: ExecutionContext): Promise<boolean> {
    console.log(`[TaskOrchestrator] Executing action: ${step.action}`);

    if (!this.messengerClient) {
      console.warn('[TaskOrchestrator] No messenger client set, cannot execute action');
      return false;
    }

    try {
      switch (step.action) {
        case 'send_message':
          if (context.chatId && step.args) {
            const chatIdStr = typeof context.chatId === 'string' 
              ? context.chatId 
              : String(context.chatId);
            await this.messengerClient.sendMessage(chatIdStr, step.args);
            return true;
          }
          return false;

        case 'send_file':
          if (step.file && context.chatId) {
            const file = Bun.file(step.file);
            const exists = await file.exists();
            if (exists) {
              const chatIdStr = typeof context.chatId === 'string' 
                ? context.chatId 
                : String(context.chatId);
              const content = await file.text();
              await this.messengerClient.sendMessage(chatIdStr, content);
              return true;
            } else {
              console.error(`[TaskOrchestrator] File not found: ${step.file}`);
              return false;
            }
          }
          return false;

        default:
          console.warn(`[TaskOrchestrator] Unknown action: ${step.action}`);
          return false;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[TaskOrchestrator] Error executing action: ${message}`);
      return false;
    }
  }

  setTaskCompletionCallback(callback: TaskCompletionCallback): void {
    this.taskManager.setTaskCompletionCallback(callback);
  }
}