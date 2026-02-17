# Filament Tests

This project uses Node.js 24's native test runner with [test-battery](https://www.npmjs.com/package/test-battery) for assertions.

## Running Tests

```bash
npm test
```

This will run all test files in the `tests/` directory.

## Test Structure

The tests are organized as follows:

- `tests/router.test.ts` - Tests for path routing utilities (pathToRegex, matchPath)
- `tests/response.test.ts` - Tests for the Response implementation
- `tests/application.test.ts` - Integration tests for the Application class

## Writing Tests

Tests use Node.js's built-in test runner:

```typescript
import { describe, it } from 'node:test';
import { equal, deepEqual, throws } from 'test-battery/assert';

describe('My feature', () => {
  it('should do something', () => {
    equal(1 + 1, 2, 'math should work');
  });
});
```

### Available Assertions from test-battery

- `equal(actual, expected, message)` - Strict equality (===)
- `deepEqual(actual, expected, message)` - Deep equality for objects/arrays
- `throws(fn, expectedError, message)` - Assert function throws
- And many more from test-battery's assertion library

## Test Coverage

The test suite covers:

- **Router utilities**: Path parsing, parameter extraction, route matching
- **Response handling**: Status codes, headers, JSON/text responses, error cases
- **Application features**: Route registration, middleware chain, error handling, finalizers, transformers
- **Integration**: Full request/response cycle with actual HTTP server

## Notes

- Tests use Node 24's experimental TypeScript support (`--experimental-strip-types`)
- Integration tests start HTTP servers on high-numbered ports (9876+)
- Tests clean up resources (close servers) after completion
