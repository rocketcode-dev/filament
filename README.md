# Filament

A TypeScript API framework with metadata-driven middleware. Similar in purpose to Express but organized around typed endpoint metadata that controls middleware behavior.

## Why Filament?

### Best Features

- **Type-Safe Metadata**: Full TypeScript support means your middleware logic is validated at compile time
- **Zero Runtime Overhead**: Metadata inspection is fast—no reflection or complex routing logic
- **Predictable Execution**: Registration order is everything—no magic, no surprises
- **Immutable Request Context**: Middleware can't accidentally corrupt endpoint metadata
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

Middleware runs in registration order. Each middleware inspects `req.endpointMeta` to decide what to do.

### 4. Post-Request Processing

Three types of post-request handlers:

- **Error Handlers**: Run when errors occur
- **Response Transformers**: Modify successful responses
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
  requiresAuth: false,
  rateLimit: 100,
  logLevel: 'info',
  tags: [],
};

// Create app
const app = createApp<AppMeta>(defaultMeta);

// Add middleware that inspects metadata
app.use(async (req, res, next) => {
  if (req.endpointMeta.requiresAuth) {
    const token = req.headers.authorization;
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    // validate token...
  }
  await next();
});

// Define endpoints with custom metadata
app.get('/public', {}, async (req, res) => {
  res.json({ message: 'Public endpoint' });
});

app.get('/admin', 
  { requiresAuth: true, logLevel: 'debug' },
  async (req, res) => {
    res.json({ message: 'Admin panel' });
  }
);

// Start server
app.listen(3000);
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
app.get(path: string, meta: Partial<T>, handler: AsyncRequestHandler): void
app.post(path: string, meta: Partial<T>, handler: AsyncRequestHandler): void
app.put(path: string, meta: Partial<T>, handler: AsyncRequestHandler): void
app.patch(path: string, meta: Partial<T>, handler: AsyncRequestHandler): void
app.delete(path: string, meta: Partial<T>, handler: AsyncRequestHandler): void
```

#### Middleware Registration

```typescript
app.use(middleware: AsyncRequestHandler): void
app.use(path: string, middleware: AsyncRequestHandler): void
```

#### Post-Request Handlers

```typescript
app.onError(handler: ErrorHandler<T>): void
app.onTransform(handler: ResponseTransformer<T>): void
app.onFinalize(handler: Finalizer<T>): void
```

#### Server Control

```typescript
app.listen(port: number, callback?: () => void): void
app.close(): Promise<void>
```

## Request Object

```typescript
interface Request<T extends FrameworkMeta> {
  method: HttpMethod;
  path: string;
  params: Record<string, string>;        // Path parameters
  query: Record<string, string | string[]>;  // Query parameters
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;                        // Parsed JSON body
  endpointMeta: Readonly<T>;            // Endpoint metadata (read-only)
}
```

## Response Object

```typescript
interface Response {
  status(code: number): Response;
  setHeader(name: string, value: string | string[]): Response;
  json(data: unknown): void;
  send(data: string | Buffer): void;
  end(): void;
}
```

## Request Lifecycle

```text
1. Incoming Request
   ↓
2. Route Matching → req.endpointMeta populated (readonly)
   ↓
3. Middleware Chain (in registration order)
   - Each middleware inspects req.endpointMeta
   - Decides whether to execute logic
   - await next() continues chain
   ↓
4. Route Handler executes
   ↓
5. [If Success] Response Transformers (sequential, awaited)
   ↓
6. [If Error anywhere] Error Handlers (sequential, awaited)
   ↓
7. Finalizers (always run, sequential, awaited)
   ↓
8. Response sent
```

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

## Metadata Merging

- Endpoint metadata is merged with defaults using shallow merge
- Arrays **always replace** (not concatenate)
- Metadata is immutable at runtime

```typescript
const defaultMeta = {
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

Errors thrown anywhere in the request lifecycle are caught and passed to error handlers:

```typescript
app.onError(async (err, req, res) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message });
});
```

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
4. **Path Parameters**: Typed as `Record<string, string>` (no advanced type inference)
5. **Array Replacement**: Arrays in metadata always replace (never merge)

## TypeScript

Full TypeScript support with strict typing:

- Generic `Application<T>` for typed metadata
- Type-safe request/response objects
- Compile-time validation of metadata interfaces

## License

ISC
