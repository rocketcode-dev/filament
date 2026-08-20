import { suite } from 'node:test';
import TestBattery from 'test-battery';
import { createApp, Application, createRouteContext } from '../src/application.js';
function errorMessage(fn) {
    try {
        fn();
        return undefined;
    }
    catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}
function createTestApp(meta) {
    return createApp({
        application: { maxRequestSize: '2MiB' },
        ...meta,
    }, {});
}
suite('Application', () => {
    suite('create application', () => {
        TestBattery.test('should create an application instance', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            battery.test('should create Application instance')
                .value(app instanceof Application).is.true;
        });
        TestBattery.test('should use provided default meta', (battery) => {
            const defaultMeta = {
                application: { maxRequestSize: '2MiB' },
                requiresAuth: true,
                roles: ['admin'],
            };
            const app = createApp(defaultMeta, {});
            battery.test('should create app with custom meta')
                .value(app instanceof Application).is.true;
        });
    });
    suite('route registration', () => {
        TestBattery.test('should register GET route', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            let called = false;
            app.get('/test', {}, async (req, res) => {
                called = true;
                await res.json({ success: true });
            });
            battery.test('handler should not be called yet')
                .value(called).is.false;
        });
        TestBattery.test('should register POST route', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            app.post('/users', {}, async (req, res) => {
                res.json({ created: true });
            });
            battery.test('POST route registered')
                .value(true).is.true;
        });
        TestBattery.test('should register PUT route', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            app.put('/users/:id', {}, async (req, res) => {
                res.json({ updated: true });
            });
            battery.test('PUT route registered')
                .value(true).is.true;
        });
        TestBattery.test('should register PATCH route', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            app.patch('/users/:id', {}, async (req, res) => {
                res.json({ patched: true });
            });
            battery.test('PATCH route registered')
                .value(true).is.true;
        });
        TestBattery.test('should register DELETE route', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            app.delete('/users/:id', {}, async (req, res) => {
                res.json({ deleted: true });
            });
            battery.test('DELETE route registered')
                .value(true).is.true;
        });
        TestBattery.test('should merge route meta with default meta', (battery) => {
            const app = createTestApp({ requiresAuth: false, roles: ['user'] });
            let capturedMeta;
            app.get('/test', { requiresAuth: true }, async (req, res) => {
                capturedMeta = req.endpointMeta;
                res.json({ success: true });
            });
            battery.test('meta not captured until route is called')
                .value(capturedMeta).value(undefined).equal;
        });
        TestBattery.test('should require exactly one route handler', battery => {
            const app = createTestApp({ requiresAuth: false });
            const handler = async () => { };
            battery.test('missing and duplicate handlers are rejected')
                .value([
                errorMessage(() => app.get('/missing-handler')),
                errorMessage(() => app.get('/duplicate-handler', handler, handler)),
            ])
                .value([
                'No handler provided for route',
                'Multiple handlers provided for route',
            ])
                .deepEqual;
        });
    });
    suite('route registration with a route context', () => {
        TestBattery.test('should register GET route', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            const rc = createRouteContext(app, '/rc');
            let called = false;
            rc.get('/test', {}, async (req, res) => {
                called = true;
                res.json({ success: true });
            });
            battery.test('handler should not be called yet')
                .value(called).is.false;
        });
        TestBattery.test('should register POST route', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            const rc = createRouteContext(app, '/rc');
            rc.post('/users', {}, async (req, res) => {
                res.json({ created: true });
            });
            battery.test('POST route registered')
                .value(true).is.true;
        });
        TestBattery.test('should register PUT route', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            const rc = createRouteContext(app, '/rc');
            rc.put('/users/:id', {}, async (req, res) => {
                res.json({ updated: true });
            });
            battery.test('PUT route registered')
                .value(true).is.true;
        });
        TestBattery.test('should register PATCH route', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            const rc = createRouteContext(app, '/rc');
            rc.patch('/users/:id', {}, async (req, res) => {
                res.json({ patched: true });
            });
            battery.test('PATCH route registered')
                .value(true).is.true;
        });
        TestBattery.test('should register DELETE route', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            const rc = createRouteContext(app, '/rc');
            rc.delete('/users/:id', {}, async (req, res) => {
                res.json({ deleted: true });
            });
            battery.test('DELETE route registered')
                .value(true).is.true;
        });
        TestBattery.test('should merge route meta with default meta', (battery) => {
            const app = createTestApp({ requiresAuth: false, roles: ['user'] });
            const rc = createRouteContext(app, '/rc');
            let capturedMeta;
            rc.get('/test', { requiresAuth: true }, async (req, res) => {
                capturedMeta = req.endpointMeta;
                res.json({ success: true });
            });
            battery.test('meta not captured until route is called')
                .value(capturedMeta).value(undefined).equal;
        });
        TestBattery.test('should expand default and multiple bases across methods', async (battery) => {
            const app = createTestApp({ requiresAuth: false });
            const root = createRouteContext(app, { requiresAuth: true });
            const versions = createRouteContext(app, '/v1', '/v2');
            const handler = async (req, res) => {
                await res.send(`${req.method}:${req.path}`);
            };
            root.route(['GET', 'POST', 'DELETE'], '/dual', handler);
            versions.get('/health', handler);
            const port = await app.listen(0);
            const results = await Promise.all([
                fetch(`http://localhost:${port}/dual`).then(response => response.text()),
                fetch(`http://localhost:${port}/dual`, { method: 'POST' })
                    .then(response => response.text()),
                fetch(`http://localhost:${port}/dual`, { method: 'DELETE' })
                    .then(response => response.text()),
                fetch(`http://localhost:${port}/v1/health`)
                    .then(response => response.text()),
                fetch(`http://localhost:${port}/v2/health`)
                    .then(response => response.text()),
            ]);
            await app.close();
            battery.test('all expanded routes should resolve')
                .value(results)
                .value([
                'GET:/dual',
                'POST:/dual',
                'DELETE:/dual',
                'GET:/v1/health',
                'GET:/v2/health',
            ])
                .deepEqual;
        });
        TestBattery.test('should require exactly one context handler', battery => {
            const app = createTestApp({ requiresAuth: false });
            const context = createRouteContext(app, '/v1');
            const handler = async () => { };
            battery.test('missing and duplicate handlers are rejected')
                .value([
                errorMessage(() => context.get('/missing-handler')),
                errorMessage(() => context.get('/duplicate-handler', handler, handler)),
            ])
                .value([
                'No handler provided for route',
                'Multiple handlers provided for route',
            ])
                .deepEqual;
        });
    });
    suite('middleware registration', () => {
        TestBattery.test('should register global middleware', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            let middlewareCalled = false;
            app.use(async () => {
                middlewareCalled = true;
            });
            battery.test('middleware not called until request')
                .value(middlewareCalled).is.false;
        });
        TestBattery.test('should register multiple middlewares', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            app.use(async () => { });
            app.use(async () => { });
            battery.test('multiple middlewares registered')
                .value(true).is.true;
        });
    });
    suite('error handler registration', () => {
        TestBattery.test('should register error handler', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            app.onError(async (err, req, res) => {
                res.status(500).json({ error: err.message });
            });
            battery.test('error handler registered')
                .value(true).is.true;
        });
        TestBattery.test('should register multiple error handlers', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            app.onError(async () => {
                // First handler
            });
            app.onError(async () => {
                // Second handler
            });
            battery.test('multiple error handlers registered')
                .value(true).is.true;
        });
    });
    suite('finalizer registration', () => {
        TestBattery.test('should register finalizer', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            app.onFinalize(async (req, res) => {
                // Logging logic
            });
            battery.test('finalizer registered')
                .value(true).is.true;
        });
        TestBattery.test('should register multiple finalizers', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            app.onFinalize(async (req, res) => {
                // First finalizer
            });
            app.onFinalize(async (req, res) => {
                // Second finalizer
            });
            battery.test('multiple finalizers registered')
                .value(true).is.true;
        });
    });
    suite('transformer registration', () => {
        TestBattery.test('should register response transformer', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            app.onTransform(async (req, res) => {
                // Transform response
            });
            battery.test('transformer registered')
                .value(true).is.true;
        });
        TestBattery.test('should register multiple transformers', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            app.onTransform(async (req, res) => {
                // First transformer
            });
            app.onTransform(async (req, res) => {
                // Second transformer
            });
            battery.test('multiple transformers registered')
                .value(true).is.true;
        });
    });
    suite('server lifecycle', () => {
        TestBattery.test('should start server on specified port', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            const port = 9876;
            const listenPromise = app.listen(port).finally(() => {
                app.close();
            });
            battery.test('server started on correct port')
                .value(listenPromise).value(port).equal;
        });
        TestBattery.test('should close server gracefully', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            const port = 9877;
            const closePromise = app.listen(port).then(async () => {
                await new Promise(resolve => setTimeout(resolve, 100));
                return app.close();
            });
            battery.test('server closed without errors')
                .value(closePromise).value(undefined).equal;
        });
        TestBattery.test('should handle close when server not started', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            const closePromise = app.close();
            battery.test('close handled when server not started')
                .value(closePromise).value(undefined).equal;
        });
        TestBattery.test('should reject an occupied port', async (battery) => {
            const owner = createTestApp({ requiresAuth: false });
            const contender = createTestApp({ requiresAuth: false });
            const port = await owner.listen(0);
            const message = await contender.listen(port).then(() => undefined, error => error instanceof Error ? error.message : String(error));
            await owner.close();
            battery.test('listen should identify the occupied port')
                .value(message).value(`Port ${port} is already in use`).equal;
        });
    });
    suite('request handling', () => {
        TestBattery.test('should handle basic GET request', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            let handlerCalled = false;
            let responseData;
            app.get('/test', {}, async (req, res) => {
                handlerCalled = true;
                responseData = { message: 'success' };
                res.json(responseData);
            });
            const port = 9878;
            const requestPromise = app.listen(port).then(async (port) => {
                const response = await fetch(`http://localhost:${port}/test`);
                const data = await response.json();
                await app.close();
                return { handlerCalled, data };
            });
            battery.test('handler should be called')
                .value(requestPromise).value({ handlerCalled: true, data: { message: 'success' } }).deepEqual;
        });
        TestBattery.test('should handle route with parameters', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            let capturedId;
            app.get('/users/:id', {}, async (req, res) => {
                capturedId = req.params.id;
                res.json({ id: req.params.id });
            });
            const port = 9879;
            const responsePromise = app.listen(port).then(async (port) => {
                const response = await fetch(`http://localhost:${port}/users/123`);
                const data = await response.json();
                await app.close();
                return { response: data, capturedId };
            });
            battery.test('should return parameter in response')
                .value(responsePromise).value({ response: { id: '123' }, capturedId: '123' }).deepEqual;
        });
        TestBattery.test('should preserve repeated query parameters', battery => {
            const app = createTestApp({ requiresAuth: false });
            app.get('/query', async (req, res) => {
                await res.json(req.query);
            });
            const responsePromise = app.listen(0).then(async (port) => {
                const response = await fetch(`http://localhost:${port}/query?tag=one&single=value&tag=two`);
                const query = await response.json();
                await app.close();
                return query;
            });
            battery.test('duplicate keys become arrays and single keys stay strings')
                .value(responsePromise)
                .value({ tag: ['one', 'two'], single: 'value' }).deepEqual;
        });
        TestBattery.test('should handle POST request with body', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            let capturedBody;
            app.post('/users', {}, async (req, res) => {
                capturedBody = JSON.parse(req.body?.toString() || '{}');
                res.status(201).json({ created: true, data: capturedBody });
            });
            const port = 9880;
            const postPromise = app.listen(port).then(async (port) => {
                const response = await fetch(`http://localhost:${port}/users`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'John', age: 30 })
                });
                const data = await response.json();
                await app.close();
                return { status: response.status, data, capturedBody };
            });
            battery.test('should have correct status and data')
                .value(postPromise).value({
                status: 201,
                data: { created: true, data: { name: 'John', age: 30 } },
                capturedBody: { name: 'John', age: 30 }
            }).deepEqual;
        });
        TestBattery.test('should execute middleware chain', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            const order = [];
            app.use(async () => {
                order.push('middleware1');
            });
            app.use(async () => {
                order.push('middleware2');
            });
            app.get('/test', {}, async (req, res) => {
                order.push('handler');
                res.json({ success: true });
            });
            const port = 9881;
            const chainPromise = app.listen(port).then(async (port) => {
                await fetch(`http://localhost:${port}/test`);
                await app.close();
                return order;
            });
            battery.test('should execute in order')
                .value(chainPromise)
                .value(['middleware1', 'middleware2', 'handler']).deepEqual;
        });
        TestBattery.test('should treat a middleware response as terminal', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            const order = [];
            app.use(async (_req, res) => {
                order.push('terminal middleware');
                await res.status(401).json({ error: 'Unauthorized' });
            });
            app.use(async () => {
                order.push('later middleware');
            });
            app.onTransform(async () => {
                order.push('transformer');
            });
            app.onFinalize(async () => {
                order.push('finalizer');
            });
            app.get('/protected', async (_req, res) => {
                order.push('handler');
                await res.json({ success: true });
            });
            const responsePromise = app.listen(9897).then(async (port) => {
                const response = await fetch(`http://localhost:${port}/protected`);
                const body = await response.json();
                await app.close();
                return { status: response.status, body, order };
            });
            battery.test('should skip downstream work but run finalizers')
                .value(responsePromise)
                .value({
                status: 401,
                body: { error: 'Unauthorized' },
                order: ['terminal middleware', 'finalizer'],
            })
                .deepEqual;
        });
        TestBattery.test('should handle 404 for non-existent routes', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            app.get('/exists', {}, async (req, res) => {
                res.json({ found: true });
            });
            const port = 9882;
            const notFoundPromise = app.listen(port).then(async (port) => {
                const response = await fetch(`http://localhost:${port}/not-found`);
                const data = await response.json();
                await app.close();
                return { status: response.status, data };
            });
            battery.test('should return 404 not found')
                .value(notFoundPromise).value({ status: 404, data: { error: 'Not Found' } }).deepEqual;
        });
        TestBattery.test('should send route misses through error flow', battery => {
            const app = createTestApp({ requiresAuth: false });
            let errorStatus;
            let finalizerPath;
            app.onError(async (err) => {
                errorStatus = 'statusCode' in err
                    ? err.statusCode
                    : undefined;
            });
            app.onFinalize(async (req) => {
                finalizerPath = req.path;
            });
            const resultPromise = app.listen(9895).then(async (port) => {
                const response = await fetch(`http://localhost:${port}/missing`);
                const body = await response.json();
                await app.close();
                return {
                    status: response.status,
                    body,
                    errorStatus,
                    finalizerPath,
                };
            });
            battery.test('should run error handlers, the default, and finalizers')
                .value(resultPromise)
                .value({
                status: 404,
                body: { error: 'Not Found' },
                errorStatus: 404,
                finalizerPath: '/missing',
            })
                .deepEqual;
        });
        TestBattery.test('should reject request bodies over the limit', battery => {
            const app = createApp({
                application: { maxRequestSize: '4B' },
                requiresAuth: false,
            }, {});
            let handlerCalled = false;
            app.post('/limited', async (req, res) => {
                handlerCalled = true;
                await res.send(req.body ?? Buffer.alloc(0));
            });
            const resultPromise = app.listen(9894).then(async (port) => {
                const response = await fetch(`http://localhost:${port}/limited`, {
                    method: 'POST',
                    body: '12345',
                });
                const body = await response.json();
                await app.close();
                return { status: response.status, body, handlerCalled };
            });
            battery.test('should enter error flow with 413')
                .value(resultPromise)
                .value({
                status: 413,
                body: { error: 'Payload Too Large' },
                handlerCalled: false,
            })
                .deepEqual;
        });
        TestBattery.test('should reject malformed encoded parameters', battery => {
            const app = createTestApp({ requiresAuth: false });
            app.get('/users/:id', async (req, res) => {
                await res.json({ id: req.params.id });
            });
            const resultPromise = app.listen(9896).then(async (port) => {
                const response = await fetch(`http://localhost:${port}/users/%E0%A4%A`);
                const body = await response.json();
                await app.close();
                return { status: response.status, body };
            });
            battery.test('should enter error flow with 400')
                .value(resultPromise)
                .value({ status: 400, body: { error: 'Bad Request' } })
                .deepEqual;
        });
        TestBattery.test('should call error handlers on exceptions', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            let errorHandlerCalled = false;
            let capturedError;
            app.get('/error', {}, async (req, res) => {
                throw new Error('Test error');
            });
            app.onError(async (err, _req, res) => {
                errorHandlerCalled = true;
                capturedError = err;
                res.status(500).json({ error: err.message });
            });
            const port = 9883;
            const errorPromise = app.listen(port).then(async (port) => {
                const response = await fetch(`http://localhost:${port}/error`);
                const data = await response.json();
                await app.close();
                return {
                    errorHandlerCalled,
                    capturedErrorMessage: capturedError?.message,
                    status: response.status,
                    data
                };
            });
            battery.test('should call error handler with correct error')
                .value(errorPromise).value({
                errorHandlerCalled: true,
                capturedErrorMessage: 'Test error',
                status: 500,
                data: { error: 'Test error' }
            }).deepEqual;
        });
        TestBattery.test('should advance through open error handlers', battery => {
            const app = createTestApp({ requiresAuth: false });
            const errors = [];
            app.get('/error-chain', async () => {
                throw new Error('original');
            });
            app.onError(async (err) => {
                errors.push(err.message);
                throw 'replacement';
            });
            app.onError(async (err, _req, res) => {
                errors.push(err.message);
                await res.status(422).json({ error: err.message });
            });
            const responsePromise = app.listen(9898).then(async (port) => {
                const response = await fetch(`http://localhost:${port}/error-chain`);
                const body = await response.json();
                await app.close();
                return { status: response.status, body, errors };
            });
            battery.test('should carry thrown replacements to the next handler')
                .value(responsePromise)
                .value({
                status: 422,
                body: { error: 'replacement' },
                errors: ['original', 'replacement'],
            })
                .deepEqual;
        });
        TestBattery.test('should advance a buffered replacement error until commit', battery => {
            const app = createTestApp({ requiresAuth: false });
            const errors = [];
            // A transformer makes the default response mode buffered.
            app.onTransform(async () => { });
            app.get('/buffered-error-chain', async () => {
                throw new Error('original');
            });
            app.onError(async (error, _req, res) => {
                errors.push(error.message);
                await res.status(409).json({ error: 'first response' });
                throw 'replacement';
            });
            app.onError(async (error, _req, res) => {
                errors.push(error.message);
                res.status(422);
                res.body = JSON.stringify({ error: error.message });
            });
            const responsePromise = app.listen(0).then(async (port) => {
                const response = await fetch(`http://localhost:${port}/buffered-error-chain`);
                const body = await response.json();
                await app.close();
                return { status: response.status, body, errors };
            });
            battery.test('the replacement should supersede the closed buffer')
                .value(responsePromise)
                .value({
                status: 422,
                body: { error: 'replacement' },
                errors: ['original', 'replacement'],
            })
                .deepEqual;
        });
        TestBattery.test('should normalize primitive route errors', battery => {
            const app = createTestApp({ requiresAuth: false });
            let capturedError;
            app.get('/primitive-error', async () => {
                throw 17;
            });
            app.onError(async (error, _req, res) => {
                capturedError = error.message;
                await res.status(500).json({ error: error.message });
            });
            const responsePromise = app.listen(0).then(async (port) => {
                const response = await fetch(`http://localhost:${port}/primitive-error`);
                const body = await response.json();
                await app.close();
                return { body, capturedError };
            });
            battery.test('error handlers receive an Error instance')
                .value(responsePromise)
                .value({ body: { error: '17' }, capturedError: '17' }).deepEqual;
        });
        TestBattery.test('should implicitly end a handler response', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            app.get('/implicit-end', {}, async (req, res) => {
                res.body = 'implicitly closed';
            });
            const responsePromise = app.listen(9890).then(async (port) => {
                const response = await fetch(`http://localhost:${port}/implicit-end`);
                const body = await response.text();
                await app.close();
                return { status: response.status, body };
            });
            battery.test('handler return should close and commit its response')
                .value(responsePromise)
                .value({ status: 200, body: 'implicitly closed' }).deepEqual;
        });
        TestBattery.test('should use the default error handler', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            app.get('/default-error', {}, async () => {
                throw new Error('private details');
            });
            const responsePromise = app.listen(9891).then(async (port) => {
                const response = await fetch(`http://localhost:${port}/default-error`);
                const body = await response.json();
                await app.close();
                return { status: response.status, body };
            });
            battery.test('default error response should hide exception details')
                .value(responsePromise)
                .value({
                status: 500,
                body: { error: 'Internal Server Error' },
            }).deepEqual;
        });
        TestBattery.test('should replace an uncommitted response after transformer failure', battery => {
            const app = createTestApp({ requiresAuth: false });
            app.onTransform(async () => {
                throw new Error('Transform failed');
            });
            app.get('/transform-error', {}, async (_req, res) => {
                await res.json({ unsafe: 'partial response' });
            });
            const responsePromise = app.listen(9892).then(async (port) => {
                const response = await fetch(`http://localhost:${port}/transform-error`);
                const body = await response.json();
                await app.close();
                return { status: response.status, body };
            });
            battery.test('default error should replace buffered body')
                .value(responsePromise)
                .value({
                status: 500,
                body: { error: 'Internal Server Error' },
            }).deepEqual;
        });
        TestBattery.test('should transform buffered route responses before commit', battery => {
            const app = createTestApp({ requiresAuth: false });
            let transformations = 0;
            app.onTransform(async (req, res) => {
                transformations++;
                res.body = JSON.stringify({ transformed: res.statusCode });
            });
            app.get('/closed-error', {}, async (_req, res) => {
                await res.status(404).json({ error: 'Not Found' });
            });
            app.get('/open-success', {}, async (_req, res) => {
                res.headers.set('Content-Type', 'application/json');
                res.body = JSON.stringify({ success: true });
            });
            app.get('/exception', {}, async () => {
                throw new Error('Unexpected failure');
            });
            const responsePromise = app.listen(9893).then(async (port) => {
                const closedErrorResponse = await fetch(`http://localhost:${port}/closed-error`);
                const openSuccessResponse = await fetch(`http://localhost:${port}/open-success`);
                const exceptionResponse = await fetch(`http://localhost:${port}/exception`);
                const result = {
                    closedError: {
                        status: closedErrorResponse.status,
                        body: await closedErrorResponse.json(),
                    },
                    openSuccess: {
                        status: openSuccessResponse.status,
                        body: await openSuccessResponse.json(),
                    },
                    exception: {
                        status: exceptionResponse.status,
                        body: await exceptionResponse.json(),
                    },
                    transformations,
                };
                await app.close();
                return result;
            });
            battery.test('only exception responses should bypass transforms')
                .value(responsePromise)
                .value({
                closedError: {
                    status: 404,
                    body: { transformed: 404 },
                },
                openSuccess: {
                    status: 200,
                    body: { transformed: 200 },
                },
                exception: {
                    status: 500,
                    body: { error: 'Internal Server Error' },
                },
                transformations: 2,
            }).deepEqual;
        });
        TestBattery.test('should run all buffered route transformers', battery => {
            const app = createTestApp({ requiresAuth: false });
            const order = [];
            app.onTransform(async (_req, res) => {
                order.push('first transformer');
                await res.end();
            });
            app.onTransform(async () => {
                order.push('second transformer');
            });
            app.onFinalize(async () => {
                order.push('finalizer');
            });
            app.get('/closing-transformer', async (_req, res) => {
                res.body = 'complete';
            });
            const responsePromise = app.listen(9899).then(async (port) => {
                const response = await fetch(`http://localhost:${port}/closing-transformer`);
                const body = await response.text();
                await app.close();
                return { body, order };
            });
            battery.test('end should not stop route response transformers')
                .value(responsePromise)
                .value({
                body: 'complete',
                order: ['first transformer', 'second transformer', 'finalizer'],
            })
                .deepEqual;
        });
        TestBattery.test('should never transform a streaming response', battery => {
            const app = createTestApp({ requiresAuth: false });
            let transformations = 0;
            app.onTransform(async () => {
                transformations++;
            });
            app.get('/stream', async (_req, res) => {
                res.streaming = true;
                await res.sendChunk('one');
                await res.sendChunk('two');
            });
            const responsePromise = app.listen(0).then(async (port) => {
                const response = await fetch(`http://localhost:${port}/stream`);
                const body = await response.text();
                await app.close();
                return { body, transformations };
            });
            battery.test('streaming bytes bypass the transformer chain')
                .value(responsePromise)
                .value({ body: 'onetwo', transformations: 0 }).deepEqual;
        });
        TestBattery.test('should finish a stream when its handler later throws', battery => {
            const app = createTestApp({ requiresAuth: false });
            const originalConsoleError = console.error;
            let logged = '';
            app.get('/partial-stream', async (_req, res) => {
                res.streaming = true;
                await res.sendChunk('partial');
                throw new Error('too late to replace the response');
            });
            const responsePromise = (async () => {
                console.error = (...values) => {
                    logged = values.map(String).join(' ');
                };
                try {
                    const port = await app.listen(0);
                    const response = await fetch(`http://localhost:${port}/partial-stream`);
                    return {
                        status: response.status,
                        body: await response.text(),
                        logged,
                    };
                }
                finally {
                    await app.close();
                    console.error = originalConsoleError;
                }
            })();
            battery.test('escaped bytes remain intact and the error is logged')
                .value(responsePromise)
                .value({
                status: 200,
                body: 'partial',
                logged: 'Error after response started: Error: ' +
                    'too late to replace the response',
            }).deepEqual;
        });
        TestBattery.test('should commit an error response before finalizers', battery => {
            const app = createTestApp({ requiresAuth: false });
            let committedInFinalizer = false;
            // A transformer makes error responses buffered, though errors bypass
            // the transformer chain itself.
            app.onTransform(async () => { });
            app.get('/buffered-error-finalizer', async () => {
                throw new Error('failure');
            });
            app.onError(async (_error, _req, res) => {
                await res.status(500).json({ error: 'handled' });
            });
            app.onFinalize(async (_req, res) => {
                committedInFinalizer = res.committed;
            });
            const responsePromise = app.listen(0).then(async (port) => {
                const response = await fetch(`http://localhost:${port}/buffered-error-finalizer`);
                const body = await response.json();
                await app.close();
                return { body, committedInFinalizer };
            });
            battery.test('finalizers should observe the committed response')
                .value(responsePromise)
                .value({ body: { error: 'handled' }, committedInFinalizer: true })
                .deepEqual;
        });
        TestBattery.test('should isolate finalizer failures', battery => {
            const app = createTestApp({ requiresAuth: false });
            const originalConsoleError = console.error;
            let logged = '';
            let resolveFinalized;
            const finalized = new Promise(resolve => {
                resolveFinalized = resolve;
            });
            app.get('/finalizer-failure', async (_req, res) => {
                await res.send('complete');
            });
            app.onFinalize(async () => {
                throw new Error('finalizer failed');
            });
            app.onFinalize(async () => {
                resolveFinalized();
            });
            const responsePromise = (async () => {
                console.error = (...values) => {
                    logged = values.map(String).join(' ');
                };
                try {
                    const port = await app.listen(0);
                    const response = await fetch(`http://localhost:${port}/finalizer-failure`);
                    const body = await response.text();
                    await finalized;
                    await app.close();
                    return { body, logged };
                }
                finally {
                    console.error = originalConsoleError;
                }
            })();
            battery.test('later finalizers run and the response remains successful')
                .value(responsePromise)
                .value({
                body: 'complete',
                logged: 'Error in finalizer: Error: finalizer failed',
            })
                .deepEqual;
        });
        TestBattery.test('should call finalizers after response', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            let finalizerCalled = false;
            let capturedPath;
            app.get('/test', {}, async (req, res) => {
                res.json({ success: true });
            });
            app.onFinalize(async (req, res) => {
                finalizerCalled = true;
                capturedPath = req.path;
            });
            const port = 9884;
            const finalizerPromise = app.listen(port).then(async (port) => {
                await fetch(`http://localhost:${port}/test`);
                // Wait a bit for finalizer to run
                await new Promise(resolve => setTimeout(resolve, 50));
                await app.close();
                return { finalizerCalled, capturedPath };
            });
            battery.test('finalizer should be called with correct path')
                .value(finalizerPromise)
                .value({ finalizerCalled: true, capturedPath: '/test' }).deepEqual;
        });
    });
    suite('request handling with route contexts', () => {
        TestBattery.test('should handle basic GET request', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            const rc = createRouteContext(app, '/rc');
            let handlerCalled = false;
            let responseData;
            rc.get('/test', {}, async (req, res) => {
                handlerCalled = true;
                responseData = { message: 'success' };
                res.json(responseData);
            });
            const port = 9878;
            const requestPromise = app.listen(port).then(async (port) => {
                const response = await fetch(`http://localhost:${port}/rc/test`);
                const data = await response.json();
                await app.close();
                return { handlerCalled, data };
            });
            battery.test('handler should be called')
                .value(requestPromise).value({ handlerCalled: true, data: { message: 'success' } }).deepEqual;
        });
        TestBattery.test('should handle route with parameters', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            const rc = createRouteContext(app, '/rc');
            let capturedId;
            rc.get('/users/:id', {}, async (req, res) => {
                capturedId = req.params.id;
                res.json({ id: req.params.id });
            });
            const port = 9879;
            const responsePromise = app.listen(port).then(async (port) => {
                const response = await fetch(`http://localhost:${port}/rc/users/123`);
                const data = await response.json();
                await app.close();
                return { response: data, capturedId };
            });
            battery.test('should return parameter in response')
                .value(responsePromise).value({ response: { id: '123' }, capturedId: '123' }).deepEqual;
        });
        TestBattery.test('should handle POST request with body', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            const rc = createRouteContext(app, '/rc');
            let capturedBody;
            rc.post('/users', {}, async (req, res) => {
                capturedBody = JSON.parse(req.body?.toString() || '{}');
                res.status(201).json({ created: true, data: capturedBody });
            });
            const port = 9880;
            const postPromise = app.listen(port).then(async (port) => {
                const response = await fetch(`http://localhost:${port}/rc/users`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'John', age: 30 })
                });
                const data = await response.json();
                await app.close();
                return { status: response.status, data, capturedBody };
            });
            battery.test('should have correct status and data')
                .value(postPromise).value({
                status: 201,
                data: { created: true, data: { name: 'John', age: 30 } },
                capturedBody: { name: 'John', age: 30 }
            }).deepEqual;
        });
        TestBattery.test('should execute middleware chain', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            const rc = createRouteContext(app, '/rc');
            const order = [];
            app.use(async () => {
                order.push('middleware1');
            });
            app.use(async () => {
                order.push('middleware2');
            });
            rc.get('/test', {}, async (req, res) => {
                order.push('handler');
                res.json({ success: true });
            });
            const port = 9881;
            const chainPromise = app.listen(port).then(async (port) => {
                await fetch(`http://localhost:${port}/rc/test`);
                await app.close();
                return order;
            });
            battery.test('should execute in order')
                .value(chainPromise)
                .value(['middleware1', 'middleware2', 'handler']).deepEqual;
        });
        TestBattery.test('should handle 404 for non-existent routes', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            const rc = createRouteContext(app, '/rc');
            rc.get('/exists', {}, async (req, res) => {
                res.json({ found: true });
            });
            const port = 9882;
            const notFoundPromise = app.listen(port).then(async (port) => {
                const response = await fetch(`http://localhost:${port}/rc/not-found`);
                const data = await response.json();
                await app.close();
                return { status: response.status, data };
            });
            battery.test('should return 404 not found')
                .value(notFoundPromise).value({ status: 404, data: { error: 'Not Found' } }).deepEqual;
        });
        TestBattery.test('should handle 404 for non-basepath routes', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            const rc = createRouteContext(app, '/rc');
            rc.get('/exists', {}, async (req, res) => {
                res.json({ found: true });
            });
            const port = 9882;
            const notFoundPromise = app.listen(port).then(async (port) => {
                const response = await fetch(`http://localhost:${port}/exists`);
                const data = await response.json();
                await app.close();
                return { status: response.status, data };
            });
            battery.test('should return 404 not found')
                .value(notFoundPromise).value({ status: 404, data: { error: 'Not Found' } }).deepEqual;
        });
        TestBattery.test('should call error handlers on exceptions', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            const rc = createRouteContext(app, '/rc');
            let errorHandlerCalled = false;
            let capturedError;
            rc.get('/error', {}, async (req, res) => {
                throw new Error('Test error');
            });
            app.onError(async (err, _req, res) => {
                errorHandlerCalled = true;
                capturedError = err;
                res.status(500).json({ error: err.message });
            });
            const port = 9883;
            const errorPromise = app.listen(port).then(async (port) => {
                const response = await fetch(`http://localhost:${port}/rc/error`);
                const data = await response.json();
                await app.close();
                return {
                    errorHandlerCalled,
                    capturedErrorMessage: capturedError?.message,
                    status: response.status,
                    data
                };
            });
            battery.test('should call error handler with correct error')
                .value(errorPromise).value({
                errorHandlerCalled: true,
                capturedErrorMessage: 'Test error',
                status: 500,
                data: { error: 'Test error' }
            }).deepEqual;
        });
        TestBattery.test('should call finalizers after response', (battery) => {
            const app = createTestApp({ requiresAuth: false });
            const rc = createRouteContext(app, '/rc');
            let finalizerCalled = false;
            let capturedPath;
            rc.get('/test', {}, async (req, res) => {
                res.json({ success: true });
            });
            app.onFinalize(async (req, res) => {
                finalizerCalled = true;
                capturedPath = req.path;
            });
            const port = 9884;
            const finalizerPromise = app.listen(port).then(async (port) => {
                await fetch(`http://localhost:${port}/rc/test`);
                // Wait a bit for finalizer to run
                await new Promise(resolve => setTimeout(resolve, 50));
                await app.close();
                return { finalizerCalled, capturedPath };
            });
            battery.test('finalizer should be called with correct path')
                .value(finalizerPromise)
                .value({ finalizerCalled: true, capturedPath: '/rc/test' }).deepEqual;
        });
    });
    suite('meta handling', () => {
        TestBattery.test('should provide endpoint meta to handlers', (battery) => {
            const app = createTestApp({ requiresAuth: false, roles: [] });
            let capturedMeta;
            app.get('/admin', { requiresAuth: true, roles: ['admin'] }, async (req, res) => {
                capturedMeta = req.endpointMeta;
                res.json({ success: true });
            });
            const port = 9885;
            const metaPromise = app.listen(port).then(async (port) => {
                await fetch(`http://localhost:${port}/admin`);
                await app.close();
                return capturedMeta;
            });
            battery.test('should have correct endpoint meta')
                .value(metaPromise).value({
                application: { maxRequestSize: 2097152 },
                requiresAuth: true,
                roles: ['admin'],
            }).deepEqual;
        });
        TestBattery.test('should merge partial meta with defaults', (battery) => {
            const app = createTestApp({ requiresAuth: false, roles: ['user'] });
            let capturedMeta;
            app.get('/test', { requiresAuth: true }, async (req, res) => {
                capturedMeta = req.endpointMeta;
                res.json({ success: true });
            });
            const port = 9886;
            const mergePromise = app.listen(port).then(async (port) => {
                await fetch(`http://localhost:${port}/test`);
                await app.close();
                return capturedMeta;
            });
            battery.test('should override requiresAuth and keep defaults')
                .value(mergePromise)
                .value({
                application: { maxRequestSize: 2097152 },
                requiresAuth: true,
                roles: ['user'],
            })
                .deepEqual;
        });
        TestBattery.test('should clone and deeply freeze route metadata', battery => {
            const roles = ['user'];
            const app = createTestApp({ requiresAuth: false, roles });
            app.get('/frozen', async (req, res) => {
                await res.json({
                    roles: req.endpointMeta.roles,
                    rootFrozen: Object.isFrozen(req.endpointMeta),
                    rolesFrozen: Object.isFrozen(req.endpointMeta.roles),
                    applicationFrozen: Object.isFrozen(req.endpointMeta.application),
                });
            });
            roles.push('mutated-after-registration');
            const resultPromise = app.listen(9887).then(async (port) => {
                const response = await fetch(`http://localhost:${port}/frozen`);
                const body = await response.json();
                await app.close();
                return body;
            });
            battery.test('should expose an isolated frozen metadata snapshot')
                .value(resultPromise)
                .value({
                roles: ['user'],
                rootFrozen: true,
                rolesFrozen: true,
                applicationFrozen: true,
            })
                .deepEqual;
        });
    });
});
//# sourceMappingURL=application.test.js.map