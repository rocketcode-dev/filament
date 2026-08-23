import http from 'node:http';
import https from 'node:https';
import { FrameworkMeta, ContextMeta, HttpMethod, AsyncRequestHandler, ErrorHandler, Finalizer, ResponseTransformer } from './types.js';
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
export declare class Application<T extends FrameworkMeta, C extends ContextMeta = ContextMeta> {
    private routes;
    private middlewares;
    private errorHandlers;
    private finalizers;
    private transformers;
    private defaultMeta;
    private defaultContext;
    private server?;
    private requestIdFactory?;
    constructor(defaultMeta: T, defaultContext: C);
    /**
     * Register a route. Supports multiple paths, metadata, and a single handler.
     */
    route(method: HttpMethod, ...pmh: (string | Partial<T> | AsyncRequestHandler<T, C>)[]): void;
    /**
     * Merge metadata into a new, normalized, deeply frozen object.
     */
    private mergeMeta;
    get(...pmh: (string | Partial<T> | AsyncRequestHandler<T, C>)[]): void;
    post(...pmh: (string | Partial<T> | AsyncRequestHandler<T, C>)[]): void;
    put(...pmh: (string | Partial<T> | AsyncRequestHandler<T, C>)[]): void;
    patch(...pmh: (string | Partial<T> | AsyncRequestHandler<T, C>)[]): void;
    delete(...pmh: (string | Partial<T> | AsyncRequestHandler<T, C>)[]): void;
    /**
     * Register middleware
     */
    use(handler: AsyncRequestHandler<T, C>): void;
    /**
     * Register error handler
     */
    onError(handler: ErrorHandler<T, C>): void;
    /**
     * Register finalizer
     */
    onFinalize(handler: Finalizer<T, C>): void;
    /**
     * Register response transformer
     */
    onTransform(handler: ResponseTransformer<T, C>): void;
    /**
     * Execute middleware chain
     */
    private executeMiddlewareChain;
    /**
     * Execute error handlers
     */
    private executeErrorHandlers;
    /**
     * Execute response transformers
     */
    private executeTransformers;
    /**
     * Execute finalizers
     */
    private executeFinalizers;
    /**
     * Buffer a request body without retaining data beyond the configured limit.
     * The stream is still consumed before a size error enters the error flow.
     */
    private readRequestBody;
    /**
     * Handle incoming HTTP request
     */
    private handleRequest;
    /**
     * Start the server. Returns a promise that resolves with the port number of
     * the new server
     */
    listen(// assumes http on all IP addresses
    port: number, options?: http.ServerOptions): Promise<number>;
    listen(protocol: 'http', port: number, options?: http.ServerOptions): Promise<number>;
    listen(protocol: 'http', ip: string, port: number, options?: http.ServerOptions): Promise<number>;
    listen(protocol: 'https', port: number, options?: https.ServerOptions): Promise<number>;
    listen(protocol: 'https', ip: string, port: number, options?: https.ServerOptions): Promise<number>;
    /**
     * Stop the server
     */
    close(): Promise<void>;
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
export declare function createApp<T extends FrameworkMeta, C extends ContextMeta = ContextMeta>(defaultMeta: T, defaultContext: C): Application<T, C>;
export declare class RouteContext<T extends FrameworkMeta, C extends ContextMeta = ContextMeta> {
    private app;
    private bases;
    private metas;
    constructor(app: Application<T, C>, ...basesAndMetas: (string | Partial<T>)[]);
    route(method: HttpMethod | HttpMethod[], ...pmh: (string | Partial<T> | AsyncRequestHandler<T, C>)[]): void;
    get(...pmh: (string | Partial<T> | AsyncRequestHandler<T, C>)[]): void;
    post(...pmh: (string | Partial<T> | AsyncRequestHandler<T, C>)[]): void;
    put(...pmh: (string | Partial<T> | AsyncRequestHandler<T, C>)[]): void;
    patch(...pmh: (string | Partial<T> | AsyncRequestHandler<T, C>)[]): void;
    delete(...pmh: (string | Partial<T> | AsyncRequestHandler<T, C>)[]): void;
}
export declare function createRouteContext<T extends FrameworkMeta, C extends ContextMeta = ContextMeta>(app: Application<T, C>, ...basesAndMetas: (string | Partial<T>)[]): RouteContext<T, C>;
//# sourceMappingURL=application.d.ts.map