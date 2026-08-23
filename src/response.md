# Response lifecycle

A response has two related boundaries: close and commit. Closing prevents more
data from being sent by the current stage. Committing performs the native write
and makes the representation immutable.

The stage that closes a response determines what Filament does next:

- If middleware closes it, later middleware, the route handler, and response
  transformers are skipped.
- When a route handler completes, Filament closes the response if necessary,
  runs transformers when it is buffered, and commits it.
- Error-flow responses bypass transformers.
- Finalizers always run for observation and cleanup.
- A client disconnect closes the Filament response, suppresses further native
  response I/O, and skips transformers; finalizers still run.

## Streaming and buffering

| Feature | Streaming | Buffered |
| --- | --- | --- |
| Writes | Sent through native I/O | Retained until commit |
| Transformers | Never | Run after the route handler |
| Body after close | Unavailable | Mutable until commit |

Streaming defaults to enabled when the application has no transformers and
disabled when transformers are registered. Code can set `res.streaming`
explicitly until the mode is locked.

The mode is locked by the first of these operations:

- Assigning `res.body` locks buffered mode.
- `sendChunk()` locks the current mode but leaves the response open.
- `send()`, `json()`, and `end()` lock the current mode and close the response.

## Middleware responses

Returning from middleware with an open response advances automatically. A
middleware can produce its own final representation with `send()`, `json()`,
or `end()`. Filament then skips all remaining regular request processing and
commits that response.

## Route responses

A route handler can use the normal response methods:

```typescript
app.get('/report', async (_req, res) => {
  await res.json({ ready: true });
});
```

After the handler returns, Filament supplies an implicit `end()` if necessary.
Buffered responses then pass through every registered transformer before
commit. A transformer can replace the body, status, or headers. Streaming
responses commit without entering the transformer chain.

## Commit

For streaming responses, native output occurs as data is sent and `end()`
completes it. For buffered responses, `commit()` writes the final transformed
representation. Filament owns `commit()` during normal application processing.

After commit, the body, status, and headers can no longer be changed. Repeated
`end()` and `commit()` calls share their existing completion operations.

## Client disconnects

`res.onDisconnect(listener)` runs its listener once when the native connection
closes before the response finishes. The `res.disconnected` flag is already
`true` while the listener runs. A listener registered after the disconnect is
invoked immediately, so route setup does not need a separate race check.

Pending response writes settle when a disconnect is observed. Later `send()`,
`json()`, `sendChunk()`, `end()`, and `commit()` calls settle without starting
native I/O. Routes remain responsible for cancelling work outside the response,
such as timers, database operations, and upstream streams.

## Finalizers

Finalizers run for successful, middleware-terminal, and error responses. They
are intended for observation and cleanup, not response mutation. A finalizer
failure is logged and does not replace the response.
