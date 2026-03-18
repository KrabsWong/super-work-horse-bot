# VibeCodingBot

A Telegram bot server that receives slash commands and executes server-side AI coding workflows (via `opencode` or `claude` CLI) within tmux sessions. Supports scheduled tasks and real-time monitoring.

## Features

- **Telegram Bot Integration** - Uses Telegraf framework for reliable message handling
- **YAML-based Configuration** - All settings managed through `config.yaml` (not environment variables)
- **Dynamic Command Registration** - Commands defined in config, automatically registered at startup
- **tmux Session Management** - Each command has its own tmux session (creates when needed, reuses when exists)
- **Scheduled Tasks (Cron)** - Configure automatic execution using cron syntax
- **Task Monitoring** - Automatic tracking of task completion with timeout protection (1 hour max)
- **Graceful Process Control** - `/jobs stop` command to stop running tasks or cancel queued tasks
- **Today in History Integration** - Smart research topic generation based on historical events
- **Thin Router Architecture** - Business logic lives in target project, bot only handles routing

## Architecture

This bot uses a **Thin Router Architecture**:

```
Telegram User -> temp-dir (thin router) -> opencode -> target project (business logic)
```

**temp-dir (this project):**
- Receives Telegram/Discord messages
- Routes to target project via opencode CLI
- Manages tmux sessions
- Monitors execution

**Target Project (e.g., vibe-research):**
- Defines business logic
- Template selection
- Content generation rules
- Quality standards

**Benefits:**
- Bot can serve multiple projects with different workflows
- Business logic is centralized in target projects
- Easy to test and maintain

See `docs/thin-router-architecture.md` for details.

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
    platforms:
      activePlatform: telegram
      telegram:
        token: your_telegram_bot_token_here
    
    logLevel: info
    
    commands:
      - name: research
        dir: ~/workspace/research
        session: research-bot
        model: opencode/glm-4.7-free
        maxConcurrent: 3
    
      - name: auto-daily-paper
        dir: ~/workspace/paper
        session: paper-bot
        model: opencode/glm-4.7-free
        maxConcurrent: 1
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

**System Commands:**
- `/start` - Show welcome message
- `/help` - Display help information
- `/run <command> <text>` - Execute specified command (or default command)

**Task Management:**
- `/jobs` - List running and queued tasks
- `/jobs show <taskId>` - Show task details
- `/jobs stop <taskId>` - Stop a running task or cancel a queued task

**Cron Task Management:**
- `/cron` - List scheduled cron tasks
- `/cron show <taskName>` - Show cron task details
- `/cron run <taskName>` - Manually trigger a cron task

**Configured Commands:**
- `/<command> <text>` - Execute opencode in configured workspace (defined in config.yaml)

### Example

In Telegram, send:
```
/research 帮我生成一份研究报告，介绍新能源汽车领域涉及到哪些技术
```

 This will execute on your server:
  ```bash
  cd ~/workspace/research && opencode --model="opencode/glm-4.7-free" --prompt="/research 帮我生成一份研究报告，介绍新能源汽车领域涉及到哪些技术"
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
├── cron/                    # Cron task definitions (markdown files)
├── src/
│   ├── index.ts             # Entry point, bot initialization
│   ├── types/
│   │   └── index.ts         # TypeScript type definitions
│   ├── config/
│   │   └── index.ts         # YAML configuration loader
│   ├── core/
│   │   ├── scheduler/       # Cron task scheduler
│   │   ├── task-manager/    # Task queue and execution management
│   │   └── cron-manager/    # Cron expression parsing and orchestration
│   ├── infra/
│   │   ├── tmux/            # tmux session management
│   │   ├── monitor/         # Task monitoring & completion tracking
│   │   ├── git/             # Git worktree and sync utilities
│   │   └── cli/             # CLI builder for opencode/claude
│   └── interface/
│       ├── messenger/       # Platform abstraction (Telegram/Discord)
│       └── commands/        # Command handlers
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
| `name` | Yes | - | Command name (used as `/<name>` and prompt prefix `/<name>`) |
| `dir` | Yes | - | Working directory for the command |
| `session` | No | `<name>-bot` | tmux session name |
| `model` | No | - | AI model (e.g., `opencode/glm-4.7-free`, `claude-sonnet-4-20250514`) |
| `cli` | No | `{type: 'opencode'}` | CLI tool configuration |
| `maxConcurrent` | No | `3` | Maximum concurrent tasks for this command |

**How it works:** The `name` field becomes both the Telegram/Discord slash command (e.g., `/research`) and the opencode prompt prefix. When executed, the bot generates: `/<name> <user input> --status-file=...`

### CLI Configuration

The `cli` field allows you to choose between different AI CLI tools:

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `type` | No | `opencode` | CLI tool type: `opencode` or `claude` |
| `skipPermissions` | No | `false` | (claude only) Skip permission checks. Use with caution in trusted environments. |

**Supported CLI types:**
- `opencode` - Default, uses `opencode --model="..." --prompt="..."`
- `claude` - Uses `claude --model "..." "..."` with optional `--dangerously-skip-permissions`

### Cron Task Configuration

Scheduled tasks are configured via Markdown files in the `cron/` directory. Each `.md` file contains YAML frontmatter with task configuration.

**Frontmatter Fields:**

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `name` | Yes | - | Task name (for logging and identification) |
| `schedule` | Yes | - | Time expression (e.g., `每天 09:00`, `每周一 08:00`) |
| `messenger` | No | `telegram` | Platform to send notifications (`telegram` or `discord`) |
| `enabled` | No | `true` | Whether the task is active |
| `command` | Yes | - | Command name from `commands` config (without `/` prefix) |

**Example:** `cron/daily-paper.md`
```yaml
---
name: daily-paper
schedule: 每天 09:00
messenger: telegram
enabled: true
command: auto-daily-paper
---

每天早上9点自动从 Hugging Face Papers 获取最新论文并进行深度解读...
```

**How it works:** When triggered, the bot executes: `/<command> <markdown body> --status-file=...`

**Supported schedule formats:**
- `每天 HH:MM` - Daily at specific time
- `每周一 HH:MM` - Every Monday
- `工作日 HH:MM` - Weekdays only (Mon-Fri)
- `每周末 HH:MM` - Weekends only
- `每小时` - Every hour
- `每N小时` - Every N hours
- Standard cron: `0 9 * * *`

### Example: Adding Custom Commands

Add to your `config.yaml`:

```yaml
commands:
  # Interactive research command
  - name: research
    dir: ~/workspace/research
    session: research-bot
    model: opencode/glm-4.7-free
    maxConcurrent: 3

  # Automated daily paper analysis (for cron tasks)
  - name: auto-daily-paper
    dir: ~/workspace/paper
    session: paper-bot
    model: opencode/glm-4.7-free
    maxConcurrent: 1

  # Using claude CLI
  - name: claude-task
    dir: ~/workspace/claude
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

The `/research`, `/auto-daily-paper`, and `/claude-task` commands will now be available!

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
## Discord Support

This bot now supports both Telegram and Discord platforms!

### Configuration

#### Option 1: Telegram Only (Backward Compatible)

```yaml
telegramBotToken: your_telegram_bot_token
```

#### Option 2: Multi-Platform

```yaml
platforms:
  telegram:
    enabled: true
    token: your_telegram_bot_token
  discord:
    enabled: true
    token: your_discord_bot_token
```

### Getting Discord Bot Token

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Navigate to "Bot" section
4. Click "Add Bot"
5. Copy the token
6. Enable "Message Content Intent" under "Privileged Gateway Intents"
7. Invite the bot to your server using the OAuth2 URL generator

### Architecture

The bot now uses a platform abstraction layer:

- `src/messenger/types.ts` - Platform-agnostic interfaces
- `src/messenger/manager.ts` - Multi-platform manager
- `src/messenger/telegram/` - Telegram implementation
- `src/messenger/discord/` - Discord implementation

All commands work identically on both platforms!
