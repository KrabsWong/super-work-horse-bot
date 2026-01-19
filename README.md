# Server Telegram Bot

A Telegram bot server that receives slash commands and executes corresponding server-side commands (like `opencode`) within tmux sessions.

## Features

- 🤖 **Telegram Bot Integration** - Uses Telegraf framework for reliable message handling
- 🔐 **Configurable Commands** - Define custom commands with working directories via environment variables
- 🖥️ **tmux Session Management** - Each command has its own tmux session (creates when needed, reuses when exists)
- ⚡ **Simple Setup** - Easy configuration with environment variables
- 🔄 **Flexible Architecture** - Add new commands without code changes
- 📝 **Comprehensive Logging** - Detailed logs for debugging and auditing

## Prerequisites

- **Bun** v1.0.0 or higher
- **tmux** installed on your server
- **opencode** CLI tool available in PATH
- A Telegram bot token (get one from [@BotFather](https://t.me/BotFather))

## Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd server-tele-bot
   ```

2. **Install dependencies:**
    ```bash
    bun install
    ```

3. **Install tmux (if not already installed):**
   ```bash
   # macOS
   brew install tmux
   
   # Ubuntu/Debian
   sudo apt-get install tmux
   
   # CentOS/RHEL
   sudo yum install tmux
   ```

4. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and configure your bot token and commands:
 ```env
    TELEGRAM_BOT_TOKEN=your_bot_token_here
    LOG_LEVEL=info
    
     # Command Configuration
    COMMAND_RESEARCH_DIR=~/workspace/research
    COMMAND_RESEARCH_PROMPT=/openspec:proposal
    COMMAND_RESEARCH_SESSION=research-bot
    COMMAND_RESEARCH_MODEL=opencode/glm-4.7-free
     ```

## Getting Your Bot Token

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` command
3. Follow the prompts to create your bot
4. Copy the token provided by BotFather
5. Add it to your `.env` file

## Usage

### Starting the Bot

**Development mode (with auto-reload):**
```bash
bun run dev
```

**Production mode:**
```bash
bun start
```

### Available Commands

Once the bot is running, you can interact with it on Telegram:

- `/start` - Show welcome message
- `/help` - Display help information
- `/research <text>` - Execute opencode in configured workspace (example command)
- Custom commands can be added via environment variables

### Example

In Telegram, send:
```
/research 帮我生成一份研究报告，介绍新能源汽车领域涉及到哪些技术
```

 This will execute on your server:
  ```bash
  cd ~/workspace/research && opencode --model="opencode/glm-4.7-free" --prompt="/openspec:proposal 帮我生成一份研究报告，介绍新能源汽车领域涉及到哪些技术"
  ```

The command runs in a dedicated tmux session named `research-bot` (configurable via `COMMAND_RESEARCH_SESSION`).

## How It Works

1. **User sends command** - You send `/research <text>` (or any configured command) to the bot on Telegram
2. **Bot receives message** - The server receives and validates the command
3. **Command is sanitized** - Input is cleaned to prevent command injection
4. **tmux session check** - Bot checks if a tmux session exists
5. **Session creation** - If no session exists, one is created automatically
6. **Command execution** - The command is sent to the tmux session
7. **Confirmation** - Bot confirms successful execution on Telegram

## Project Structure

```
server-tele-bot/
├── package.json          # Project dependencies
├── .env                  # Environment configuration (not in git)
├── .env.example          # Example environment configuration
├── README.md             # This file
├── src/
│   ├── index.js          # Entry point, bot initialization
│   ├── bot/
│   │   ├── handlers.js   # Command handlers
│   │   └── middleware.js # Logging, error handling
│   ├── tmux/
│   │   └── session.js    # tmux session management
│   ├── commands/
│   │   └── executor.js   # Command execution logic
│   └── config/
│       └── env.js        # Environment configuration
└── openspec/             # OpenSpec design documents
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
 | `TELEGRAM_BOT_TOKEN` | Yes | - | Your Telegram bot token from @BotFather |
 | `COMMAND_<NAME>_DIR` | Yes | - | Working directory for the command |
  | `COMMAND_<NAME>_PROMPT` | Yes | - | OpenCode prompt format for the command |
  | `COMMAND_<NAME>_SESSION` | No | `<name>-bot` | tmux session name for the command |
  | `COMMAND_<NAME>_MODEL` | No | - | AI model to use (e.g., `opencode/glm-4.7-free`) |
  | `LOG_LEVEL` | No | `info` | Logging level: debug, info, warn, error |

  **Command Configuration Format:**
 - Replace `<NAME>` with your command name in UPPERCASE (e.g., `RESEARCH`, `PROPOSAL`)
 - The Telegram command will be lowercase (e.g., `/research`, `/proposal`)
  - Each command must have at least `DIR` and `PROMPT` configured
  - `MODEL` is optional - if not specified, opencode will use its default model
  - When `MODEL` is configured, the `--model` parameter is placed before `--prompt` in the generated command

### Adding Custom Commands

You can easily add new commands by adding environment variables to your `.env` file:

 **Example: Add a `/proposal` command**

  ```env
  # Add to your .env file
  COMMAND_PROPOSAL_DIR=~/workspace/myproject
  COMMAND_PROPOSAL_PROMPT=/proposal
  COMMAND_PROPOSAL_SESSION=proposal-bot
  COMMAND_PROPOSAL_MODEL=opencode/glm-4.7-free
  ```

Then restart the bot:
```bash
bun start
```

The `/proposal` command will now be available automatically!

 **Example: Add a `/codereview` command**

  ```env
  COMMAND_CODEREVIEW_DIR=~/workspace/reviews
  COMMAND_CODEREVIEW_PROMPT=/code-review
  COMMAND_CODEREVIEW_SESSION=review-bot
  COMMAND_CODEREVIEW_MODEL=opencode/claude-sonnet-4.5
  ```

**How it works:**
1. Bot reads all `COMMAND_*` environment variables at startup
2. For each set of `DIR`, `PROMPT`, and `SESSION` variables, a command is created
3. Commands are automatically registered with Telegraf
4. Each command gets its own tmux session
5. No code changes needed!

## Security

- **Command Configuration**: Only configured commands are allowed (defined via environment variables)
- **Input Sanitization**: User input is sanitized to prevent command injection
- **No Token Logging**: Bot token is never logged to console or files
- **Private Bot**: Intended for trusted users or private groups

## Troubleshooting

### Bot doesn't start

**Problem**: `ERROR: TELEGRAM_BOT_TOKEN is required`

**Solution**: Make sure you've created a `.env` file with your bot token:
```bash
cp .env.example .env
# Edit .env and add your token
```

---

**Problem**: `ERROR: tmux is required but not found`

**Solution**: Install tmux on your system:
```bash
# macOS
brew install tmux

# Linux
sudo apt-get install tmux  # Debian/Ubuntu
sudo yum install tmux      # CentOS/RHEL
```

### Commands not executing

**Problem**: Bot responds but commands don't execute

**Solution**: 
1. Check if `opencode` is in your PATH:
   ```bash
   which opencode
   ```
2. Check tmux session status:
   ```bash
   tmux list-sessions
   ```
3. Attach to the session to see output:
   ```bash
   tmux attach -t research-bot  # or your configured session name
   ```

### Bot authentication fails

**Problem**: `Failed to start bot: 401 Unauthorized`

**Solution**: Your bot token is invalid. Get a new token from @BotFather:
1. Send `/token` to @BotFather
2. Select your bot
3. Update the token in `.env`

## Deployment

### Using PM2 (Recommended for production)

1. **Install PM2:**
    ```bash
    bun install -g pm2
    ```

2. **Start the bot:**
    ```bash
    pm2 start --name telegram-bot -- bun src/index.js
    ```

3. **Configure auto-restart on system boot:**
   ```bash
   pm2 startup
   pm2 save
   ```

4. **Monitor the bot:**
   ```bash
   pm2 logs telegram-bot
   pm2 status
   ```

### Using systemd

1. **Create a service file** `/etc/systemd/system/telegram-bot.service`:
   ```ini
    [Unit]
    Description=Telegram Bot Server
    After=network.target

    [Service]
    Type=simple
    User=your-username
    WorkingDirectory=/path/to/server-tele-bot
    ExecStart=/home/ubuntu/.bun/bin/bun src/index.js
    Restart=always
    Environment=NODE_ENV=production

    [Install]
    WantedBy=multi-user.target
    ```

2. **Enable and start:**
   ```bash
   sudo systemctl enable telegram-bot
   sudo systemctl start telegram-bot
   sudo systemctl status telegram-bot
   ```

## Development

### Running Tests

Tests are coming in a future version. For now, test manually by:

1. Starting the bot: `bun run dev`
2. Sending test commands on Telegram
3. Checking server logs and tmux session output

### Adding New Commands

Commands are now configuration-driven! To add a new command, simply add environment variables:

**Example: Add `/mycommand`**

1. **Edit `.env` file:**
   ```env
   COMMAND_MYCOMMAND_DIR=~/workspace/mycommand
   COMMAND_MYCOMMAND_PROMPT=/my-prompt
   COMMAND_MYCOMMAND_SESSION=mycommand-bot
   COMMAND_MYCOMMAND_MODEL=opencode/glm-4.7-free  # Optional
   ```

2. **Restart the bot:**
    ```bash
    bun start
    ```

That's it! No code changes needed. The command is automatically:
- Validated at startup
- Registered with Telegraf
- Given its own tmux session
- Available via `/mycommand` in Telegram

### Configuration-Driven Architecture

The bot uses a fully dynamic command system:
- Commands loaded from `COMMAND_*` environment variables
- Handlers created automatically at runtime
- Each command has isolated working directory and tmux session
- Easy to add, remove, or modify commands via `.env`

## Contributing

Contributions are welcome! Please follow the OpenSpec workflow defined in `openspec/AGENTS.md`.

## License

MIT

## Support

For issues and questions:
- Check the [Troubleshooting](#troubleshooting) section
- Review server logs: `pm2 logs telegram-bot` (if using PM2)
- Check tmux session: `tmux list-sessions` then `tmux attach -t <session-name>`
