## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Command Acknowledgment

The system SHALL send immediate acknowledgment messages to users when commands are received and track the message for subsequent updates.

#### Scenario: Command execution starts

- **WHEN** a valid command is received and parsed
- **THEN** the bot SHALL immediately send a single message indicating the task status
- **AND** the message_id SHALL be stored for future updates
- **AND** the message SHALL include task ID and relevant details
- **AND** the command SHALL proceed to execution phase

## REMOVED Requirements

### Requirement: Duplicate Completion Notification

**Reason**: The TaskManager completion callback sends a redundant completion message that duplicates the monitor's notification.

**Migration**: Remove the `taskManager.setTaskCompletionCallback()` in `src/index.ts`. The monitor's notification is sufficient and will be updated via message editing.