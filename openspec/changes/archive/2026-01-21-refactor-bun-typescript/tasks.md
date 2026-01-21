## 1. Setup TypeScript Infrastructure

- [x] 1.1 Create `tsconfig.json` with Bun-optimized configuration
- [x] 1.2 Add `bun-types` to devDependencies in `package.json`
- [x] 1.3 Create `src/types/index.ts` with shared type definitions

## 2. Convert Configuration Module

- [x] 2.1 Rename `src/config/env.js` to `src/config/env.ts`
- [x] 2.2 Add typed interfaces for `Config` and `CommandConfig`
- [x] 2.3 Type all function parameters and return values
- [x] 2.4 Ensure `Bun.env` access is properly typed

## 3. Convert Tmux Session Module

- [x] 3.1 Rename `src/tmux/session.js` to `src/tmux/session.ts`
- [x] 3.2 Replace `child_process.exec` with `Bun.spawn()` API
- [x] 3.3 Add typed interfaces for tmux operation results
- [x] 3.4 Remove `promisify` import (no longer needed)
- [x] 3.5 Type all function parameters and return values

## 4. Convert Commands Module

- [x] 4.1 Rename `src/commands/executor.js` to `src/commands/executor.ts`
- [x] 4.2 Add `ExecutionResult` and `ValidationResult` type usage
- [x] 4.3 Type all function parameters and return values
- [x] 4.4 Update imports to use extensionless paths

## 5. Convert Bot Middleware Module

- [x] 5.1 Rename `src/bot/middleware.js` to `src/bot/middleware.ts`
- [x] 5.2 Add Telegraf context types (`Context` from telegraf)
- [x] 5.3 Type middleware functions with proper Telegraf types

## 6. Convert Bot Handlers Module

- [x] 6.1 Rename `src/bot/handlers.js` to `src/bot/handlers.ts`
- [x] 6.2 Add Telegraf context types for all handlers
- [x] 6.3 Type the `createCommandHandler` higher-order function
- [x] 6.4 Update imports to use extensionless paths

## 7. Convert Main Entry Point

- [x] 7.1 Rename `src/index.js` to `src/index.ts`
- [x] 7.2 Type the `Telegraf` instance with proper generics
- [x] 7.3 Update imports to use extensionless paths
- [x] 7.4 Ensure signal handlers are properly typed

## 8. Update Package Configuration

- [x] 8.1 Update `package.json` main field to `src/index.ts`
- [x] 8.2 Update scripts to point to `.ts` files
- [x] 8.3 Verify `bun start` and `bun dev` work correctly

## 9. Cleanup and Verification

- [x] 9.1 Remove all old `.js` files from `src/`
- [x] 9.2 Run `bun run tsc --noEmit` to verify type checking passes
- [x] 9.3 Run bot and test `/start`, `/help`, `/proposal` commands manually
- [x] 9.4 Update `openspec/project.md` to reflect TypeScript code style

## Dependencies

- Task 1 must complete before all others
- Task 2 must complete before Tasks 3-7
- Task 3 must complete before Task 4
- Tasks 5, 6 can run in parallel with Tasks 3, 4
- Task 7 requires Tasks 2-6 to complete
- Task 8 requires Task 7 to complete
- Task 9 requires Task 8 to complete
