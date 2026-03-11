/**
 * Git Operation Lock Manager
 * 
 * Provides per-directory mutex locks to prevent concurrent Git operations
 * on the same repository, which can cause race conditions and branch detection issues.
 */

import { Mutex } from 'async-mutex';

const gitLocks = new Map<string, Mutex>();

/**
 * Get or create a mutex lock for a specific Git repository directory
 * @param baseDir - The Git repository directory path
 * @returns Mutex instance for the directory
 */
export function getGitLock(baseDir: string): Mutex {
  const normalizedDir = baseDir.replace(/\/$/, ''); // Remove trailing slash
  if (!gitLocks.has(normalizedDir)) {
    gitLocks.set(normalizedDir, new Mutex());
  }
  return gitLocks.get(normalizedDir)!;
}

/**
 * Execute a function with Git lock protection
 * @param baseDir - The Git repository directory path
 * @param fn - The function to execute
 * @returns Result of the function
 */
export async function withGitLock<T>(
  baseDir: string,
  fn: () => Promise<T>
): Promise<T> {
  const lock = getGitLock(baseDir);
  const release = await lock.acquire();
  
  try {
    return await fn();
  } finally {
    release();
  }
}


