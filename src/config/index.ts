import type { Config, CommandConfig, CronTaskConfig, CliType } from '../types';
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

interface YamlConfig {
  telegramBotToken: string;
  logLevel?: string;
  commands: RawCommandConfig[];
  cronTasks?: RawCronTaskConfig[];
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

  // Validate cli.type if provided
  if (raw.cli?.type && !validCliTypes.includes(raw.cli.type as CliType)) {
    console.error(`ERROR: Command '${raw.name}' has invalid cli.type '${raw.cli.type}'. Valid types: ${validCliTypes.join(', ')}`);
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

    if (!parsed.telegramBotToken) {
      throw new Error(`Missing required field 'telegramBotToken' in ${configPath}`);
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

    return {
      telegramBotToken: parsed.telegramBotToken,
      logLevel: parsed.logLevel || 'info',
      commands,
      cronTasks,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`ERROR: Failed to load configuration: ${message}`);
    throw error;
  }
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
  telegramBotToken: '',
  logLevel: 'info',
  commands: {},
  cronTasks: {},
};

export async function initializeConfig(configPath?: string): Promise<void> {
  const loaded = await loadConfiguration(configPath);
  Object.assign(config, loaded);
}

export function validateConfig(): void {
  if (!config.telegramBotToken) {
    console.error('ERROR: telegramBotToken is required in config.yaml');
    console.error('');
    console.error('Please create a config.yaml file:');
    console.error('');
    console.error('telegramBotToken: your_bot_token_here');
    console.error('commands:');
    console.error('  - name: research');
    console.error('    dir: ~/workspace/research');
    console.error('    prompt: /opsx:propose');
    console.error('    session: research-bot');
    console.error('    model: opencode/glm-4.7-free');
    process.exit(1);
  }

  const commandNames = Object.keys(config.commands);
  if (commandNames.length === 0) {
    console.error('ERROR: No commands configured in config.yaml');
    process.exit(1);
  }

  console.log(`Loaded ${commandNames.length} command(s): ${commandNames.join(', ')}`);
}