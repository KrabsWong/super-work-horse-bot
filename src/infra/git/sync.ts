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

export async function getCurrentBranch(workDir: string): Promise<string | null> {
  const { stdout, exitCode } = await execGitCommand(['branch', '--show-current'], workDir);
  
  if (exitCode !== 0) {
    return null;
  }
  
  return stdout.trim();
}