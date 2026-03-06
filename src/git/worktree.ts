import type { TaskId } from '../types';
import path from 'path';
import os from 'os';

function expandPath(p: string): string {
  if (p.startsWith('~/')) {
    return p.replace('~', os.homedir());
  }
  return p;
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

export function getWorktreePath(baseDir: string, taskId: TaskId, worktreeBaseDir?: string): string {
  const expandedBaseDir = expandPath(baseDir);
  const repoName = path.basename(expandedBaseDir);
  const parentDir = worktreeBaseDir ? expandPath(worktreeBaseDir) : path.dirname(expandedBaseDir);
  return path.join(parentDir, `${repoName}-${taskId}`);
}

export async function createWorktree(
  taskId: TaskId,
  baseDir: string,
  worktreeBaseDir?: string
): Promise<{ worktreePath: string; branchName: string } | null> {
  const branchName = taskId;
  const worktreePath = getWorktreePath(baseDir, taskId, worktreeBaseDir);
  
  const { exitCode: fetchExitCode, stderr: fetchStderr } = await execGitCommand(
    ['fetch', 'origin', 'main'],
    baseDir
  );
  
  if (fetchExitCode !== 0) {
    console.error(`Failed to fetch origin/main: ${fetchStderr}`);
    return null;
  }
  
  const { exitCode, stderr } = await execGitCommand(
    ['worktree', 'add', worktreePath, '-b', branchName, 'origin/main'],
    baseDir
  );
  
  if (exitCode !== 0) {
    console.error(`Failed to create worktree ${worktreePath}: ${stderr}`);
    return null;
  }
  
  console.log(`Created worktree: ${worktreePath} with branch: ${branchName}`);
  return { worktreePath, branchName };
}

export async function removeWorktree(worktreePath: string, baseDir: string, branchName?: string): Promise<boolean> {
  const { exitCode, stderr } = await execGitCommand(
    ['worktree', 'remove', worktreePath, '--force'],
    baseDir
  );
  
  if (exitCode !== 0) {
    console.error(`Failed to remove worktree ${worktreePath}: ${stderr}`);
    return false;
  }
  
  console.log(`Removed worktree: ${worktreePath}`);
  
  if (branchName) {
    const { exitCode: branchExitCode } = await execGitCommand(
      ['branch', '-D', branchName],
      baseDir
    );
    
    if (branchExitCode === 0) {
      console.log(`Deleted branch: ${branchName}`);
    } else {
      console.log(`Branch ${branchName} may not exist or already deleted`);
    }
  }
  
  return true;
}

export async function listWorktrees(baseDir: string): Promise<string[]> {
  const { stdout, exitCode } = await execGitCommand(
    ['worktree', 'list', '--porcelain'],
    baseDir
  );
  
  if (exitCode !== 0) {
    return [];
  }
  
  const lines = stdout.split('\n');
  const paths: string[] = [];
  
  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      paths.push(line.substring('worktree '.length));
    }
  }
  
  return paths;
}

export async function pruneWorktrees(baseDir: string): Promise<boolean> {
  const { exitCode, stderr } = await execGitCommand(
    ['worktree', 'prune'],
    baseDir
  );
  
  if (exitCode !== 0) {
    console.error(`Failed to prune worktrees: ${stderr}`);
    return false;
  }
  
  console.log('Pruned stale worktree references');
  return true;
}