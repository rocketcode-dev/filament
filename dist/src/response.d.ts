import { ServerResponse } from 'http';
import { Headers } from './headers.js';
import { Response } from './types.js';
import EventEmitter from 'events';
interface ResponseEvents {
    send: [data: Buffer, length: number];
    sendChunk: [data: Buffer, length: number];
    end: [];
}
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
export declare class ResponseImpl extends EventEmitter<ResponseEvents> implements Response {
    private bodyBuffers;
    private _closed;
    private _sendingInChunks;
    private _statusCode;
    private serverResponse;
    private _headers;
    /**
     * Creates a new response handler.
     *
     * @param serverResponse - The underlying server response
     */
    constructor(serverResponse: ServerResponse);
    get body(): Buffer | null;
    get headers(): Headers;
    get closed(): boolean;
    set keepBody(doKeep: boolean);
    get sendingInChunks(): boolean;
    get statusCode(): number;
    set statusCode(newStatusCode: number);
    /**
     * Send the response to the client with previously set status and headers.
     * If nothing has been sent yet, sends an empty response.
     * Can be called multiple times safely - subsequent calls are ignored.
     */
    end(): Promise<void>;
    /**
     * Send a JSON response with Content-Type: application/json header.
     * Automatically serializes the data to JSON.
     *
     * @param data - Data to serialize as JSON
     * @throws Error if response has already been sent
     */
    json(data: unknown): Promise<void>;
    /**
     * Send response data to the client.
     * Once called, no more headers can be set or data sent.
     *
     * @param data - Response body as a string or buffer
     * @throws Error if response has already been sent
     */
    send(data: string | Buffer): Promise<void>;
    /**
     * Send a chunk of data to the client.
     * @param data - Response chunk
     * @throws Error if the response has already been sent
     */
    sendChunk(data: string | Buffer): Promise<void>;
    private sendHeadersIfNotSentAlready;
    /**
     * Set the HTTP response status code.
     *
     * @param code - HTTP status code
     * @returns This response object for method chaining
     */
    status(code: number): Response;
}
export {};
//# sourceMappingURL=response.d.ts.map