# Project Context

## Purpose

Server-side Telegram bot that enables remote execution of server commands (specifically `opencode`) through Telegram chat. This allows developers to trigger AI-assisted coding workflows from any device with Telegram access, without requiring direct SSH access to the server.

## Tech Stack

- **Runtime**: Bun v1+ (ES6 modules)
- **Bot Framework**: Telegraf v4.x (Telegram Bot API wrapper)
- **Session Management**: tmux (terminal multiplexer)
- **Configuration**: Bun built-in environment variables
- **External Tools**: opencode CLI (AI coding assistant)

## Project Conventions

### Code Style

- ES6+ JavaScript with import/export modules
- Async/await for asynchronous operations
- Clear, descriptive function and variable names
- Comprehensive JSDoc comments for public functions
- Console logging with visual separators (━) and emoji indicators (✓, ✗, ℹ)

### Architecture Patterns

- **Modular structure**: Separate concerns into bot/, tmux/, commands/, config/ directories
- **Command whitelisting**: Security-first approach - only approved commands can execute
- **Graceful error handling**: Log errors server-side, send user-friendly messages to Telegram
- **Fail-fast startup**: Validate configuration and dependencies before starting bot
- **Middleware pattern**: Use Telegraf middleware for logging and error handling

### Testing Strategy

- Manual testing via Telegram bot interaction
- Validation checks at startup (config, tmux availability)
- Comprehensive logging for debugging and auditing
- Future: Add automated tests for command sanitization and tmux operations

### Git Workflow

- Follow OpenSpec workflow for changes (proposal → implementation → archive)
- Keep .env files out of version control
- Commit messages should be clear and descriptive
- Document breaking changes in commit messages

## Domain Context

### Key Concepts

- **Slash Commands**: Telegram commands starting with `/` (e.g., `/proposal`)
- **tmux Sessions**: Background terminal sessions that persist after disconnect
- **Long-polling**: Bot update mode where bot requests updates from Telegram API
- **Command Injection**: Security vulnerability where user input could execute arbitrary code
- **Whitelisting**: Security pattern where only approved commands are allowed

### User Workflow

1. User opens Telegram and messages the bot
2. User sends `/proposal <text>` command
3. Bot validates and sanitizes the input
4. Bot checks if tmux session exists (creates if needed)
5. Bot executes `opencode --prompt "/proposal <text>"` in tmux session
6. Bot confirms execution to user on Telegram
7. User can check tmux session for command output

## Important Constraints

- **Single server deployment**: Not designed for distributed/multi-server setup
- **Trusted users only**: No multi-user authentication beyond Telegram's built-in mechanisms
- **Command whitelisting**: Only `/proposal` → `opencode` mapping is implemented
- **No output streaming**: V1 doesn't capture or stream command output back to Telegram
- **Requires tmux**: Hard dependency on tmux being installed on server
- **Requires opencode**: Assumes opencode CLI tool is available in PATH

## External Dependencies

### Required

- **Telegram Bot API**: For receiving and sending messages
- **tmux**: For persistent session management
- **opencode**: The AI coding assistant CLI tool being triggered

### Optional

- **PM2 or systemd**: For process management in production
- **Git**: For version control (if deploying from repository)

### Environment Variables

- `TELEGRAM_BOT_TOKEN` (required): Bot authentication token from @BotFather
- `TMUX_SESSION_NAME` (optional): Name of tmux session (default: "opencode-bot")
- `LOG_LEVEL` (optional): Logging verbosity (default: "info")
