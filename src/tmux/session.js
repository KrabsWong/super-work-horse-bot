import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Check if tmux is installed and available
 */
export async function checkTmuxAvailability() {
  try {
    const { stdout } = await execAsync('tmux -V');
    console.log(`✓ tmux is available: ${stdout.trim()}`);
    return true;
  } catch (error) {
    console.error('✗ ERROR: tmux is required but not found');
    console.error('Please install tmux:');
    console.error('  - macOS: brew install tmux');
    console.error('  - Ubuntu/Debian: sudo apt-get install tmux');
    console.error('  - CentOS/RHEL: sudo yum install tmux');
    return false;
  }
}

/**
 * Check if a tmux session exists
 * @param {string} sessionName - Name of the tmux session (required)
 * @returns {Promise<boolean>} - True if session exists, false otherwise
 */
export async function sessionExists(sessionName) {
  if (!sessionName) {
    throw new Error('Session name is required');
  }
  
  try {
    await execAsync(`tmux has-session -t ${sessionName} 2>/dev/null`);
    console.log(`✓ tmux session '${sessionName}' exists`);
    return true;
  } catch (error) {
    console.log(`ℹ tmux session '${sessionName}' does not exist`);
    return false;
  }
}

/**
 * Create a new detached tmux session
 * @param {string} sessionName - Name of the tmux session to create (required)
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
export async function createSession(sessionName) {
  if (!sessionName) {
    throw new Error('Session name is required');
  }
  
  try {
    await execAsync(`tmux new-session -d -s ${sessionName}`);
    console.log(`✓ Created new tmux session: ${sessionName}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to create tmux session '${sessionName}':`, error.message);
    return false;
  }
}

/**
 * Send a command to an existing tmux session
 * @param {string} command - Command to execute
 * @param {string} sessionName - Name of the tmux session (required)
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
export async function sendCommand(command, sessionName) {
  if (!sessionName) {
    throw new Error('Session name is required');
  }
  
  try {
    // Escape single quotes in the command
    const escapedCommand = command.replace(/'/g, "'\\''");
    await execAsync(`tmux send-keys -t ${sessionName} '${escapedCommand}' Enter`);
    console.log(`✓ Command sent to tmux session '${sessionName}': ${command}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to send command to tmux session '${sessionName}':`, error.message);
    
    // Attempt recovery: try to recreate the session
    console.log('ℹ Attempting to recover by recreating session...');
    try {
      await execAsync(`tmux kill-session -t ${sessionName} 2>/dev/null`);
    } catch {
      // Ignore errors when killing potentially non-existent session
    }
    
    const created = await createSession(sessionName);
    if (created) {
      // Retry sending the command
      try {
        const escapedCommand = command.replace(/'/g, "'\\''");
        await execAsync(`tmux send-keys -t ${sessionName} '${escapedCommand}' Enter`);
        console.log(`✓ Command sent after recovery: ${command}`);
        return true;
      } catch (retryError) {
        console.error(`✗ Failed to send command even after recovery:`, retryError.message);
        return false;
      }
    }
    
    return false;
  }
}

/**
 * Execute a command in tmux (handles session lifecycle automatically)
 * @param {string} command - Command to execute
 * @param {string} sessionName - Name of the tmux session (required)
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
export async function executeInTmux(command, sessionName) {
  if (!sessionName) {
    console.error('✗ Session name is required');
    return false;
  }
  
  console.log(`ℹ Executing command in tmux session '${sessionName}'...`);
  
  // Check if session exists
  const exists = await sessionExists(sessionName);
  
  // Create session if it doesn't exist
  if (!exists) {
    const created = await createSession(sessionName);
    if (!created) {
      console.error('✗ Cannot execute command: failed to create tmux session');
      return false;
    }
  }
  
  // Send command to session
  return await sendCommand(command, sessionName);
}
