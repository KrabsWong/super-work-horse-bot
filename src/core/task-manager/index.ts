import type { TaskId, Task, TaskResult, ExecutionContext, MessengerClient } from '../../types';
import { TaskStatus } from '../../types';
import { SlotManager } from './slot-manager';
import { TaskQueue } from './queue';
import type { TaskQueueItem } from './types';
import { getCurrentBranch } from '../../infra/git/sync';
import { createWorktree, removeWorktree } from '../../infra/git/worktree';
import { executeInTmux, sessionExists, killSession } from '../../infra/tmux/session';
import { config } from '../../config';
import { buildCliCommand } from '../../infra/cli/builder';
import { generateStatusFilePath, buildCompletionInstruction } from '../../infra/monitor';

function generateTaskId(): TaskId {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 6);
  
  return `task-${year}${month}${day}_${hour}${minute}${second}-${random}`;
}

export type TaskCompletionCallback = (task: Task) => Promise<void>;

export class TaskManager {
  private slotManagers: Map<string, SlotManager> = new Map();
  private taskQueues: Map<string, TaskQueue> = new Map();
  private tasks: Map<TaskId, Task> = new Map();
  private onTaskCompletion: TaskCompletionCallback | null = null;
  private _messengerClient: MessengerClient | null = null;

  setMessengerClient(client: MessengerClient): void {
    this._messengerClient = client;
  }

  getMessengerClient(): MessengerClient | null {
    return this._messengerClient;
  }

  setTaskCompletionCallback(callback: TaskCompletionCallback): void {
    this.onTaskCompletion = callback;
  }

  initialize(): void {
    for (const [commandName, cmdConfig] of Object.entries(config.commands)) {
      this.slotManagers.set(commandName, new SlotManager(cmdConfig.maxConcurrent));
      this.taskQueues.set(commandName, new TaskQueue());
      console.log(`[TaskManager] Initialized for command '${commandName}': maxConcurrent=${cmdConfig.maxConcurrent}`);
    }
  }

  async createTask(
    commandName: string,
    args: string,
    context: ExecutionContext
  ): Promise<TaskResult> {
    const cmdConfig = config.commands[commandName];
    if (!cmdConfig) {
      throw new Error(`Command '${commandName}' is not configured`);
    }

    const taskId = generateTaskId();
    const sessionName = `${cmdConfig.session}-${taskId}`;
    const branchName = taskId;
    const statusFile = generateStatusFilePath(taskId);

    const task: Task = {
      id: taskId,
      commandName,
      args,
      status: TaskStatus.PENDING,
      sessionName,
      branchName,
      worktreePath: '',
      statusFile,
      dir: cmdConfig.dir,
      createdAt: Date.now(),
      userId: context.userId,
      username: context.username,
      chatId: context.chatId,
    };

    this.tasks.set(taskId, task);

    const slotManager = this.slotManagers.get(commandName)!;
    const queue = this.taskQueues.get(commandName)!;

    const slot = slotManager.acquireSlot(taskId, sessionName, branchName, statusFile);

    if (slot) {
      task.status = TaskStatus.RUNNING;
      task.startedAt = Date.now();

      const worktreeResult = await createWorktree(taskId, cmdConfig.dir, config.worktreeBaseDir);
      if (!worktreeResult) {
        slotManager.releaseSlot(taskId);
        task.status = TaskStatus.FAILED;
        task.error = 'Failed to create git worktree';
        console.error(`[TaskManager] Failed to create worktree for task ${taskId}`);
        return {
          taskId,
          status: 'running',
          sessionName,
          branchName,
        };
      }
      
      task.worktreePath = worktreeResult.worktreePath;
      task.branchName = worktreeResult.branchName;

      await this.executeTask(task, context);

      return {
        taskId,
        status: 'running',
        sessionName,
        branchName,
      };
    } else {
      const queueItem: TaskQueueItem = {
        taskId,
        commandName,
        args,
        context: {
          userId: context.userId,
          username: context.username,
          chatId: context.chatId,
          dir: cmdConfig.dir,
        },
        createdAt: Date.now(),
      };

      const position = queue.enqueue(queueItem);
      console.log(`[TaskManager] Task ${taskId} queued at position ${position}`);

      return {
        taskId,
        status: 'queued',
        queuePosition: position,
        sessionName,
        branchName,
      };
    }
  }

  private async executeTask(task: Task, _context: ExecutionContext): Promise<void> {
    const cmdConfig = config.commands[task.commandName];

    // 检测测试模式：以"大哥测试下"开头的请求
    const TEST_MODE_PREFIX = '大哥测试下';
    const isTestMode = task.args.trim().startsWith(TEST_MODE_PREFIX);

    let fullPrompt: string;

    if (isTestMode) {
      console.log(`[TaskManager] Test mode detected for task ${task.id}`);
      const testModeInstructions = `
[TEST MODE]
You are in test mode. The user has prefixed their request with "大哥测试下".
Please read 'openspec/project.md' to understand the project structure and execution flow.
Then respond to the user's request directly without following the full research workflow.

User Request:
`;
      fullPrompt = testModeInstructions + task.args;
    } else {
      // 正常模式：使用 openspec 流程
      let additionalInstructions = `
IMPORTANT INSTRUCTIONS:
1. This is a RESEARCH task.
2. **STEP 1**: Read 'openspec/project.md'.
3. **STEP 2 (Routing)**: Based on my request, CHOOSE the most appropriate template from the Template Selection Strategy section.
   - If I asked for features/pricing -> Use 'product-requirement-standard.md'
   - If I asked for feasibility/integration -> 'Use tech-feasibility-standard.md'
4. **Action**: Create the directory and generated files strictly following the chosen template's structure.
5. **Language**: Report content in CHINESE (中文).
6. **Output**: Start by stating: 'Identifying Intent... Selected Template: [Template Name]'.
`;

      additionalInstructions += buildCompletionInstruction(task.statusFile);
      fullPrompt = `${cmdConfig.prompt} ${task.args}${additionalInstructions}`;
    }

    const cliCmd = buildCliCommand(cmdConfig.cli, cmdConfig.model, fullPrompt);
    const workDir = task.worktreePath || cmdConfig.dir;
    const command = `cd ${workDir} && ${cliCmd}`;

    console.log(`[TaskManager] Executing task ${task.id} in session ${task.sessionName} (worktree: ${workDir})`);
    console.log(`[TaskManager] Mode: ${isTestMode ? 'TEST' : 'NORMAL'}`);

    const success = await executeInTmux(command, task.sessionName);

    if (!success) {
      task.status = TaskStatus.FAILED;
      task.error = 'Failed to execute command in tmux';
      console.error(`[TaskManager] Failed to execute task ${task.id}`);
    }
  }

  async completeTask(taskId: TaskId): Promise<void> {
    console.log(`[TaskManager] ========== COMPLETE TASK START ==========`);
    console.log(`[TaskManager] Target taskId: ${taskId}`);
    
    const task = this.tasks.get(taskId);
    if (!task) {
      console.error(`[TaskManager] Task ${taskId} not found in tasks map`);
      console.log(`[TaskManager] Current tasks in map:`, Array.from(this.tasks.keys()));
      console.log(`[TaskManager] ========== COMPLETE TASK END (FAILED) ==========`);
      return;
    }

    console.log(`[TaskManager] Task found:`);
    console.log(`[TaskManager]   - taskId: ${task.id}`);
    console.log(`[TaskManager]   - commandName: ${task.commandName}`);
    console.log(`[TaskManager]   - worktreePath: "${task.worktreePath}"`);
    console.log(`[TaskManager]   - branchName: ${task.branchName}`);
    console.log(`[TaskManager]   - sessionName: ${task.sessionName}`);
    console.log(`[TaskManager]   - status: ${task.status}`);

    const cmdConfig = config.commands[task.commandName];
    if (!cmdConfig) {
      console.error(`[TaskManager] No config found for command: ${task.commandName}`);
      console.log(`[TaskManager] ========== COMPLETE TASK END (FAILED) ==========`);
      return;
    }
    
    console.log(`[TaskManager] cmdConfig.dir: "${cmdConfig.dir}"`);

    const slotManager = this.slotManagers.get(task.commandName)!;
    const queue = this.taskQueues.get(task.commandName)!;
    
    console.log(`[TaskManager] Current slot status:`);
    console.log(`[TaskManager]   - Active slots: ${slotManager.getRunningTaskIds().join(', ') || 'none'}`);
    console.log(`[TaskManager]   - Available slots: ${slotManager.getAvailableSlots()}`);
    
    console.log(`[TaskManager] Running tasks before completion:`);
    const runningTasks = this.getRunningTasks();
    runningTasks.forEach(t => {
      console.log(`[TaskManager]   - ${t.id} (branch: ${t.branchName}, worktree: ${t.worktreePath})`);
    });

    task.status = TaskStatus.COMPLETED;
    task.completedAt = Date.now();

    try {
      const workDir = task.worktreePath || cmdConfig.dir;
      console.log(`[TaskManager] Checking work dir: ${workDir}`);
      
      const currentBranch = await getCurrentBranch(workDir);
      console.log(`[TaskManager] Current branch in workDir: ${currentBranch}`);
      console.log(`[TaskManager] Expected branch: ${task.branchName}`);
      
      if (currentBranch !== task.branchName) {
        console.warn(`[TaskManager] WARNING: Branch mismatch! Current: ${currentBranch}, Expected: ${task.branchName}`);
      }
    } catch (error) {
      console.error(`[TaskManager] Error checking branch for task ${taskId}:`, error);
    }

    if (task.worktreePath) {
      console.log(`[TaskManager] Proceeding to remove worktree...`);
      await removeWorktree(task.worktreePath, cmdConfig.dir, task.branchName);
    } else {
      console.log(`[TaskManager] No worktreePath set, skipping worktree removal`);
    }

    console.log(`[TaskManager] Releasing slot for ${taskId}...`);
    const releasedSlot = slotManager.releaseSlot(taskId);
    console.log(`[TaskManager] Released slot: ${releasedSlot ? 'success' : 'not found'}`);
    console.log(`[TaskManager] Remaining active slots: ${slotManager.getRunningTaskIds().join(', ') || 'none'}`);

    console.log(`[TaskManager] Cleaning up tmux session for ${taskId}...`);
    await this.cleanupSession(taskId);

    if (this.onTaskCompletion) {
      console.log(`[TaskManager] Calling onTaskCompletion callback...`);
      await this.onTaskCompletion(task);
    } else {
      console.log(`[TaskManager] No onTaskCompletion callback set`);
    }

    if (!queue.isEmpty()) {
      console.log(`[TaskManager] Queue is not empty, dequeuing next task...`);
      const nextItem = queue.dequeue();
      if (nextItem) {
        console.log(`[TaskManager] Starting queued task: ${nextItem.taskId}`);
        await this.startQueuedTask(nextItem);
      }
    } else {
      console.log(`[TaskManager] Queue is empty`);
    }
    
    console.log(`[TaskManager] ========== COMPLETE TASK END ==========`);
  }

  async failTask(taskId: TaskId, error: string): Promise<void> {
    console.log(`[TaskManager] ========== FAIL TASK START ==========`);
    console.log(`[TaskManager] Target taskId: ${taskId}`);
    console.log(`[TaskManager] Error: ${error}`);
    
    const task = this.tasks.get(taskId);
    if (!task) {
      console.error(`[TaskManager] Task ${taskId} not found in tasks map`);
      console.log(`[TaskManager] ========== FAIL TASK END (NOT FOUND) ==========`);
      return;
    }

    console.log(`[TaskManager] Task found:`);
    console.log(`[TaskManager]   - taskId: ${task.id}`);
    console.log(`[TaskManager]   - worktreePath: "${task.worktreePath}"`);
    console.log(`[TaskManager]   - branchName: ${task.branchName}`);

    task.status = TaskStatus.FAILED;
    task.error = error;
    task.completedAt = Date.now();

    const cmdConfig = config.commands[task.commandName];
    if (task.worktreePath && cmdConfig) {
      console.log(`[TaskManager] Removing worktree for failed task...`);
      await removeWorktree(task.worktreePath, cmdConfig.dir, task.branchName);
    }

    const slotManager = this.slotManagers.get(task.commandName)!;
    console.log(`[TaskManager] Releasing slot for ${taskId}...`);
    slotManager.releaseSlot(taskId);
    console.log(`[TaskManager] Remaining active slots: ${slotManager.getRunningTaskIds().join(', ') || 'none'}`);

    console.log(`[TaskManager] Cleaning up tmux session for ${taskId}...`);
    await this.cleanupSession(taskId);

    const queue = this.taskQueues.get(task.commandName)!;
    if (!queue.isEmpty()) {
      console.log(`[TaskManager] Queue is not empty, dequeuing next task...`);
      const nextItem = queue.dequeue();
      if (nextItem) {
        console.log(`[TaskManager] Starting queued task: ${nextItem.taskId}`);
        await this.startQueuedTask(nextItem);
      }
    }
    
    console.log(`[TaskManager] ========== FAIL TASK END ==========`);
  }

  private async startQueuedTask(item: TaskQueueItem): Promise<void> {
    const task = this.tasks.get(item.taskId);
    if (!task) {
      return;
    }

    const slotManager = this.slotManagers.get(item.commandName)!;
    const slot = slotManager.acquireSlot(task.id, task.sessionName, task.branchName, task.statusFile);

    if (!slot) {
      console.error(`[TaskManager] Failed to acquire slot for queued task ${item.taskId}`);
      return;
    }

    task.status = TaskStatus.RUNNING;
    task.startedAt = Date.now();

    const worktreeResult = await createWorktree(task.id, task.dir, config.worktreeBaseDir);
    if (!worktreeResult) {
      slotManager.releaseSlot(task.id);
      task.status = TaskStatus.FAILED;
      task.error = 'Failed to create git worktree';
      return;
    }
    
    task.worktreePath = worktreeResult.worktreePath;
    task.branchName = worktreeResult.branchName;

    await this.executeTask(task, {
      userId: item.context.userId,
      username: item.context.username,
      chatId: item.context.chatId,
    });

    console.log(`[TaskManager] Started queued task ${item.taskId}`);
  }

  cancelTask(taskId: TaskId): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    if (task.status === TaskStatus.RUNNING) {
      return false;
    }

    if (task.status === TaskStatus.PENDING) {
      const queue = this.taskQueues.get(task.commandName)!;
      queue.remove(taskId);
    }

    task.status = TaskStatus.CANCELLED;
    task.completedAt = Date.now();

    console.log(`[TaskManager] Cancelled task ${taskId}`);
    return true;
  }

  getTask(taskId: TaskId): Task | undefined {
    return this.tasks.get(taskId);
  }

  getRunningTasks(): Task[] {
    return Array.from(this.tasks.values()).filter(t => t.status === TaskStatus.RUNNING);
  }

  getQueuedTasks(): Task[] {
    return Array.from(this.tasks.values()).filter(t => t.status === TaskStatus.PENDING);
  }

  getQueuePosition(taskId: TaskId): number {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== TaskStatus.PENDING) {
      return -1;
    }
    const queue = this.taskQueues.get(task.commandName)!;
    return queue.getPosition(taskId);
  }

  async cleanupSession(taskId: TaskId): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return;
    }

    try {
      const exists = await sessionExists(task.sessionName);
      if (exists) {
        await killSession(task.sessionName);
      }
    } catch (error) {
      console.error(`[TaskManager] Failed to cleanup session for task ${taskId}:`, error);
    }
  }

  cleanup(): void {
    for (const slotManager of this.slotManagers.values()) {
      slotManager.clear();
    }
    for (const queue of this.taskQueues.values()) {
      queue.clear();
    }
    this.tasks.clear();
    console.log('[TaskManager] Cleaned up all resources');
  }
}

export const taskManager = new TaskManager();