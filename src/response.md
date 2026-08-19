# Response lifecycle

The response lifecycle is different when streaming mode is enabled. The
essential differences are:

| Feature | Streaming enabled | Streaming disabled |
| --- | --- | --- |
| send timing | immediate with each chunk | all chunks stored until transformers complete |
| transformer middlewares | disabled | enabled |
| memory usage | chunks are not retained in memory | chunks are retained |

In the end, streaming mode can provide higher performance and concurrency, but it inhibits the use of transformers. By default, streaming is enabled unless the app has transformers registered.

It's best to **enabled** streaming for:

- Sending large payloads, and
- High-concurrency services

It's best to **disabled** streaming for:

- postprocessing transforms, e.g. converting between JSON, XML, and YAML

What affects streaming mode, in order of decreasing priority

- Writing data directly to `res.body = data` will always **disable** streaming mode and lock it in (use `res.send(data)` or `res.sendChunk(data)` to avoid changing streaming mode),
- Directly set `res.streaming = true|false` to **enable** or **disable** streaming mode,
- Add a transform to the app to **disable** streaming mode, or
- Default to streaming mode **enabled**

Streaming mode is changeable until data is sent:

- `res.body = data` locks in streaming mode **disabled**,
- `res.sendChunk(data)` locks in streaming mode to its current state,
- `res.send(data)` locks in streaming mode to its current state, and
- `res.end() also locks in streaming mode to its current state.

## Initial state

The initial state of a newly-created Response is as follows:

| streaming | headers | closed | committed | body |
| --- | --- | --- | --- | --- |
| 🟢 unlocked | 🟢 fluid | 🟢 false | 🟢 false | 🟢 empty |

At this point, streaming mode can be set, headers can be adjusted, and status
code can be changed.

When the first write occurs, the streaming mode is locked in.

## With streaming mode enabled

### `sendChunk`

Data chunk is sent to the end point without storing it. If the headers haven't been sent already, they will be sent first, and then frozen. Streaming mode is locked in.

| streaming | headers | closed | committed | body |
| --- | --- | --- | --- | --- |
| 🔴 locked | 🔴 frozen | 🟢 false | 🟢 false | 🔴 unused |

### `send` or `json`

Final data chunk is sent to the end point and `end` is called. Note that `json` cannot be called after `sendChunk`.

| streaming | headers | closed | committed | body |
| --- | --- | --- | --- | --- |
| 🔴 locked | 🔴 frozen | 🔴 'pending' | 🟢 false | 🔴 unused |

### `end`

Write stream is closed. The transaction is complete.

| streaming | headers | closed | committed | body |
| --- | --- | --- | --- | --- |
| 🔴 locked | 🔴 frozen | 🔴 true | 🔴 true | 🔴 unused |

### `commit` is a no-op

This is essentially a no-op in streaming mode as the response is already out.

| streaming | headers | closed | committed | body |
| --- | --- | --- | --- | --- |
| 🔴 locked | 🔴 frozen | 🔴 true | 🔴 true | 🔴 unused |

## With streaming mode disabled

### `sendChunk` without streaming

Data chunk is stored in memory for sending later. Chunks here are meaningless; they are combined long before the data goes out. Because data hasn't actually been sent, the headers are still malleable.

| streaming | headers | closed | committed | body |
| --- | --- | --- | --- | --- |
| 🔴 locked | 🟢 fluid | 🟢 false | 🟢 false | 🟢 writable |

### `send`, `end`

Final data chunk is stored in memory and the body is marked as closed. The body
remains writable because this is still useful for transforms.

| streaming | headers | closed | committed | body |
| --- | --- | --- | --- | --- |
| 🔴 locked | 🟢 fluid | 🔴 true | 🟢 false | 🟢 still writable |

### `commit`

This is when the headers and all body data is send out. At this point, everything is closed and no changes to body can be made.

| streaming | headers | closed | committed | body |
| --- | --- | --- | --- | --- |
| 🔴 locked | 🔴 locked | 🔴 true | 🔴 true | 🔴 unused |

