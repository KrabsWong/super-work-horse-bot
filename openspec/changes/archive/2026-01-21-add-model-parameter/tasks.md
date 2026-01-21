# Implementation Tasks

## 1. Configuration Changes
- [x] 1.1 Update loadCommandConfigs() in src/config/env.js to parse COMMAND_<NAME>_MODEL environment variables
- [x] 1.2 Add model property to command configuration object
- [x] 1.3 Update .env.example with COMMAND_<NAME>_MODEL examples

## 2. Command Building
- [x] 2.1 Modify buildCommandWithDirectory() in src/commands/executor.js to include --model parameter when configured
- [x] 2.2 Ensure model parameter is properly formatted and positioned in command string
- [x] 2.3 Add logging for model parameter when present

## 3. Documentation
- [x] 3.1 Update README.md with model parameter configuration instructions
- [x] 3.2 Add example showing how to configure model for a command

## 4. Testing
- [x] 4.1 Manual test: Configure a command with model parameter
- [x] 4.2 Manual test: Verify command executes with correct --model flag
- [x] 4.3 Manual test: Verify backward compatibility (commands without model still work)
- [x] 4.4 Manual test: Test with GLM-4.7 model specifically ("opencode/glm-4.7-free")
