# Filament Examples

These runnable examples demonstrate Filament's metadata-driven middleware,
response lifecycle, and streaming behavior. Install dependencies once with
`npm install`; the locally pinned `tsx` runner executes the TypeScript sources
directly, so a separate build is unnecessary while exploring them.

## Table of Contents

- [Running the examples](#running-the-examples)
- [1. Blog API](#1-blog-api)
- [2. API Versioning](#2-api-versioning)
- [3. Performance Controls](#3-performance-controls)
- [4. Observability](#4-observability)
- [5. Content Negotiation](#5-content-negotiation)
- [6. OAuth Authorization Code](#6-oauth-authorization-code)
- [7. OAuth Authorization Code with PKCE](#7-oauth-authorization-code-with-pkce)
- [8. OAuth Device Authorization](#8-oauth-device-authorization)
- [9. OAuth Client Credentials](#9-oauth-client-credentials)
- [10. Streaming Ozymandias](#10-streaming-ozymandias)
- [Common Patterns](#common-patterns)
- [Best Practices](#best-practices)

## Running the Examples

Every section contains its own source-level command. Servers accept `--port 0`
to choose an available port automatically and `--silent` for test harnesses.
The OAuth examples use two terminals: one for the server and one for its client.

## 1. Blog API

Source: `01-blog-api.ts`

**Run:**

```bash
npx tsx examples/01-blog-api.ts --port 3001
```

**Concepts:** Authentication, authorization, RBAC

**Middlewares:**

- Authentication middleware validates configured token-protected routes and
  attaches the mock user to the request.
- Authorization middleware compares the authenticated user's role with route
  metadata.
- An error handler produces consistent JSON errors, and a finalizer logs the
  completed request.

**Endpoints:**

- `GET /posts` - List all posts (public).
- `GET /posts/:id` - Get one post (public).
- `POST /posts` - Create a post (editor or admin).
- `PATCH /posts/:id` - Update a post (editors are restricted to their own).
- `DELETE /posts/:id` - Delete a post (admin only).

**Key Pattern:**

```typescript
app.post('/posts',
  { requiresAuth: true, role: 'editor' },
  async (req, res) => { /* create the post */ },
);
```

**Try it:**

```bash
curl http://127.0.0.1:3001/posts
curl -X POST -H 'Authorization: token-editor' \
  -H 'Content-Type: application/json' \
  -d '{"title":"New post","content":"Hello"}' \
  http://127.0.0.1:3001/posts
```

---

## 2. API Versioning

Source: `02-api-versioning.ts`

**Run:**

```bash
npx tsx examples/02-api-versioning.ts --port 3002
```

**Concepts:** Versioning, deprecation, response formats

**Middlewares:**

- Deprecation middleware adds warning and sunset headers to deprecated routes.
- Version middleware publishes the selected API version on every response.
- A response transformer selects cache policy and documentation links from
  route metadata.
- A finalizer reports use of deprecated endpoints.

**Endpoints:**

- `GET /api/v1/user/:id` - Minimal deprecated V1 representation.
- `GET /api/v1/user/:id/profile` - Standard deprecated V1 profile.
- `GET /api/v2/user/:id` - Structured current V2 representation.
- `GET /api/v2/user/:id/full` - Detailed V2 representation with links.

**Key Pattern:**

```typescript
app.get('/api/v1/user/:id',
  { apiVersion: 'v1', deprecated: true, responseFormat: 'minimal' },
  async (req, res) => { /* return the V1 representation */ },
);
```

**Try it:**

```bash
curl -i http://127.0.0.1:3002/api/v1/user/123
curl -i http://127.0.0.1:3002/api/v2/user/123/full
```

---

## 3. Performance Controls

Source: `03-performance-controls.ts`

**Run:**

```bash
npx tsx examples/03-performance-controls.ts --port 3003
```

**Concepts:** Rate limiting, caching, request priority

**Middlewares:**

- Rate-limit middleware maintains per-client/path windows and emits limit
  headers or a `429` response.
- Cache middleware returns live in-memory entries before the route handler.
- Priority middleware annotates requests and simulates delaying low-priority
  work.
- Buffering middleware makes response bodies available to the cache-writing
  transformer.
- A finalizer logs priority, duration, and cache-hit status.

**Endpoints:**

- `GET /products` - High limit, cached for five minutes.
- `POST /orders` - Low limit and high priority.
- `GET /analytics/dashboard` - Very low limit, cached, low priority.
- `GET /search?q=term` - Medium limit, cached for two minutes.

**Key Pattern:**

```typescript
app.get('/products', {
  rateLimit: { requests: 100, window: 60, strategy: 'fixed' },
  cache: { enabled: true, ttl: 300 },
  priority: 'normal',
}, handler);
```

**Try it:**

```bash
curl -i -H 'X-Client-Id: demo' http://127.0.0.1:3003/products
curl -i -H 'X-Client-Id: demo' 'http://127.0.0.1:3003/search?q=filament'
```

---

## 4. Observability

Source: `04-observability.ts`

**Run:**

```bash
npx tsx examples/04-observability.ts --port 3004
```

**Concepts:** Distributed tracing, metrics, structured logging

**Middlewares:**

- Tracing middleware samples requests and propagates or generates trace/span
  identifiers.
- Metrics middleware times the downstream work and records configured
  dimensions.
- Logging middleware emits structured or human-readable request-start events.
- A finalizer completes traces and logs request completion.

**Endpoints:**

- `GET /users/:id` - User service with full tracing.
- `POST /payments` - Payment service with sampling and sensitive fields.
- `GET /analytics/events` - Analytics service with debug logging.
- `GET /health` - Health check without tracing.
- `GET /metrics` - Inspect collected metrics.
- `GET /traces?limit=10` - Inspect recent traces.

**Key Pattern:**

```typescript
app.get('/users/:id', {
  trace: { enabled: true, sampleRate: 1 },
  metrics: { enabled: true, dimensions: ['service', 'endpoint'] },
  service: 'user-service',
}, handler);
```

**Try it:**

```bash
curl -i -H 'X-Trace-Id: demo-trace' http://127.0.0.1:3004/users/42
curl http://127.0.0.1:3004/metrics
curl 'http://127.0.0.1:3004/traces?limit=5'
```

---

## 5. Content Negotiation

Source: `05-content-negotiation.ts`

**Run:**

```bash
npx tsx examples/05-content-negotiation.ts --port 3005
```

**Concepts:** Content negotiation, response transformation, format conversion

**Middlewares:**

- Negotiation middleware chooses an allowed format from the `format` query
  parameter, `Accept` header, and route metadata.
- A response transformer converts buffered JSON into JSON, XML, CSV, or HTML.
- A second transformer demonstrates where compression metadata could be added;
  it intentionally simulates rather than performs compression.

**Endpoints:**

- `GET /books` - List books as JSON, XML, CSV, or HTML.
- `GET /books/:id` - Return one book as JSON or XML.
- `GET /stats` - Return JSON-only statistics.

**Key Pattern:**

```typescript
app.onTransform(async (req, res) => {
  const format = (req as any).responseFormat;
  // Convert the buffered response body to the negotiated format.
});
```

**Try it:**

```bash
curl http://127.0.0.1:3005/books
curl 'http://127.0.0.1:3005/books?format=xml'
curl -H 'Accept: text/csv' http://127.0.0.1:3005/books
```

---

## 6. OAuth Authorization Code

Sources: `06-authorization-code-server.ts` and
`06-authorization-code-client.ts`

**Run:**

```bash
# Terminal 1
npx tsx examples/06-authorization-code-server.ts --port 3006

# Terminal 2
npx tsx examples/06-authorization-code-client.ts \
  --base-url http://127.0.0.1:3006
```

**Concepts:** Confidential clients, redirect state, one-time codes, bearer scopes

**Middlewares:**

- Bearer middleware skips public protocol endpoints, then uses
  `requiredScope` metadata to authenticate protected resource requests and put
  their token record in request-local context.

**Endpoints:**

- `GET /authorize` - Validate the client and redirect URI, simulate consent,
  and issue an authorization code.
- `POST /token` - Authenticate the confidential client and exchange the
  single-use code for a token.
- `GET /api/profile` - Read a profile using the `profile:read` scope.

**Key Pattern:**

```typescript
app.get('/api/profile', { requiredScope: 'profile:read' }, handler);
```

**Useful work:** The client validates `state`, obtains a token, and reads the
protected reader profile.

---

## 7. OAuth Authorization Code with PKCE

Sources: `07-authorization-code-pkce-server.ts` and
`07-authorization-code-pkce-client.ts`

**Run:**

```bash
# Terminal 1
npx tsx examples/07-authorization-code-pkce-server.ts --port 3007

# Terminal 2
npx tsx examples/07-authorization-code-pkce-client.ts \
  --base-url http://127.0.0.1:3007
```

**Concepts:** Public clients, S256 PKCE, proof of possession, bearer scopes

**Middlewares:**

- Bearer middleware enforces route `requiredScope` metadata and exposes the
  validated access-token record through request-local context.

**Endpoints:**

- `GET /authorize` - Bind an authorization code to the client's S256 challenge.
- `POST /token` - Hash and verify the original code verifier before issuing a
  token.
- `POST /api/reading-list` - Add a title using `reading-list:write`.

**Key Pattern:**

```typescript
sha256Base64Url(codeVerifier) === storedCodeChallenge;
```

**Useful work:** The public client proves possession of its verifier and adds an
Emily Dickinson collection to its protected reading list.

---

## 8. OAuth Device Authorization

Sources: `08-device-authorization-server.ts` and
`08-device-authorization-client.ts`

**Run:**

```bash
# Terminal 1
npx tsx examples/08-device-authorization-server.ts --port 3008

# Terminal 2
npx tsx examples/08-device-authorization-client.ts \
  --base-url http://127.0.0.1:3008
```

**Concepts:** Device and user codes, second-device approval, token polling

**Middlewares:**

- Bearer middleware protects metadata-marked resource routes while leaving
  device authorization, verification, and polling public.

**Endpoints:**

- `POST /device_authorization` - Issue device/user codes and polling guidance.
- `POST /device/verify` - Simulate the resource owner approving a user code.
- `POST /token` - Return `authorization_pending` until approval, then a token.
- `POST /api/notes` - Save a note using `notes:write`.

**Key Pattern:**

```typescript
if (!grant.approved) {
  await res.status(400).json({ error: 'authorization_pending' });
}
```

**Useful work:** The client simulates second-device approval, polls for a token,
and stores a protected note.

---

## 9. OAuth Client Credentials

Sources: `09-client-credentials-server.ts` and
`09-client-credentials-client.ts`

**Run:**

```bash
# Terminal 1
npx tsx examples/09-client-credentials-server.ts --port 3009

# Terminal 2
npx tsx examples/09-client-credentials-client.ts \
  --base-url http://127.0.0.1:3009
```

**Concepts:** Machine-to-machine authentication, HTTP Basic, service identity

**Middlewares:**

- Bearer middleware requires the endpoint's configured scope and makes the
  authenticated service identity available through request-local context.

**Endpoints:**

- `POST /token` - Authenticate a registered service and restrict its scopes.
- `POST /api/analyze` - Analyze text using `text:analyze`.

**Key Pattern:**

```typescript
const credentials = basicCredentials(req);
const requestedScopes = form.get('scope')?.split(' ') ?? [];
```

**Useful work:** The service client obtains its own token and counts words and
characters in a line of poetry.

---

## 10. Streaming Ozymandias

Source: `10-streaming-ozymandias.ts`

**Run:**

```bash
npx tsx examples/10-streaming-ozymandias.ts --port 3010
```

Use `--interval 50` to shorten the default 500 ms interval while experimenting.

**Concepts:** Streaming mode, chunked transfer, backpressure-aware writes

**Middlewares:**

- None. The endpoint opts directly into streaming mode so the example isolates
  response streaming from other lifecycle behavior.

**Endpoints:**

- `GET /poem` - Stream the fourteen lines of Shelley's public-domain sonnet.

**Key Pattern:**

```typescript
res.streaming = true;
await res.sendChunk(`${line}\n`);
```

**Try it:**

```bash
curl --no-buffer http://127.0.0.1:3010/poem
```

Each `sendChunk()` is awaited before the configured delay, respecting the
native response's write lifecycle.

---

## Common Patterns

### 1. Conditional Middleware

Middleware inspects `req.endpointMeta` to decide behavior:

```typescript
app.use(async (req, res, next) => {
  if (req.endpointMeta.someProperty) {
    // Do something
  }
  await next();
});
```

### 2. Metadata-Driven Headers

Set response headers based on metadata:

```typescript
app.onTransform(async (req, res) => {
  if (req.endpointMeta.cors) {
    res.headers.set('Access-Control-Allow-Origin', '*');
  }
});
```

### 3. Request Context Extension

Attach data to request for downstream use:

```typescript
app.use(async (req, res, next) => {
  req.context.user = authenticateUser(req);
  await next();
});
```

### 4. Post-Processing Chains

Use the three post-request handlers:

```typescript
// Transform successful responses
app.onTransform(async (req, res) => { /* ... */ });

// Handle errors
app.onError(async (err, req, res) => { /* ... */ });

// Always run (logging, cleanup)
app.onFinalize(async (req, res) => { /* ... */ });
```

## Best Practices

1. **Keep metadata flat** - Avoid deep nesting for better type inference
2. **Use descriptive property names** - `requiresAuth` vs `auth: boolean`
3. **Provide sensible defaults** - Most endpoints should work with default metadata
4. **Document metadata fields** - Add JSDoc comments to your metadata interface
5. **Leverage TypeScript** - Use union types for enums, optional fields where appropriate
6. **Separate concerns** - Different middleware for auth, logging, metrics, etc.
7. **Make middleware generic** - Let metadata drive specifics, not hardcoded logic

## Next Steps

- Combine patterns from multiple examples
- Create your own metadata interfaces for your use cases
- Build reusable middleware libraries
- Share your patterns with the community!
