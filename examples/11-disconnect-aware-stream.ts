import { setTimeout as delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { createApp, FrameworkMeta } from '../src/index.js';

const { values } = parseArgs({
  options: {
    port: { type: 'string' },
    interval: { type: 'string' },
    count: { type: 'string' },
    silent: { type: 'boolean' },
  },
});
const port = Number(values.port ?? 0);
const interval = Number(values.interval ?? 500);
const count = Number(values.count ?? 100);
const silent = values.silent ?? false;

const app = createApp<FrameworkMeta>({
  application: { maxRequestSize: '2MiB' },
}, {});

app.get('/ticks', async (_req, res) => {
  res.streaming = true;
  res.headers.set('Content-Type', 'text/plain; charset=utf-8');
  res.headers.set('Cache-Control', 'no-store');

  // Use the disconnect callback to cancel work that is not owned by the
  // response itself. Filament automatically suppresses later native writes.
  const cancellation = new AbortController();
  res.onDisconnect(() => cancellation.abort());

  try {
    for (let tick = 1; tick <= count; tick += 1) {
      if (tick > 1) {
        await delay(interval, undefined, { signal: cancellation.signal });
      }
      await res.sendChunk(`tick ${tick}\n`);
    }
    await res.end();
  } catch (error) {
    if (!res.disconnected) throw error;
  }
});

app.listen(port).then(actualPort => {
  if (!silent) {
    console.log(`\n🔌 Disconnect-aware stream running on http://127.0.0.1:${actualPort}`);
    console.log('\nEndpoints:');
    console.log('  GET /ticks   - Stream numbered ticks and cancel work on disconnect');
    console.log('\nTry:');
    console.log(`  curl --no-buffer http://127.0.0.1:${actualPort}/ticks`);
    console.log('\nPress Ctrl-C while curl is running to trigger cancellation.\n');
  }
});
