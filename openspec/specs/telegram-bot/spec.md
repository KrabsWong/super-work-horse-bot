# telegram-bot Specification

## Purpose
Telegram Bot 服务端实现，接收用户命令并执行 AI 编码工作流。

## Requirements

### Requirement: Bot Initialization and Connection

The system SHALL initialize a Telegram bot using the Telegraf framework and establish a connection to the Telegram API using a valid bot token from environment configuration.

#### Scenario: Successful bot startup with valid token

- **WHEN** the server starts with a valid TELEGRAM_BOT_TOKEN in environment variables
- **THEN** the bot SHALL successfully connect to Telegram API
- **AND** the bot SHALL start polling for updates
- **AND** a success message SHALL be logged

#### Scenario: Startup failure with missing token

- **WHEN** the server starts without TELEGRAM_BOT_TOKEN in environment variables
- **THEN** the bot SHALL fail to start
- **AND** an error message SHALL be logged indicating missing token
- **AND** the process SHALL exit with non-zero exit code

#### Scenario: Startup failure with invalid token

- **WHEN** the server starts with an invalid TELEGRAM_BOT_TOKEN
- **THEN** the bot SHALL fail to authenticate with Telegram API
- **AND** an error message SHALL be logged indicating authentication failure
- **AND** the process SHALL exit with non-zero exit code

### Requirement: Slash Command Registration

The system SHALL register and handle the `/proposal` slash command from Telegram users.

#### Scenario: User sends valid proposal command

- **WHEN** a user sends `/proposal <prompt text>` in a Telegram chat with the bot
- **THEN** the bot SHALL parse the command and extract the prompt text
- **AND** the bot SHALL acknowledge receipt with a confirmation message
- **AND** the command SHALL be forwarded to the command execution system

#### Scenario: User sends proposal command without arguments

- **WHEN** a user sends `/proposal` without any additional text
- **THEN** the bot SHALL respond with a usage message explaining the required format
- **AND** no command execution SHALL be triggered

#### Scenario: User sends unrecognized command

- **WHEN** a user sends a command that is not `/proposal`
- **THEN** the bot SHALL respond with a help message listing available commands
- **AND** no command execution SHALL be triggered

### Requirement: Message Logging and Error Handling

The system SHALL log all received messages and handle Telegram API errors gracefully without crashing.

#### Scenario: Successful message processing

- **WHEN** any message is received from Telegram API
- **THEN** the message content, user ID, and timestamp SHALL be logged
- **AND** the message SHALL be processed according to its type

#### Scenario: Telegram API temporary failure

- **WHEN** a Telegram API call fails with a temporary error (network timeout, rate limit)
- **THEN** the bot SHALL retry the request with exponential backoff
- **AND** the error SHALL be logged
- **AND** the bot SHALL continue running without crashing

#### Scenario: Telegram API permanent failure

- **WHEN** a Telegram API call fails with a permanent error (invalid request format)
- **THEN** the bot SHALL log the error with full details
- **AND** the bot SHALL send a generic error message to the user
- **AND** the bot SHALL continue running without crashing

### Requirement: Command Acknowledgment

The system SHALL send immediate acknowledgment messages to users when commands are received and track the message for subsequent updates.

#### Scenario: Command execution starts

- **WHEN** a valid `/proposal` command is received and parsed
- **THEN** the bot SHALL immediately send a single message indicating the task status
- **AND** the message_id SHALL be stored for future updates
- **AND** the message SHALL include task ID and relevant details
- **AND** the command SHALL proceed to execution phase

### Requirement: Message State Tracking

The system SHALL track Telegram message IDs for task status updates and use message editing to update existing messages rather than sending new messages.

#### Scenario: Task message creation

- **WHEN** a task is created from a command
- **THEN** the system SHALL send a single initial status message
- **AND** the message_id SHALL be stored with the task
- **AND** no additional "task started" messages SHALL be sent

#### Scenario: Task progress update

- **WHEN** a task's status changes during execution
- **THEN** the system SHALL use Telegram's `editMessageText` API to update the existing message
- **AND** the message content SHALL reflect the current task status
- **AND** no new messages SHALL be created for status updates

#### Scenario: Task completion update

- **WHEN** a monitored task completes successfully
- **THEN** the system SHALL edit the existing task message to show completion status
- **AND** the message SHALL include task ID, duration, and cleanup count
- **AND** only ONE completion notification SHALL be sent (not multiple)

#### Scenario: Task error or timeout update

- **WHEN** a task fails, times out, or ends unexpectedly
- **THEN** the system SHALL edit the existing task message to show error status
- **AND** the message SHALL include relevant error details