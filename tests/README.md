# Filament Tests

This project uses Node.js's native test runner with
[test-battery](https://www.npmjs.com/package/test-battery) for assertions.

## Running Tests

```bash
npm test

# Run the same suite and print line, branch, and function coverage
npm run test:coverage
```

This will run all test files in the `tests/` directory.

## Test Structure

The tests are organized as follows:

- `tests/router.test.ts` - Tests for path routing utilities (pathToRegex, matchPath)
- `tests/headers.test.ts` - Tests for header mutation, repeatability, bulk
  operations, canonicalization, and freezing
- `tests/tools.test.ts` - Tests for metadata merging and header-name normalization
- `tests/response.test.ts` - Tests for the Response implementation
- `tests/application.test.ts` - Integration tests for the Application class
- `tests/examples.test.ts` - Compile and HTTP contract tests for every example
- `tests/request-isolation.test.ts` - 360 interleaved requests checking for
  crosstalk in routing, middleware, transformers, and exception handlers

## Writing Tests

Tests use Node.js's built-in test runner:

```typescript
import { suite } from 'node:test';
import TestBattery from 'test-battery';

suite('My feature', () => {
  TestBattery.test('should do something', battery => {
    battery.test('math works').value(1 + 1).value(2).equal;
  });
});
```

Some focused unit tests use `node:assert/strict` directly. Application and
lifecycle tests use TestBattery's fluent assertions so asynchronous values can
be evaluated through the same test declaration.


## Test Coverage

`npm run test:coverage` uses Node's built-in V8 coverage and prints a summary at
the end of the run. Rate coverage by the uncovered behavior, not just one
percentage:

- Lines show how much implementation code executed.
- Branches reveal missed condition/error paths and are usually the most useful
  signal for this framework.
- Functions reveal callbacks or lifecycle hooks that never ran.
- The HTML-free terminal report includes uncovered line numbers to prioritize.

The coverage command enforces at least 90% lines, 95% functions, and 85%
branches in `src/`. Require coverage not to regress in review, and accompany it
with the lifecycle, HTTP contract, concurrency-isolation, and future performance
tests. The OAuth examples run in child processes; their behavior is rated by
their compile and HTTP contract tests rather than the parent process's V8 line
coverage.

The test suite covers:

- **Router utilities**: Path parsing, parameter extraction, route matching
- **Response handling**: Status codes, headers, JSON/text responses, error cases
- **Application features**: Route registration, middleware chain, error handling, finalizers, transformers
- **Integration**: Full request/response cycle with actual HTTP server

## Notes

- `npm test` compiles TypeScript before invoking Node's test runner.
- Integration tests start HTTP servers on high-numbered ports (9876+)
- Tests clean up resources (close servers) after completion
