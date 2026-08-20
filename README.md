# Filament

A TypeScript API framework with metadata-driven middleware. Similar in purpose to Express but organized around typed endpoint metadata that controls middleware behavior.

## Why Filament?

### Best Features

- **Type-Safe Metadata**: Full TypeScript support means your middleware logic is validated at compile time
- **Low Runtime Overhead**: Metadata inspection is fast—no reflection or complex routing logic
- **Predictable Execution**: Registration order is everything—no magic, no surprises
- **Immutable Endpoint Metadata**: Middleware can't accidentally change route policy
- **Flexible Post-Processing**: Handle errors, transform responses, and finalize requests with dedicated hooks
- **Express-Familiar API**: If you know Express, you know Filament—intuitive and approachable
- **Minimal Dependencies**: Lightweight framework perfect for microservices and APIs
- **Strongly Typed Middleware**: Know exactly what metadata your middleware needs before writing a single line

## Core Concepts

### 1. Endpoint Metadata (`EndpointMeta`)

Every endpoint has metadata that describes its requirements and behavior. Middleware inspects this metadata to decide whether and how to execute.

```typescript
interface AppMeta extends FrameworkMeta {
  requiresAuth: boolean;
  rateLimit: number;
  logLevel: 'debug' | 'info' | 'error';
  tags: string[];
}
```

### 2. Default Metadata

You define a complete default metadata object when creating your app. Individual endpoints can override specific properties using `Partial<T>`.

### 3. Single Middleware Chain

All middleware runs in registration order. Each middleware inspects
`req.endpointMeta` and bows out when its policy does not apply. Returning with
an open response advances automatically; `send()`, `json()`, or `end()` makes
that middleware terminal.

### 4. Post-Request Processing

Three types of post-request handlers:

- **Error Handlers**: Run when errors occur
- **Response Transformers**: Modify buffered route responses before commit
- **Finalizers**: Always run, regardless of success/failure

## Quick Start

```typescript
import { createApp, FrameworkMeta } from 'filamentjs';

// Define your metadata interface
interface AppMeta extends FrameworkMeta {
  requiresAuth: boolean;
  rateLimit: number;
  logLevel: 'debug' | 'info' | 'error';
  tags: string[];
}

// Create default metadata
const defaultMeta: AppMeta = {
  application: { maxRequestSize: '2MiB' },
  requiresAuth: false,
  rateLimit: 100,
  logLevel: 'info',
  tags: [],
};

// Create app
const app = createApp<AppMeta>(defaultMeta);

// Add middleware that inspects metadata
app.use(async (req, res) => {
  if (req.endpointMeta.requiresAuth) {
    const token = req.headers.get('Authorization');
    if (!token) {
      await res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    // validate token...
  }
});

// Define endpoints with custom metadata
app.get('/public', {}, async (req, res) => {
  await res.json({ message: 'Public endpoint' });
});

app.get('/admin', 
  { requiresAuth: true, logLevel: 'debug' },
  async (req, res) => {
    await res.json({ message: 'Admin panel' });
  }
);

// Start server
const port = await app.listen(3000);
```

## API Reference

### `createApp<T>(defaultMeta: T): Application<T>`

Creates a new application instance with typed metadata.

**Parameters:**

- `defaultMeta`: Complete implementation of your metadata interface

**Returns:** Application instance

### Application Methods

#### HTTP Methods

```typescript
type RoutePart<T> = string | Partial<T> | AsyncRequestHandler<T>;

app.get(...parts: RoutePart<T>[]): void
app.post(...parts: RoutePart<T>[]): void
app.put(...parts: RoutePart<T>[]): void
app.patch(...parts: RoutePart<T>[]): void
app.delete(...parts: RoutePart<T>[]): void
```

A registration accepts one handler, one or more paths, and zero or more
metadata overrides. Metadata sources merge in argument order.

#### Middleware Registration

```typescript
app.use(middleware: AsyncRequestHandler<T>): void
```

Middleware is application-wide by design. Use `req.endpointMeta` inside the
middleware to decide whether its behavior applies to the matched endpoint.

#### Post-Request Handlers

```typescript
app.onError(handler: ErrorHandler<T>): void
app.onTransform(handler: ResponseTransformer<T>): void
app.onFinalize(handler: Finalizer<T>): void
```

#### Server Control

```typescript
app.listen(port: number): Promise<number>
app.close(): Promise<void>
```

## Request Object

```typescript
interface Request<T extends FrameworkMeta> {
  method: HttpMethod;
  path: string;
  params: Record<string, string>;
  query: Record<string, string | string[]>;
  headers: Headers;
  body?: Buffer;
  endpointMeta: Readonly<T>;
  context: Record<string, any>;
}
```

## Response Object

```typescript
interface Response {
  readonly statusCode: number;
  readonly headers: Headers;
  readonly closed: boolean;
  readonly committed: boolean;
  streaming: boolean;
  body: Buffer | string | null;
  status(code: number): Response;
  json(data: unknown): Promise<void>;
  send(data: string | Buffer): Promise<void>;
  sendChunk(data: string | Buffer): Promise<void>;
  end(): Promise<void>;
}
```

Read and mutate headers through `res.headers`, for example
`res.headers.set('Content-Type', 'text/plain')`.

## Request Lifecycle

![Filament request lifecycle, including terminal responses and exception flows](assets/request-lifecycle.svg)

```text
1. Incoming Request
   ↓
2. Route Matching → req.endpointMeta populated (readonly)
   ↓
3. Middleware Chain (in registration order)
   - Each middleware inspects req.endpointMeta
   - Returning with an open response continues automatically
   - Closing stops later middleware, the route handler, and transformers
   ↓
4. Route Handler executes
   - Filament supplies an implicit end if the handler leaves it open
   ↓
5. [If Buffered] Response Transformers (sequential, awaited)
   - Streaming responses always skip transformers
   ↓
6. Filament commits the route response

If an error is thrown in steps 2–5, error handlers run in registration order.
Whether processing succeeds, closes early, or enters error handling, finalizers
always run.
```

If middleware calls `send()`, `json()`, or `end()`, its response is terminal:
later middleware, the route handler, and transformers are skipped. A route
handler's closed response still proceeds through buffered transformers and
commit. Finalizers remain the always-run observation and cleanup stage.

## Response Transformers

Transformers receive buffered route responses after the handler completes and
before commit:

```typescript
app.get('/report', async (_req, res) => {
  await res.json({ ready: true });
});

app.onTransform(async (_req, res) => {
  res.headers.set('X-Transformed', 'true');
});
```

Calling `json()`, `send()`, or `end()` in a route handler closes its response but
does not bypass buffered transformation. Streaming responses never transform.
Middleware-produced and error-flow responses bypass transformers entirely.

## Headers

Header names are case-insensitive. Filament presents them in conventional
upper-kebab form, with common exceptions such as `ETag`, `TE`,
`WWW-Authenticate`, `Sec-WebSocket-Key`, and `RateLimit-Remaining`.

`Headers.add()` preserves multiple field lines for list-valued fields and the
special `Set-Cookie` response field. Known singleton fields—such as
`Content-Length`, `Content-Type`, `Host`, `Location`, and `ETag`—use the last
value. Unknown fields default to repeatable. Use `setRepeatable()` or the
`Headers` constructor options to override that policy for application-specific
fields.

## Path Parameters

Supports Express-style path parameters:

```typescript
app.get('/users/:id', {}, async (req, res) => {
  const userId = req.params.id;  // string
  res.json({ userId });
});

app.get('/posts/:postId/comments/:commentId', {}, async (req, res) => {
  const { postId, commentId } = req.params;
  res.json({ postId, commentId });
});
```

Static path text is matched literally, and parameter values are percent-decoded.

## Request Size Limit

`application.maxRequestSize` limits buffered POST, PUT, and PATCH request
bodies. It accepts a byte count or a case-insensitive byte-size string. Familiar
forms use binary multiples, so `2Mi`, `2MiB`, `2Mb`, and `2 MB` all normalize to
2097152 bytes. Oversized requests enter the error flow as `HttpError` responses
with status 413.

## Metadata Merging

- Endpoint metadata is deeply cloned and merged with defaults
- Arrays **always replace** (not concatenate)
- Default and endpoint metadata are deeply frozen at runtime

```typescript
const defaultMeta = {
  application: { maxRequestSize: '2MiB' },
  requiresAuth: false,
  tags: ['default'],
};

app.get('/endpoint', 
  { requiresAuth: true, tags: ['custom'] },  // tags replaces, not appends
  handler
);
// Result: { requiresAuth: true, tags: ['custom'] }
```

## Error Handling

Errors thrown anywhere in the request lifecycle are caught and passed to error
handlers:

```typescript
app.onError(async (err, req, res) => {
  console.error('Error:', err);
  await res.status(500).json({ error: err.message });
});
```

Routing failures use the same flow. Filament raises exported `HttpError`
instances for framework-detected failures such as malformed encoded parameters
(400), unmatched routes (404), and oversized request bodies (413). If a custom
error handler leaves the response open, Filament automatically tries the next
handler and eventually its default JSON response. Closing the response marks the
error as handled.

## Complete Example

See `src/example.ts` for a complete working example with:

- Authentication middleware
- Rate limiting middleware
- Logging middleware
- Multiple endpoints with different metadata
- Response transformers
- Error handling
- Finalizers

## Design Decisions

1. **Immutable Metadata**: `req.endpointMeta` is read-only to prevent middleware from creating hidden dependencies
2. **Async by Default**: All handlers support `async/await`
3. **Registration Order**: Middleware runs in strict registration order
4. **Metadata-Driven Scope**: Middleware uses endpoint metadata to bow out
5. **Terminal Closure**: Closing a response skips normal downstream processing
6. **Path Parameters**: Typed as `Record<string, string>`
7. **Array Replacement**: Arrays in metadata always replace (never merge)

## TypeScript

Full TypeScript support with strict typing:

- Generic `Application<T>` for typed metadata
- Type-safe request/response objects
- Compile-time validation of metadata interfaces

## Breaking Changes

### Version 0.5.0

Added support for chunked responses. This came with significant rearchitecture,
demanding a new major release number.

### Version 0.4.0

The handling of headers changed to ensure all header names are normalized to
kebab case with initial caps `If-Modified-Since` or `Content-Type`.

- `req.headers['content-type']` is now `req.headers.get('Content-Type')`
- `res.headers['content-type']` is now `res.headers.get('Content-Type')`

Headers are also now stored as tuples so they always appear in insertion order.

## License

ISC
