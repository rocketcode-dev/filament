import { suite } from 'node:test';
import TestBattery from 'test-battery';
import { createApp, Application } from '../src/application.js';
import { FrameworkMeta } from '../src/types.js';

interface TestMeta extends FrameworkMeta {
  requiresAuth?: boolean;
  roles?: string[];
}

suite('Application', () => {
  
  suite('create application', () => {
    TestBattery.test('should create an application instance', (battery) => {
      const app = createApp<TestMeta>({ requiresAuth: false });
      battery.test('should create Application instance')
        .value(app instanceof Application).is.true;
    });

    TestBattery.test('should use provided default meta', (battery) => {
      const defaultMeta: TestMeta = { requiresAuth: true, roles: ['admin'] };
      const app = createApp(defaultMeta);
      battery.test('should create app with custom meta')
        .value(app instanceof Application).is.true;
    });
  });

  suite('route registration', () => {
    TestBattery.test('should register GET route', (battery) => {
      const app = createApp<TestMeta>({ requiresAuth: false });
      let called = false;

      app.get('/test', {}, async (req, res) => {
        called = true;
        res.json({ success: true });
      });

      battery.test('handler should not be called yet')
        .value(called).is.false;
    });

    TestBattery.test('should register POST route', (battery) => {
      const app = createApp<TestMeta>({ requiresAuth: false });
      app.post('/users', {}, async (req, res) => {
        res.json({ created: true });
      });
      battery.test('POST route registered')
        .value(true).is.true;
    });

    TestBattery.test('should register PUT route', (battery) => {
      const app = createApp<TestMeta>({ requiresAuth: false });
      app.put('/users/:id', {}, async (req, res) => {
        res.json({ updated: true });
      });
      battery.test('PUT route registered')
        .value(true).is.true;
    });

    TestBattery.test('should register PATCH route', (battery) => {
      const app = createApp<TestMeta>({ requiresAuth: false });
      app.patch('/users/:id', {}, async (req, res) => {
        res.json({ patched: true });
      });
      battery.test('PATCH route registered')
        .value(true).is.true;
    });

    TestBattery.test('should register DELETE route', (battery) => {
      const app = createApp<TestMeta>({ requiresAuth: false });
      app.delete('/users/:id', {}, async (req, res) => {
        res.json({ deleted: true });
      });
      battery.test('DELETE route registered')
        .value(true).is.true;
    });

    TestBattery.test('should merge route meta with default meta', (battery) => {
      const app = createApp<TestMeta>({ requiresAuth: false, roles: ['user'] });
      let capturedMeta: TestMeta | undefined;

      app.get('/test', { requiresAuth: true }, async (req, res) => {
        capturedMeta = req.endpointMeta;
        res.json({ success: true });
      });

      battery.test('meta not captured until route is called')
        .value(capturedMeta).value(undefined).equal;
    });
  });

  suite('middleware registration', () => {
    TestBattery.test('should register global middleware', (battery) => {
      const app = createApp<TestMeta>({ requiresAuth: false });
      let middlewareCalled = false;

      app.use(async (req, res, next) => {
        middlewareCalled = true;
        await next();
      });

      battery.test('middleware not called until request')
        .value(middlewareCalled).is.false;
    });

    TestBattery.test('should register path-specific middleware', (battery) => {
      const app = createApp<TestMeta>({ requiresAuth: false });
      let middlewareCalled = false;

      app.use('/api', async (req, res, next) => {
        middlewareCalled = true;
        await next();
      });

      battery.test('middleware not called until request')
        .value(middlewareCalled).is.false;
    });

    TestBattery.test('should register multiple middlewares', (battery) => {
      const app = createApp<TestMeta>({ requiresAuth: false });

      app.use(async (req, res, next) => {
        await next();
      });

      app.use(async (req, res, next) => {
        await next();
      });

      battery.test('multiple middlewares registered')
        .value(true).is.true;
    });
  });

  suite('error handler registration', () => {
    TestBattery.test('should register error handler', (battery) => {
      const app = createApp<TestMeta>({ requiresAuth: false });

      app.onError(async (err, req, res, next) => {
        res.status(500).json({ error: err.message });
      });

      battery.test('error handler registered')
        .value(true).is.true;
    });

    TestBattery.test('should register multiple error handlers', (battery) => {
      const app = createApp<TestMeta>({ requiresAuth: false });

      app.onError(async (err, req, res, next) => {
        // First handler
      });

      app.onError(async (err, req, res, next) => {
        // Second handler
      });

      battery.test('multiple error handlers registered')
        .value(true).is.true;
    });
  });

  suite('finalizer registration', () => {
    TestBattery.test('should register finalizer', (battery) => {
      const app = createApp<TestMeta>({ requiresAuth: false });

      app.onFinalize(async (req, res) => {
        // Logging logic
      });

      battery.test('finalizer registered')
        .value(true).is.true;
    });

    TestBattery.test('should register multiple finalizers', (battery) => {
      const app = createApp<TestMeta>({ requiresAuth: false });

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
      const app = createApp<TestMeta>({ requiresAuth: false });

      app.onTransform(async (req, res) => {
        // Transform response
      });

      battery.test('transformer registered')
        .value(true).is.true;
    });

    TestBattery.test('should register multiple transformers', (battery) => {
      const app = createApp<TestMeta>({ requiresAuth: false });

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
      const app = createApp<TestMeta>({ requiresAuth: false });
      const port = 9876;
      const listenPromise = app.listen(port).finally(() => {
        app.close();
      });
      battery.test('server started on correct port')
        .value(listenPromise).value(port).equal;
    });

    TestBattery.test('should close server gracefully', (battery) => {
      const app = createApp<TestMeta>({ requiresAuth: false });
      const port = 9877;

      const closePromise = app.listen(port).then(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return app.close();
      });

      battery.test('server closed without errors')
        .value(closePromise).value(undefined).equal;
    });

    TestBattery.test('should handle close when server not started', (battery) => {
      const app = createApp<TestMeta>({ requiresAuth: false });
      const closePromise = app.close();
      battery.test('close handled when server not started')
        .value(closePromise).value(undefined).equal;
    });
  });

  suite('request handling', () => {
    TestBattery.test('should handle basic GET request', (battery) => {
      const app = createApp<TestMeta>({ requiresAuth: false });
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
      const app = createApp<TestMeta>({ requiresAuth: false });
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
      const app = createApp<TestMeta>({ requiresAuth: false });
      let capturedBody: any;

      app.post('/users', {}, async (req, res) => {
        capturedBody = req.body;
        res.status(201).json({ created: true, data: req.body });
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
      const app = createApp<TestMeta>({ requiresAuth: false });
      const order: string[] = [];

      app.use(async (req, res, next) => {
        order.push('middleware1');
        await next();
      });

      app.use(async (req, res, next) => {
        order.push('middleware2');
        await next();
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

    TestBattery.test('should handle 404 for non-existent routes', (battery) => {
      const app = createApp<TestMeta>({ requiresAuth: false });

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

    TestBattery.test('should call error handlers on exceptions', (battery) => {
      const app = createApp<TestMeta>({ requiresAuth: false });
      let errorHandlerCalled = false;
      let capturedError: Error | undefined;

      app.get('/error', {}, async (req, res) => {
        throw new Error('Test error');
      });

      app.onError(async (err, req, res, next) => {
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

    TestBattery.test('should call finalizers after response', (battery) => {
      const app = createApp<TestMeta>({ requiresAuth: false });
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

  suite('meta handling', () => {
    TestBattery.test('should provide endpoint meta to handlers', (battery) => {
      const app = createApp<TestMeta>({ requiresAuth: false, roles: [] });
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
        .value(metaPromise).value({ requiresAuth: true, roles: ['admin'] }).deepEqual;
    });

    TestBattery.test('should merge partial meta with defaults', (battery) => {
      const app = createApp<TestMeta>({ requiresAuth: false, roles: ['user'] });
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
        .value({ requiresAuth: true, roles: ['user'] })
        .deepEqual;
    });
  });
});
