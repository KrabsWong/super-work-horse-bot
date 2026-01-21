import { executeInTmux } from '../tmux/session';
import { config } from '../config/env';
import type { ExecutionResult, ValidationResult, ExecutionContext } from '../types';

/**
 * Sanitize user input to prevent command injection
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Remove or escape dangerous characters
  // This is a basic sanitization - input is wrapped in quotes in the final command
  const sanitized = input
    .replace(/`/g, '')      // Remove backticks
    .replace(/\$/g, '')     // Remove dollar signs
    .replace(/;/g, '')      // Remove semicolons
    .replace(/&/g, '')      // Remove ampersands
    .replace(/\|/g, '')     // Remove pipes
    .replace(/>/g, '')      // Remove redirects
    .replace(/</g, '')      // Remove redirects
    .trim();
  
  return sanitized;
}

/**
 * Build opencode command with directory change and proper prompt format
 */
function buildCommandWithDirectory(commandName: string, args: string): string {
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
  
  // Build the command: cd to directory && execute opencode
  // Model parameter comes before prompt parameter
  let opencodeCmd = 'opencode';
  
  if (cmdConfig.model) {
    opencodeCmd += ` --model="${cmdConfig.model}"`;
  }
  
  const additionalInstructions = `
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
  opencodeCmd += ` --prompt="${cmdConfig.prompt} ${sanitized}${additionalInstructions}"`;
  
  return `cd ${cmdConfig.dir} && ${opencodeCmd}`;
}

/**
 * Validate command input
 */
export function validateCommand(commandName: string, args: string): ValidationResult {
  // Check if command is configured
  const availableCommands = Object.keys(config.commands);
  if (!availableCommands.includes(commandName)) {
    return {
      valid: false,
      error: `Command '${commandName}' is not supported. Available commands: ${availableCommands.join(', ')}`,
    };
  }
  
  // Check if arguments are provided
  if (!args || args.trim().length === 0) {
    return {
      valid: false,
      error: `Command '${commandName}' requires arguments. Usage: /${commandName} <your text here>`,
    };
  }
  
  // Check length limits (prevent extremely long commands)
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
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`[${timestamp}] Command execution requested`);
  console.log(`  Command: ${commandName}`);
  console.log(`  Args: ${args}`);
  console.log(`  User ID: ${context.userId || 'unknown'}`);
  console.log(`  Chat ID: ${context.chatId || 'unknown'}`);
  
  // Validate command
  const validation = validateCommand(commandName, args);
  if (!validation.valid) {
    console.log(`Validation failed: ${validation.error}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return {
      success: false,
      error: validation.error,
    };
  }
  
  // Build command
  let command: string;
  try {
    command = buildCommandWithDirectory(commandName, args);
    console.log(`Built command: ${command}`);
    
    // Log model parameter if configured
    const cmdConfig = config.commands[commandName];
    if (cmdConfig.model) {
      console.log(`Using model: ${cmdConfig.model}`);
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
  
  // Get session name for this command
  const sessionName = config.commands[commandName].session;
  console.log(`Using tmux session: ${sessionName}`);
  
  // Execute in tmux
  const success = await executeInTmux(command, sessionName);
  
  if (success) {
    console.log(`Command executed successfully`);
  } else {
    console.log(`Command execution failed`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  return {
    success,
    error: success ? null : 'Command execution failed - please contact administrator',
  };
}
