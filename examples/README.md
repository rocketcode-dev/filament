# Filament Examples

This directory contains comprehensive examples demonstrating various Filament features and patterns.

## Running the Examples

Each example is a standalone server. To run them:

```bash
# Build the project first
npm run build

# Run an example
node dist/examples/01-blog-api.js
node dist/examples/02-api-versioning.js
node dist/examples/03-performance-controls.js
node dist/examples/04-observability.js
node dist/examples/05-content-negotiation.js
```

## Examples Overview

### 1. Blog API (`01-blog-api.ts`)
**Concepts:** Authentication, Authorization, RBAC

A complete blog API demonstrating:
- User authentication via tokens
- Role-based access control (admin, editor, viewer)
- Different endpoints requiring different permission levels
- Middleware that inspects `requiresAuth` and `role` metadata

**Endpoints:**
- `GET /posts` - List all posts (public)
- `GET /posts/:id` - Get single post (public)
- `POST /posts` - Create post (editor+)
- `PATCH /posts/:id` - Update post (editor+, own posts only)
- `DELETE /posts/:id` - Delete post (admin only)

**Key Pattern:**
```typescript
interface BlogMeta extends FrameworkMeta {
  requiresAuth: boolean;
  role?: 'admin' | 'editor' | 'viewer';
}

// Middleware checks metadata
app.use(async (req, res, next) => {
  if (req.endpointMeta.requiresAuth) {
    // Perform authentication
  }
});
```

---

### 2. API Versioning (`02-api-versioning.ts`)
**Concepts:** Versioning, Deprecation, Response Formats

Demonstrates handling multiple API versions:
- V1 endpoints (deprecated) with sunset headers
- V2 endpoints (current) with improved structure
- Different response formats (minimal, standard, detailed)
- Automatic deprecation warnings
- Format-based caching strategies

**Endpoints:**
- `GET /api/v1/user/:id` - V1 minimal format (deprecated)
- `GET /api/v1/user/:id/profile` - V1 profile (deprecated)
- `GET /api/v2/user/:id` - V2 standard format
- `GET /api/v2/user/:id/full` - V2 detailed format

**Key Pattern:**
```typescript
interface ApiMeta extends FrameworkMeta {
  apiVersion: 'v1' | 'v2';
  deprecated?: boolean;
  responseFormat: 'minimal' | 'standard' | 'detailed';
}

// Add deprecation warnings
app.use(async (req, res, next) => {
  if (req.endpointMeta.deprecated) {
    res.setHeader('X-API-Deprecated', 'true');
  }
});
```

---

### 3. Performance Controls (`03-performance-controls.ts`)
**Concepts:** Rate Limiting, Caching, Priority Queues

Advanced performance management:
- Configurable rate limiting per endpoint
- In-memory caching with TTL
- Request prioritization (low, normal, high)
- Automatic cache key generation
- Rate limit headers (X-RateLimit-*)

**Endpoints:**
- `GET /products` - High rate limit, cached 5min
- `POST /orders` - Low rate limit, high priority
- `GET /analytics/dashboard` - Very low rate limit, low priority
- `GET /search?q=term` - Medium rate limit, cached 2min

**Key Pattern:**
```typescript
interface PerformanceMeta extends FrameworkMeta {
  rateLimit: {
    requests: number;
    window: number;
    strategy: 'fixed' | 'sliding';
  };
  cache: {
    enabled: boolean;
    ttl: number;
  };
  priority: 'low' | 'normal' | 'high';
}
```

---

### 4. Observability (`04-observability.ts`)
**Concepts:** Distributed Tracing, Metrics, Structured Logging

Complete observability stack:
- Distributed tracing with trace/span IDs
- Configurable sampling rates
- Metrics collection with custom dimensions
- Structured logging (JSON format)
- Service identification
- Internal observability endpoints

**Endpoints:**
- `GET /users/:id` - User service (full tracing)
- `POST /payments` - Payment service (10% sample rate)
- `GET /analytics/events` - Analytics (debug logging)
- `GET /health` - Health check (no tracing)
- `GET /metrics` - View collected metrics
- `GET /traces?limit=10` - View recent traces

**Key Pattern:**
```typescript
interface ObservabilityMeta extends FrameworkMeta {
  trace: {
    enabled: boolean;
    sampleRate: number;
    includeHeaders: boolean;
    includeBody: boolean;
  };
  metrics: {
    enabled: boolean;
    dimensions: string[];
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    structured: boolean;
  };
  service: string;
}
```

---

### 5. Content Negotiation (`05-content-negotiation.ts`)
**Concepts:** Content Types, Response Transformation, Format Conversion

Multi-format response support:
- JSON, XML, CSV, and HTML output
- Content negotiation via Accept header or query param
- Pretty printing for development
- Metadata wrapping
- Format-specific headers

**Endpoints:**
- `GET /books` - List books (supports all formats)
- `GET /books/:id` - Single book (JSON, XML)
- `GET /stats` - Statistics (JSON only)

**Key Pattern:**
```typescript
interface ContentMeta extends FrameworkMeta {
  formats: ('json' | 'xml' | 'csv' | 'html')[];
  defaultFormat: 'json' | 'xml' | 'csv' | 'html';
  prettyPrint: boolean;
  includeMetadata: boolean;
}

// Transform response in onTransform
app.onTransform(async (req, res) => {
  const format = (req as any).responseFormat;
  // Convert res.body to requested format
});
```

**Try it:**
```bash
# JSON (default)
curl http://localhost:3005/books

# XML
curl http://localhost:3005/books?format=xml

# CSV
curl http://localhost:3005/books?format=csv

# HTML (open in browser)
http://localhost:3005/books?format=html
```

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
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
});
```

### 3. Request Context Extension
Attach data to request for downstream use:
```typescript
app.use(async (req, res, next) => {
  (req as any).user = authenticateUser(req);
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
