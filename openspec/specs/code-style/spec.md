# code-style Specification

## Purpose
TBD - created by archiving change refactor-bun-typescript. Update Purpose after archive.
## Requirements
### Requirement: TypeScript Code Standard

The codebase SHALL use TypeScript as the primary programming language with Bun-native patterns.

#### Scenario: Source files use TypeScript extension

- **WHEN** a new source file is created in the `src/` directory
- **THEN** the file SHALL have a `.ts` extension
- **AND** the file SHALL contain valid TypeScript code

#### Scenario: Type annotations for function signatures

- **WHEN** a function is defined
- **THEN** all parameters SHALL have explicit type annotations
- **AND** the return type SHALL be explicitly declared
- **AND** JSDoc type annotations SHALL NOT be used for type information

#### Scenario: Shared types in central location

- **WHEN** a type or interface is used across multiple modules
- **THEN** it SHALL be defined in `src/types/index.ts`
- **AND** it SHALL be exported for use by other modules

### Requirement: Bun-Native API Usage

The system SHALL use Bun-native APIs instead of Node.js compatibility APIs where Bun provides a native alternative.

#### Scenario: Subprocess execution uses Bun.spawn

- **WHEN** a shell command needs to be executed
- **THEN** the system SHALL use `Bun.spawn()` or `Bun.spawnSync()` API
- **AND** the system SHALL NOT use `child_process.exec` or `child_process.spawn`
- **AND** subprocess output SHALL be read from the stdout stream

#### Scenario: Environment variables accessed via Bun.env

- **WHEN** environment variables need to be accessed
- **THEN** the system SHALL use `Bun.env` property
- **AND** environment variable access SHALL be type-safe through configuration module

### Requirement: TypeScript Configuration

The project SHALL maintain a `tsconfig.json` file with Bun-optimized settings.

#### Scenario: TypeScript compilation check passes

- **WHEN** `bun run tsc --noEmit` is executed
- **THEN** no type errors SHALL be reported
- **AND** all source files SHALL be checked

#### Scenario: Module resolution follows Bun conventions

- **WHEN** importing from another module
- **THEN** import paths SHALL NOT include file extensions
- **AND** the TypeScript module resolution SHALL be set to "bundler"

