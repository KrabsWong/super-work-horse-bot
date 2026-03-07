export interface ExecutionStep {
  type: 'command' | 'action';
  command?: string;
  args?: string;
  action?: string;
  input?: string;
  output?: string;
  file?: string;
}

export interface ExecutionPlan {
  steps: ExecutionStep[];
  description: string;
}

export interface PlannerOptions {
  useLLM?: boolean;
  llmModel?: string;
}

export class TaskPlanner {
  private options: PlannerOptions;

  constructor(options: PlannerOptions = {}) {
    this.options = {
      useLLM: false,
      ...options,
    };
  }

  async plan(taskDescription: string): Promise<ExecutionPlan> {
    console.log(`[TaskPlanner] Planning task: ${taskDescription.substring(0, 50)}...`);

    if (this.options.useLLM) {
      return this.planWithLLM(taskDescription);
    }

    return this.planWithRules(taskDescription);
  }

  private async planWithRules(description: string): Promise<ExecutionPlan> {
    const steps: ExecutionStep[] = [];

    const multiStepPatterns = [
      /首先.*然后/i,
      /第一步.*第二步/i,
      /先.*再/i,
      /\d+\.\s+/,
    ];

    const isMultiStep = multiStepPatterns.some(pattern => pattern.test(description));

    if (isMultiStep) {
      const parsedSteps = this.parseMultiStepDescription(description);
      steps.push(...parsedSteps);
    } else {
      steps.push({
        type: 'command',
        command: 'execute',
        args: description,
      });
    }

    if (description.includes('发送') || description.includes('报告') || description.includes('通知')) {
      const hasSendAction = steps.some(s => s.action === 'send_file' || s.action === 'send_message');
      if (!hasSendAction) {
        steps.push({
          type: 'action',
          action: 'send_message',
          args: '任务执行完成',
        });
      }
    }

    return {
      steps,
      description,
    };
  }

  private parseMultiStepDescription(description: string): ExecutionStep[] {
    const steps: ExecutionStep[] = [];

    const numberedPattern = /(\d+)[.、]\s*([^\d]+)/g;
    let match;
    const numberedSteps: string[] = [];

    while ((match = numberedPattern.exec(description)) !== null) {
      numberedSteps.push(match[2].trim());
    }

    if (numberedSteps.length > 1) {
      numberedSteps.forEach((stepDesc, index) => {
        steps.push({
          type: 'command',
          command: 'execute',
          args: stepDesc,
          output: index < numberedSteps.length - 1 ? `step-${index + 1}.out` : undefined,
        });
      });
      return steps;
    }

    const keywordPattern = /(首先|然后|接着|最后|再|之后)[，,]?\s*([^，,。]+)/g;
    const keywordSteps: string[] = [];

    while ((match = keywordPattern.exec(description)) !== null) {
      keywordSteps.push(match[2].trim());
    }

    if (keywordSteps.length > 1) {
      keywordSteps.forEach((stepDesc, index) => {
        steps.push({
          type: 'command',
          command: 'execute',
          args: stepDesc,
          output: index < keywordSteps.length - 1 ? `step-${index + 1}.out` : undefined,
        });
      });
      return steps;
    }

    steps.push({
      type: 'command',
      command: 'execute',
      args: description,
    });

    return steps;
  }

  private async planWithLLM(description: string): Promise<ExecutionPlan> {
    console.log('[TaskPlanner] LLM-based planning not yet implemented, falling back to rule-based');
    return this.planWithRules(description);
  }

  validatePlan(plan: ExecutionPlan): boolean {
    if (!plan.steps || plan.steps.length === 0) {
      return false;
    }

    for (const step of plan.steps) {
      if (step.type === 'command' && !step.command) {
        return false;
      }
      if (step.type === 'action' && !step.action) {
        return false;
      }
    }

    return true;
  }

  summarizePlan(plan: ExecutionPlan): string {
    const lines = plan.steps.map((step, index) => {
      const num = index + 1;
      if (step.type === 'command') {
        return `${num}. Execute: ${step.args || step.command}`;
      } else {
        return `${num}. Action: ${step.action}`;
      }
    });

    return `Execution Plan:\n${lines.join('\n')}`;
  }
}

export const taskPlanner = new TaskPlanner();