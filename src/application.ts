import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls'
import { URL } from 'url';
import {
  FrameworkMeta,
  ContextMeta,
  Headers,
  HttpMethod,
  Request,
  AsyncRequestHandler,
  ErrorHandler,
  Finalizer,
  ResponseTransformer,
  Route,
} from './types.js';
import { Response } from './response.js';
import { pathToRegex, matchPath } from './router.js';
import { HttpError } from './errors.js';
import { deepMerge, normalizeByteSize } from './tools.js';
import {
  RequestIdFactory,
  registeredPolicyName,
  RequestObserver,
  requestOrigin,
  routePolicyName,
} from './observability.js';

/**
 * Main Application class for Filament.
 * 
 * The `Application` class is the core of the Filament framework. It manages routes,
 * middleware, error handling, and the HTTP server lifecycle.
 * Use {@link createApp} to instantiate an application.
 * 
 * @template T - The application metadata type that extends FrameworkMeta
 * @template C - The mutable, request-local context type
 * 
 * @example
 * ```typescript
 * interface AppMeta extends FrameworkMeta {
 *   requiresAuth: boolean;
 * }
 * 
 * const app = createApp<AppMeta>(
 *   {
 *     application: { maxRequestSize: '2MiB' },
 *     requiresAuth: false,
 *   },
 *   {},
 * );
 * 
 * app.get('/users/:id', { requiresAuth: true }, async (req, res) => {
 *   res.json({ id: req.params.id, auth: req.endpointMeta.requiresAuth });
 * });
 * 
 * const port = await app.listen(3000);
 * console.log(`Server running on port ${port}`);
 * ```
 */
export class Application<
  T extends FrameworkMeta,
  C extends ContextMeta = ContextMeta,
> {
  private routes: Route<T, C>[] = [];
  private middlewares: AsyncRequestHandler<T, C>[] = [];
  private errorHandlers: ErrorHandler<T, C>[] = [];
  private finalizers: Finalizer<T, C>[] = [];
  private transformers: ResponseTransformer<T, C>[] = [];
  private defaultMeta: T;
  private defaultContext: C;
  private server?: http.Server;
  private requestIdFactory?: RequestIdFactory;

  constructor(defaultMeta: T, defaultContext: C) {
    this.defaultMeta = this.mergeMeta(defaultMeta);
    this.defaultContext = deepMerge(defaultContext);
  }

  /**
   * Register a route. Supports multiple paths, metadata, and a single handler.
   */
  public route(
    method: HttpMethod,
    ...pmh: (string | Partial<T> | AsyncRequestHandler<T, C>)[]
  ): void {
    const paths: string[] = [];
    const metas: Partial<T>[] = [];
    let handler: AsyncRequestHandler<T, C> | null = null;

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
        metas.push(p);
      }
    }
    if (!handler) {
      throw new Error('No handler provided for route');
    }
    const mergedMeta = this.mergeMeta(this.defaultMeta, ...metas);

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
   * Merge metadata into a new, normalized, deeply frozen object.
   */
  private mergeMeta(defaultMeta: T, ...sources: Partial<T>[]): T {
    const result = deepMerge(defaultMeta, ...sources);
    result.application.maxRequestSize = normalizeByteSize(
      result.application.maxRequestSize,
    );
    return deepMerge(result, true);
  }

  // HTTP method helpers
  get(
    ...pmh: (string | Partial<T> | AsyncRequestHandler<T, C>)[]
  ): void {
    this.route('GET', ...pmh);
  }

  post(
    ...pmh: (string | Partial<T> | AsyncRequestHandler<T, C>)[]
  ): void {
    this.route('POST', ...pmh);
  }

  put(
    ...pmh: (string | Partial<T> | AsyncRequestHandler<T, C>)[]
  ): void {
    this.route('PUT', ...pmh);
  }

  patch(
    ...pmh: (string | Partial<T> | AsyncRequestHandler<T, C>)[]
  ): void {
    this.route('PATCH', ...pmh);
  }

  delete(
    ...pmh: (string | Partial<T> | AsyncRequestHandler<T, C>)[]
  ): void {
    this.route('DELETE', ...pmh);
  }

  /**
   * Register middleware
   */
  use(handler: AsyncRequestHandler<T, C>): void {
    this.middlewares.push(handler);
  }

  /**
   * Register error handler
   */
  onError(handler: ErrorHandler<T, C>): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Register finalizer
   */
  onFinalize(handler: Finalizer<T, C>): void {
    this.finalizers.push(handler);
  }

  /**
   * Register response transformer
   */
  onTransform(handler: ResponseTransformer<T, C>): void {
    this.transformers.push(handler);
  }

  /**
   * Execute middleware chain
   */
  private async executeMiddlewareChain(
    req: Request<T, C>,
    res: Response,
    middlewares: AsyncRequestHandler<T, C>[],
    observer: RequestObserver<T, C>,
  ): Promise<boolean> {
    for (const [index, middleware] of middlewares.entries()) {
      try {
        await middleware(req, res);
      } finally {
        observer.policyEnded(
          'middleware',
          registeredPolicyName(middleware, 'middleware', index),
          res,
        );
      }
      if (res.closed) return false;
    }
    return true;
  }

  /**
   * Execute error handlers
   */
  private async executeErrorHandlers(
    err: Error,
    req: Request<T, C>,
    res: Response,
    observer: RequestObserver<T, C>,
  ): Promise<void> {
    const responseHasEscaped = (): boolean =>
      res.disconnected || res.committed || res.headers.frozen;
    const logLateError = (error: Error): void => {
      console.error('Error after response started:', error);
    };
    const defaultHandler = async (error: Error): Promise<void> => {
      try {
        // Once headers have escaped, the status and body can no longer be
        // replaced. Preserve the response and make the late failure observable.
        if (responseHasEscaped()) {
          logLateError(error);
          return;
        }
        const statusCode = error instanceof HttpError ? error.statusCode : 500;
        const message = statusCode < 500
          ? error.message
          : 'Internal Server Error';
        res.status(statusCode);
        res.headers.set('Content-Type', 'application/json');
        res.body = JSON.stringify({ error: message });
        await res.end();
      } finally {
        observer.policyEnded('error', 'default', res);
      }
    };

    let currentError = err;
    if (responseHasEscaped()) {
      logLateError(currentError);
      return;
    }

    for (const [index, handler] of this.errorHandlers.entries()) {
      let replacementThrown = false;
      try {
        await handler(currentError, req, res);
      } catch (caught) {
        currentError = caught instanceof Error
          ? caught
          : new Error(String(caught));
        replacementThrown = true;
      } finally {
        observer.policyEnded(
          'error',
          registeredPolicyName(handler, 'error', index),
          res,
        );
      }
      if (responseHasEscaped()) {
        if (replacementThrown) {
          logLateError(currentError);
        }
        return;
      }
      // A returned, closed response handles the error. A thrown replacement
      // continues through the chain while a buffered response is uncommitted.
      if (res.closed && !replacementThrown) return;
    }
    await defaultHandler(currentError);
  }

  /**
   * Execute response transformers
   */
  private async executeTransformers(
    req: Request<T, C>,
    res: Response,
    observer: RequestObserver<T, C>,
  )
  : Promise<void> {
    for (const [index, transformer] of this.transformers.entries()) {
      if (res.committed) {
        break;
      }
      try {
        await transformer(req, res);
      } finally {
        observer.policyEnded(
          'transformer',
          registeredPolicyName(transformer, 'transformer', index),
          res,
        );
      }
    }
  }

  /**
   * Execute finalizers
   */
  private async executeFinalizers(req: Request<T, C>, res: Response)
  : Promise<void> {
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
   * Buffer a request body without retaining data beyond the configured limit.
   * The stream is still consumed before a size error enters the error flow.
   */
  private async readRequestBody(
    nodeReq: http.IncomingMessage,
    maxRequestSize: number,
  ): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let totalLength = 0;
    let sizeExceeded = false;

    for await (const chunk of nodeReq) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalLength += buffer.length;
      if (totalLength > maxRequestSize) {
        sizeExceeded = true;
        chunks.length = 0;
      } else if (!sizeExceeded) {
        chunks.push(buffer);
      }
    }

    if (sizeExceeded) {
      throw new HttpError(413, 'Payload Too Large');
    }
    return Buffer.concat(chunks, totalLength);
  }

  /**
   * Handle incoming HTTP request
   */
  private async handleRequest(
    nodeReq: http.IncomingMessage,
    nodeRes: http.ServerResponse
  ): Promise<void> {
    const startTime = Date.now();
    const method = (nodeReq.method || 'GET').toUpperCase() as HttpMethod;
    let path = nodeReq.url?.split('?', 1)[0] || '/';
    const query: Record<string, string | string[]> = {};
    let requestTargetError: HttpError | undefined;
    let parsedUrl: URL | undefined;
    const origin = requestOrigin(nodeReq);

    try {
      const url = parsedUrl = new URL(
        nodeReq.url || '/',
        `http://${nodeReq.headers.host || 'localhost'}`
      );
      path = url.pathname;

      // Parse query parameters
      url.searchParams.forEach((value, key) => {
        const existing = query[key];
        if (existing) {
          query[key] = Array.isArray(existing)
            ? [...existing, value]
            : [existing, value];
        } else {
          query[key] = value;
        }
      });
    } catch {
      requestTargetError = new HttpError(400, 'Bad Request');
    }

    // Parse headers
    const headers: Record<string, string | string[]> = {};
    Object.entries(nodeReq.headers).forEach(([key, value]) => {
      if (value !== undefined) {
        headers[key] = value;
      }
    });

    // Create a base request before routing so routing failures can use the
    // standard error and finalizer flow.
    let req: Request<T, C> = {
      method,
      path,
      params: {},
      query,
      headers: new Headers('request', headers),
      context: deepMerge(this.defaultContext),
      endpointMeta: this.defaultMeta,
      _startTime: startTime,
    };

    // Create response object
    const res = new Response(
      nodeRes,
      { hasTransformers: !!this.transformers.length }
    );
    const observer = new RequestObserver(req, this.requestIdFactory!, startTime);

    try {
      if (requestTargetError) throw requestTargetError;

      let matchedRoute: Route<T, C> | undefined;
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
        throw new HttpError(404, 'Not Found');
      }

      req = {
        ...req,
        params,
        endpointMeta: matchedRoute.meta,
      };
      observer.configure(
        matchedRoute.meta.application.observability,
        origin,
        parsedUrl?.search ?? '',
        res,
      );

      // Buffer request bodies for methods supported by the current API.
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        req.body = await this.readRequestBody(
          nodeReq,
          matchedRoute.meta.application.maxRequestSize as number,
        );
        observer.captureRequestBody(req.body);
      }

      observer.finishSystem(res);

      // Execute middleware chain
      const shouldContinue = await this.executeMiddlewareChain(
        req,
        res,
        this.middlewares,
        observer,
      );

      if (shouldContinue) {
        try {
          await matchedRoute.handler(req, res);
        } finally {
          observer.policyEnded(
            'route',
            routePolicyName(matchedRoute.handler, method, matchedRoute.path),
            res,
          );
        }

        // The application owns the route boundary: it supplies an implicit end
        // when needed, transforms buffered route responses, and commits them.
        // Responses closed by middleware never reach this block.
        await res.end();
        if (!res.disconnected && !res.streaming && !res.committed) {
          await this.executeTransformers(req, res, observer);
        }
      }

      // make sure the response is over.
      await res.commit();
    } catch (caught) {
      if (!observer.isConfigured) {
        observer.configure(
          this.defaultMeta.application.observability,
          origin,
          parsedUrl?.search ?? '',
          res,
        );
      }
      observer.finishSystem(res);
      const err = caught instanceof URIError
        ? new HttpError(400, 'Bad Request')
        : caught instanceof Error
          ? caught
          : new Error(String(caught));
      await this.executeErrorHandlers(err, req, res, observer);
    } finally {
      // Finalization starts by closing and committing the response. Finalizers
      // still always run, including when native response completion fails.
      try {
        await res.end();
        await res.commit();
      } finally {
        observer.prepareForFinalizers(res);
        await this.executeFinalizers(req, res);
      }
    }
  }

  /**
   * Start the server. Returns a promise that resolves with the port number of
   * the new server
   */
  async listen( // assumes http on all IP addresses
    port: number,
    options?: http.ServerOptions
  ): Promise<number>;
  async listen(
    protocol: 'http',
    port: number,
    options?: http.ServerOptions
  ): Promise<number>;
  async listen(
    protocol: 'http',
    ip: string,
    port: number,
    options?: http.ServerOptions
  ): Promise<number>;
  async listen(
    protocol: 'https',
    port: number,
    options?: https.ServerOptions
  ): Promise<number>;
  async listen(
    protocol: 'https',
    ip: string,
    port: number,
    options?: https.ServerOptions
  ): Promise<number>;
  async listen(
    protocol: 'http'|'https'|number,
    ip?: string|number|http.ServerOptions|https.ServerOptions,
    port?: number|http.ServerOptions|https.ServerOptions,
    options?: http.ServerOptions|https.ServerOptions,
  ): Promise<number> {

    const parameters
      :(undefined|string|number|http.ServerOptions|https.ServerOptions)[] =
      [protocol, ip, port, options];
    if (typeof protocol === 'number') {
      parameters.unshift('http');
    }
    if (typeof parameters[1] !== 'string' && parameters[1] !== undefined) {
      parameters.splice(1, 0, undefined);
    }
    parameters[3] ??= {};

    protocol = parameters[0] as 'http'|'https';
    ip = parameters[1] as string|undefined;
    port = parameters[2] as number;
    switch(protocol) {
    case 'http':
      options = parameters[3] as http.ServerOptions;
      break;
    case 'https':
      options = parameters[3] as https.ServerOptions;
      break;
    }

    // One identifier namespace is shared by every request for this
    // application's server lifetime, including a close/listen cycle.
    this.requestIdFactory ??= new RequestIdFactory(process.env.POD_NAME);
    return new Promise((resolve, reject) => {
      const listener: http.RequestListener = (req, res) => {
        this.handleRequest(req, res).catch((err) => {
          console.error('Unhandled error in request handler:', err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Internal Server Error' }));
          }
        });
      }

      let server!: http.Server|https.Server;
      switch(protocol) {
      case 'http':
        server = http.createServer(options as http.ServerOptions, listener);
        break;
      case 'https':
        server = https.createServer(options as https.ServerOptions, listener);
        break;
      }

      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`Port ${port} is already in use`));
        } else if (err.code === 'EACCES') {
          reject(new Error(`Permission denied: cannot listen on port ${port}`));
        } else {
          reject(new Error(`Failed to start server on port ${port}: ${err.message}`));
        }
      });

      const listenListener = () => {
        const address = server.address();
        if (address) {
          if (typeof address === 'string') {
            resolve(parseInt(address.split(':').pop()!));
          } else {
            resolve(address.port);
          }
        } else {
          reject(new Error('Failed to get server port'))
        }
      };

      if (ip) {
        server.listen(port, ip, listenListener);
      } else {
        server.listen(port, listenListener);
      }

      this.server = server;
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
 * Creates an Application instance with the specified metadata type and default
 * metadata values. The metadata type extends {@link FrameworkMeta} and defines
 * the shape of metadata available to all route handlers and middleware.
 * 
 * @template T - The application metadata type that extends FrameworkMeta
 * @template C - The mutable, request-local context type
 * @param defaultMeta - Default metadata object shared across all routes.
 *                      Route-specific metadata merges with these defaults.
 * @param defaultContext - Baseline context cloned for each request.
 * @returns A new Application instance with the specified metadata type
 * 
 * @example
 * ```typescript
 * interface AppMeta extends FrameworkMeta {
 *   requiresAuth: boolean;
 *   rateLimit: number;
 * }
 * 
 * interface AppContext extends ContextMeta {
 *   requestId: string;
 * }
 *
 * const app = createApp<AppMeta, AppContext>(
 *   {
 *     application: { maxRequestSize: '2MiB' },
 *     requiresAuth: false,
 *     rateLimit: 100,
 *   },
 *   { requestId: '' },
 * );
 * 
 * app.get('/public', {}, async (req, res) => {
 *   res.json({ auth: req.endpointMeta.requiresAuth });
 * });
 * ```
 */
export function createApp<
  T extends FrameworkMeta,
  C extends ContextMeta = ContextMeta,
>(defaultMeta: T, defaultContext: C): Application<T, C> {
  return new Application<T, C>(defaultMeta, defaultContext);
}

export class RouteContext<
  T extends FrameworkMeta,
  C extends ContextMeta = ContextMeta,
> {
  private app: Application<T, C>;
  private bases: string[];
  private metas: Partial<T>[];
  constructor(
    app: Application<T, C>,
    ...basesAndMetas: (string | Partial<T>)[]
  ) {
    this.app = app;
    this.bases = [];
    this.metas = [];
    for (const item of basesAndMetas) {
      if (typeof item === 'string') {
        this.bases.push(item);
      } else if (typeof item === 'object') {
        this.metas.push(item);
      }
    }
    if (this.bases.length === 0) {
      this.bases.push('');
    }
  }
  route(
    method: HttpMethod|HttpMethod[],
    ...pmh: (string | Partial<T> | AsyncRequestHandler<T, C>)[]
  ) {
    const paths: string[] = [];
    const metas = Array.from(this.metas);
    let handler: AsyncRequestHandler<T, C> | null = null;
    for (const item of pmh) {
      if (typeof item === 'string') {
        for (const base of this.bases) {
          const fullPath = `${base}${item}`;
          paths.push(fullPath);
        }
      } else if (typeof item === 'function') {
        if (handler) {
          throw new Error('Multiple handlers provided for route');
        }
        handler = item;
      } else if (typeof item === 'object') {
        metas.push(item);
      }
    }
    if (null === handler) {
      throw new Error('No handler provided for route');
    }
    for (const m of Array.isArray(method) ? method : [method]) {
      this.app.route(m, ...paths, ...metas, handler!);
    }
  }

  // HTTP method helpers
  get(
    ...pmh: (string | Partial<T> | AsyncRequestHandler<T, C>)[]
  ): void {
    this.route('GET', ...pmh);
  }

  post(
    ...pmh: (string | Partial<T> | AsyncRequestHandler<T, C>)[]
  ): void {
    this.route('POST', ...pmh);
  }

  put(
    ...pmh: (string | Partial<T> | AsyncRequestHandler<T, C>)[]
  ): void {
    this.route('PUT', ...pmh);
  }

  patch(
    ...pmh: (string | Partial<T> | AsyncRequestHandler<T, C>)[]
  ): void {
    this.route('PATCH', ...pmh);
  }

  delete(
    ...pmh: (string | Partial<T> | AsyncRequestHandler<T, C>)[]
  ): void {
    this.route('DELETE', ...pmh);
  }
}

export function createRouteContext<
  T extends FrameworkMeta,
  C extends ContextMeta = ContextMeta,
>(
  app: Application<T, C>,
  ...basesAndMetas: (string | Partial<T>)[]
): RouteContext<T, C> {
  return new RouteContext<T, C>(app, ...basesAndMetas);
}
