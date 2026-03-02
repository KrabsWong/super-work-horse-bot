import type { TaskId, PRInfo } from '../types';
import { pushBranch, deleteBranch, commitChanges, hasUncommittedChanges } from '../git/sync';

function escapeShellArg(arg: string): string {
  // Use double quotes and escape special characters inside
  // This handles newlines, spaces, and special chars correctly
  return `"${arg.replace(/["\\$`!]/g, '\\$&')}"`;
}

async function execGhCommand(args: string[], cwd?: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const escapedArgs = args.map(escapeShellArg).join(' ');
  const command = cwd ? `cd ${escapeShellArg(cwd)} && gh ${escapedArgs}` : `gh ${escapedArgs}`;
  
  const proc = Bun.spawn(['sh', '-c', command], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  
  return { stdout, stderr, exitCode };
}

export class PRManager {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  async createPR(taskId: TaskId, title: string, body: string, worktreePath?: string): Promise<PRInfo | null> {
    const branchName = taskId;
    const workDir = worktreePath || this.baseDir;

    const hasChanges = await hasUncommittedChanges(workDir);
    if (hasChanges) {
      const commitResult = await commitChanges(title, workDir);
      if (!commitResult) {
        console.error(`[PRManager] Failed to commit changes for task ${taskId}`);
        return null;
      }
    }

    const pushResult = await pushBranch(branchName, workDir);
    if (!pushResult) {
      console.error(`[PRManager] Failed to push branch ${branchName}`);
      return null;
    }

    const { stdout, stderr, exitCode } = await execGhCommand(
      ['pr', 'create', '--base', 'main', '--title', title, '--body', body],
      workDir
    );

    if (exitCode !== 0) {
      console.error(`[PRManager] Failed to create PR: ${stderr}`);
      return null;
    }

    const prUrl = stdout.trim();
    const prNumber = this.extractPRNumber(prUrl);

    if (!prNumber) {
      console.error(`[PRManager] Failed to extract PR number from URL: ${prUrl}`);
      return null;
    }

    const prInfo: PRInfo = {
      number: prNumber,
      url: prUrl,
      title,
      state: 'open',
      branchName,
    };

    console.log(`[PRManager] Created PR #${prNumber}: ${prUrl}`);
    return prInfo;
  }

  async getPR(prNumber: number): Promise<PRInfo | null> {
    const { stdout, stderr, exitCode } = await execGhCommand(
      ['pr', 'view', prNumber.toString(), '--json', 'number,url,title,state,headRefName'],
      this.baseDir
    );

    if (exitCode !== 0) {
      console.error(`[PRManager] Failed to get PR #${prNumber}: ${stderr}`);
      return null;
    }

    try {
      const data = JSON.parse(stdout);
      return {
        number: data.number,
        url: data.url,
        title: data.title,
        state: data.state.toLowerCase() === 'merged' ? 'merged' : data.state.toLowerCase(),
        branchName: data.headRefName,
      };
    } catch (error) {
      console.error(`[PRManager] Failed to parse PR data: ${error}`);
      return null;
    }
  }

  async mergePR(prNumber: number): Promise<boolean> {
    const { stderr, exitCode } = await execGhCommand(
      ['pr', 'merge', prNumber.toString(), '--squash', '--delete-branch'],
      this.baseDir
    );

    if (exitCode !== 0) {
      console.error(`[PRManager] Failed to merge PR #${prNumber}: ${stderr}`);
      return false;
    }

    console.log(`[PRManager] Merged PR #${prNumber}`);
    return true;
  }

  async closePR(prNumber: number): Promise<boolean> {
    const { stderr, exitCode } = await execGhCommand(
      ['pr', 'close', prNumber.toString()],
      this.baseDir
    );

    if (exitCode !== 0) {
      console.error(`[PRManager] Failed to close PR #${prNumber}: ${stderr}`);
      return false;
    }

    console.log(`[PRManager] Closed PR #${prNumber}`);
    return true;
  }

  async deleteBranch(branchName: string): Promise<boolean> {
    return deleteBranch(branchName, this.baseDir, true);
  }

  private extractPRNumber(url: string): number | null {
    const match = url.match(/\/pull\/(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  }

  async checkUncommittedChanges(): Promise<boolean> {
    return hasUncommittedChanges(this.baseDir);
  }
}