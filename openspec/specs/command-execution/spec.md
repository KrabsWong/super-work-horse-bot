# command-execution Specification

## Purpose
TBD - created by archiving change add-telegram-bot-server. Update Purpose after archive.
## Requirements
### Requirement: Command Whitelisting and Validation

The system SHALL only execute whitelisted commands and validate all user input before execution.

#### Scenario: Executing whitelisted proposal command

- **WHEN** a `/proposal <prompt>` command is received
- **THEN** the system SHALL recognize it as a whitelisted command
- **AND** the system SHALL construct the corresponding `opencode --prompt "/proposal <prompt>"` command
- **AND** the command SHALL proceed to tmux execution

#### Scenario: Input sanitization

- **WHEN** any command contains special shell characters (e.g., `;`, `|`, `&`, `$()`, backticks)
- **THEN** the system SHALL escape or reject these characters to prevent command injection
- **AND** the sanitized or rejected command SHALL be logged

#### Scenario: Command validation failure

- **WHEN** a command fails validation (contains malicious patterns or exceeds length limits)
- **THEN** the system SHALL reject the command
- **AND** an error message SHALL be sent to the user
- **AND** the rejection SHALL be logged with details

### Requirement: opencode Command Execution

The system SHALL execute opencode commands with the correct prompt format within tmux sessions.

#### Scenario: Successful command construction

- **WHEN** a `/proposal` command with prompt text "调研以下glm4.7和mini max的各项指标的差异" is received
- **THEN** the system SHALL construct the command: `opencode --prompt "/proposal 调研以下glm4.7和mini max的各项指标的差异"`
- **AND** the command SHALL be passed to the tmux session manager

#### Scenario: Command execution within tmux

- **WHEN** a constructed opencode command is ready for execution
- **THEN** the system SHALL request tmux session manager to execute the command
- **AND** the execution SHALL be logged with timestamp and command details

### Requirement: Command Execution Error Handling

The system SHALL handle command execution failures gracefully and provide feedback.

#### Scenario: opencode not found in PATH

- **WHEN** the system attempts to execute opencode but it's not available in PATH
- **THEN** the execution SHALL fail
- **AND** an error message SHALL be logged indicating "opencode command not found"
- **AND** a user-friendly error message SHALL be sent to Telegram: "Command execution failed - please contact administrator"

#### Scenario: Command execution timeout

- **WHEN** a command is sent to tmux session but tmux operations timeout
- **THEN** the system SHALL log a timeout error
- **AND** a user-friendly error message SHALL be sent to Telegram: "Command execution timed out"

### Requirement: Execution Logging

The system SHALL log all command executions with sufficient detail for debugging and auditing.

#### Scenario: Command execution logging

- **WHEN** any command is executed
- **THEN** the system SHALL log: timestamp, user ID, original Telegram command, constructed shell command, and execution status
- **AND** logs SHALL be written to stdout/stderr or a configured log file
- **AND** sensitive information (tokens, credentials) SHALL NOT be logged

