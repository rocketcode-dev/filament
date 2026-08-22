# Project status

This is generated from an AI code review, and items will be removed as they are addressed.

## Design Decisions and compromises

These are my responses to AI review

| Area | Decision / outcome |
| --- | --- |
| Middleware scope | Application-wide middleware is intentional. There will be no path-scoped middleware; middleware examines immutable `endpointMeta` and bows out when its policy does not apply. |
| Context overlay | Every request starts with the same cloned context baseline and immutable merged endpoint metadata. Policies may mutate request-local context. `contextGet(req, 'path.to.item')` reads a complete path from context first, then falls back to endpoint metadata. |
| Route response semantics | Settled: a route handler may close its logical response, but the application owns the route boundary and commits it. Buffered route responses still pass through transformers before commit. |
| Streaming responses | Settled: streaming responses are committed progressively and can never be transformed. If an error happens after headers or bytes escape, error handling cannot replace that response; it can only finish it safely. |
| Error handlers | Returning with an open response advances to the next handler. Closing handles the error. Thrown replacement errors—including primitive values—are normalized and passed onward while a buffered response remains uncommitted. Once a response is committed, or streaming headers or bytes have escaped, later errors are logged and cannot change it. |
| Finalizers | Finalization starts by closing and committing the response, then finalizers always run. One failing finalizer is logged and does not prevent later finalizers or alter the response. |
| Wrong method | Do not return 405 Method not Allowed with `Allow` headers. A future feature can support it but only if specifically enabled -- keep it both simple and secure by default. |
| Request body | Filament handles streaming responses but not inputs. Mulipart handling will not be part of the core framework, just pass the body through for a middleware to handle. |
| Listener IP | I changed listener to accept IP as a paremeter and all the http(s) options/ |

## Remaining action items

### Triaged

These items have been triaged and are ready for implementation

1. HTTP method semantics
    - HEAD requests, when not already implemented, should use the GET but suppress the body
    - Currently a request to a valid path but the wrong method will result in a 404. For now we will keep it that way, but as a future feature, we can set a FrameworkMeta property to enable 405 messages with generated Allow headers. For now, we'll keep it simple and secure by default.
    - DELETE requests should be allowed to have a body like POST, PUT, and PATCH. The HTTP protocol allows it, we should allow it too.
1. Request body should be lazy-loaded so that middleware can start earlier.

### Pending

These items are either suggested by AI or brainstormed and have not been triaged

1. More sophisticated request-body handling
   Only needed if Filament moves toward large uploads or public-facing edge workloads:
   - disconnect/cancellation awareness;
   The current implementation is reasonable for bounded JSON/API payloads.
1. Clarify special-object immutability
   Cloning now supports Date, RegExp, Map, and Set, but JavaScript’s Object.freeze() does not make the internal state of Date, Map, or Set immutable. There are two honest choices:
   - define endpoint metadata as JSON-like data—plain objects, arrays, and primitives; or
   - provide stronger handling for mutable special objects.
   I would favor explicitly defining metadata as JSON-like. It keeps equality, serialization, freezing, and mental models clean.

## What I think Filament’s main selling points are

The strongest pitch is not “a smaller Express.” It is:
Filament makes endpoint policy typed, immutable, and visible to every cross-cutting concern.

That is the real differentiator.

### Metadata as a policy plane

Authentication, authorization, caching, rate limits, observability, deprecation, content negotiation, and similar concerns can all inspect one typed endpointMeta object.

That avoids two common problems:

- behavior hidden in nested router/middleware registration;
- middleware ordering and scoping that becomes impossible to understand from the endpoint itself.

A route declaration describes both what the endpoint does and which policies govern it.

### A very predictable lifecycle

The execution model is unusually easy to explain:
route match

```text
→ global middleware
→ route handler
→ buffered transformers
→ commit
→ finalizers
```

Errors have their own chain, response closure has an explicit meaning, and there is no next() choreography. That is a meaningful ergonomic advantage over callback-shaped middleware systems.

### Immutable endpoint contracts

Defaults and overrides are deeply cloned, merged once, and frozen. Middleware cannot silently alter policy for later middleware or future requests. That makes request isolation and reasoning under concurrency much stronger.

### Clean separation of responsibilities

Filament distinguishes:

- middleware for pre-handler policy;
- handlers for endpoint behavior;
- transformers for buffered route representations;
- error handlers for failures;
- finalizers for observation and cleanup.
Those boundaries are now coherent, especially after settling middleware closure versus route closure and streaming behavior.

### Low ceremony without hiding control

It stays close to Node’s HTTP model:

- bodies are buffers;
- response streaming is explicit;
- headers have a dedicated concrete abstraction;
- async completion is represented by promises;
- there is little reflection or decorator magic.

That makes it attractive for developers who want structure without adopting a large application platform.

### Good fit for policy-heavy APIs

The examples show the natural market well: APIs with authentication, RBAC, rate limiting, versioning, observability, content negotiation, and OAuth flows. Those are exactly the systems where metadata-driven middleware becomes more valuable than route-scoped middleware.

I would lead the project messaging with typed metadata-driven policy, deterministic async execution, and immutable endpoint contracts. “Express-familiar” is useful reassurance, but not the differentiator. I would also soften “zero runtime overhead” to something like “small, predictable overhead”—the former is literally hard to defend when every global middleware still executes and inspects metadata.
