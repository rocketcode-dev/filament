import { Response } from './types.js';
/**
 * Response implementation for meta-express
 */
export declare class ResponseImpl implements Response {
    statusCode: number;
    headers: Record<string, string | string[]>;
    body?: unknown;
    headersSent: boolean;
    private onSend?;
    constructor(onSend?: (res: Response) => void);
    status(code: number): Response;
    setHeader(name: string, value: string | string[]): Response;
    json(data: unknown): void;
    send(data: string | Buffer): void;
    end(): void;
}
//# sourceMappingURL=response.d.ts.map