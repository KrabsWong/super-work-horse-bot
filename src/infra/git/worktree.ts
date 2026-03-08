import type { TaskId } from '../../types';
import path from 'path';
import os from 'os';
import { withGitLock } from './lock';
import { getCurrentBranch } from './sync';

function expandPath(p: string): string {
  if (p.startsWith('~/')) {
    return p.replace('~', os.homedir());
  }
  return p;
}

/**
 * 从 worktree 路径中提取 taskId
 * 路径格式: {parentDir}/{repoName}-{taskId}
 */
function extractTaskIdFromPath(worktreePath: string): string | null {
  const match = worktreePath.match(/-task-\d{8}_\d{6}-[a-z0-9]{4}$/);
  if (match) {
    return match[0].substring(1);
  }
  return null;
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

  return withGitLock(baseDir, async () => {
    console.log(`[Worktree] Acquired lock for ${baseDir}, creating worktree for ${taskId}`);

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

    // CRITICAL FIX: Ensure baseDir is on main branch after creating worktree
    // This prevents subsequent branch deletions from needing to switch branches,
    // which could affect other active worktrees
    const baseDirBranch = await getCurrentBranch(baseDir);
    if (baseDirBranch && baseDirBranch !== 'main' && baseDirBranch !== 'master') {
      console.log(`[Worktree] Switching baseDir from '${baseDirBranch}' to 'main' to avoid branch deletion issues`);
      const { exitCode: checkoutExitCode, stderr: checkoutStderr } = await execGitCommand(
        ['checkout', 'main'],
        baseDir
      );
      if (checkoutExitCode !== 0) {
        console.warn(`[Worktree] Failed to switch baseDir to main: ${checkoutStderr}`);
        // Continue anyway, worktree is created successfully
      } else {
        console.log(`[Worktree] baseDir is now on 'main' branch`);
      }
    }

    return { worktreePath, branchName };
  });
}

export async function removeWorktree(worktreePath: string, baseDir: string, branchName?: string): Promise<boolean> {
  console.log(`[Worktree] ========== REMOVE START ==========`);
  console.log(`[Worktree] Target worktree: ${worktreePath}`);
  console.log(`[Worktree] Base dir: ${baseDir}`);
  console.log(`[Worktree] Branch to delete: ${branchName || 'none'}`);

  return withGitLock(baseDir, async () => {
    console.log(`[Worktree] Acquired lock for ${baseDir}`);

    // 防护1: 验证路径格式包含合法的 taskId
    const taskIdFromPath = extractTaskIdFromPath(worktreePath);
    if (!taskIdFromPath) {
      console.error(`[Worktree] REJECTED: Path does not contain valid taskId format: ${worktreePath}`);
      return false;
    }
    console.log(`[Worktree] Extracted taskId from path: ${taskIdFromPath}`);

    // 防护2: 如果提供了 branchName，验证它与路径中的 taskId 一致
    if (branchName && branchName !== taskIdFromPath) {
      console.error(`[Worktree] REJECTED: Branch name mismatch. Path taskId=${taskIdFromPath}, but branchName=${branchName}`);
      return false;
    }

    // 防护3: 验证 worktree 实际存在
    const worktrees = await listWorktrees(baseDir);
    console.log(`[Worktree] Current worktrees (${worktrees.length}):`, worktrees);

    if (!worktrees.includes(worktreePath)) {
      console.error(`[Worktree] REJECTED: Worktree not found in list: ${worktreePath}`);
      console.error(`[Worktree] Available worktrees:`, worktrees);
      return false;
    }

    // 防护4: 检查是否还有其他活跃的 worktree（并发任务保护）
    const otherWorktrees = worktrees.filter(w => w !== worktreePath);
    const hasOtherActiveWorktrees = otherWorktrees.length > 0;
    console.log(`[Worktree] Other active worktrees: ${otherWorktrees.length}`);
    if (hasOtherActiveWorktrees) {
      console.log(`[Worktree] Active worktrees:`, otherWorktrees);
    }

    console.log(`[Worktree] Validation passed, proceeding with removal...`);

    // 步骤1: 删除 worktree（释放对该分支的占用）
    const { exitCode, stderr } = await execGitCommand(
      ['worktree', 'remove', worktreePath, '--force'],
      baseDir
    );

    if (exitCode !== 0) {
      console.error(`[Worktree] FAILED to remove worktree ${worktreePath}: ${stderr}`);
      return false;
    }

    console.log(`[Worktree] Successfully removed worktree: ${worktreePath}`);

    if (branchName) {
      const { exitCode: branchExitCode, stderr: branchStderr } = await execGitCommand(
        ['branch', '-D', branchName],
        baseDir
      );

      if (branchExitCode === 0) {
        console.log(`[Worktree] Successfully deleted branch: ${branchName}`);
      } else {
        console.log(`[Worktree] Branch deletion skipped (may not exist): ${branchName}. stderr: ${branchStderr}`);
      }
    }

    // 验证清理后的状态
    const remainingWorktrees = await listWorktrees(baseDir);
    console.log(`[Worktree] Remaining worktrees (${remainingWorktrees.length}):`, remainingWorktrees);
    console.log(`[Worktree] ========== REMOVE END ==========`);

    return true;
  });
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