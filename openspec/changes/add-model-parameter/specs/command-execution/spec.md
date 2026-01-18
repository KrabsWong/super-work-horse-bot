## ADDED Requirements

### Requirement: Model Parameter Configuration

The system SHALL support optional model parameter configuration for opencode commands to allow users to specify which AI model to use.

#### Scenario: Loading model configuration from environment

- **WHEN** environment variables include `COMMAND_<NAME>_MODEL` (e.g., `COMMAND_RESEARCH_MODEL=opencode/glm-4.7-free`)
- **THEN** the system SHALL parse and store the model value in the command configuration object
- **AND** the model SHALL be available for command construction

#### Scenario: Command without model configuration

- **WHEN** a command is configured without a `COMMAND_<NAME>_MODEL` environment variable
- **THEN** the system SHALL load the command successfully without a model property
- **AND** the command SHALL execute using opencode's default model behavior

#### Scenario: Invalid model configuration

- **WHEN** `COMMAND_<NAME>_MODEL` contains shell injection characters (e.g., `;`, `|`, `&`)
- **THEN** the system SHALL log a warning or error
- **AND** the system SHALL either sanitize or reject the model value

## MODIFIED Requirements

### Requirement: opencode Command Execution

The system SHALL execute opencode commands with the correct prompt format and optional model parameter within tmux sessions.

#### Scenario: Successful command construction

- **WHEN** a `/proposal` command with prompt text "调研以下glm4.7和mini max的各项指标的差异" is received
- **THEN** the system SHALL construct the command: `opencode --prompt "/proposal 调研以下glm4.7和mini max的各项指标的差异"`
- **AND** the command SHALL be passed to the tmux session manager

#### Scenario: Command construction with model parameter

- **WHEN** a command is configured with a model (e.g., `COMMAND_RESEARCH_MODEL=opencode/glm-4.7-free`)
- **AND** a user sends the command with prompt text
- **THEN** the system SHALL construct the command: `cd <dir> && opencode --prompt="<prompt> <text>" --model="opencode/glm-4.7-free"`
- **AND** the model parameter SHALL be properly quoted to prevent injection
- **AND** the command SHALL be passed to the tmux session manager

#### Scenario: Command execution within tmux

- **WHEN** a constructed opencode command is ready for execution
- **THEN** the system SHALL request tmux session manager to execute the command
- **AND** the execution SHALL be logged with timestamp and command details
