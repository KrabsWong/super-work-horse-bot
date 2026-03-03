## MODIFIED Requirements

### Requirement: opencode Command Execution

The system SHALL execute opencode commands with the correct prompt format and optional model parameter within tmux sessions.

#### Scenario: Successful command construction

- **WHEN** a `/proposal <prompt>` command is received
- **THEN** the system SHALL recognize it as a whitelisted command
- **AND** the system SHALL construct the corresponding `opencode --prompt "/proposal <prompt>"` command
- **AND** the command SHALL proceed to execution via OpenCode Server SDK

#### Scenario: Command construction with model parameter

- **WHEN** a command is configured with a model (e.g., `COMMAND_RESEARCH_MODEL=opencode/glm-4.7-free`)
- **AND** a user sends the command with prompt text
- **THEN** the system SHALL construct the command: `cd <dir> && opencode --prompt="<prompt> <text>" --model="opencode/glm-4.7-free"`
- **AND** the model parameter SHALL be properly quoted to prevent injection
- **AND** the command SHALL be passed to OpenCode Server SDK for execution

#### Scenario: Command execution via OpenCode Server

- **WHEN** a constructed opencode command is ready for execution
- **THEN** the system SHALL use OpenCode Server SDK to execute the command
- **AND** the execution SHALL be logged with timestamp and command details

## ADDED Requirements

### Requirement: User Interaction During Execution

The system SHALL detect and handle user confirmation requests during opencode execution, enabling remote user decisions via Telegram.

#### Scenario: Detecting user confirmation request

- **WHEN** OpenCode emits a `session.waiting` event during execution
- **THEN** the system SHALL parse the control request from the event
- **AND** the system SHALL send a confirmation message to the user via Telegram

#### Scenario: User confirms and continues

- **WHEN** user sends `/confirm <requestId>` command
- **THEN** the system SHALL forward the response to OpenCode via Control API
- **AND** the task SHALL continue execution

#### Scenario: User denies and terminates

- **WHEN** user sends `/deny <requestId>` command
- **THEN** the system SHALL forward the denial to OpenCode
- **AND** the task SHALL be terminated
- **AND** a termination notification SHALL be sent to the user

#### Scenario: User skips current step

- **WHEN** user sends `/skip <requestId>` command
- **THEN** the system SHALL forward the skip response to OpenCode
- **AND** OpenCode SHALL skip the current step and continue

#### Scenario: Confirmation request timeout

- **WHEN** a confirmation request exceeds the configured timeout (default 5 minutes)
- **THEN** the system SHALL automatically deny the request
- **AND** the task SHALL be terminated
- **AND** a timeout notification SHALL be sent to the user

### Requirement: Fallback Execution Mode

The system SHALL provide fallback to tmux-based execution when OpenCode Server is unavailable.

#### Scenario: OpenCode Server unavailable

- **WHEN** OpenCode Server fails to start or connect
- **AND** fallback mode is enabled
- **THEN** the system SHALL execute commands via tmux session
- **AND** the fallback execution SHALL be logged