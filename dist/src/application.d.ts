import { FrameworkMeta, AsyncRequestHandler, ErrorHandler, Finalizer, ResponseTransformer } from './types.js';
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
export declare class Application<T extends FrameworkMeta> {
    private routes;
    private middlewares;
    private errorHandlers;
    private finalizers;
    private transformers;
    private defaultMeta;
    private server?;
    constructor(defaultMeta: T);
    /**
     * Register a route. Supports multiple paths, metadata, and a single handler.
     */
    private route;
    /**
     * Merge partial meta with defaults
     */
    private mergeMeta;
    get(...pmh: (string | Partial<T> | AsyncRequestHandler<T>)[]): void;
    post(...pmh: (string | Partial<T> | AsyncRequestHandler<T>)[]): void;
    put(...pmh: (string | Partial<T> | AsyncRequestHandler<T>)[]): void;
    patch(...pmh: (string | Partial<T> | AsyncRequestHandler<T>)[]): void;
    delete(...pmh: (string | Partial<T> | AsyncRequestHandler<T>)[]): void;
    /**
     * Register middleware
     */
    use(pathOrHandler: string | AsyncRequestHandler<T>, handler?: AsyncRequestHandler<T>): void;
    /**
     * Register error handler
     */
    onError(handler: ErrorHandler<T>): void;
    /**
     * Register finalizer
     */
    onFinalize(handler: Finalizer<T>): void;
    /**
     * Register response transformer
     */
    onTransform(handler: ResponseTransformer<T>): void;
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
     * Handle incoming HTTP request
     */
    private handleRequest;
    /**
     * Start the server
     */
    listen(port: number): Promise<number>;
    /**
     * Stop the server
     */
    close(): Promise<void>;
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
export declare function createApp<T extends FrameworkMeta>(defaultMeta: T): Application<T>;
//# sourceMappingURL=application.d.ts.map