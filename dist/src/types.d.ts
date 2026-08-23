/**
 * Core type definitions for the Filament framework
 */
import Headers from "./headers.js";
import Response from './response.js';
interface BooleanObservabilityForStatus<B> {
    /** Included by default when observability is enabled. */
    origin?: B;
    /** Included by default when observability is enabled. */
    method?: B;
    /** Included by default when observability is enabled. */
    path?: B;
    /** Included by default when observability is enabled. */
    search?: B;
    /** Included by default when observability is enabled. */
    statusCode?: B;
    /** Included by default when observability is enabled. */
    trace?: B;
    /** Excluded by default. */
    statusText?: B;
    /** Excluded by default. */
    requestHeaders?: B;
    /** Excluded by default. */
    requestBody?: B;
    /** Excluded by default. */
    responseHeaders?: B;
    /** Excluded by default. */
    responseBody?: B;
}
export type ObservabilityForStatus = BooleanObservabilityForStatus<boolean>;
export type NegativeObservabilityForStatus = BooleanObservabilityForStatus<false>;
/**
 * Indicates what type of policy introduced this latency. `system` is the time
 * between receiving the headers of the request and starting the first
 * middleware or error policy.
 */
export type PolicyType = 'system' | 'middleware' | 'route' | 'transformer' | 'error' | 'finalizer';
/**
 * Indicates the status of the transaction at the time the policy ended.
 * - `new` means the response hasn't been created yet
 * - `open` means headers and status code can still change
 * - `headers` means the headers have been sent and can no longer be changed.
 *    This is only possible in streaming mode.
 * - `closed` means the response is closed and middlewares and routes can no
 *    longer operate. In streaming mode, it is also no longer possible to send
 *    body data and transformers are also excluded. In buffered mode, the body
 *    and headers can still be changed by the transformers.
 * - `committed` means the response is out and nothing can change.
 */
export type ResponseEndStatus = 'new' | 'open' | 'headers' | 'closed' | 'committed';
/**
 * How the response data is handled. In streaming mode, response data chunks go
 * out as soon as they are sent and they are never stored. In buffered mode,
 * the data is held until the transforms are complete, then it all goes out as
 * a unit.
 */
export type ResponseMode = 'buffered' | 'streaming';
export interface ObservedTraceEntry {
    type: PolicyType;
    /**
     * A registered function name when available, otherwise a stable lifecycle
     * label such as `middleware[0]` or `GET /users/:id`.
     */
    name?: string;
    endTime: number;
    endStatus: ResponseEndStatus;
    mode?: ResponseMode;
}
export interface ObservedRequestInfo {
    /** Originating client IP, preferring Forwarded/X-Forwarded-For/X-Real-IP. */
    origin?: string;
    method?: HttpMethod;
    path?: string;
    search?: string;
    headers?: Record<string, string | string[]>;
    body?: string;
}
export interface ObservedResponseInfo {
    statusCode?: number;
    statusText?: string;
    headers?: Record<string, string | string[]>;
    body?: string;
}
export interface ObservedInfo {
    /**
     * Globally sortable transaction ID.
     */
    requestId: string;
    /**
     * Time the transaction started, expressed as millis since the epoch
     */
    startTime: number;
    requestInfo?: ObservedRequestInfo;
    responseInfo?: ObservedResponseInfo;
    trace?: ObservedTraceEntry[];
}
export interface Observability {
    /** Defaults to false. */
    enabled?: boolean;
    /** Uses the documented per-field defaults when omitted. */
    success?: ObservabilityForStatus;
    /** Defaults to the effective success settings. */
    failure?: ObservabilityForStatus;
    /** Settings for an exact HTTP status code override its outcome settings. */
    [statusCode: number]: ObservabilityForStatus | undefined;
}
export interface NegativeObservability {
    /** Setting this to false stops all further collection for the request. */
    enabled?: false;
    success?: NegativeObservabilityForStatus;
    failure?: NegativeObservabilityForStatus;
    [statusCode: number]: NegativeObservabilityForStatus | undefined;
}
/**
 * Base interface for context metadata. Extend this interface to add custom
 * metadata that will be available on request handlers.
 *
 * @example
 * ```typescript
 * interface MyContext extends ContextMeta {
 *  includeWidget: true
 * }
 * ```
 */
export interface ContextMeta {
    application?: {
        /**
         * This can be used to disable observability as the request progresses
         */
        observability?: NegativeObservability;
        observed?: ObservedInfo;
    };
}
/**
 * Base interface for application metadata. Extend this interface to add custom
 * metadata that will be available on request handlers.
 *
 * @example
 * ```typescript
 * interface AppMeta extends FrameworkMeta {
 *   requiresAuth: boolean;
 *   roles: string[];
 * }
 * ```
 */
export interface FrameworkMeta {
    /**
     * @internal Reserved for framework use
     */
    _internal?: unknown;
    /** Framework-level behavior shared by endpoint metadata. */
    application: {
        /**
         * Maximum buffered request body size, as bytes or a byte-size string.
         */
        maxRequestSize: number | string;
        /**
         * Information about the observability of an endpoint.
         */
        observability?: Observability;
    };
}
export { Headers };
/**
 * Supported HTTP methods for route handling
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
export type InitHeader = Record<string, string | string[]> | [
    string,
    string | string[]
];
/**
 * Incoming HTTP request object passed to handlers and middleware.
 *
 * @template T - The application metadata type that extends FrameworkMeta
 * @template C - The mutable, request-local context type
 *
 * @example
 * ```typescript
 * app.get('/users/:id', {}, async (req, res) => {
 *   console.log(req.params.id, req.query, req.body);
 * });
 * ```
 */
export interface Request<T extends FrameworkMeta = FrameworkMeta, C extends ContextMeta = ContextMeta> {
    /** The HTTP method of the request */
    method: HttpMethod;
    /** The request path without query string */
    path: string;
    /** Path parameters extracted from the route pattern */
    params: Record<string, string>;
    /** Query string parameters */
    query: Record<string, string | string[]>;
    /** HTTP request headers */
    headers: Headers;
    /** Parsed request body (for POST, PUT, PATCH requests) */
    body?: Buffer;
    /** Endpoint-specific metadata merged with default metadata */
    endpointMeta: Readonly<T>;
    /**
     * Context object for storing data during request processing. This is mutable
     * and can be used by middleware and handlers to pass information along the
     * processing chain.
     */
    context: C;
    /** @internal Request start timestamp in milliseconds */
    _startTime?: number;
}
/**
 * Request handler function type for routes and middleware. Global middleware
 * advances automatically when it returns with an open response. Closing the
 * response skips the remaining middleware, route handler, and transformers.
 *
 * @template T - The application metadata type
 * @template C - The request context type
 * @param req - The incoming request object
 * @param res - The response object
 *
 * @example
 * ```typescript
 * const handler: AsyncRequestHandler<AppMeta> = async (req, res) => {
 *   if (req.endpointMeta.requiresAuth) {
 *     // check auth
 *   }
 * };
 * ```
 */
export type AsyncRequestHandler<T extends FrameworkMeta = FrameworkMeta, C extends ContextMeta = ContextMeta> = (req: Request<T, C>, res: Response) => void | Promise<void>;
/**
 * Error handler function type for handling exceptions in request processing.
 * Returning with an open response advances to the next registered error
 * handler; closing it marks the error as handled.
 *
 * @template T - The application metadata type
 * @template C - The request context type
 * @param err - The error that was thrown
 * @param req - The incoming request object
 * @param res - The response object
 *
 * @example
 * ```typescript
 * app.onError(async (err, req, res) => {
 *   if (err instanceof ValidationError) {
 *     res.status(400).json({ error: err.message });
 *   } else {
 *     res.status(500).json({ error: 'Internal Server Error' });
 *   }
 * });
 * ```
 */
export type ErrorHandler<T extends FrameworkMeta = FrameworkMeta, C extends ContextMeta = ContextMeta> = (err: Error, req: Request<T, C>, res: Response) => void | Promise<void>;
/**
 * Finalizer function type for cleanup operations after response is sent.
 * These run regardless of success or error and should not throw.
 *
 * @template T - The application metadata type
 * @template C - The request context type
 * @param req - The request object
 * @param res - The response object
 *
 * @example
 * ```typescript
 * app.onFinalize(async (req, res) => {
 *   console.log(`${req.method} ${req.path} - ${res.statusCode}`);
 * });
 * ```
 */
export type Finalizer<T extends FrameworkMeta = FrameworkMeta, C extends ContextMeta = ContextMeta> = (req: Request<T, C>, res: Response) => void | Promise<void>;
/**
 * Response transformer function type for modifying buffered route responses
 * after the handler completes and before commit. Middleware-produced,
 * streaming, and error-flow responses bypass transformers.
 *
 * @template T - The application metadata type
 * @template C - The request context type
 * @param req - The request object
 * @param res - The response object
 *
 * @example
 * ```typescript
 * app.onTransform(async (req, res) => {
 *   // Add timing header
 *   const duration = Date.now() - req._startTime!;
 *   res.headers.set('X-Duration-Ms', duration.toString());
 * });
 * ```
 */
export type ResponseTransformer<T extends FrameworkMeta = FrameworkMeta, C extends ContextMeta = ContextMeta> = (req: Request<T, C>, res: Response) => void | Promise<void>;
/**
 * Internal route definition used by the application.
 * @internal
 */
export interface Route<T extends FrameworkMeta, C extends ContextMeta = ContextMeta> {
    /** HTTP method */
    method: HttpMethod;
    /** Original path pattern */
    path: string;
    /** Compiled regular expression for matching */
    pattern: RegExp;
    /** Extracted parameter names from the path */
    paramNames: string[];
    /** Merged metadata for this route */
    meta: T;
    /** Route handler function */
    handler: AsyncRequestHandler<T, C>;
}
export declare const __type_module__ = true;
//# sourceMappingURL=types.d.ts.map