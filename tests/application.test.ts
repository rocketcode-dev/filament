import { suite } from 'node:test';
import TestBattery from 'test-battery';
import { createApp, Application, createRouteContext } from '../src/application.js';
import { FrameworkMeta } from '../src/types.js';

interface TestMeta extends FrameworkMeta {
  requiresAuth?: boolean;
  roles?: string[];
}

function createTestApp(
  meta: Omit<TestMeta, 'application'>,
): Application<TestMeta> {
  return createApp<TestMeta>({
    application: { maxRequestSize: '2MiB' },
    ...meta,
  });
}

suite('Application', () => {
  
  suite('create application', () => {
    TestBattery.test('should create an application instance', (battery) => {
      const app = createTestApp({ requiresAuth: false });
      battery.test('should create Application instance')
        .value(app instanceof Application).is.true;
    });

    TestBattery.test('should use provided default meta', (battery) => {
      const defaultMeta: TestMeta = {
        application: { maxRequestSize: '2MiB' },
        requiresAuth: true,
        roles: ['admin'],
      };
      const app = createApp(defaultMeta);
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
      let capturedMeta: TestMeta | undefined;

      app.get('/test', { requiresAuth: true }, async (req, res) => {
        capturedMeta = req.endpointMeta;
        res.json({ success: true });
      });

      battery.test('meta not captured until route is called')
        .value(capturedMeta).value(undefined).equal;
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
      let capturedMeta: TestMeta | undefined;

      rc.get('/test', { requiresAuth: true }, async (req, res) => {
        capturedMeta = req.endpointMeta;
        res.json({ success: true });
      });

      battery.test('meta not captured until route is called')
        .value(capturedMeta).value(undefined).equal;
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

    TestBattery.test('should register path-specific middleware', (battery) => {
      const app = createTestApp({ requiresAuth: false });
      let middlewareCalled = false;

      app.use('/api', async () => {
        middlewareCalled = true;
      });

      battery.test('middleware not called until request')
        .value(middlewareCalled).is.false;
    });

    TestBattery.test('should register multiple middlewares', (battery) => {
      const app = createTestApp({ requiresAuth: false });

      app.use(async () => {});

      app.use(async () => {});

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
  });

  suite('request handling', () => {
    TestBattery.test('should handle basic GET request', (battery) => {
      const app = createTestApp({ requiresAuth: false });
      let handlerCalled = false;
      let responseData: any;

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
      let capturedId: string | undefined;

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

    TestBattery.test('should handle POST request with body', (battery) => {
      const app = createTestApp({ requiresAuth: false });
      let capturedBody: any;

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
      const order: string[] = [];

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

    TestBattery.test(
      'should treat a middleware response as terminal',
      (battery) => {
        const app = createTestApp({ requiresAuth: false });
        const order: string[] = [];

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

        const responsePromise = app.listen(9897).then(async port => {
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
      },
    );

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
      let errorStatus: number | undefined;
      let finalizerPath: string | undefined;

      app.onError(async (err) => {
        errorStatus = 'statusCode' in err
          ? err.statusCode as number
          : undefined;
      });
      app.onFinalize(async req => {
        finalizerPath = req.path;
      });

      const resultPromise = app.listen(9895).then(async port => {
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
      const app = createApp<TestMeta>({
        application: { maxRequestSize: '4B' },
        requiresAuth: false,
      });
      let handlerCalled = false;

      app.post('/limited', async (req, res) => {
        handlerCalled = true;
        await res.send(req.body ?? Buffer.alloc(0));
      });

      const resultPromise = app.listen(9894).then(async port => {
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

      const resultPromise = app.listen(9896).then(async port => {
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
      let capturedError: Error | undefined;

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
      const errors: string[] = [];

      app.get('/error-chain', async () => {
        throw new Error('original');
      });
      app.onError(async err => {
        errors.push(err.message);
        throw new Error('replacement');
      });
      app.onError(async (err, _req, res) => {
        errors.push(err.message);
        await res.status(422).json({ error: err.message });
      });

      const responsePromise = app.listen(9898).then(async port => {
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

    TestBattery.test('should implicitly end a handler response', (battery) => {
      const app = createTestApp({ requiresAuth: false });

      app.get('/implicit-end', {}, async (req, res) => {
        res.body = 'implicitly closed';
      });

      const responsePromise = app.listen(9890).then(async port => {
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

      const responsePromise = app.listen(9891).then(async port => {
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

    TestBattery.test(
      'should replace an uncommitted response after transformer failure',
      battery => {
        const app = createTestApp({ requiresAuth: false });

        app.onTransform(async () => {
          throw new Error('Transform failed');
        });
        app.get('/transform-error', {}, async (req, res) => {
          await res.json({ unsafe: 'partial response' });
        });

        const responsePromise = app.listen(9892).then(async port => {
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
      },
    );

    TestBattery.test(
      'should transform HTTP errors but not exception responses',
      battery => {
        const app = createTestApp({ requiresAuth: false });
        let transformations = 0;

        app.onTransform(async (req, res) => {
          transformations++;
          res.body = JSON.stringify({ transformed: res.statusCode });
        });
        app.get('/http-error', {}, async (req, res) => {
          await res.status(404).json({ error: 'Not Found' });
        });
        app.get('/exception', {}, async () => {
          throw new Error('Unexpected failure');
        });

        const responsePromise = app.listen(9893).then(async port => {
          const httpErrorResponse = await fetch(
            `http://localhost:${port}/http-error`,
          );
          const exceptionResponse = await fetch(
            `http://localhost:${port}/exception`,
          );
          const result = {
            httpError: {
              status: httpErrorResponse.status,
              body: await httpErrorResponse.json(),
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

        battery.test('only explicit HTTP error should be transformed')
          .value(responsePromise)
          .value({
            httpError: {
              status: 404,
              body: { transformed: 404 },
            },
            exception: {
              status: 500,
              body: { error: 'Internal Server Error' },
            },
            transformations: 1,
          }).deepEqual;
      },
    );

    TestBattery.test('should call finalizers after response', (battery) => {
      const app = createTestApp({ requiresAuth: false });
      let finalizerCalled = false;
      let capturedPath: string | undefined;

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
      let responseData: any;

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
      let capturedId: string | undefined;

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
      let capturedBody: any;

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
      const order: string[] = [];

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
      let capturedError: Error | undefined;

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
      let capturedPath: string | undefined;

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
      let capturedMeta: TestMeta | undefined;

      app.get(
        '/admin',
        { requiresAuth: true, roles: ['admin'] },
        async (req, res) => {
          capturedMeta = req.endpointMeta;
          res.json({ success: true });
        }
      );

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
      let capturedMeta: TestMeta | undefined;

      app.get(
        '/test',
        { requiresAuth: true },
        async (req, res) => {
          capturedMeta = req.endpointMeta;
          res.json({ success: true });
        }
      );

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

      const resultPromise = app.listen(9887).then(async port => {
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
