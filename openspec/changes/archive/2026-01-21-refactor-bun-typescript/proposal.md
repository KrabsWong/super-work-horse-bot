# Change: Refactor to Pure TypeScript with Bun-Native Patterns

## Why

The project currently uses plain JavaScript with JSDoc type annotations, which lacks full type safety and IDE support. Bun natively supports TypeScript without a build step, making it ideal for this project. Converting to TypeScript will:
- Improve code quality through static type checking
- Enable better IDE autocomplete and error detection
- Leverage Bun-specific APIs and patterns
- Reduce boilerplate by replacing JSDoc with native TS types

## What Changes

- **BREAKING**: All `.js` files renamed to `.ts`
- Replace JSDoc type annotations with native TypeScript types
- Replace `import { exec } from 'child_process'` with Bun-native `Bun.spawn()` API
- Replace `Bun.env` access with typed environment configuration
- Add proper TypeScript interfaces for all data structures (command configs, execution results, etc.)
- Update `package.json` to use `.ts` entry point
- Add `tsconfig.json` with Bun-recommended configuration
- Leverage Bun's native file I/O APIs where applicable

## Impact

- Affected specs: None (behavior unchanged, only code style)
- Affected code: All files in `src/` directory
  - `src/index.js` → `src/index.ts`
  - `src/bot/handlers.js` → `src/bot/handlers.ts`
  - `src/bot/middleware.js` → `src/bot/middleware.ts`
  - `src/commands/executor.js` → `src/commands/executor.ts`
  - `src/config/env.js` → `src/config/env.ts`
  - `src/tmux/session.js` → `src/tmux/session.ts`
- New files: `tsconfig.json`, `src/types/index.ts`

## Bun-Specific Features to Leverage

1. **Native TypeScript**: No transpilation needed, direct execution
2. **Bun.spawn()**: Replace promisified `child_process.exec` with native Bun subprocess API
3. **Bun.env**: Already used, add proper typing
4. **Type-safe imports**: Remove `.js` extensions in imports (Bun handles this)
