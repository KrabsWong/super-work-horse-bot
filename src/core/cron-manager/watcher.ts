import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import type { CronTaskConfig } from './types';
import { parseTaskFile, createTaskConfig } from './parser';
import { validateTaskConfig } from './validator';

const DEBOUNCE_MS = 1000;

export class CronWatcher {
  private cronDir: string;
  private tasks: Map<string, CronTaskConfig> = new Map();
  private onChangeCallback: ((tasks: Map<string, CronTaskConfig>) => void) | null = null;
  private debounceTimer: Timer | null = null;
  private _watching: boolean = false;

  constructor(cronDir: string) {
    this.cronDir = cronDir;
  }

  onChange(callback: (tasks: Map<string, CronTaskConfig>) => void): void {
    this.onChangeCallback = callback;
  }

  async start(): Promise<void> {
    console.log(`[CronWatcher] Starting to watch directory: ${this.cronDir}`);
    this._watching = true;
    await this.scan();
  }

  stop(): void {
    console.log('[CronWatcher] Stopping watcher');
    this._watching = false;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  isWatching(): boolean {
    return this._watching;
  }

  private async scan(): Promise<void> {
    console.log(`[CronWatcher] Scanning directory: ${this.cronDir}`);
    
    try {
      const files = await readdir(this.cronDir);
      const mdFiles = files.filter(f => f.endsWith('.md'));
      
      console.log(`[CronWatcher] Found ${mdFiles.length} markdown files`);
      
      const newTasks = new Map<string, CronTaskConfig>();
      
      for (const file of mdFiles) {
        const config = await this.loadTaskFile(file);
        if (config) {
          newTasks.set(config.name, config);
        }
      }
      
      const changed = !this.mapsEqual(this.tasks, newTasks);
      this.tasks = newTasks;
      
      if (changed && this.onChangeCallback) {
        this.notifyChange();
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log(`[CronWatcher] Directory does not exist: ${this.cronDir}`);
        this.tasks.clear();
        if (this.onChangeCallback) {
          this.notifyChange();
        }
      } else {
        console.error('[CronWatcher] Error scanning directory:', error);
      }
    }
  }

  private async loadTaskFile(filename: string): Promise<CronTaskConfig | null> {
    const filePath = join(this.cronDir, filename);
    
    try {
      const content = await readFile(filePath, 'utf-8');
      const parsed = parseTaskFile(content, filename);
      
      if (!parsed) {
        return null;
      }
      
      const config = createTaskConfig(parsed, filename);
      
      if (!config) {
        return null;
      }
      
      const validation = validateTaskConfig(config);
      
      if (!validation.valid) {
        console.error(`[CronWatcher] Invalid task config in ${filename}:`);
        validation.errors.forEach(e => console.error(`  - ${e}`));
        return null;
      }
      
      if (validation.warnings.length > 0) {
        console.warn(`[CronWatcher] Warnings for ${filename}:`);
        validation.warnings.forEach(w => console.warn(`  - ${w}`));
      }
      
      console.log(`[CronWatcher] Loaded task: ${config.name} (${config.schedule} -> ${config.cronExpression})`);
      return config;
    } catch (error) {
      console.error(`[CronWatcher] Error loading ${filename}:`, error);
      return null;
    }
  }

  private notifyChange(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      if (this.onChangeCallback) {
        console.log(`[CronWatcher] Notifying change: ${this.tasks.size} tasks`);
        this.onChangeCallback(new Map(this.tasks));
      }
    }, DEBOUNCE_MS);
  }

  private mapsEqual(a: Map<string, CronTaskConfig>, b: Map<string, CronTaskConfig>): boolean {
    if (a.size !== b.size) return false;
    
    for (const [key, value] of a) {
      const other = b.get(key);
      if (!other) return false;
      if (JSON.stringify(value) !== JSON.stringify(other)) return false;
    }
    
    return true;
  }

  getTasks(): Map<string, CronTaskConfig> {
    return new Map(this.tasks);
  }

  getTask(name: string): CronTaskConfig | undefined {
    return this.tasks.get(name);
  }
}