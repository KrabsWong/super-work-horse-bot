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

export async function sendCtrlC(sessionName: string): Promise<boolean> {
  if (!sessionName) {
    console.error('Session name is required');
    return false;
  }

  const { exitCode } = await execShellCommand(`tmux send-keys -t ${sessionName} C-c`);

  if (exitCode === 0) {
    console.log(`Sent Ctrl+C to session '${sessionName}'`);
    return true;
  }

  console.error(`Failed to send Ctrl+C to session '${sessionName}'`);
  return false;
}

/**
 * Check if there are any opencode processes running in a tmux session
 */
export async function hasOpencodeProcess(sessionName: string): Promise<boolean> {
  if (!sessionName) {
    return false;
  }

  try {
    const { stdout } = await execShellCommand(
      `tmux list-panes -t ${sessionName} -F '#{pane_pid}' 2>/dev/null`
    );

    const panePids = stdout.trim().split('\n').filter(pid => pid);

    for (const panePid of panePids) {
      const { stdout: pgrepOut } = await execShellCommand(
        `pgrep -P ${panePid} -f opencode 2>/dev/null || true`
      );
      if (pgrepOut.trim()) {
        return true;
      }

      const { stdout: descendantsOut } = await execShellCommand(
        `pstree -p ${panePid} 2>/dev/null | grep -E 'opencode\\(' || true`
      );
      if (descendantsOut.trim()) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 5000;
const GRACEFUL_SHUTDOWN_POLL_INTERVAL_MS = 500;

export async function killOpencodeInSession(sessionName: string): Promise<number> {
  if (!sessionName) {
    return 0;
  }

  try {
    const hasProcess = await hasOpencodeProcess(sessionName);
    if (!hasProcess) {
      return 0;
    }

    console.log(`Sending Ctrl+C to session ${sessionName} for graceful shutdown...`);
    await sendCtrlC(sessionName);

    const startTime = Date.now();
    while (Date.now() - startTime < GRACEFUL_SHUTDOWN_TIMEOUT_MS) {
      await new Promise(resolve => setTimeout(resolve, GRACEFUL_SHUTDOWN_POLL_INTERVAL_MS));
      const stillRunning = await hasOpencodeProcess(sessionName);
      if (!stillRunning) {
        console.log(`opencode process in session ${sessionName} exited gracefully`);
        return 1;
      }
    }

    console.log(`Graceful shutdown timed out, force killing opencode in session ${sessionName}...`);

    const { stdout } = await execShellCommand(
      `tmux list-panes -t ${sessionName} -F '#{pane_pid}' 2>/dev/null`
    );

    const panePids = stdout.trim().split('\n').filter(pid => pid);
    let killedCount = 0;

    for (const panePid of panePids) {
      const { stdout: pgrepOut } = await execShellCommand(
        `pgrep -P ${panePid} -f opencode 2>/dev/null || true`
      );

      const opencodePids = pgrepOut.trim().split('\n').filter(pid => pid);

      for (const opencodePid of opencodePids) {
        const { exitCode } = await execShellCommand(`kill ${opencodePid} 2>/dev/null || true`);
        if (exitCode === 0) {
          console.log(`Force killed opencode process ${opencodePid} in session ${sessionName}`);
          killedCount++;
        }
      }
    }

    return killedCount;
  } catch (error) {
    console.error(`Failed to kill opencode processes in session ${sessionName}:`, error);
    return 0;
  }
}
