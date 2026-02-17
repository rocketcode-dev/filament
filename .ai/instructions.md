# Filament AI Development Guidelines

## Architecture-specific patterns

- **Meta merging**: Shallow merge with defaults - **arrays replace, not merge**
- **Response flow order**: Middleware → Handler → Transformers → Finalizers
  - Transformers only run on success
  - Finalizers always run (even on errors)
- **Type pattern**: All classes use `<T extends FrameworkMeta>` generic

## Coding standards

- Lines under 80 columns when possible
- Comments are to document design and usage, not to repeat code.
- When updating code, ensure that the READMEs and test cases are also up to date whith your changes.

### Typescript

- imports should be in this order: Native, public libraries, local modules. Alphabetize within this order. Local modules may be difficult to alphabetize, just do your best.

### Markdown

- Markdowns should have an empty line after all headers and before all lists.

### Testing (Non-standard tooling)

- **Assertions**: `test-battery` library, NOT chai/assert
- **Test framework**: Node.js native test runner (`node:test`), NOT mocha/jest.
  - Favour the native name `suite`, not its aliases like `describe`. Use
    `test-battery` to handle the `test` part.
- Integration tests use real HTTP servers on high-numbered ports (9876+)

```typescript
import { describe, it } from 'node:test';
import TestBattery from 'test-battery';
```

## Protected files

DO NOT modify: `/dist/*`, `package-lock.json`, `tsconfig.json` (ask first)

## Adding route methods

Follow pattern in `application.ts:62-81` - must update Route type and add handler
