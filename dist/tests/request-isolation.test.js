import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { suite, test } from 'node:test';
import { createApp } from '../src/index.js';
function jitter(value, salt = 0) {
    const milliseconds = (Number(value.replace(/\D/g, '')) + salt) % 9;
    return delay(milliseconds);
}
suite('Request isolation under high concurrency', () => {
    test('does not crosstalk across routes, middleware, transformers, or exception handlers', async () => {
        const app = createApp({
            application: { maxRequestSize: '2MiB' },
            routeName: 'alpha',
        });
        app.use(async (req) => {
            const requestId = String(req.headers.get('x-request-id'));
            await jitter(requestId, 1);
            req.context.requestId = requestId;
            req.context.middleware = `global:${requestId}`;
        });
        app.use('/alpha', async (req) => {
            await jitter(req.context.requestId, 2);
            req.context.middleware = `alpha:${req.context.requestId}`;
        });
        const success = async (req, res) => {
            await jitter(req.context.requestId, 3);
            await res.json({
                requestId: req.context.requestId,
                route: req.endpointMeta.routeName,
                param: req.params.id,
                middleware: req.context.middleware,
            });
        };
        app.get('/alpha/:id', { routeName: 'alpha' }, success);
        app.get('/beta/:id', { routeName: 'beta' }, success);
        app.get('/failure/:id', { routeName: 'failure' }, async (req) => {
            await jitter(req.context.requestId, 4);
            throw new Error(`failure:${req.params.id}:${req.context.requestId}`);
        });
        app.onTransform(async (req, res) => {
            await jitter(req.context.requestId, 5);
            const body = JSON.parse(res.body.toString());
            body.transformed = `transform:${req.context.requestId}`;
            res.body = JSON.stringify(body);
            res.headers.set('X-Transformed-Request', req.context.requestId);
        });
        app.onError(async (error, req, res) => {
            await jitter(req.context.requestId, 6);
            await res.status(500).json({
                requestId: req.context.requestId,
                route: req.endpointMeta.routeName,
                param: req.params.id,
                middleware: req.context.middleware,
                error: error.message,
            });
        });
        const port = await app.listen(0);
        try {
            const requestCount = 360;
            const results = await Promise.all(Array.from({ length: requestCount }, async (_, index) => {
                const requestId = `request-${index}`;
                const kind = index % 3 === 0 ? 'alpha' : index % 3 === 1 ? 'beta' : 'failure';
                const response = await fetch(`http://127.0.0.1:${port}/${kind}/${index}`, {
                    headers: { 'X-Request-Id': requestId },
                });
                return {
                    index,
                    kind,
                    status: response.status,
                    transformedHeader: response.headers.get('x-transformed-request'),
                    body: await response.json(),
                };
            }));
            assert.equal(results.length, requestCount);
            for (const result of results) {
                const requestId = `request-${result.index}`;
                assert.equal(result.body.requestId, requestId);
                assert.equal(result.body.route, result.kind);
                assert.equal(result.body.param, String(result.index));
                assert.equal(result.body.middleware, result.kind === 'alpha' ? `alpha:${requestId}` : `global:${requestId}`);
                if (result.kind === 'failure') {
                    assert.equal(result.status, 500);
                    assert.equal(result.transformedHeader, null);
                    assert.equal(result.body.error, `failure:${result.index}:${requestId}`);
                    assert.equal(result.body.transformed, undefined);
                }
                else {
                    assert.equal(result.status, 200);
                    assert.equal(result.transformedHeader, requestId);
                    assert.equal(result.body.transformed, `transform:${requestId}`);
                    assert.equal(result.body.error, undefined);
                }
            }
        }
        finally {
            await app.close();
        }
    });
});
//# sourceMappingURL=request-isolation.test.js.map