/**
 * Core type definitions for the meta-express framework
 */

// Framework base interface (minimal requirements)
export interface FrameworkMeta {
  _internal?: unknown; // Reserved for framework use
}

// HTTP methods supported
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

// Next function for middleware chain
export type NextFunction = () => void | Promise<void>;

// Request object with meta
export interface Request<T extends FrameworkMeta = FrameworkMeta> {
  method: HttpMethod;
  path: string;
  params: Record<string, string>;
  query: Record<string, string | string[]>;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  endpointMeta: Readonly<T>;
  _startTime?: number;
}

// Response object
export interface Response {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body?: unknown;
  headersSent: boolean;
  
  status(code: number): Response;
  setHeader(name: string, value: string | string[]): Response;
  json(data: unknown): void;
  send(data: string | Buffer): void;
  end(): void;
}

// Handler types
export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

export type ErrorHandler<T extends FrameworkMeta> = (
  err: Error,
  req: Request<T>,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

export type Finalizer<T extends FrameworkMeta> = (
  req: Request<T>,
  res: Response
) => void | Promise<void>;

export type ResponseTransformer<T extends FrameworkMeta> = (
  req: Request<T>,
  res: Response
) => void | Promise<void>;

// Route definition
export interface Route<T extends FrameworkMeta> {
  method: HttpMethod;
  path: string;
  pattern: RegExp;
  paramNames: string[];
  meta: T;
  handler: AsyncRequestHandler;
}

// Middleware definition
export interface Middleware {
  path?: string;
  handler: AsyncRequestHandler;
}
