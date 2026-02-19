import { executeInTmux } from '../tmux/session';
import { config } from '../config';
import { startMonitoring, generateStatusFilePath, buildCompletionInstruction } from '../monitor';
import type { ExecutionResult, ValidationResult, ExecutionContext } from '../types';

/**
 * Sanitize user input to prevent command injection
 */
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

interface BuiltCommand {
  command: string;
  statusFile: string | null;
}

/**
 * Build opencode command with directory change and proper prompt format
 */
function buildCommandWithDirectory(commandName: string, args: string, enableMonitoring: boolean): BuiltCommand {
  const sanitized = sanitizeInput(args);
  if (!sanitized) {
    throw new Error('Prompt cannot be empty');
  }
  
  const cmdConfig = config.commands[commandName];
  if (!cmdConfig) {
    throw new Error(`Command '${commandName}' is not configured`);
  }
  
  if (!cmdConfig.dir || !cmdConfig.prompt) {
    throw new Error(`Command '${commandName}' is missing DIR or PROMPT configuration`);
  }
  
  let opencodeCmd = 'opencode';
  
  if (cmdConfig.model) {
    opencodeCmd += ` --model="${cmdConfig.model}"`;
  }
  
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

  let statusFile: string | null = null;
  
  if (enableMonitoring) {
    statusFile = generateStatusFilePath(cmdConfig.session);
    additionalInstructions += buildCompletionInstruction(statusFile);
  }
  
  opencodeCmd += ` --prompt="${cmdConfig.prompt} ${sanitized}${additionalInstructions}"`;
  
  return {
    command: `cd ${cmdConfig.dir} && ${opencodeCmd}`,
    statusFile,
  };
}

/**
 * Validate command input
 */
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

/**
 * Execute a whitelisted command
 */
export async function executeCommand(
  commandName: string,
  args: string,
  context: ExecutionContext = {}
): Promise<ExecutionResult> {
  const timestamp = new Date().toISOString();
  const enableMonitoring = (context.enableMonitoring !== false) && !!context.telegram && !!context.chatId;
  
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
  
  let builtCommand: BuiltCommand;
  try {
    builtCommand = buildCommandWithDirectory(commandName, args, enableMonitoring);
    console.log(`Built command: ${builtCommand.command}`);
    
    const cmdConfig = config.commands[commandName];
    if (cmdConfig.model) {
      console.log(`Using model: ${cmdConfig.model}`);
    }
    if (builtCommand.statusFile) {
      console.log(`Status file: ${builtCommand.statusFile}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`Failed to build command: ${errorMessage}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return {
      success: false,
      error: errorMessage,
    };
  }
  
  const sessionName = config.commands[commandName].session;
  console.log(`Using tmux session: ${sessionName}`);
  
  const success = await executeInTmux(builtCommand.command, sessionName);
  
  if (success) {
    console.log(`Command executed successfully`);
    
    if (enableMonitoring && builtCommand.statusFile && context.telegram && context.chatId) {
      startMonitoring({
        sessionName,
        statusFile: builtCommand.statusFile,
        telegram: context.telegram,
        chatId: context.chatId,
        taskName: `/${commandName}`,
      });
    }
  } else {
    console.log(`Command execution failed`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  return {
    success,
    error: success ? null : 'Command execution failed - please contact administrator',
    statusFile: builtCommand.statusFile ?? undefined,
  };
}
