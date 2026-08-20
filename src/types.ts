/**
 * Core type definitions for the Filament framework
 */
import Headers from "./headers.js";
import Response from './response.js';

interface _BooleanObservabilityForStatus<B> {
  // default true for these if undefined after merging metas
  origin?: B,
  method?: B,
  path?: B,
  search?: B,
  statusCode?: B,
  trace?: B,
  // default false for all of these if undefined after merging metas
  statusText?: B,
  requestHeaders?: B,
  requestBody?: B,
  responseHeaders?: B,
  responseBody?: B
}
type ObservabilityForStatus = _BooleanObservabilityForStatus<boolean>;
type NegativeObservabilityForStatus = _BooleanObservabilityForStatus<false>;

/**
 * Indicates what type of policy introduced this latency. `system` is the time
 * between receiving the headers of the request and starting the first
 * middleware or error policy.
 */
type PolicyTypeEnum =
  'system'|'middleware'|'route'|'transformer'|'error'|'finalizer';

/**
 * Indicates the status of the transaction at the time the policy ended.
 * - `new` means the response hasn't be created yet
 * - `open` means headers and status code can still change
 * - `headers` means the headers heave been sent and can no longer be changed.
 *    This is only possible in streaming mode.
 * - `closed` means the response is closed and middlewares and routes can no
 *    longer operate. In streaming mode, it is also no longer possible to send
 *    body data and transformers are also excluded. In buffered mode, the body
 *    and headers can still be changed by the transformers.
 * - `committed` means the response is out and nothing can change.
 */
type EndStatusEnum = 'new'|'open'|'headers'|'closed'|'committed';

/**
 * How the response data is handled. In streaming mode, response data chunks go
 * out as soon as they are sent and they are never stored. In buffered mode,
 * the data is held until the transforms are complete, then it all goes out as
 * a unit.
 */
type ModeEnum = 'buffered'|'streaming';

interface ObservedInfo {
  /**
   * Global transaction ID.
   */
  // dateTime to millis (UTC) + sequence number within that millisecond +
  // random string that was generated at the time of application startup, 
  // example 20260820-165324123-00-fbst3kd, 20260820-165324123-01-fbst3kd,
  // 20260820-165324124-00-fbst3kd -- inteded to be sortable with data from
  // other nodes
  gitd: string;
  /**
   * Time the transaction started, expressed as millis since the epoch
   */
  startTime: number; // millis since the epoch
  responseInfo: {
    statusCode?: number, statusText?: string, headers?: string, body?: string
  },
  requestInfo: {
    origin?: string, method?: HttpMethod, path?: string, search?: string,
    headers?: string[], body?: string[]
  },
  trace?: {
    type: PolicyTypeEnum, name?: string, endtime: number,
    endStatus: EndStatusEnum, mode?: ModeEnum
  }[]
}

interface Observability {
  enabled?: boolean; // default false
  // default is include: { [ all the default values ] }
  success?: ObservabilityForStatus;
  // default is same as success
  failure?: ObservabilityForStatus;
  [key: number]: ObservabilityForStatus;
}
interface NegativeObservability {
  enabled?: false; // default false
  // default is include: { [ all the default values ] }
  success?: NegativeObservabilityForStatus;
  // default is same as success
  failure?: NegativeObservabilityForStatus;
  [key: number]: NegativeObservabilityForStatus;
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
    observability?: NegativeObservability,
    observed?: ObservedInfo
  }
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
    observability?: Observability
  };
}

export { Headers };

/**
 * Supported HTTP methods for route handling
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  | 'OPTIONS' | 'HEAD';

export type InitHeader =
  Record<string, string | string[]> |
  [string, string|string[]];

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
export interface Request<
  T extends FrameworkMeta = FrameworkMeta,
  C extends ContextMeta = ContextMeta,
> {
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
export type AsyncRequestHandler<
  T extends FrameworkMeta = FrameworkMeta,
  C extends ContextMeta = ContextMeta,
> = (
  req: Request<T, C>,
  res: Response
) => void | Promise<void>;

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
export type ErrorHandler<
  T extends FrameworkMeta = FrameworkMeta,
  C extends ContextMeta = ContextMeta,
> = (
  err: Error,
  req: Request<T, C>,
  res: Response
) => void | Promise<void>;

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
export type Finalizer<
  T extends FrameworkMeta = FrameworkMeta,
  C extends ContextMeta = ContextMeta,
> = (
  req: Request<T, C>,
  res: Response
) => void | Promise<void>;

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
export type ResponseTransformer<
  T extends FrameworkMeta = FrameworkMeta,
  C extends ContextMeta = ContextMeta,
> = (
  req: Request<T, C>,
  res: Response
) => void | Promise<void>;

/**
 * Internal route definition used by the application.
 * @internal
 */
export interface Route<
  T extends FrameworkMeta,
  C extends ContextMeta = ContextMeta,
> {
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

// Export a marker to ensure this module has runtime exports
export const __type_module__ = true;
