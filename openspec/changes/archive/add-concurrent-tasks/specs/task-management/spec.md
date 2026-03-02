# Task Management Capability

## ADDED Requirements

### Requirement: Concurrent Task Execution

The system SHALL support concurrent execution of multiple tasks for the same command type, with each task running in an independent tmux session and independent git branch.

#### Scenario: Single task execution

- **GIVEN** system is configured with `maxConcurrent: 3`
- **WHEN** user sends `/research analyze Tesla`
- **THEN** system creates task `task-{timestamp}-{random}`
- **AND** task executes in tmux session `research-bot-{taskId}`
- **AND** task uses branch `task-{taskId}`
- **AND** returns task ID, session name, and branch name

#### Scenario: Multiple concurrent tasks

- **GIVEN** system is configured with `maxConcurrent: 3`
- **AND** one task is currently running
- **WHEN** user sends new `/research analyze Apple`
- **THEN** system creates a second task
- **AND** both tasks run concurrently in their respective tmux sessions
- **AND** both tasks use independent branches

#### Scenario: Concurrency limit reached

- **GIVEN** system is configured with `maxConcurrent: 3`
- **AND** three tasks are currently running
- **WHEN** user sends new `/research analyze Google`
- **THEN** task enters queue and waits
- **AND** returns queue position information
- **AND** automatically starts execution when a slot becomes available

---

### Requirement: Task Queue Management

The system SHALL maintain a task queue with First-In-First-Out (FIFO) scheduling.

#### Scenario: Task enqueue

- **GIVEN** all concurrency slots are occupied
- **WHEN** user sends new task request
- **THEN** task is added to queue
- **AND** returns queue position
- **AND** user receives queue notification

#### Scenario: Task dequeue

- **GIVEN** tasks are waiting in queue
- **WHEN** running task completes and releases slot
- **THEN** first task in queue automatically starts execution
- **AND** user is notified that task has started

#### Scenario: Cancel queued task

- **GIVEN** task is waiting in queue
- **WHEN** user sends `/cancel {taskId}`
- **THEN** task is removed from queue
- **AND** queue positions of subsequent tasks are updated

---

### Requirement: Task Status Tracking

The system SHALL provide task status query functionality.

#### Scenario: Query all task status

- **GIVEN** system has running and queued tasks
- **WHEN** user sends `/status`
- **THEN** returns list of running tasks (with task ID, description, duration, branch)
- **AND** returns list of queued tasks (with task ID, description, queue position)

#### Scenario: Query specific task status

- **GIVEN** task exists
- **WHEN** user sends `/status {taskId}`
- **THEN** returns detailed status of that task

---

### Requirement: Branch Isolation Strategy

The system SHALL create an independent git branch for each task, ensuring complete isolation of changes.

#### Scenario: Task branch creation

- **GIVEN** user sends `/research analyze Tesla`
- **WHEN** task starts execution
- **THEN** system syncs local main branch with remote
- **AND** system creates new branch `task-{taskId}` from main
- **AND** task executes in this branch

#### Scenario: Main branch sync

- **GIVEN** local main branch is behind remote
- **WHEN** task is about to start
- **THEN** system executes `git fetch origin main`
- **AND** system executes `git reset --hard origin/main`
- **AND** new branch is created from latest main

#### Scenario: Task branch naming

- **GIVEN** task ID is `task-1709123456789-abc123`
- **WHEN** branch is created
- **THEN** branch name is `task-1709123456789-abc123`

---

### Requirement: PR Management

The system SHALL create a Pull Request for each completed task and support configurable merge strategies.

#### Scenario: Task completion with PR creation

- **GIVEN** task has completed its work
- **WHEN** task finishes execution
- **THEN** system commits all changes
- **AND** system pushes branch to remote
- **AND** system creates PR with task description

#### Scenario: Manual merge strategy (default)

- **GIVEN** command is configured with `prMergeStrategy: manual`
- **WHEN** PR is created
- **THEN** Telegram message is sent with PR link
- **AND** message includes interactive buttons (Merge, Close, View)
- **AND** PR remains open until user action

#### Scenario: Auto merge strategy

- **GIVEN** command is configured with `prMergeStrategy: auto`
- **WHEN** PR is created
- **THEN** PR is automatically merged
- **AND** Telegram message confirms auto-merge
- **AND** branch is deleted after merge

#### Scenario: PR merge via button

- **GIVEN** PR is open and user clicks "Merge PR" button
- **WHEN** merge operation is triggered
- **THEN** PR is merged into main
- **AND** branch is deleted
- **AND** user receives confirmation message

#### Scenario: PR close via button

- **GIVEN** PR is open and user clicks "Close PR" button
- **WHEN** close operation is triggered
- **THEN** PR is closed without merging
- **AND** branch is deleted
- **AND** user receives confirmation message

---

### Requirement: Configurable Concurrency

The system SHALL support configuration of maximum concurrent tasks per command.

#### Scenario: Use configured concurrency

- **GIVEN** config file sets `maxConcurrent: 5`
- **WHEN** system initializes
- **THEN** command allows maximum 5 concurrent tasks

#### Scenario: Use default concurrency

- **GIVEN** config file does not set `maxConcurrent`
- **WHEN** system initializes
- **THEN** default value of 3 is used

#### Scenario: Limit concurrency to 1

- **GIVEN** config file sets `maxConcurrent: 1`
- **WHEN** system runs
- **THEN** only one task can execute at a time
- **AND** new tasks enter queue and wait

---

### Requirement: Configurable PR Merge Strategy

The system SHALL support configuration of PR merge strategy per command.

#### Scenario: Use manual merge strategy

- **GIVEN** config file sets `prMergeStrategy: manual`
- **WHEN** PR is created
- **THEN** PR requires manual user action to merge

#### Scenario: Use auto merge strategy

- **GIVEN** config file sets `prMergeStrategy: auto`
- **WHEN** PR is created
- **THEN** PR is automatically merged

#### Scenario: Use default merge strategy

- **GIVEN** config file does not set `prMergeStrategy`
- **WHEN** system initializes
- **THEN** default value `manual` is used

---

### Requirement: Resource Cleanup

The system SHALL clean up related resources when tasks complete, fail, or are cancelled.

#### Scenario: Task completes normally

- **GIVEN** task execution completes
- **WHEN** monitor detects completion signal
- **THEN** monitoring stops
- **AND** tmux session is cleaned up
- **AND** status file is deleted
- **AND** concurrency slot is released
- **AND** PR is created for the branch

#### Scenario: Task timeout

- **GIVEN** task runs longer than maximum duration (1 hour)
- **WHEN** monitor detects timeout
- **THEN** opencode process is forcefully terminated
- **AND** resource cleanup process executes

#### Scenario: Task cancellation

- **GIVEN** user sends cancel command
- **WHEN** cancellation is processed
- **THEN** task is stopped
- **AND** related resources are cleaned up
- **AND** uncommitted branch may be deleted (optional)

#### Scenario: PR merged or closed

- **GIVEN** PR is merged or closed
- **WHEN** merge/close completes
- **THEN** remote branch is deleted
- **AND** local branch may be cleaned up