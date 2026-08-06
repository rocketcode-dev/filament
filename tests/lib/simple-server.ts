import { createApp } from '../../src/application.js';
import { ResponseImpl } from '../../src/response.js';
import {
  FrameworkMeta,
  Request,
  Response
} from '../../src/types.js';
import { Readable } from 'stream';
import TestBattery from 'test-battery';

interface OneTimeServer {
  close: () => Promise<void>;
  port: number;
  response: Promise<Response>;
  request: Promise<void>;
  finish: () => void;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>['resolve'];
  let reject!: Deferred<T>['reject'];

  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

export async function oneTimeServer(
  method: 'get' | 'post' | 'put',
  body: string | Buffer | (string | Buffer)[] | object | null,
  path: string = '/',
): Promise<OneTimeServer> {
  const app = createApp<FrameworkMeta>({});

  const responseDeferred = deferred<Response>();
  const finishedDeferred = deferred<void>();

  let finished = false;

  const finish = (): void => {
    if (finished) {
      return;
    }
    finished = true;
    finishedDeferred.resolve();
  };

  app[method](
    path,
    async (req: Request, res: Response): Promise<void> => {

      // repeat the data sent in the request to the response

      if (req.method !== 'GET') {
        const ct = req.headers.getHeader('Content-Type');
        ct && res.setHeader('Content-Type', ct);

        if (ct === 'application/json') {
          const o = JSON.parse(req.body?.toString() || '');
          res.json(o);
        } else {
          // TODO support chunked data
          if (req.body) {
            res.send(req.body);
          } else {
            res.end()
          }
        }
      }

      responseDeferred.resolve(res);
      await finishedDeferred.promise;
      await res.end();
    },
  );

  const port = await app.listen(0);

  const request = makeSelfRequest(
    port,
    method,
    body,
    path,
  ).catch(error => {
    responseDeferred.reject(error);
    throw error;
  });

  return {
    close: () => app.close(),
    port,
    response: responseDeferred.promise,
    request,
    finish,
  };
}
async function makeSelfRequest(
  port: number,
  method: 'get' | 'post' | 'put',
  body: string | Buffer | (string | Buffer)[] | object | null,
  path: string,
): Promise<void> {
  let requestBody: Readable | Buffer | undefined;
  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
    'Connection': 'close'
  };

  if (method === 'post' || method === 'put') {
    if (Array.isArray(body)) {
      const chunks = [...body];

      requestBody = new Readable({
        read() {
          this.push(chunks.shift() ?? null);
        },
      });
    } else if (typeof body === 'object') {
      if (body !== null) {
        requestBody = Buffer.from(JSON.stringify(body));
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = String(requestBody.byteLength);
      }
    } else if (body !== null) {
      const buffer =
        typeof body === 'string'
          ? Buffer.from(body)
          : body

      requestBody = buffer;
      headers['Content-Length'] = String(buffer.byteLength);
    }
  }

  const options: RequestInit = {
    method,
    headers
  };

  if (requestBody !== undefined) {
    options.body = requestBody;

    /*
     * Required by Node's fetch implementation when streaming a request body.
     */
    if (requestBody instanceof Readable) {
      options.duplex = 'half';
    }
  }

  const response = await fetch(
    `http://localhost:${port}${path}`,
    { ...options }
  );

  await response.text();
}

export function testWithOneTimeServer(
  should: string,
  testFn: (
    battery: TestBattery,
    res: ResponseImpl,
    close: () => Promise<void>,
    port: number,
  ) => Promise<void>,
  call: {
    method?: 'get' | 'post' | 'put';
    body?: string | Buffer | (string | Buffer)[] | object;
    path?: string;
  } = {},
): void {
  TestBattery.test(should, async battery => {
    const server = await oneTimeServer(
      call.method ?? (call.body ? 'post' : 'get'),
      call.body ?? null,
      call.path ?? '/',
    );

    try {
      const res = await server.response as ResponseImpl;

      await testFn(
        battery,
        res,
        server.close,
        server.port,
      );

    } catch(e) {
      battery.fail('exception in test', e);

    } finally {
      server.finish();

      try {
        await server.request;
      } finally {
        await server.close();
      }
    }
  });
}