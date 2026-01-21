## Context

This project is a Telegram bot server running on Bun v1+. Currently written in ES6 JavaScript with JSDoc annotations for type hints. Bun provides first-class TypeScript support with zero configuration, making this an ideal candidate for TypeScript migration.

**Stakeholders**: Developers maintaining this codebase

**Constraints**:
- Must maintain backward compatibility with existing behavior
- Must not change any external interfaces (Telegram commands, environment variables)
- Must work with existing Telegraf v4.x types

## Goals / Non-Goals

**Goals**:
- Convert all JS files to TypeScript with proper static typing
- Replace Node.js-style patterns with Bun-native alternatives
- Improve type safety and developer experience
- Maintain 100% functional parity with current implementation

**Non-Goals**:
- Changing application behavior or features
- Adding new functionality
- Modifying the bot's command interface
- Changing environment variable names

## Decisions

### Decision 1: Use Bun's Native Subprocess API

**What**: Replace `child_process.exec` with `Bun.spawn()` and `Bun.spawnSync()`

**Why**: 
- Bun.spawn() is faster and more memory-efficient
- Returns typed subprocess objects with built-in Promise support
- Better error handling with structured exit codes
- No need for `promisify` wrapper

**Current** (Node.js style):
```javascript
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
const { stdout, stderr } = await execAsync('tmux -V');
```

**Proposed** (Bun-native):
```typescript
const proc = Bun.spawn(['tmux', '-V']);
const stdout = await new Response(proc.stdout).text();
const exitCode = await proc.exited;
```

### Decision 2: Centralized Type Definitions

**What**: Create `src/types/index.ts` with all shared interfaces

**Why**:
- Single source of truth for type definitions
- Easier to maintain and update
- Better code organization
- Enables type reuse across modules

**Types to define**:
```typescript
interface CommandConfig {
  dir: string;
  prompt: string;
  session: string;
  model?: string;
}

interface Config {
  telegramBotToken: string;
  tmuxSessionName: string;
  logLevel: string;
  commands: Record<string, CommandConfig>;
}

interface ExecutionResult {
  success: boolean;
  error?: string;
  output?: string;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitizedArgs?: string;
}
```

### Decision 3: tsconfig.json Configuration

**What**: Use Bun-optimized TypeScript configuration

**Why**: 
- Bun has specific module resolution requirements
- Need to enable modern TS features
- Align with Bun's native handling

**Proposed config**:
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["bun-types"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### Decision 4: Import Path Strategy

**What**: Remove `.js` extensions from imports, use extensionless imports

**Why**:
- Bun's module resolver handles this natively
- Cleaner import statements
- Standard TypeScript convention

**Before**: `import { config } from './config/env.js'`
**After**: `import { config } from './config/env'`

## Alternatives Considered

### Alternative: Use JSDoc with TypeScript checking
- **Rejected because**: Requires more boilerplate, less type inference, doesn't leverage Bun's native TS support

### Alternative: Keep child_process with proper types
- **Rejected because**: Misses opportunity to use Bun-native APIs which are more performant and better typed

### Alternative: Type definitions inline in each file
- **Rejected because**: Leads to duplication and harder maintenance

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Telegraf types may not match runtime exactly | Use `@types/telegraf` if available, or `any` with comments for edge cases |
| Bun.spawn behavior differs from exec | Test all tmux operations manually during migration |
| Breaking changes for contributors | Update README with new development setup |

## Migration Plan

1. **Preparation**
   - Add `tsconfig.json` and `bun-types`
   - Create `src/types/index.ts` with interfaces

2. **File-by-file conversion** (in dependency order)
   - `src/types/index.ts` (new)
   - `src/config/env.ts` (no dependencies)
   - `src/tmux/session.ts` (config dependency)
   - `src/commands/executor.ts` (config, tmux dependencies)
   - `src/bot/middleware.ts` (no dependencies)
   - `src/bot/handlers.ts` (commands, config dependencies)
   - `src/index.ts` (all dependencies)

3. **Update configuration**
   - Update `package.json` main and scripts
   - Remove old `.js` files after verification

4. **Verification**
   - Run type checking: `bun run tsc --noEmit`
   - Manual testing of all bot commands

## Open Questions

- None at this time. The migration path is straightforward given Bun's native TypeScript support.
