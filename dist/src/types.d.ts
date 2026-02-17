/**
 * Core type definitions for the meta-express framework
 */
export interface FrameworkMeta {
    _internal?: unknown;
}
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
export type NextFunction = () => void | Promise<void>;
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
export type AsyncRequestHandler<T extends FrameworkMeta = FrameworkMeta> = (req: Request<T>, res: Response, next: NextFunction) => void | Promise<void>;
export type ErrorHandler<T extends FrameworkMeta> = (err: Error, req: Request<T>, res: Response, next: NextFunction) => void | Promise<void>;
export type Finalizer<T extends FrameworkMeta> = (req: Request<T>, res: Response) => void | Promise<void>;
export type ResponseTransformer<T extends FrameworkMeta> = (req: Request<T>, res: Response) => void | Promise<void>;
export interface Route<T extends FrameworkMeta> {
    method: HttpMethod;
    path: string;
    pattern: RegExp;
    paramNames: string[];
    meta: T;
    handler: AsyncRequestHandler<T>;
}
export interface Middleware<T extends FrameworkMeta = FrameworkMeta> {
    path?: string;
    handler: AsyncRequestHandler<T>;
}
export declare const __type_module__ = true;
//# sourceMappingURL=types.d.ts.map