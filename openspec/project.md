# Project Context

## Purpose

Telegram bot server that enables remote execution of AI coding workflows (via `opencode`) through Telegram chat. Supports scheduled tasks with automatic research topic generation based on GitHub trending repositories.

## Tech Stack

- **Runtime**: Bun v1+ (native TypeScript support)
- **Language**: TypeScript with strict mode
- **Bot Framework**: Telegraf v4.x (Telegram Bot API wrapper), discord.js v14.x
- **Session Management**: tmux (terminal multiplexer)
- **Configuration**: YAML-based (js-yaml)
- **Scheduler**: Croner v9.x (cron expressions)
- **Version Control**: Git (worktree for task isolation)
- **External Tools**: opencode CLI, claude CLI (AI coding assistants)

## Project Conventions

### Code Style

- Pure TypeScript with strict type checking
- Native TypeScript types (no JSDoc type annotations)
- Centralized type definitions in `src/types/index.ts`
- Bun-native APIs (Bun.spawn for subprocess, Bun.file for file operations)
- Async/await for asynchronous operations
- Clear, descriptive function and variable names
- Explicit return types on all functions
- Console logging with visual separators (`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

### Architecture Patterns

- **Modular structure**: Separate concerns into bot/, tmux/, commands/, config/, scheduler/, monitor/ directories
- **Command whitelisting**: Security-first approach - only approved commands can execute
- **YAML configuration**: All settings in `config.yaml` (not environment variables)
- **Graceful error handling**: Log errors server-side, send user-friendly messages to Telegram
- **Fail-fast startup**: Validate configuration and dependencies before starting bot
- **Middleware pattern**: Use Telegraf middleware for logging and error handling
- **Task monitoring**: Automatic tracking with completion detection via status files
- **Timeout protection**: Max 1 hour per task execution

### Testing Strategy

- Manual testing via Telegram bot interaction
- Validation checks at startup (config, tmux availability)
- Comprehensive logging for debugging and auditing
- TypeScript strict mode for compile-time safety

### Git Workflow

- Follow OpenSpec workflow for changes (proposal → implementation → archive)
- Keep config.yaml out of version control
- Commit messages should be clear and descriptive
- Document breaking changes in commit messages

## Domain Context

### Key Concepts

- **Slash Commands**: Telegram/Discord commands starting with `/` (e.g., `/research`)
- **tmux Sessions**: Background terminal sessions that persist after disconnect
- **Long-polling**: Bot update mode where bot requests updates from Telegram API
- **Command Injection**: Security vulnerability where user input could execute arbitrary code
- **Whitelisting**: Security pattern where only approved commands are allowed
- **Cron Tasks**: Scheduled execution using cron expressions, defined in `./cron/*.md` files
- **Task Manager**: Queue system managing concurrent task execution with configurable limits
- **Cron Manager**: File watcher and scheduler for automatic task reloading
- **Status File**: Marker file created by opencode to signal task completion
- **GitHub Trending**: API integration for generating research topics from popular repositories
- **Git Worktree**: Isolated working directories for concurrent task execution
- **Messenger Platform**: Abstraction layer supporting Telegram and Discord

### User Workflow

1. User opens Telegram/Discord and messages the bot
2. User sends `/<command> <text>` or `/run <command> <text>`
3. Bot validates and sanitizes the input
4. Bot creates a git worktree for isolated execution (if configured)
5. Bot checks if tmux session exists (creates if needed)
6. Bot executes the command in tmux session
7. Task Manager tracks execution status
8. Bot monitors task execution (completion or timeout)
9. Bot sends notification to user on completion or failure
10. User can check task status via `/jobs` command

### Task Management Commands

- `/jobs` - List all running and queued tasks
- `/jobs show <taskId>` - View detailed task information
- `/jobs stop <taskId>` - Cancel a queued task
- `/finish` - Stop all running tasks gracefully

### Admin Workflow (Cron)

1. Admin creates cron task files in `./cron/` directory (markdown format)
2. File watcher detects changes and reloads tasks automatically
3. Scheduler triggers task at configured cron expression time
4. System fetches GitHub trending repositories created in the past week
5. System selects an interesting repository based on relevance scoring
6. Bot executes opencode with generated research prompt (project analysis, use cases, competitors)
7. Bot monitors and notifies on completion

### Cron Task File Format

Create markdown files in `./cron/` directory:

```markdown
# Task Name

- **Schedule**: `0 9 * * *`
- **Description**: Analyze trending repositories
- **Enabled**: true
- **Messenger**: telegram
```

## Important Constraints

- **Single server deployment**: Not designed for distributed/multi-server setup
- **Trusted users only**: No multi-user authentication beyond Telegram/Discord's built-in mechanisms
- **Command whitelisting**: Only configured commands in `config.yaml` can execute
- **Task timeout**: Maximum 1 hour execution time before force stop
- **Requires tmux**: Hard dependency on tmux being installed on server
- **Requires Git**: Git worktrees are used for concurrent task isolation
- **Requires opencode or claude**: Assumes AI CLI tool is available in PATH
- **Multi-platform support**: Both Telegram and Discord platforms supported, but only one active at a time

## External Dependencies

### Required

- **Telegram Bot API**: For receiving and sending messages
- **tmux**: For persistent session management
- **opencode**: The AI coding assistant CLI tool being triggered

### Optional

- **PM2 or systemd**: For process management in production
- **Git**: For version control (if deploying from repository)

### Configuration (config.yaml)

- `platforms` (required): Messenger platform configuration
  - `activePlatform`: `"telegram"` or `"discord"`
  - `telegram.token`: Bot authentication token from @BotFather
  - `discord.token`: Bot token from Discord Developer Portal
- `logLevel` (optional): Logging verbosity (default: "info")
- `commands` (required): Array of command configurations
  - `name`: Command name (used as `/<name>`)
  - `dir`: Working directory for the command
  - `prompt`: Prompt format for the AI
  - `session`: tmux session name (optional)
  - `model`: AI model to use (optional)
  - `cli`: CLI tool configuration (`opencode` or `claude`)
  - `maxConcurrent`: Maximum concurrent tasks (default: 1)
- `cronDir` (optional): Directory for cron task markdown files (default: `./cron`)
