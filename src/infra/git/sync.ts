import type { TaskId } from '../../types';
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

export function getBranchName(taskId: TaskId): string {
  return taskId;
}

/**
 * 检查远程分支是否存在（一次性检查，无重试）
 * 用于监控循环中周期性检查
 */
export async function checkRemoteBranchExists(
  workDir: string,
  branchName: string
): Promise<boolean> {
  const { stdout, exitCode } = await execGitCommand(
    ['ls-remote', '--heads', 'origin', branchName],
    workDir
  );

  return exitCode === 0 && stdout.trim().includes(branchName);
}

export async function getCurrentBranch(workDir: string): Promise<string | null> {
  const { stdout, exitCode } = await execGitCommand(['branch', '--show-current'], workDir);
  
  if (exitCode !== 0) {
    return null;
  }
  
  return stdout.trim();
}

/**
 * 验证远程分支是否存在（带重试机制）
 * 用于确认 git push 已完成
 */
export async function verifyRemoteBranchExists(
  workDir: string,
  branchName: string,
  options: {
    maxRetries?: number;
    retryDelayMs?: number;
    timeoutMs?: number;
  } = {}
): Promise<boolean> {
  const { maxRetries = 6, retryDelayMs = 10000, timeoutMs = 60000 } = options;
  const startTime = Date.now();
  
  for (let i = 0; i < maxRetries; i++) {
    // 检查总体超时
    if (Date.now() - startTime > timeoutMs) {
      console.log(`[GitSync] Remote branch verification timeout after ${timeoutMs}ms`);
      return false;
    }
    
    const { stdout, exitCode } = await execGitCommand(
      ['ls-remote', '--heads', 'origin', branchName],
      workDir
    );
    
    if (exitCode === 0 && stdout.trim().includes(branchName)) {
      console.log(`[GitSync] Remote branch ${branchName} verified`);
      return true;
    }
    
    const remainingRetries = maxRetries - i - 1;
    if (remainingRetries > 0) {
      console.log(
        `[GitSync] Remote branch ${branchName} not found, ` +
        `retrying in ${retryDelayMs}ms... (${i + 1}/${maxRetries})`
      );
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }
  
  console.error(
    `[GitSync] Remote branch ${branchName} verification failed ` +
    `after ${maxRetries} retries`
  );
  return false;
}

/**
 * 获取分支的 commit 数量（相对于 origin/main）
 * 用于验证是否有实际提交
 */
export async function getCommitCountSinceMain(
  workDir: string,
  branchName: string
): Promise<number> {
  const { stdout, exitCode } = await execGitCommand(
    ['rev-list', '--count', `origin/main..${branchName}`],
    workDir
  );
  
  if (exitCode !== 0) {
    return 0;
  }
  
  const count = parseInt(stdout.trim(), 10);
  return isNaN(count) ? 0 : count;
}