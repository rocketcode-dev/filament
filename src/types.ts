/**
 * Core type definitions for the Filament framework
 */
import Headers from "./headers.js";

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
 * Middleware next function for chaining middleware and handlers.
 * Call this to proceed to the next middleware or route handler.
 * 
 * @returns Either void or a Promise that resolves when the next handler
 *  completes
 */
export type NextFunction = () => void | Promise<void>;

/**
 * Incoming HTTP request object passed to handlers and middleware.
 * 
 * @template T - The application metadata type that extends FrameworkMeta
 * 
 * @example
 * ```typescript
 * app.get('/users/:id', {}, async (req, res) => {
 *   console.log(req.params.id, req.query, req.body);
 * });
 * ```
 */
export interface Request<T extends FrameworkMeta = FrameworkMeta> {
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
  context: Record<string, any>;
  /** @internal Request start timestamp in milliseconds */
  _startTime?: number;
}

/**
 * HTTP response object for sending data to the client.
 * Supports method chaining for fluent API.
 * 
 * @example
 * ```typescript
 * res.status(200).json({ success: true });
 * // or
 * res.setHeader('X-Custom', 'value').send('data');
 * ```
 */
export interface Response {
  /** HTTP status code */
  statusCode: number;
  /** Response body content */
  body?: unknown;

  /**
   * Set to `true` if the response is closed and cannot send any more body data,
   * `false` if not.
   */
  get closed(): boolean;

  /**
   * Returns all the headers. This object cannot be changed. Use addHeader and
   * setHeader to change the response headers.
   * @returns The headers
   */
  get headerPairs(): readonly (readonly [string, string])[];

  /** 
   * Returns `true` if the response headers have been sent
   */
  get headersSent(): boolean;

  /**
   * Returns `true` if a chunk of the response is sent already
   */
  get sendingInChunks(): boolean;
  
  /**
   * Set the HTTP status code
   * @param code - The status code to set
   * @returns This response object for chaining
   */
  status(code: number): Response;
  
  /**
   * Add a response header. If a header with the name name already exists,
   * another header will be added with the same name.
   * Headers must be set before sending the response.
   * 
   * @param name - Header name
   * @param value - Header value(s), can be a string or array of strings
   * @returns this object for chaining
   * @throws Error if headers have already been sent
   */
  addHeader(name: string, ...value: (string | string[])[]): Response;

  /**
   * Add response headers _en masse_. If a header with the same name already
   * exists, another header will be added with the same name.
   * Headers must be set before sending the response.
   * 
   * @param name - Header name
   * @param value - Header value(s), can be a string or array of strings
   * @returns this object for chaining
   * @throws Error if headers have already been sent
   */
  addHeaders(...newHeaders:(InitHeader|InitHeader[])[]): Response;

  /**
   * Returns the value of a header. If there are multiple headers of the same
   * name, this will return an array in insertion order.
   * @param name the name of the header to retrieve.
   * @returns the header value or values, or `null` if the header does not exist
   */
  getHeader(name: string):string|string[]|null;
  
  /**
   * Set a response header. If a header with the same name already exists, the
   * header will be replaced with this one.
   * Headers must be set before sending the response.
   * 
   * @param name - Header name
   * @param value - Header value(s), can be a string or array of strings
   * @returns this object for chaining
   * @throws Error if headers have already been sent
   */
  setHeader(name: string, ...value: (string | string[])[]): Response;

  /**
   * Set response headers _en masse_. If a header with the same name already
   * exists, the header will be replaced with this one.
   * Headers must be set before sending the response.
   * 
   * @param name - Header name
   * @param value - Header value(s), can be a string or array of strings
   * @returns this object for chaining
   * @throws Error if headers have already been sent
   */
  setHeaders(...newHeaders:(InitHeader|InitHeader[])[]): Response;
  
  /**
   * Send a JSON response with Content-Type: application/json
   * @param data - Data to serialize as JSON
   * @throws Error if response has already been sent
   */
  json(data: unknown): Promise<void>;
  
  /**
   * Send response data. If the headers are not yet sent, send them. Closes
   * the response.
   * @param data - Response body as string or buffer
   * @throws Error if the response is already closed
   */
  send(data: string | Buffer): Promise<void>;
  
  /**
   * Send a chunk of data. If the headers are not yet sent, send them.
   * @param data - chunk to send as a string or buffer
   * @throws Error if the response is already closed.
   */
  sendChunk(data: string | Buffer): Promise<void>

  /**
   * Close the response. If the headers are not yet sent, send them. Does
   * nothing if the response is already closed.
   */
  end(): Promise<void>;
}

/**
 * Request handler function type for routes and middleware.
 * 
 * @template T - The application metadata type
 * @param req - The incoming request object
 * @param res - The response object
 * @param next - Function to call the next middleware in the chain
 * 
 * @example
 * ```typescript
 * const handler: AsyncRequestHandler<AppMeta> = async (req, res, next) => {
 *   if (req.endpointMeta.requiresAuth) {
 *     // check auth
 *   }
 *   await next();
 * };
 * ```
 */
export type AsyncRequestHandler<
  T extends FrameworkMeta = FrameworkMeta
> = (
  req: Request<T>,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

/**
 * Error handler function type for handling exceptions in request processing.
 * 
 * @template T - The application metadata type
 * @param err - The error that was thrown
 * @param req - The incoming request object
 * @param res - The response object
 * @param next - Function to call the next error handler
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
export type ErrorHandler<T extends FrameworkMeta> = (
  err: Error,
  req: Request<T>,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

/**
 * Finalizer function type for cleanup operations after response is sent.
 * These run regardless of success or error and should not throw.
 * 
 * @template T - The application metadata type
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
export type Finalizer<T extends FrameworkMeta> = (
  req: Request<T>,
  res: Response
) => void | Promise<void>;

/**
 * Response transformer function type for modifying responses before sending.
 * Runs after successful handler execution but before finalizers.
 * 
 * @template T - The application metadata type
 * @param req - The request object
 * @param res - The response object
 * 
 * @example
 * ```typescript
 * app.onTransform(async (req, res) => {
 *   // Add timing header
 *   const duration = Date.now() - req._startTime!;
 *   res.setHeader('X-Duration-Ms', duration.toString());
 * });
 * ```
 */
export type ResponseTransformer<T extends FrameworkMeta> = (
  req: Request<T>,
  res: Response
) => void | Promise<void>;

/**
 * Internal route definition used by the application.
 * @internal
 */
export interface Route<T extends FrameworkMeta> {
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
  handler: AsyncRequestHandler<T>;
}

/**
 * Middleware registration entry.
 * @internal
 */
export interface Middleware<T extends FrameworkMeta = FrameworkMeta> {
  /** Optional path prefix for this middleware */
  path?: string;
  /** Middleware handler function */
  handler: AsyncRequestHandler<T>;
}

// Export a marker to ensure this module has runtime exports
export const __type_module__ = true;
