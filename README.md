# VibeCodingBot

A Telegram bot server that receives slash commands and executes server-side AI coding workflows (via `opencode` or `claude` CLI) within tmux sessions. Supports scheduled tasks and real-time monitoring.

## Features

- **Telegram Bot Integration** - Uses Telegraf framework for reliable message handling
- **YAML-based Configuration** - All settings managed through `config.yaml` (not environment variables)
- **Dynamic Command Registration** - Commands defined in config, automatically registered at startup
- **tmux Session Management** - Each command has its own tmux session (creates when needed, reuses when exists)
- **Scheduled Tasks (Cron)** - Configure automatic execution using cron syntax
- **Task Monitoring** - Automatic tracking of task completion with timeout protection (1 hour max)
- **Graceful Process Control** - `/finish` command to stop running opencode processes
- **Today in History Integration** - Smart research topic generation based on historical events

## Prerequisites

- **Bun** v1.0.0 or higher
- **tmux** installed on your server
- **opencode** or **claude** CLI tool available in PATH
- A Telegram bot token (get one from [@BotFather](https://t.me/BotFather))

## Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd super-work-work-horse-bot
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

4. **Configure the bot:**
   ```bash
   cp config.yaml.example config.yaml
   ```
   
   Edit `config.yaml` and configure your bot token and commands:
   ```yaml
   telegramBotToken: your_bot_token_here
   logLevel: info
   
   commands:
     - name: research
       dir: ~/workspace/research
       prompt: /openspec:proposal
       session: research-bot
       model: opencode/glm-4.7-free
   
   cronTasks:
     - name: daily-research
       schedule: "0 9 * * *"
       command: research
       chatId: 123456789
       enabled: true
   ```

## Getting Your Bot Token

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` command
3. Follow the prompts to create your bot
4. Copy the token provided by BotFather
5. Add it to your `config.yaml` file

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
- `/finish` - Stop the running opencode process in research session
- `/<command> <text>` - Execute opencode in configured workspace

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

1. **User sends command** - You send `/research <text>` to the bot on Telegram
2. **Bot receives message** - Server validates the command against config
3. **Input sanitization** - User input is cleaned to prevent command injection
4. **tmux session check** - Bot checks if a tmux session exists
5. **Session creation** - If no session exists, one is created automatically
6. **Command execution** - The opencode command is sent to the tmux session
7. **Monitoring starts** - Bot monitors for task completion or timeout
8. **Notification** - Bot sends completion notification to Telegram

## Project Structure

```
super-work-horse-bot/
├── config.yaml              # Configuration file (not in git)
├── config.yaml.example      # Example configuration
├── package.json             # Project dependencies
├── tsconfig.json            # TypeScript configuration
├── README.md                # This file
├── src/
│   ├── index.ts             # Entry point, bot initialization
│   ├── types/
│   │   └── index.ts         # TypeScript type definitions
│   ├── config/
│   │   └── index.ts         # YAML configuration loader
│   ├── bot/
│   │   ├── handlers.ts      # Command handlers
│   │   └── middleware.ts    # Logging, error handling
│   ├── tmux/
│   │   └── session.ts       # tmux session management
│   ├── commands/
│   │   └── executor.ts     # Command execution logic
│   ├── scheduler/
│   │   └── index.ts         # Cron task scheduler
│   └── monitor/
│       └── index.ts         # Task monitoring & completion tracking
└── openspec/                # OpenSpec design documents
```

## Configuration

### config.yaml Structure

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `telegramBotToken` | Yes | - | Your Telegram bot token from @BotFather |
| `logLevel` | No | `info` | Logging level: debug, info, warn, error |

### Command Configuration

Each command in the `commands` array:

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `name` | Yes | - | Command name (used as `/<name>`) |
| `dir` | Yes | - | Working directory for the command |
| `prompt` | Yes | - | Prompt format |
| `session` | No | `<name>-bot` | tmux session name |
| `model` | No | - | AI model (e.g., `opencode/glm-4.7-free`, `claude-sonnet-4-20250514`) |
| `cli` | No | `{type: 'opencode'}` | CLI tool configuration |

### CLI Configuration

The `cli` field allows you to choose between different AI CLI tools:

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `type` | No | `opencode` | CLI tool type: `opencode` or `claude` |
| `skipPermissions` | No | `false` | (claude only) Skip permission checks. Use with caution in trusted environments. |

**Supported CLI types:**
- `opencode` - Default, uses `opencode --model="..." --prompt="..."`
- `claude` - Uses `claude --model "..." -p "..."` with optional `--dangerously-skip-permissions`

### Cron Task Configuration

Each task in the `cronTasks` array:

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `name` | Yes | - | Task name (for logging) |
| `schedule` | Yes | - | Cron expression (e.g., `0 9 * * *`) |
| `command` | Yes | - | References a command name from `commands` |
| `chatId` | Yes | - | Telegram chat ID to send notifications |
| `dir` | No | inherits from command | Working directory |
| `session` | No | `<command>-cron` | tmux session name |
| `enabled` | No | `true` | Whether the task is active |

### Example: Adding Custom Commands

Add to your `config.yaml`:

```yaml
commands:
  # Using opencode (default CLI)
  - name: research
    dir: ~/workspace/research
    prompt: /openspec:proposal
    session: research-bot
    model: opencode/glm-4.7-free
  
  # Using claude CLI
  - name: claude-task
    dir: ~/workspace/claude
    prompt: "Help me with"
    session: claude-bot
    model: claude-sonnet-4-20250514
    cli:
      type: claude
      skipPermissions: true  # Skip permission checks (use with caution)
```

Restart the bot:
```bash
bun start
```

The `/research` and `/claude-task` commands will now be available!

## Security

- **Command Whitelisting**: Only configured commands can execute
- **Input Sanitization**: User input is sanitized to prevent command injection
- **No Token Logging**: Bot token is never logged to console or files
- **Directory Validation**: Prevents directory traversal attacks
- **Private Bot**: Intended for trusted users or private groups

## Contributing

Contributions are welcome! Please follow the OpenSpec workflow defined in `openspec/AGENTS.md`.

## License

MIT