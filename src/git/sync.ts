import type { TaskId } from '../types';
import os from 'os';

function expandPath(path: string): string {
  if (path.startsWith('~/')) {
    return path.replace('~', os.homedir());
  }
  return path;
}

function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

async function execGitCommand(args: string[], cwd?: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const expandedCwd = cwd ? expandPath(cwd) : undefined;
  const escapedArgs = args.map(escapeShellArg).join(' ');
  const command = expandedCwd ? `cd ${escapeShellArg(expandedCwd)} && git ${escapedArgs}` : `git ${escapedArgs}`;
  
  const proc = Bun.spawn(['sh', '-c', command], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  
  return { stdout, stderr, exitCode };
}

export async function fetchOrigin(workDir: string): Promise<boolean> {
  const { exitCode, stderr } = await execGitCommand(['fetch', 'origin', 'main'], workDir);
  
  if (exitCode !== 0) {
    console.error(`Failed to fetch origin: ${stderr}`);
    return false;
  }
  
  console.log(`Fetched origin/main in ${workDir}`);
  return true;
}

export async function syncMainBranch(workDir: string): Promise<boolean> {
  const fetchResult = await fetchOrigin(workDir);
  if (!fetchResult) {
    return false;
  }
  
  const checkoutResult = await execGitCommand(['checkout', 'main'], workDir);
  if (checkoutResult.exitCode !== 0) {
    console.error(`Failed to checkout main: ${checkoutResult.stderr}`);
    return false;
  }
  
  const resetResult = await execGitCommand(['reset', '--hard', 'origin/main'], workDir);
  if (resetResult.exitCode !== 0) {
    console.error(`Failed to reset main: ${resetResult.stderr}`);
    return false;
  }
  
  console.log(`Synced local main branch with origin/main in ${workDir}`);
  return true;
}

export async function isMainSynced(workDir: string): Promise<boolean> {
  const { stdout } = await execGitCommand(['rev-parse', 'HEAD'], workDir);
  const localHead = stdout.trim();
  
  const { stdout: remoteStdout } = await execGitCommand(['rev-parse', 'origin/main'], workDir);
  const remoteHead = remoteStdout.trim();
  
  return localHead === remoteHead;
}

export function getBranchName(taskId: TaskId): string {
  return taskId;
}

export async function createTaskBranch(taskId: TaskId, workDir: string): Promise<string | null> {
  const branchName = getBranchName(taskId);
  
  // Fetch latest from origin/main (without switching branches)
  const { exitCode: fetchExitCode, stderr: fetchStderr } = await execGitCommand(
    ['fetch', 'origin', 'main'],
    workDir
  );
  
  if (fetchExitCode !== 0) {
    console.error(`Failed to fetch origin/main: ${fetchStderr}`);
    return null;
  }
  
  // Create branch directly from origin/main (without checking out main first)
  // This prevents interfering with other running tasks on different branches
  const { exitCode, stderr } = await execGitCommand(
    ['checkout', '-b', branchName, 'origin/main'],
    workDir
  );
  
  if (exitCode !== 0) {
    console.error(`Failed to create branch ${branchName}: ${stderr}`);
    return null;
  }
  
  console.log(`Created task branch: ${branchName} from origin/main`);
  return branchName;
}

export async function commitChanges(message: string, workDir: string): Promise<boolean> {
  await execGitCommand(['add', '-A'], workDir);
  
  const { exitCode, stderr } = await execGitCommand(['commit', '-m', message, '--no-verify'], workDir);
  
  if (exitCode !== 0) {
    if (stderr.includes('nothing to commit')) {
      console.log('No changes to commit');
      return true;
    }
    console.error(`Failed to commit changes: ${stderr}`);
    return false;
  }
  
  console.log(`Committed changes: ${message}`);
  return true;
}

export async function pushBranch(branchName: string, workDir: string): Promise<boolean> {
  const { exitCode, stderr } = await execGitCommand(['push', '-u', 'origin', branchName], workDir);
  
  if (exitCode !== 0) {
    console.error(`Failed to push branch ${branchName}: ${stderr}`);
    return false;
  }
  
  console.log(`Pushed branch: ${branchName}`);
  return true;
}

export async function deleteBranch(branchName: string, workDir: string, remote: boolean = true): Promise<boolean> {
  if (remote) {
    const { exitCode: remoteExitCode } = await execGitCommand(['push', 'origin', '--delete', branchName], workDir);
    if (remoteExitCode !== 0) {
      console.log(`Remote branch ${branchName} may not exist or already deleted`);
    } else {
      console.log(`Deleted remote branch: ${branchName}`);
    }
  }
  
  await execGitCommand(['checkout', 'main'], workDir);
  
  const { exitCode } = await execGitCommand(['branch', '-D', branchName], workDir);
  if (exitCode === 0) {
    console.log(`Deleted local branch: ${branchName}`);
  }
  
  return true;
}

export async function getCurrentBranch(workDir: string): Promise<string | null> {
  const { stdout, exitCode } = await execGitCommand(['branch', '--show-current'], workDir);
  
  if (exitCode !== 0) {
    return null;
  }
  
  return stdout.trim();
}

export async function hasUncommittedChanges(workDir: string): Promise<boolean> {
  const { stdout } = await execGitCommand(['status', '--porcelain'], workDir);
  return stdout.trim().length > 0;
}