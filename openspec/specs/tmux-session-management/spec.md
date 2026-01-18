# tmux-session-management Specification

## Purpose
TBD - created by archiving change add-telegram-bot-server. Update Purpose after archive.
## Requirements
### Requirement: tmux Availability Check

The system SHALL verify tmux is installed and available before attempting any session operations.

#### Scenario: tmux available at startup

- **WHEN** the bot server starts
- **THEN** the system SHALL execute `tmux -V` to check tmux availability
- **AND** if tmux is found, the system SHALL log the tmux version
- **AND** the bot SHALL continue initialization

#### Scenario: tmux not available at startup

- **WHEN** the bot server starts and tmux is not installed or not in PATH
- **THEN** the system SHALL log a fatal error: "tmux is required but not found"
- **AND** the bot SHALL exit with a non-zero exit code
- **AND** clear instructions SHALL be logged for installing tmux

### Requirement: Session Detection

The system SHALL detect whether a target tmux session exists before attempting to create or use it.

#### Scenario: Session exists

- **WHEN** a command needs to be executed and the system checks for session "opencode-bot"
- **THEN** the system SHALL execute `tmux has-session -t opencode-bot 2>/dev/null`
- **AND** if the exit code is 0, the system SHALL determine the session exists
- **AND** the session detection result SHALL be logged

#### Scenario: Session does not exist

- **WHEN** a command needs to be executed and the system checks for session "opencode-bot"
- **THEN** the system SHALL execute `tmux has-session -t opencode-bot 2>/dev/null`
- **AND** if the exit code is non-zero, the system SHALL determine the session does not exist
- **AND** the session detection result SHALL be logged

### Requirement: Session Creation

The system SHALL create a new detached tmux session when none exists.

#### Scenario: Creating new session successfully

- **WHEN** session detection determines no session exists
- **THEN** the system SHALL execute `tmux new-session -d -s opencode-bot`
- **AND** if successful (exit code 0), the system SHALL log "Created new tmux session: opencode-bot"
- **AND** the system SHALL proceed to command execution

#### Scenario: Session creation fails

- **WHEN** session creation command fails (non-zero exit code)
- **THEN** the system SHALL log the error with full details
- **AND** the system SHALL send an error message to the Telegram user
- **AND** the command execution SHALL be aborted

### Requirement: Command Injection into Existing Session

The system SHALL inject commands into an existing tmux session using send-keys.

#### Scenario: Sending command to existing session

- **WHEN** session detection determines session "opencode-bot" exists
- **AND** a command "opencode --prompt '/proposal test'" needs to be executed
- **THEN** the system SHALL execute `tmux send-keys -t opencode-bot "opencode --prompt '/proposal test'" Enter`
- **AND** if successful, the system SHALL log "Command sent to tmux session: opencode-bot"

#### Scenario: Send-keys command fails

- **WHEN** the tmux send-keys command fails (non-zero exit code)
- **THEN** the system SHALL log the error details
- **AND** the system SHALL attempt to recreate the session and retry once
- **AND** if retry fails, an error message SHALL be sent to the Telegram user

### Requirement: Session Naming Strategy

The system SHALL use a configurable session name with a sensible default.

#### Scenario: Using default session name

- **WHEN** no custom session name is configured in environment variables
- **THEN** the system SHALL use "opencode-bot" as the session name
- **AND** all session operations SHALL use this name

#### Scenario: Using custom session name

- **WHEN** environment variable TMUX_SESSION_NAME is set to "my-custom-session"
- **THEN** the system SHALL use "my-custom-session" as the session name
- **AND** all session operations SHALL use this custom name

### Requirement: Session Lifecycle Management

The system SHALL handle the complete lifecycle: check → create if needed → execute.

#### Scenario: Complete execution flow with new session

- **WHEN** a command execution is requested and no session exists
- **THEN** the system SHALL detect no session exists
- **AND** the system SHALL create a new session
- **AND** the system SHALL inject the command into the newly created session
- **AND** all steps SHALL be logged

#### Scenario: Complete execution flow with existing session

- **WHEN** a command execution is requested and a session already exists
- **THEN** the system SHALL detect the existing session
- **AND** the system SHALL directly inject the command into the existing session
- **AND** session creation SHALL be skipped
- **AND** all steps SHALL be logged

### Requirement: Error Recovery

The system SHALL attempt recovery when tmux operations fail unexpectedly.

#### Scenario: Stale session recovery

- **WHEN** send-keys fails because session exists but is unresponsive
- **THEN** the system SHALL attempt to kill the stale session with `tmux kill-session -t <name>`
- **AND** the system SHALL create a fresh session
- **AND** the system SHALL retry command execution
- **AND** recovery attempts SHALL be logged

