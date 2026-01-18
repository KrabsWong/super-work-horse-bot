import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  logLevel: process.env.LOG_LEVEL || 'info',
  commands: loadCommandConfigs(),
};

/**
 * Load command configurations from environment variables
 * Parses COMMAND_<NAME>_DIR, COMMAND_<NAME>_PROMPT, COMMAND_<NAME>_SESSION, COMMAND_<NAME>_MODEL, COMMAND_<NAME>_FULL_AUTO
 * @returns {Object} Commands configuration object
 */
function loadCommandConfigs() {
  const commands = {};
  const envVars = process.env;
  const commandPattern = /^COMMAND_([A-Z]+)_(DIR|PROMPT|SESSION|MODEL|FULL_AUTO)$/;
  
  // Parse all COMMAND_* environment variables
  for (const [key, value] of Object.entries(envVars)) {
    const match = key.match(commandPattern);
    if (match) {
      const commandName = match[1].toLowerCase(); // e.g., "RESEARCH" -> "research"
      const property = match[2].toLowerCase();     // e.g., "DIR" -> "dir"
      
      if (!commands[commandName]) {
        commands[commandName] = {};
      }
      
      // Convert FULL_AUTO to boolean
      if (property === 'full_auto') {
        commands[commandName][property] = value.toLowerCase() === 'true' || value === '1';
      } else {
        commands[commandName][property] = value;
      }
    }
  }
  
  // Validate each command has required properties
  for (const [name, cmdConfig] of Object.entries(commands)) {
    if (!cmdConfig.dir) {
      console.warn(`⚠ Warning: Command '${name}' is missing DIR configuration`);
    }
    if (!cmdConfig.prompt) {
      console.warn(`⚠ Warning: Command '${name}' is missing PROMPT configuration`);
    }
    if (!cmdConfig.session) {
      // Set default session name if not specified
      cmdConfig.session = `${name}-bot`;
      console.log(`ℹ Using default session name for '${name}': ${cmdConfig.session}`);
    }
    
    // Validate directory path (basic security check)
    if (cmdConfig.dir && cmdConfig.dir.includes(';')) {
      console.error(`✗ ERROR: Command '${name}' has invalid directory path (contains semicolon)`);
      delete commands[name];
    }
    
    // Validate model parameter (basic security check)
    if (cmdConfig.model && (cmdConfig.model.includes(';') || cmdConfig.model.includes('|') || cmdConfig.model.includes('&'))) {
      console.error(`✗ ERROR: Command '${name}' has invalid model parameter (contains dangerous characters)`);
      delete commands[name];
    }
  }
  
  return commands;
}

// Validate required configuration
export function validateConfig() {
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
  
  console.log(`✓ Loaded ${commandNames.length} command(s): ${commandNames.join(', ')}`);
}
