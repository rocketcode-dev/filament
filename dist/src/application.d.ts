import { FrameworkMeta, AsyncRequestHandler, ErrorHandler, Finalizer, ResponseTransformer } from './types.js';
/**
 * Main Application class for Filament
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
     * Register a route
     */
    private route;
    /**
     * Merge partial meta with defaults
     */
    private mergeMeta;
    get(path: string, meta: Partial<T>, handler: AsyncRequestHandler<T>): void;
    post(path: string, meta: Partial<T>, handler: AsyncRequestHandler<T>): void;
    put(path: string, meta: Partial<T>, handler: AsyncRequestHandler<T>): void;
    patch(path: string, meta: Partial<T>, handler: AsyncRequestHandler<T>): void;
    delete(path: string, meta: Partial<T>, handler: AsyncRequestHandler<T>): void;
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
 * Factory function to create an application
 */
export declare function createApp<T extends FrameworkMeta>(defaultMeta: T): Application<T>;
//# sourceMappingURL=application.d.ts.map