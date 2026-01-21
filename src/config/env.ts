import type { Config, CommandConfig } from '../types';

/**
 * Load command configurations from environment variables
 * Parses COMMAND_<NAME>_DIR, COMMAND_<NAME>_PROMPT, COMMAND_<NAME>_SESSION, COMMAND_<NAME>_MODEL
 */
function loadCommandConfigs(): Record<string, CommandConfig> {
  const commands: Record<string, Partial<CommandConfig>> = {};
  const envVars = Bun.env;
  const commandPattern = /^COMMAND_([A-Z]+)_(DIR|PROMPT|SESSION|MODEL)$/;
  
  // Parse all COMMAND_* environment variables
  for (const [key, value] of Object.entries(envVars)) {
    if (!value) continue;
    
    const match = key.match(commandPattern);
    if (match) {
      const commandName = match[1].toLowerCase(); // e.g., "RESEARCH" -> "research"
      const property = match[2].toLowerCase() as keyof CommandConfig; // e.g., "DIR" -> "dir"
      
      if (!commands[commandName]) {
        commands[commandName] = {};
      }
      
      commands[commandName][property] = value;
    }
  }
  
  // Validate each command has required properties
  for (const [name, cmdConfig] of Object.entries(commands)) {
    if (!cmdConfig.dir) {
      console.warn(`Warning: Command '${name}' is missing DIR configuration`);
    }
    if (!cmdConfig.prompt) {
      console.warn(`Warning: Command '${name}' is missing PROMPT configuration`);
    }
    if (!cmdConfig.session) {
      // Set default session name if not specified
      cmdConfig.session = `${name}-bot`;
      console.log(`Using default session name for '${name}': ${cmdConfig.session}`);
    }
    
    // Validate directory path (basic security check)
    if (cmdConfig.dir && cmdConfig.dir.includes(';')) {
      console.error(`ERROR: Command '${name}' has invalid directory path (contains semicolon)`);
      delete commands[name];
      continue;
    }
    
    // Validate model parameter (basic security check)
    if (cmdConfig.model && (cmdConfig.model.includes(';') || cmdConfig.model.includes('|') || cmdConfig.model.includes('&'))) {
      console.error(`ERROR: Command '${name}' has invalid model parameter (contains dangerous characters)`);
      delete commands[name];
    }
  }
  
  return commands as Record<string, CommandConfig>;
}

export const config: Config = {
  telegramBotToken: Bun.env.TELEGRAM_BOT_TOKEN || '',
  logLevel: Bun.env.LOG_LEVEL || 'info',
  commands: loadCommandConfigs(),
};

/**
 * Validate required configuration
 */
export function validateConfig(): void {
  if (!config.telegramBotToken) {
    console.error('ERROR: TELEGRAM_BOT_TOKEN is required in environment variables');
    console.error('Please create a .env file with your bot token (see .env.example)');
    process.exit(1);
  }
  
  // Check that at least one command is configured
  const commandNames = Object.keys(config.commands);
  if (commandNames.length === 0) {
    console.error('ERROR: No commands configured');
    console.error('Please add at least one command configuration in .env file');
    console.error('Example:');
    console.error('  COMMAND_RESEARCH_DIR=~/workspace/research');
    console.error('  COMMAND_RESEARCH_PROMPT=/openspec:proposal');
    console.error('  COMMAND_RESEARCH_SESSION=research-bot');
    process.exit(1);
  }
  
  console.log(`Loaded ${commandNames.length} command(s): ${commandNames.join(', ')}`);
}
