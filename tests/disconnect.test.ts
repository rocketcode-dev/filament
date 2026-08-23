import assert from 'node:assert/strict';
import http from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { createApp, FrameworkMeta } from '../src/index.js';

test('reports a real client disconnect and suppresses later writes', async () => {
  const app = createApp<FrameworkMeta>({
    application: { maxRequestSize: '2MiB' },
  }, {});

  let disconnectEvents = 0;
  let disconnectedInCallback = false;
  let lateWriteCompleted = false;
  let finalized = false;
  let resolveDisconnect!: () => void;
  const disconnect = new Promise<void>(resolve => {
    resolveDisconnect = resolve;
  });
  let resolveFinalized!: () => void;
  const finalization = new Promise<void>(resolve => {
    resolveFinalized = resolve;
  });

  app.get('/stream', async (_req, res) => {
    res.streaming = true;
    res.onDisconnect(() => {
      disconnectEvents++;
      disconnectedInCallback = res.disconnected;
      resolveDisconnect();
    });

    await res.sendChunk('first\n');
    await disconnect;
    await res.sendChunk('must not be written\n');
    lateWriteCompleted = true;
  });
  app.onFinalize(async (_req, res) => {
    finalized = res.disconnected;
    resolveFinalized();
  });

  const port = await app.listen(0);
  try {
    await new Promise<void>((resolve, reject) => {
      const request = http.get(`http://127.0.0.1:${port}/stream`, response => {
        response.once('data', () => {
          response.destroy();
          resolve();
        });
      });
      request.once('error', error => {
        if ((error as NodeJS.ErrnoException).code === 'ECONNRESET') {
          resolve();
        } else {
          reject(error);
        }
      });
    });

    await Promise.race([
      finalization,
      delay(2_000).then(() => {
        throw new Error('Timed out waiting for disconnect finalization');
      }),
    ]);

    assert.equal(disconnectEvents, 1);
    assert.equal(disconnectedInCallback, true);
    assert.equal(lateWriteCompleted, true);
    assert.equal(finalized, true);
  } finally {
    await app.close();
  }
});

test('detects a disconnect before headers and skips buffered transformers', async () => {
  const app = createApp<FrameworkMeta>({
    application: { maxRequestSize: '2MiB' },
  }, {});

  let transformCalls = 0;
  let disconnected = false;
  let resolveStarted!: () => void;
  const started = new Promise<void>(resolve => {
    resolveStarted = resolve;
  });
  let resolveFinalized!: () => void;
  const finalization = new Promise<void>(resolve => {
    resolveFinalized = resolve;
  });

  app.onTransform(async () => {
    transformCalls++;
  });
  app.get('/buffered', async (_req, res) => {
    const clientLeft = new Promise<void>(resolve => {
      res.onDisconnect(resolve);
    });
    resolveStarted();
    await clientLeft;
    await res.json({ ignored: true });
  });
  app.onFinalize(async (_req, res) => {
    disconnected = res.disconnected;
    resolveFinalized();
  });

  const port = await app.listen(0);
  try {
    const request = http.get(`http://127.0.0.1:${port}/buffered`);
    request.on('error', () => {
      // Destroying a request before headers may report ECONNRESET to the client.
    });
    await started;
    request.destroy();

    await Promise.race([
      finalization,
      delay(2_000).then(() => {
        throw new Error('Timed out waiting for pre-header disconnect');
      }),
    ]);

    assert.equal(disconnected, true);
    assert.equal(transformCalls, 0);
  } finally {
    await app.close();
  }
});
