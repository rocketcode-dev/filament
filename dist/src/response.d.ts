import { Response } from './types.js';
/**
 * Response implementation for Filament.
 *
 * This class implements the {@link Response} interface and provides methods for
 * setting status codes, headers, and sending data to the client.
 * Supports method chaining for a fluent API.
 *
 * @example
 * ```typescript
 * res.status(200)
 *   .setHeader('Content-Type', 'application/json')
 *   .json({ success: true });
 * ```
 */
export declare class ResponseImpl implements Response {
    statusCode: number;
    headers: Record<string, string | string[]>;
    body?: unknown;
    headersSent: boolean;
    private onSend?;
    /**
     * Creates a new response handler.
     *
     * @param onSend - Optional callback invoked when the response is sent to the client
     */
    constructor(onSend?: (res: Response) => void);
    /**
     * Set the HTTP response status code.
     *
     * @param code - HTTP status code
     * @returns This response object for method chaining
     */
    status(code: number): Response;
    /**
     * Set a response header.
     * Headers must be set before sending the response.
     *
     * @param name - Header name
     * @param value - Header value(s), can be a string or array of strings
     * @returns This response object for method chaining
     * @throws Error if headers have already been sent
     */
    setHeader(name: string, value: string | string[]): Response;
    /**
     * Send a JSON response with Content-Type: application/json header.
     * Automatically serializes the data to JSON.
     *
     * @param data - Data to serialize as JSON
     * @throws Error if response has already been sent
     */
    json(data: unknown): void;
    /**
     * Send response data to the client.
     * Once called, no more headers can be set or data sent.
     *
     * @param data - Response body as a string or buffer
     * @throws Error if response has already been sent
     */
    send(data: string | Buffer): void;
    /**
     * Send the response to the client with previously set status and headers.
     * If nothing has been sent yet, sends an empty response.
     * Can be called multiple times safely - subsequent calls are ignored.
     */
    end(): void;
}
//# sourceMappingURL=response.d.ts.map