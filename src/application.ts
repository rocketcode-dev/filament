import http from 'http';
import { URL } from 'url';
import {
  FrameworkMeta,
  HttpMethod,
  Request,
  Response,
  AsyncRequestHandler,
  ErrorHandler,
  Finalizer,
  ResponseTransformer,
  Route,
  Middleware,
} from './types.js';
import { ResponseImpl } from './response.js';
import { pathToRegex, matchPath } from './router.js';
import { deepMerge } from './tools.js';

/**
 * Main Application class for Filament.
 * 
 * The `Application` class is the core of the Filament framework. It manages routes,
 * middleware, error handling, and the HTTP server lifecycle.
 * Use {@link createApp} to instantiate an application.
 * 
 * @template T - The application metadata type that extends FrameworkMeta
 * 
 * @example
 * ```typescript
 * interface AppMeta extends FrameworkMeta {
 *   requiresAuth: boolean;
 * }
 * 
 * const app = createApp<AppMeta>({ requiresAuth: false });
 * 
 * app.get('/users/:id', { requiresAuth: true }, async (req, res) => {
 *   res.json({ id: req.params.id, auth: req.endpointMeta.requiresAuth });
 * });
 * 
 * const port = await app.listen(3000);
 * console.log(`Server running on port ${port}`);
 * ```
 */
export class Application<T extends FrameworkMeta> {
  private routes: Route<T>[] = [];
  private middlewares: Middleware<T>[] = [];
  private errorHandlers: ErrorHandler<T>[] = [];
  private finalizers: Finalizer<T>[] = [];
  private transformers: ResponseTransformer<T>[] = [];
  private defaultMeta: T;
  private server?: http.Server;

  constructor(defaultMeta: T) {
    this.defaultMeta = defaultMeta;
  }

  /**
   * Register a route. Supports multiple paths, metadata, and a single handler.
   */
  private route(
    method: HttpMethod,
    ...pmh: (string | Partial<T> | AsyncRequestHandler<T>)[]
  ): void {
    // Start with defaults, then merge route-specific meta
    let mergedMeta = this.defaultMeta;

    const paths: string[] = [];
    let handler: AsyncRequestHandler<T> | null = null;

    for (const p of pmh) {
      if (typeof p === 'string') {
        paths.push(p);
      } else if (typeof p === 'function') {
        if (null === handler) {
          handler = p;
        } else {
          throw new Error('Multiple handlers provided for route');
        }
      } else if (typeof p === 'object') {
        // Assume it's meta
        mergedMeta = this.mergeMeta(mergedMeta, p);
      }
    }
    if (!handler) {
      throw new Error('No handler provided for route');
    }

    for (const path of paths) {
      const { pattern, paramNames } = pathToRegex(path);
      this.routes.push({
        method,
        path,
        pattern,
        paramNames,
        meta: mergedMeta,
        handler,
      });
    }
  }

  /**
   * Merge partial meta with defaults
   */
  private mergeMeta(original: T, partial: Partial<T>): T {
    let result: T = { ...original };
    result = deepMerge(result, partial);
    return result;
  }

  // HTTP method helpers
  get(
    ...pmh: (string | Partial<T> | AsyncRequestHandler<T>)[]
  ): void {
    this.route('GET', ...pmh);
  }

  post(
    ...pmh: (string | Partial<T> | AsyncRequestHandler<T>)[]
  ): void {
    this.route('POST', ...pmh);
  }

  put(
    ...pmh: (string | Partial<T> | AsyncRequestHandler<T>)[]
  ): void {
    this.route('PUT', ...pmh);
  }

  patch(
    ...pmh: (string | Partial<T> | AsyncRequestHandler<T>)[]
  ): void {
    this.route('PATCH', ...pmh);
  }

  delete(
    ...pmh: (string | Partial<T> | AsyncRequestHandler<T>)[]
  ): void {
    this.route('DELETE', ...pmh);
  }

  /**
   * Register middleware
   */
  use(
    pathOrHandler: string | AsyncRequestHandler<T>,
    handler?: AsyncRequestHandler<T>
  ): void {
    if (typeof pathOrHandler === 'string' && handler) {
      this.middlewares.push({ path: pathOrHandler, handler });
    } else if (typeof pathOrHandler === 'function') {
      this.middlewares.push({ handler: pathOrHandler });
    }
  }

  /**
   * Register error handler
   */
  onError(handler: ErrorHandler<T>): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Register finalizer
   */
  onFinalize(handler: Finalizer<T>): void {
    this.finalizers.push(handler);
  }

  /**
   * Register response transformer
   */
  onTransform(handler: ResponseTransformer<T>): void {
    this.transformers.push(handler);
  }

  /**
   * Execute middleware chain
   */
  private async executeMiddlewareChain(
    req: Request<T>,
    res: Response,
    middlewares: AsyncRequestHandler<T>[]
  ): Promise<void> {
    let currentIndex = 0;

    const next = async (): Promise<void> => {
      if (currentIndex >= middlewares.length) {
        return;
      }

      const middleware = middlewares[currentIndex++];
      await middleware(req, res, next);
    };

    await next();
  }

  /**
   * Execute error handlers
   */
  private async executeErrorHandlers(
    err: Error,
    req: Request<T>,
    res: Response
  ): Promise<void> {
    for (const handler of this.errorHandlers) {
      try {
        await handler(err, req, res, async () => {});
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    }

    // If no error handler sent a response, send default error
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * Execute response transformers
   */
  private async executeTransformers(req: Request<T>, res: Response): Promise<void> {
    for (const transformer of this.transformers) {
      try {
        await transformer(req, res);
      } catch (err) {
        console.error('Error in response transformer:', err);
        throw err;
      }
    }
  }

  /**
   * Execute finalizers
   */
  private async executeFinalizers(req: Request<T>, res: Response): Promise<void> {
    for (const finalizer of this.finalizers) {
      try {
        await finalizer(req, res);
      } catch (err) {
        console.error('Error in finalizer:', err);
        // Finalizers should not block response
      }
    }
  }

  /**
   * Handle incoming HTTP request
   */
  private async handleRequest(nodeReq: http.IncomingMessage, nodeRes: http.ServerResponse): Promise<void> {
    const url = new URL(nodeReq.url || '/', `http://${nodeReq.headers.host || 'localhost'}`);
    const method = (nodeReq.method || 'GET').toUpperCase() as HttpMethod;
    const path = url.pathname;

    // Find matching route
    let matchedRoute: Route<T> | undefined;
    let params: Record<string, string> = {};

    for (const route of this.routes) {
      if (route.method !== method) continue;

      const match = matchPath(path, route.pattern, route.paramNames);
      if (match) {
        matchedRoute = route;
        params = match.params;
        break;
      }
    }

    if (!matchedRoute) {
      nodeRes.statusCode = 404;
      nodeRes.end(JSON.stringify({ error: 'Not Found' }));
      return;
    }

    // Parse query parameters
    const query: Record<string, string | string[]> = {};
    url.searchParams.forEach((value, key) => {
      const existing = query[key];
      if (existing) {
        query[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
      } else {
        query[key] = value;
      }
    });

    // Parse headers
    const headers: Record<string, string | string[] | undefined> = {};
    Object.entries(nodeReq.headers).forEach(([key, value]) => {
      headers[key] = value;
    });

    // Create request object
    const req: Request<T> = {
      method,
      path,
      params,
      query,
      headers,
      context: {}, // Initialize empty context
      endpointMeta: matchedRoute.meta,
      _startTime: Date.now(),
    };

    // Read body for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      const chunks: Buffer[] = [];
      for await (const chunk of nodeReq) {
        chunks.push(chunk);
      }
      const bodyStr = Buffer.concat(chunks).toString();
      if (bodyStr) {
        try {
          req.body = JSON.parse(bodyStr);
        } catch {
          req.body = bodyStr;
        }
      }
    }

    // Create response object
    const res = new ResponseImpl((finalRes) => {
      nodeRes.statusCode = finalRes.statusCode;
      Object.entries(finalRes.headers).forEach(([key, value]) => {
        nodeRes.setHeader(key, value);
      });
      if (finalRes.body) {
        nodeRes.end(finalRes.body);
      } else {
        nodeRes.end();
      }
    });

    let hadError = false;

    try {
      // Filter applicable middleware (by path if specified)
      const applicableMiddleware = this.middlewares
        .filter((mw) => !mw.path || path.startsWith(mw.path))
        .map((mw) => mw.handler);

      // Execute middleware chain
      await this.executeMiddlewareChain(req, res, applicableMiddleware);

      // If response already sent by middleware, skip handler
      if (!res.headersSent) {
        // Execute route handler
        await matchedRoute.handler(req, res, async () => {});

        // Execute response transformers (only on success)
        if (!res.headersSent) {
          await this.executeTransformers(req, res);
        }
      }
    } catch (err) {
      hadError = true;
      await this.executeErrorHandlers(err as Error, req, res);
    } finally {
      // Always execute finalizers
      await this.executeFinalizers(req, res);

      // Ensure response is sent
      if (!res.headersSent) {
        res.end();
      }
    }
  }

  /**
   * Start the server
   */
  async listen(port: number): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res).catch((err) => {
          console.error('Unhandled error in request handler:', err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Internal Server Error' }));
          }
        });
      });

      this.server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`Port ${port} is already in use`));
        } else if (err.code === 'EACCES') {
          reject(new Error(`Permission denied: cannot listen on port ${port}`));
        } else {
          reject(new Error(`Failed to start server on port ${port}: ${err.message}`));
        }
      });

      this.server.listen(port, () => {
        resolve(port);
      });
    });
  }

  /**
   * Stop the server
   */
  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

/**
 * Factory function to create a new Filament application.
 * 
 * Creates an Application instance with the specified metadata type and default metadata values.
 * The metadata type extends {@link FrameworkMeta} and defines the shape of metadata available
 * to all route handlers and middleware.
 * 
 * @template T - The application metadata type that extends FrameworkMeta
 * @param defaultMeta - Default metadata object shared across all routes.
 *                      Route-specific metadata merges with these defaults.
 * @returns A new Application instance with the specified metadata type
 * 
 * @example
 * ```typescript
 * interface AppMeta extends FrameworkMeta {
 *   requiresAuth: boolean;
 *   rateLimit: number;
 * }
 * 
 * const app = createApp<AppMeta>({
 *   requiresAuth: false,
 *   rateLimit: 100,
 * });
 * 
 * app.get('/public', {}, async (req, res) => {
 *   res.json({ auth: req.endpointMeta.requiresAuth });
 * });
 * ```
 */
export function createApp<T extends FrameworkMeta>(defaultMeta: T): Application<T> {
  return new Application<T>(defaultMeta);
}
