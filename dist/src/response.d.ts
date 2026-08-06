import { ServerResponse } from 'http';
import { InitHeader, Response } from './types.js';
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
    private _closed;
    private _sendingInChunks;
    private _statusCode;
    private serverResponse;
    private headers;
    /**
     * Creates a new response handler.
     *
     * @param serverResponse - The underlying server response
     */
    constructor(serverResponse: ServerResponse);
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
    get sendingInChunks(): boolean;
    get statusCode(): number;
    set statusCode(newStatusCode: number);
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
    addHeaders(...newHeaders: (InitHeader | InitHeader[])[]): Response;
    /**
     * Send the response to the client with previously set status and headers.
     * If nothing has been sent yet, sends an empty response.
     * Can be called multiple times safely - subsequent calls are ignored.
     */
    end(): Promise<void>;
    /**
     * Returns the value of a header. If there are multiple headers of the same
     * name, this will return an array in insertion order.
     * @param name the name of the header to retrieve.
     * @returns the header value or values, or null if the header does not exist
     */
    getHeader(name: string): string | string[] | null;
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
    setHeaders(...newHeaders: (InitHeader | InitHeader[])[]): Response;
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