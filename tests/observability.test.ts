import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import {
  ContextMeta,
  createApp,
  FrameworkMeta,
  ObservedInfo,
} from '../src/index.js';
import { RequestIdFactory } from '../src/observability.js';

suite('Observability', () => {
  test('creates sortable request IDs with pod suffixes and ten slots per millisecond', () => {
    const factory = new RequestIdFactory('filament-abcdefghij-rv5k7');
    const timestamp = Date.UTC(2026, 7, 20, 17, 35, 52, 966);
    const ids = Array.from({ length: 12 }, () => factory.create(timestamp));

    assert.equal(factory.serviceId, 'rv5k7');
    assert.equal(ids[0], '20260820-173552-9660-rv5k7');
    assert.equal(ids[9], '20260820-173552-9669-rv5k7');
    assert.equal(ids[10], '20260820-173552-9670-rv5k7');
    assert.equal(ids[11], '20260820-173552-9671-rv5k7');
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual([...ids].sort(), ids);
  });

  test('falls back to a five-character base-36 service ID', () => {
    const factory = new RequestIdFactory('filament-invalid-pod-name');
    assert.match(factory.serviceId, /^[0-9a-z]{5}$/);
  });

  test('captures streaming chunks before commit and then stops', async () => {
    const snapshots: ObservedInfo[] = [];
    const app = createApp<FrameworkMeta, ContextMeta>({
      application: {
        maxRequestSize: '2MiB',
        observability: {
          enabled: true,
          success: { responseBody: true },
        },
      },
    }, {});

    app.get('/stream', async function streamRoute(_req, res) {
      await res.sendChunk('one');
      await res.sendChunk('two');
      await res.end();
    });
    app.onFinalize(req => {
      snapshots.push(JSON.parse(JSON.stringify(
        req.context.application?.observed,
      )) as ObservedInfo);
    });

    const port = await app.listen(0);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/stream`);
      assert.equal(await response.text(), 'onetwo');
      await new Promise(resolve => setImmediate(resolve));

      assert.equal(snapshots[0].responseInfo?.body, 'onetwo');
      assert.deepEqual(
        snapshots[0].trace?.map(entry => [entry.type, entry.endStatus]),
        [
          ['system', 'open'],
          ['route', 'committed'],
        ],
      );
    } finally {
      await app.close();
    }
  });

  test('collects the maximum, narrows by fixed status, and traces policies', async () => {
    interface Meta extends FrameworkMeta {
      label: string;
    }
    interface Context extends ContextMeta {}

    const snapshots: ObservedInfo[] = [];
    const committedAtFinalize: boolean[] = [];
    const app = createApp<Meta, Context>({
      application: {
        maxRequestSize: '2MiB',
        observability: {
          enabled: true,
          success: {
            requestHeaders: false,
            requestBody: false,
            responseHeaders: false,
            responseBody: false,
          },
          failure: {
            statusText: true,
            requestHeaders: true,
            requestBody: true,
            responseHeaders: true,
            responseBody: true,
          },
          200: {
            responseHeaders: false,
            responseBody: false,
          },
          201: {
            requestBody: true,
            responseHeaders: true,
            responseBody: true,
          },
        },
      },
      label: 'default',
    }, {});

    app.use(async function observePolicyBoundary() {});

    app.post('/created', { label: 'created' }, async function createWidget(req, res) {
      await res.status(201).json({ received: req.body?.toString() });
    });

    app.get('/failure', { label: 'failure' }, async function failRequest() {
      throw new Error('private failure');
    });

    app.get('/pruned', { label: 'pruned' }, async function prunedSuccess(_req, res) {
      res.headers.set('X-Unwanted', 'private');
      await res.json({ private: 'response' });
    });

    app.get('/disabled', {
      application: {
        maxRequestSize: '2MiB',
        observability: { enabled: false },
      },
      label: 'disabled',
    }, async function disabledRoute(_req, res) {
      await res.send('not observed');
    });

    app.get('/dynamic-opt-out', { label: 'opt-out' }, async function optOut(req, res) {
      req.context.application ??= {};
      req.context.application.observability = { enabled: false };
      await res.send('not observed');
    });

    app.onTransform(async function replaceCreatedBody(req, res) {
      if (req.path !== '/created') return;
      res.body = 'transformed';
      res.headers.set('X-Transformed', 'yes');
    });

    app.onFinalize((req, res) => {
      const observed = req.context.application?.observed;
      if (observed) {
        snapshots.push(JSON.parse(JSON.stringify(observed)) as ObservedInfo);
        committedAtFinalize.push(res.committed);
      }
    });

    const port = await app.listen(0);
    try {
      const createdResponse = await fetch(
        `http://127.0.0.1:${port}/created?source=test`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            Forwarded: 'for=192.0.2.60;proto=https',
            'X-Forwarded-For': '198.51.100.20, 10.0.0.1',
            'X-Should-Be-Pruned': 'yes',
          },
          body: 'original',
        },
      );
      assert.equal(await createdResponse.text(), 'transformed');
      await new Promise(resolve => setImmediate(resolve));
      const created = snapshots.at(-1)!;

      assert.match(
        created.requestId,
        /^\d{8}-\d{6}-\d{4}-[0-9a-z]{5}$/,
      );
      assert.ok(Number.isSafeInteger(created.startTime));
      assert.deepEqual(created.requestInfo, {
        origin: '192.0.2.60',
        method: 'POST',
        path: '/created',
        search: '?source=test',
        body: 'original',
      });
      assert.equal(created.responseInfo?.statusCode, 201);
      assert.equal(created.responseInfo?.statusText, undefined);
      assert.equal(created.responseInfo?.body, 'transformed');
      assert.deepEqual(
        created.responseInfo?.headers?.['X-Transformed'],
        ['yes'],
      );
      assert.deepEqual(
        created.trace?.map(entry => [entry.type, entry.name, entry.endStatus]),
        [
          ['system', 'request', 'open'],
          ['middleware', 'observePolicyBoundary', 'open'],
          ['route', 'createWidget', 'closed'],
          ['transformer', 'replaceCreatedBody', 'closed'],
        ],
      );
      assert.deepEqual(
        created.trace?.map(entry => entry.endTime),
        [...created.trace!].map(entry => entry.endTime).sort((a, b) => a - b),
      );

      const failureResponse = await fetch(`http://127.0.0.1:${port}/failure`, {
        headers: {
          'X-Captured': 'yes',
          'X-Forwarded-For': '198.51.100.20, 10.0.0.1',
        },
      });
      assert.equal(failureResponse.status, 500);
      await failureResponse.text();
      await new Promise(resolve => setImmediate(resolve));
      const failure = snapshots.at(-1)!;
      assert.equal(failure.responseInfo?.statusCode, 500);
      assert.equal(failure.responseInfo?.statusText, 'Internal Server Error');
      assert.equal(
        failure.responseInfo?.body,
        JSON.stringify({ error: 'Internal Server Error' }),
      );
      assert.equal(failure.requestInfo?.headers?.['X-Captured']?.[0], 'yes');
      assert.equal(failure.requestInfo?.origin, '198.51.100.20');
      assert.deepEqual(
        failure.trace?.map(entry => entry.type),
        ['system', 'middleware', 'route', 'error'],
      );

      const prunedResponse = await fetch(`http://127.0.0.1:${port}/pruned`);
      assert.deepEqual(await prunedResponse.json(), { private: 'response' });
      await new Promise(resolve => setImmediate(resolve));
      const pruned = snapshots.at(-1)!;
      assert.deepEqual(pruned.responseInfo, { statusCode: 200 });
      assert.equal(committedAtFinalize.at(-1), true);

      await fetch(`http://127.0.0.1:${port}/disabled`).then(res => res.text());
      await new Promise(resolve => setImmediate(resolve));
      const disabled = snapshots.at(-1)!;
      assert.deepEqual(Object.keys(disabled).sort(), ['requestId', 'startTime']);

      await fetch(`http://127.0.0.1:${port}/dynamic-opt-out`)
        .then(res => res.text());
      await new Promise(resolve => setImmediate(resolve));
      const optedOut = snapshots.at(-1)!;
      assert.deepEqual(Object.keys(optedOut).sort(), ['requestId', 'startTime']);
    } finally {
      await app.close();
    }
  });
});
