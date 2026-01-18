# Change: Add Telegram Bot Server

## Why

We need a reliable way to trigger server-side commands (like `opencode`) from Telegram chat conversations. This enables remote workflow automation and AI-assisted development from any device with Telegram access, without requiring direct server access.

## What Changes

- **New capability: Telegram Bot Integration** - Server application that receives Telegram bot webhook events or polls for updates using an established Node.js SDK (node-telegram-bot-api or telegraf)
- **New capability: Slash Command Processing** - Parses and routes Telegram slash commands (e.g., `/proposal`) to corresponding server-side command executors
- **New capability: tmux Session Management** - Intelligently manages tmux sessions: checks for existing sessions, creates new sessions when needed, and appends commands to existing sessions
- **New capability: Command Execution** - Executes server commands (e.g., `opencode --prompt "..."`) within tmux sessions with proper error handling and output capture

## Impact

### Affected Specs
- `telegram-bot` (new) - Bot authentication, message receiving, command parsing
- `command-execution` (new) - Safe command execution with tmux integration
- `tmux-session-management` (new) - Session detection, creation, and command injection

### Affected Code
- New Node.js project structure (package.json, main server file)
- Environment configuration for Telegram bot token
- Command routing logic
- tmux interaction layer
- Error handling and logging

### Dependencies
- Node.js runtime (v18+ recommended)
- npm packages: `node-telegram-bot-api` or `telegraf` for Telegram integration
- `tmux` installed on the server
- `opencode` CLI tool available in PATH

### Non-Goals (Out of Scope)
- User authentication/authorization beyond Telegram's built-in mechanisms
- Command output streaming back to Telegram (initial version)
- Multi-user session isolation (initial version assumes single user or trusted group)
- Web UI or dashboard
