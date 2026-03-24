import type { Config, CommandConfig, CliType } from '../types';
import type { PlatformsConfig } from '../interface/messenger/types';
import yaml from 'js-yaml';

const DEFAULT_MAX_CONCURRENT = 3;

interface RawCliConfig {
  type: string;
  skipPermissions?: boolean;
}

interface RawCommandConfig {
  name: string;
  dir: string;
  session?: string;
  model?: string;
  cli?: RawCliConfig;
  maxConcurrent?: number;
}

interface RawPlatformConfig {
  token: string;
  chatId?: string | number;
}

interface RawPlatformsConfig {
  activePlatform?: 'telegram' | 'discord';
  telegram?: RawPlatformConfig;
  discord?: RawPlatformConfig;
}

interface YamlConfig {
  logLevel?: string;
  worktreeBaseDir?: string;
  cronDir?: string;
  commands: RawCommandConfig[];
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
    session: raw.session || `${raw.name}-bot`,
    model: raw.model,
    cli: raw.cli ? {
      type: raw.cli.type as CliType,
      skipPermissions: raw.cli.skipPermissions,
    } : undefined,
    maxConcurrent,
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
      cronDir: parsed.cronDir || './cron',
      commands,
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
  cronDir: './cron',
  commands: {},
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