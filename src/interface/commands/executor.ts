import { config } from '../../config';
import { startMonitoring } from '../../infra/monitor';
import type { ExecutionResult, ValidationResult, ExecutionContext, TaskResult } from '../../types';
import { taskManager } from '../../core/task-manager';
import { sendTaskMessage, updateTaskMessage, type TaskMessageData } from '../../interface/messenger';

export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  const sanitized = input
    .replace(/`/g, '')
    .replace(/\$/g, '')
    .replace(/;/g, '')
    .replace(/&/g, '')
    .replace(/\|/g, '')
    .replace(/>/g, '')
    .replace(/</g, '')
    .trim();
  
  return sanitized;
}

export function validateCommand(commandName: string, args: string): ValidationResult {
  const availableCommands = Object.keys(config.commands);
  if (!availableCommands.includes(commandName)) {
    return {
      valid: false,
      error: `Command '${commandName}' is not supported. Available commands: ${availableCommands.join(', ')}`,
    };
  }
  
  if (!args || args.trim().length === 0) {
    return {
      valid: false,
      error: `Command '${commandName}' requires arguments. Usage: /${commandName} <your text here>`,
    };
  }
  
  if (args.length > 2000) {
    return {
      valid: false,
      error: 'Command is too long (max 2000 characters)',
    };
  }
  
  return { valid: true };
}

export interface CommandExecuteResult extends ExecutionResult {
  taskResult?: TaskResult;
}

export async function executeCommand(
  commandName: string,
  args: string,
  context: ExecutionContext = {}
): Promise<CommandExecuteResult> {
  const timestamp = new Date().toISOString();
  const enableMonitoring = (context.enableMonitoring !== false) && !!context.messenger && !!context.chatId;
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`[${timestamp}] Command execution requested`);
  console.log(`  Command: ${commandName}`);
  console.log(`  Args: ${args}`);
  console.log(`  User ID: ${context.userId || 'unknown'}`);
  console.log(`  Chat ID: ${context.chatId || 'unknown'}`);
  console.log(`  Monitoring: ${enableMonitoring ? 'enabled' : 'disabled'}`);
  
  const validation = validateCommand(commandName, args);
  if (!validation.valid) {
    console.log(`Validation failed: ${validation.error}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return {
      success: false,
      error: validation.error,
    };
  }
  
  const sanitized = sanitizeInput(args);
  if (!sanitized) {
    console.log('Sanitized args is empty');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return {
      success: false,
      error: 'Prompt cannot be empty',
    };
  }
  
  try {
    const taskResult = await taskManager.createTask(commandName, sanitized, context);
    
    console.log(`Task created: ${taskResult.taskId}`);
    console.log(`  Status: ${taskResult.status}`);
    console.log(`  Session: ${taskResult.sessionName}`);
    console.log(`  Branch: ${taskResult.branchName}`);
    if (taskResult.queuePosition) {
      console.log(`  Queue position: ${taskResult.queuePosition}`);
    }
    
    let messageId: string | null = null;
    
    if (context.messenger && context.chatId) {
      const task = taskManager.getTask(taskResult.taskId);
      if (task) {
        const messageData: TaskMessageData = {
          taskId: taskResult.taskId,
          commandName,
          args: sanitized,
          sessionName: taskResult.sessionName,
          branchName: taskResult.branchName,
          status: taskResult.status,
          duration: 0,
          startedAt: task.startedAt,
        };
        
        messageId = await sendTaskMessage(context.messenger, String(context.chatId), messageData);
        
        if (messageId) {
          task.messageId = messageId;
          console.log(`  Message ID: ${messageId}`);
        }
      }
    }
    
    if (enableMonitoring && context.messenger && context.chatId && taskResult.status === 'running') {
      const task = taskManager.getTask(taskResult.taskId);
      if (task) {
        startMonitoring({
          taskId: taskResult.taskId,
          sessionName: taskResult.sessionName,
          statusFile: task.statusFile,
          messenger: context.messenger,
          chatId: context.chatId,
          taskName: `/${commandName}`,
          branchName: taskResult.branchName,
          messageId: messageId || undefined,
          args: sanitized,
          startedAt: task.startedAt,
          onCompletion: async (taskId, duration, killedCount) => {
            await taskManager.completeTask(taskId);
            if (messageId && context.messenger && context.chatId) {
              await updateTaskMessage(context.messenger, String(context.chatId), messageId, {
                taskId,
                commandName,
                args: sanitized,
                sessionName: taskResult.sessionName,
                branchName: taskResult.branchName,
                status: 'completed',
                duration,
                killedCount,
                startedAt: task.startedAt,
                completedAt: Date.now(),
              });
            }
          },
          onFailure: async (taskId, reason, duration) => {
            await taskManager.failTask(taskId, `Task ended unexpectedly (${reason})`);
            if (messageId && context.messenger && context.chatId) {
              await updateTaskMessage(context.messenger, String(context.chatId), messageId, {
                taskId,
                commandName,
                args: sanitized,
                sessionName: taskResult.sessionName,
                branchName: taskResult.branchName,
                status: 'error',
                duration,
                startedAt: task.startedAt,
                completedAt: Date.now(),
              });
            }
          },
        });
      }
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    return {
      success: true,
      error: null,
      taskResult,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`Failed to create task: ${errorMessage}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return {
      success: false,
      error: errorMessage,
    };
  }
}