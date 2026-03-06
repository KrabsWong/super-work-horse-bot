import type { Config, CommandConfig, CronTaskConfig, CliType } from '../types';
import type { PlatformsConfig } from '../messenger/types';

const DEFAULT_MAX_CONCURRENT = 3;
import yaml from 'js-yaml';

interface RawCliConfig {
  type: string;
  skipPermissions?: boolean;
}

interface RawCommandConfig {
  name: string;
  dir: string;
  prompt: string;
  session?: string;
  model?: string;
  cli?: RawCliConfig;
  maxConcurrent?: number;
}

interface RawCronTaskConfig {
  name: string;
  schedule: string;
  command: string;
  chatId: string | number;
  dir?: string;
  session?: string;
  enabled?: boolean;
}

interface RawPlatformConfig {
  token: string;
}

interface RawPlatformsConfig {
  activePlatform?: 'telegram' | 'discord';
  telegram?: RawPlatformConfig;
  discord?: RawPlatformConfig;
}

interface YamlConfig {
  logLevel?: string;
  worktreeBaseDir?: string;
  commands: RawCommandConfig[];
  cronTasks?: RawCronTaskConfig[];
  platforms?: RawPlatformsConfig;
}

const validCliTypes: CliType[] = ['opencode', 'claude'];

function validateCommandConfig(raw: RawCommandConfig, index: number): CommandConfig | null {
  if (!raw.name) {
    console.error(`ERROR: Command at index ${index} is missing required field 'name'`);
    return null;
  }

  if (!raw.dir) {
    console.error(`ERROR: Command '${raw.name}' is missing required field 'dir'`);
    return null;
  }

  if (!raw.prompt) {
    console.error(`ERROR: Command '${raw.name}' is missing required field 'prompt'`);
    return null;
  }

  if (raw.dir.includes(';')) {
    console.error(`ERROR: Command '${raw.name}' has invalid directory path (contains semicolon)`);
    return null;
  }

  if (raw.model && (raw.model.includes(';') || raw.model.includes('|') || raw.model.includes('&'))) {
    console.error(`ERROR: Command '${raw.name}' has invalid model parameter (contains dangerous characters)`);
    return null;
  }

  if (raw.cli?.type && !validCliTypes.includes(raw.cli.type as CliType)) {
    console.error(`ERROR: Command '${raw.name}' has invalid cli.type '${raw.cli.type}'. Valid types: ${validCliTypes.join(', ')}`);
    return null;
  }

  const maxConcurrent = raw.maxConcurrent ?? DEFAULT_MAX_CONCURRENT;
  if (maxConcurrent < 1) {
    console.error(`ERROR: Command '${raw.name}' has invalid maxConcurrent '${maxConcurrent}'. Must be >= 1`);
    return null;
  }

  return {
    dir: raw.dir,
    prompt: raw.prompt,
    session: raw.session || `${raw.name}-bot`,
    model: raw.model,
    cli: raw.cli ? { 
      type: raw.cli.type as CliType,
      skipPermissions: raw.cli.skipPermissions,
    } : undefined,
    maxConcurrent,
  };
}

function validateCronTaskConfig(
  raw: RawCronTaskConfig,
  index: number,
  commands: Record<string, CommandConfig>
): CronTaskConfig | null {
  if (!raw.name) {
    console.error(`ERROR: Cron task at index ${index} is missing required field 'name'`);
    return null;
  }

  if (!raw.schedule) {
    console.error(`ERROR: Cron task '${raw.name}' is missing required field 'schedule'`);
    return null;
  }

  if (!raw.command) {
    console.error(`ERROR: Cron task '${raw.name}' is missing required field 'command'`);
    return null;
  }

  if (!raw.chatId) {
    console.error(`ERROR: Cron task '${raw.name}' is missing required field 'chatId'`);
    return null;
  }

  const chatIdNumber = typeof raw.chatId === 'number' ? raw.chatId : parseInt(raw.chatId, 10);
  if (isNaN(chatIdNumber)) {
    console.error(`ERROR: Cron task '${raw.name}' has invalid chatId '${raw.chatId}', must be a number`);
    return null;
  }

  const baseCommand = commands[raw.command];
  if (!baseCommand) {
    console.error(`ERROR: Cron task '${raw.name}' references unknown command '${raw.command}'`);
    console.error(`       Available commands: ${Object.keys(commands).join(', ')}`);
    return null;
  }

  const dir = raw.dir || baseCommand.dir;

  if (dir.includes(';')) {
    console.error(`ERROR: Cron task '${raw.name}' has invalid directory path (contains semicolon)`);
    return null;
  }

  return {
    schedule: raw.schedule,
    dir,
    session: raw.session || `${raw.command}-cron`,
    chatId: chatIdNumber,
    commandName: raw.command,
    enabled: raw.enabled !== false,
  };
}

async function loadConfigFromYaml(configPath: string): Promise<Config> {
  try {
    const file = Bun.file(configPath);
    const exists = await file.exists();
    
    if (!exists) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }

    const content = await file.text();
    const parsed = yaml.load(content) as YamlConfig;

    if (!parsed || typeof parsed !== 'object') {
      throw new Error(`Invalid YAML structure in ${configPath}`);
    }

    if (!parsed.commands || !Array.isArray(parsed.commands) || parsed.commands.length === 0) {
      throw new Error(`Missing or empty 'commands' array in ${configPath}`);
    }

    const commands: Record<string, CommandConfig> = {};
    
    for (let i = 0; i < parsed.commands.length; i++) {
      const raw = parsed.commands[i];
      const validated = validateCommandConfig(raw, i);
      if (validated) {
        commands[raw.name] = validated;
        const cliType = validated.cli?.type ?? 'opencode';
        console.log(`Loaded command '${raw.name}': session=${validated.session}, cli=${cliType}`);
      }
    }

    if (Object.keys(commands).length === 0) {
      throw new Error('No valid commands loaded from configuration');
    }

    const cronTasks: Record<string, CronTaskConfig> = {};
    
    if (parsed.cronTasks && Array.isArray(parsed.cronTasks)) {
      for (let i = 0; i < parsed.cronTasks.length; i++) {
        const raw = parsed.cronTasks[i];
        const validated = validateCronTaskConfig(raw, i, commands);
        if (validated) {
          cronTasks[raw.name] = validated;
          console.log(`Loaded cron task '${raw.name}': schedule=${validated.schedule}, chatId=${validated.chatId}`);
        }
      }
    }

    const platforms = normalizePlatformsConfig(parsed);

    const activeToken = platforms.activePlatform === 'telegram' 
      ? platforms.telegram.token 
      : platforms.discord.token;
    
    if (!activeToken) {
      throw new Error(`${platforms.activePlatform} token is required in config.yaml`);
    }

    return {
      logLevel: parsed.logLevel || 'info',
      worktreeBaseDir: parsed.worktreeBaseDir,
      commands,
      cronTasks,
      platforms,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`ERROR: Failed to load configuration: ${message}`);
    throw error;
  }
}

function normalizePlatformsConfig(parsed: YamlConfig): PlatformsConfig {
  const telegram = parsed.platforms?.telegram || { token: '' };
  const discord = parsed.platforms?.discord || { token: '' };
  const activePlatform = parsed.platforms?.activePlatform || 'telegram';

  console.log(`Active platform: ${activePlatform}`);
  
  if (!telegram.token && activePlatform === 'telegram') {
    console.warn('Warning: Telegram is active but no token configured');
  }
  if (!discord.token && activePlatform === 'discord') {
    console.warn('Warning: Discord is active but no token configured');
  }

  return { activePlatform, telegram, discord };
}

let configCache: Config | null = null;

export async function loadConfiguration(configPath?: string): Promise<Config> {
  if (configCache) {
    return configCache;
  }

  const path = configPath || './config.yaml';
  configCache = await loadConfigFromYaml(path);
  return configCache;
}

export const config: Config = {
  logLevel: 'info',
  commands: {},
  cronTasks: {},
  platforms: {
    activePlatform: 'telegram',
    telegram: { token: '' },
    discord: { token: '' },
  },
};

export async function initializeConfig(configPath?: string): Promise<void> {
  const loaded = await loadConfiguration(configPath);
  Object.assign(config, loaded);
}

export function validateConfig(): void {
  const { activePlatform, telegram, discord } = config.platforms;
  const activeToken = activePlatform === 'telegram' ? telegram.token : discord.token;
  
  if (!activeToken) {
    console.error(`ERROR: ${activePlatform} token is not configured in config.yaml`);
    console.error('');
    console.error('Example configuration:');
    console.error('platforms:');
    console.error('  activePlatform: telegram');
    console.error('  telegram:');
    console.error('    token: your_telegram_bot_token');
    console.error('  discord:');
    console.error('    token: your_discord_bot_token');
    process.exit(1);
  }

  const commandNames = Object.keys(config.commands);
  if (commandNames.length === 0) {
    console.error('ERROR: No commands configured in config.yaml');
    process.exit(1);
  }

  console.log(`Loaded ${commandNames.length} command(s): ${commandNames.join(', ')}`);
}