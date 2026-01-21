/**
 * Execute a command using Bun.spawn and return the result
 */
async function execCommand(command: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(command, {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  
  return { stdout, stderr, exitCode };
}

/**
 * Execute a shell command string using Bun.spawn with sh -c
 */
async function execShellCommand(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return execCommand(['sh', '-c', command]);
}

/**
 * Check if tmux is installed and available
 */
export async function checkTmuxAvailability(): Promise<boolean> {
  try {
    const { stdout, exitCode } = await execCommand(['tmux', '-V']);
    if (exitCode === 0) {
      console.log(`tmux is available: ${stdout.trim()}`);
      return true;
    }
    throw new Error('tmux command failed');
  } catch {
    console.error('ERROR: tmux is required but not found');
    console.error('Please install tmux:');
    console.error('  - macOS: brew install tmux');
    console.error('  - Ubuntu/Debian: sudo apt-get install tmux');
    console.error('  - CentOS/RHEL: sudo yum install tmux');
    return false;
  }
}

/**
 * Check if a tmux session exists
 */
export async function sessionExists(sessionName: string): Promise<boolean> {
  if (!sessionName) {
    throw new Error('Session name is required');
  }
  
  const { exitCode } = await execShellCommand(`tmux has-session -t ${sessionName} 2>/dev/null`);
  
  if (exitCode === 0) {
    console.log(`tmux session '${sessionName}' exists`);
    return true;
  }
  
  console.log(`tmux session '${sessionName}' does not exist`);
  return false;
}

/**
 * Create a new detached tmux session
 */
export async function createSession(sessionName: string): Promise<boolean> {
  if (!sessionName) {
    throw new Error('Session name is required');
  }
  
  const { exitCode, stderr } = await execCommand(['tmux', 'new-session', '-d', '-s', sessionName]);
  
  if (exitCode === 0) {
    console.log(`Created new tmux session: ${sessionName}`);
    return true;
  }
  
  console.error(`Failed to create tmux session '${sessionName}': ${stderr}`);
  return false;
}

/**
 * Send a command to an existing tmux session
 */
export async function sendCommand(command: string, sessionName: string): Promise<boolean> {
  if (!sessionName) {
    throw new Error('Session name is required');
  }
  
  // Escape single quotes in the command
  const escapedCommand = command.replace(/'/g, "'\\''");
  
  const { exitCode, stderr } = await execShellCommand(
    `tmux send-keys -t ${sessionName} '${escapedCommand}' Enter`
  );
  
  if (exitCode === 0) {
    console.log(`Command sent to tmux session '${sessionName}': ${command}`);
    return true;
  }
  
  console.error(`Failed to send command to tmux session '${sessionName}': ${stderr}`);
  
  // Attempt recovery: try to recreate the session
  console.log('Attempting to recover by recreating session...');
  
  // Try to kill the potentially stale session
  await execShellCommand(`tmux kill-session -t ${sessionName} 2>/dev/null`);
  
  const created = await createSession(sessionName);
  if (created) {
    // Retry sending the command
    const retryResult = await execShellCommand(
      `tmux send-keys -t ${sessionName} '${escapedCommand}' Enter`
    );
    
    if (retryResult.exitCode === 0) {
      console.log(`Command sent after recovery: ${command}`);
      return true;
    }
    
    console.error(`Failed to send command even after recovery: ${retryResult.stderr}`);
    return false;
  }
  
  return false;
}

/**
 * Execute a command in tmux (handles session lifecycle automatically)
 */
export async function executeInTmux(command: string, sessionName: string): Promise<boolean> {
  if (!sessionName) {
    console.error('Session name is required');
    return false;
  }
  
  console.log(`Executing command in tmux session '${sessionName}'...`);
  
  // Check if session exists
  const exists = await sessionExists(sessionName);
  
  // Create session if it doesn't exist
  if (!exists) {
    const created = await createSession(sessionName);
    if (!created) {
      console.error('Cannot execute command: failed to create tmux session');
      return false;
    }
  }
  
  // Send command to session
  return await sendCommand(command, sessionName);
}
