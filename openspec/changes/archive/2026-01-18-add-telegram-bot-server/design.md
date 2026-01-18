# Technical Design

## Context

We need a reliable server-side Telegram bot that can receive slash commands and execute corresponding system commands within tmux sessions. This enables remote workflow automation without requiring direct SSH access or manual server interaction.

**Constraints:**
- Must use Node.js ecosystem
- Must leverage existing, well-maintained Telegram SDKs to avoid implementation bugs
- Must handle tmux session lifecycle correctly
- Single server deployment initially (not distributed)

**Stakeholders:**
- Developers who want to trigger AI coding tools remotely
- Server administrators managing the bot deployment

## Goals / Non-Goals

### Goals
- Reliable reception of Telegram slash commands
- Safe execution of whitelisted server commands (initially: opencode)
- Intelligent tmux session management (create when needed, reuse when exists)
- Simple deployment and configuration
- Clear error handling and logging

### Non-Goals
- Multi-user authentication/authorization (assume trusted users or private bot)
- Command output streaming back to Telegram (v1 focuses on triggering)
- Web-based monitoring dashboard
- Support for arbitrary command execution (security risk)
- Distributed/multi-server deployment

## Decisions

### Decision 1: Telegram SDK Selection

**Choice:** Use **Telegraf** framework

**Rationale:**
- Modern, actively maintained (10k+ GitHub stars)
- TypeScript-first design with excellent type safety
- Built-in middleware pattern for extensibility
- Better session management and context handling than node-telegram-bot-api
- Cleaner API for slash command registration

**Alternatives Considered:**
- `node-telegram-bot-api`: More basic, callback-based API, less TypeScript support
- `grammy`: Newer but similar to Telegraf, less battle-tested
- Custom implementation: High risk of bugs (explicitly ruled out by requirements)

### Decision 2: Bot Update Mode

**Choice:** Long-polling (getUpdates) for initial version

**Rationale:**
- Simpler setup (no webhook URL, SSL certificate, or public endpoint needed)
- Easier local development and testing
- Sufficient for single-user or small team usage
- Can migrate to webhooks later for production scale

**Alternatives Considered:**
- Webhooks: Requires public HTTPS endpoint, more complex setup, better for high-traffic bots

### Decision 3: tmux Interaction Approach

**Choice:** Shell out to `tmux` CLI commands via Node.js `child_process.exec`

**Rationale:**
- tmux doesn't have a native Node.js API
- CLI is stable and well-documented
- Pattern: `tmux list-sessions` → `tmux new-session` or `tmux send-keys`
- Simple error detection via exit codes

**Implementation:**
```javascript
// Check if session exists
exec('tmux has-session -t session_name 2>/dev/null', (error) => {
  if (error) {
    // Session doesn't exist, create it
    exec('tmux new-session -d -s session_name', ...)
  } else {
    // Session exists, send command
    exec('tmux send-keys -t session_name "command" Enter', ...)
  }
})
```

**Alternatives Considered:**
- Node.js tmux client libraries: Most are unmaintained or incomplete
- Direct terminal manipulation: Over-engineered for this use case

### Decision 4: Command Whitelisting

**Choice:** Hard-code allowed commands initially (only `opencode`)

**Rationale:**
- Security: Prevent arbitrary command execution
- Simplicity: No need for complex configuration parser
- Extensible: Easy to add more commands later via code changes

**Pattern:**
```javascript
const COMMAND_HANDLERS = {
  proposal: (args) => `opencode --prompt "/proposal ${args}"`
}
```

**Alternatives Considered:**
- Configuration file: Over-engineered for single command
- No whitelist: Security risk (arbitrary code execution)

### Decision 5: Error Handling Strategy

**Choice:** Fail fast with clear error messages logged, graceful degradation for Telegram

**Rationale:**
- Log all errors server-side for debugging
- Send generic error messages to Telegram (avoid leaking system details)
- Don't crash bot on single command failure
- Restart bot automatically via process manager (pm2/systemd)

**Error Categories:**
1. Telegram API errors → Retry with exponential backoff
2. tmux command errors → Log and notify user "execution failed"
3. Configuration errors → Crash fast at startup

## Architecture

### Component Diagram

```
┌─────────────────┐
│  Telegram API   │
└────────┬────────┘
         │ (long-polling)
         ▼
┌─────────────────┐
│   Bot Server    │
│  (Telegraf)     │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌──────────────┐
│Command │ │ tmux Session │
│Parser  │ │ Manager      │
└────┬───┘ └──────┬───────┘
     │            │
     └─────┬──────┘
           ▼
    ┌──────────────┐
    │ Command      │
    │ Executor     │
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │ tmux session │
    │  → opencode  │
    └──────────────┘
```

### File Structure

```
server-tele-bot/
├── package.json
├── .env.example
├── .gitignore
├── README.md
├── src/
│   ├── index.js           # Entry point, bot initialization
│   ├── bot/
│   │   ├── handlers.js    # Command handlers
│   │   └── middleware.js  # Logging, error handling
│   ├── tmux/
│   │   └── session.js     # tmux session management
│   ├── commands/
│   │   └── executor.js    # Command execution logic
│   └── config/
│       └── env.js         # Environment configuration
└── openspec/              # (existing)
```

## Risks / Trade-offs

### Risk 1: tmux Not Available
**Impact:** Bot can't execute commands  
**Mitigation:**
- Check for tmux at startup, fail fast with clear error
- Document tmux as hard requirement in README

### Risk 2: Command Injection
**Impact:** Malicious user could execute arbitrary code  
**Mitigation:**
- Whitelist allowed commands
- Sanitize/escape user input before passing to shell
- Consider restricting bot access to trusted users via Telegram user ID check

### Risk 3: Long-Running Commands
**Impact:** opencode might run for minutes/hours, blocking session  
**Mitigation:**
- tmux sessions are asynchronous by nature (commands run in background)
- Initial version doesn't track completion (acceptable trade-off)
- Future: Add status checking mechanism

### Risk 4: Credential Leakage
**Impact:** TELEGRAM_BOT_TOKEN exposed in logs or version control  
**Mitigation:**
- Use .env file (not committed)
- Never log token value
- Add .env to .gitignore

## Migration Plan

N/A - This is a new system with no existing data or users to migrate.

**Deployment Steps:**
1. Install Node.js v18+ and tmux on server
2. Clone repository
3. Run `npm install`
4. Copy `.env.example` to `.env` and configure `TELEGRAM_BOT_TOKEN`
5. Start bot with `npm start` or `pm2 start src/index.js`
6. Test by sending `/proposal test` to bot in Telegram

**Rollback:**
- Simply stop the bot process (no data loss risk)

## Open Questions

1. **Session naming:** Should we use a single global tmux session or per-user sessions?
   - Proposal: Start with single session `opencode-bot`, add per-user later if needed

2. **Command confirmation:** Should bot acknowledge receipt before execution?
   - Proposal: Yes, send "Executing..." message immediately

3. **Output capture:** Should we capture and send command output back to Telegram?
   - Proposal: Out of scope for v1, add in future iteration

4. **Rate limiting:** Should we limit commands per user per time period?
   - Proposal: Not needed initially (trusted users), add if abused

5. **Multi-command support:** Should we support other commands beyond `opencode`?
   - Proposal: Design for extensibility, but only implement `/proposal` → `opencode` initially
