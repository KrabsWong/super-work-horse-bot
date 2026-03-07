import type { CliConfig, CliType } from '../../types';

/**
 * Build opencode CLI command
 */
function buildOpenCodeCommand(
  model: string | undefined,
  prompt: string
): string {
  let cmd = 'opencode';
  
  if (model) {
    cmd += ` --model="${model}"`;
  }
  
  cmd += ` --prompt="${prompt}"`;
  
  return cmd;
}

/**
 * Build claude CLI command
 */
function buildClaudeCommand(
  model: string | undefined,
  prompt: string,
  skipPermissions: boolean | undefined
): string {
  let cmd = 'claude';
  
  if (model) {
    cmd += ` --model "${model}"`;
  }
  
  // Skip permission checks for automated/CI environments
  if (skipPermissions) {
    cmd += ' --dangerously-skip-permissions';
  }
  
  // Prompt as positional argument
  cmd += ` "${prompt}"`;

  return cmd;
}

/**
 * Build CLI command based on CLI type
 */
export function buildCliCommand(
  cliConfig: CliConfig | undefined,
  model: string | undefined,
  prompt: string
): string {
  const cliType: CliType = cliConfig?.type ?? 'opencode';
  
  switch (cliType) {
    case 'claude':
      return buildClaudeCommand(model, prompt, cliConfig?.skipPermissions);
    case 'opencode':
    default:
      return buildOpenCodeCommand(model, prompt);
  }
}

/**
 * Get CLI type from config (with default fallback)
 */
export function getCliType(cliConfig: CliConfig | undefined): CliType {
  return cliConfig?.type ?? 'opencode';
}