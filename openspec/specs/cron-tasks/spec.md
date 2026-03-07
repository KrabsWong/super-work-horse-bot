# cron-tasks Specification

## Purpose

Provides Markdown-based scheduled task configuration with natural language time expressions and LLM-powered task planning for automated execution of AI coding workflows.

## Requirements

### Requirement: Markdown Task Configuration

The system SHALL support Markdown-based task configuration files with YAML frontmatter in the `cron/` directory.

#### Scenario: Parse valid task configuration

- **WHEN** a Markdown file is placed in the `cron/` directory
- **AND** the file contains valid YAML frontmatter with `name`, `schedule`, `messenger` fields
- **THEN** the system SHALL parse the configuration
- **AND** register the task in the scheduler

#### Scenario: Invalid configuration handling

- **WHEN** a task file has invalid YAML frontmatter
- **OR** missing required fields
- **THEN** the system SHALL log an error with the file name
- **AND** skip that task without affecting other tasks

#### Scenario: File change detection

- **WHEN** a task file is created, modified, or deleted in the `cron/` directory
- **THEN** the system SHALL reload affected tasks
- **AND** log the change

### Requirement: Natural Language Time Expression

The system SHALL support natural language time expressions for task scheduling.

#### Scenario: Parse daily schedule

- **WHEN** a task has `schedule: 每天 08:00`
- **THEN** the system SHALL convert it to cron expression `0 8 * * *`
- **AND** schedule the task accordingly

#### Scenario: Parse weekly schedule

- **WHEN** a task has `schedule: 每周一 09:00`
- **THEN** the system SHALL convert it to cron expression `0 9 * * 1`

#### Scenario: Parse weekday schedule

- **WHEN** a task has `schedule: 工作日 09:00`
- **THEN** the system SHALL convert it to cron expression `0 9 * * 1-5`

#### Scenario: Unsupported time expression

- **WHEN** a time expression cannot be matched by any rule
- **THEN** the system SHALL log an error
- **AND** the task SHALL be disabled with an error status

### Requirement: LLM Task Planner

The system SHALL use LLM to parse task descriptions and generate execution plans.

#### Scenario: Generate execution plan

- **WHEN** a scheduled task is triggered
- **THEN** the system SHALL send the task description to LLM
- **AND** receive an execution plan with steps
- **AND** execute each step in order

#### Scenario: Multi-step execution

- **WHEN** an execution plan contains multiple steps
- **THEN** the system SHALL execute steps sequentially
- **AND** pass output files from one step as input to the next
- **AND** stop execution if any step fails

#### Scenario: Send result to messenger

- **WHEN** all steps complete successfully
- **THEN** the system SHALL send a summary message (max 500 chars)
- **AND** attach the final output file
- **AND** send to the configured messenger platform

### Requirement: Unified Command System

The system SHALL provide a unified command interface for task management.

#### Scenario: Execute command with /run

- **WHEN** user sends `/run <command> <args>`
- **THEN** the system SHALL execute the specified command
- **AND** create a task for tracking

#### Scenario: View task status with /jobs

- **WHEN** user sends `/jobs`
- **THEN** the system SHALL display all running and queued tasks
- **AND** show task type (scheduled/manual), command, duration

#### Scenario: Stop running task with /jobs stop

- **WHEN** user sends `/jobs stop <taskId>`
- **AND** the task is currently running
- **THEN** the system SHALL send SIGINT to the opencode process
- **AND** notify the user

#### Scenario: Cancel queued task with /jobs cancel

- **WHEN** user sends `/jobs cancel <taskId>`
- **AND** the task is in queue
- **THEN** the system SHALL remove the task from queue
- **AND** notify the user

#### Scenario: View scheduled tasks with /cron

- **WHEN** user sends `/cron`
- **THEN** the system SHALL list all scheduled tasks
- **AND** show name, schedule, next run time, enabled status

#### Scenario: View task details with /cron show

- **WHEN** user sends `/cron show <name>`
- **THEN** the system SHALL display the task configuration
- **AND** show the task description

#### Scenario: Manually trigger task with /cron run

- **WHEN** user sends `/cron run <name>`
- **THEN** the system SHALL trigger the task immediately
- **AND** create a tracked task execution

#### Scenario: Enable task with /cron enable

- **WHEN** user sends `/cron enable <name>`
- **THEN** the system SHALL set the task enabled flag to true
- **AND** schedule the task

#### Scenario: Disable task with /cron disable

- **WHEN** user sends `/cron disable <name>`
- **THEN** the system SHALL set the task enabled flag to false
- **AND** unschedule the task
