# Change: Add Model Parameter Support for opencode Commands

## Why

Currently, the bot only supports the `--prompt` parameter when executing opencode commands. Users need the ability to specify which AI model to use (e.g., "opencode/glm-4.7-free") to take advantage of different models for different use cases. This enables users to select models based on cost, performance, or specific capabilities.

## What Changes

- Add `COMMAND_<NAME>_MODEL` environment variable configuration support
- Modify command construction logic to include `--model` parameter when configured
- Update command execution to pass model parameter to opencode CLI
- Extend configuration validation to support optional model parameter

## Impact

- **Affected specs**: command-execution
- **Affected code**: 
  - src/config/env.js (loadCommandConfigs function)
  - src/commands/executor.js (buildCommandWithDirectory function)
- **Breaking changes**: None (backward compatible - model parameter is optional)
- **Migration**: Users can optionally add `COMMAND_<NAME>_MODEL` to their .env file to specify models
