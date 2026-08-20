import { ServerResponse } from 'http';
import { Headers } from './headers.js';
import EventEmitter from 'events';
interface ResponseEvents {
    send: [data: Buffer, length: number];
    sendChunk: [data: Buffer, length: number];
    end: [];
}
export interface ResponseContext {
    hasTransformers?: boolean;
}
/**
 * Response implementation for Filament.
 *
 * This class provides methods for
 * setting status codes, headers, and sending data to the client.
 * Supports method chaining for a fluent API.
 *
 * @example
 * ```typescript
 * res.status(200)
 *   .headers.set('Content-Type', 'application/json');
 * await res.json({ success: true });
 * ```
 */
export declare class Response extends EventEmitter<ResponseEvents> {
    /**
     * The NodeJS native HTTP(S) response
     */
    private serverResponse;
    private context;
    private _statusCode;
    private _body;
    private _headers;
    private _headersSent;
    /**
     * Set to `true` if a chunk has been sent in streaming mode. This will
     * prevent `send()` from calculating `Content-Length`.
     */
    private _chunked;
    /**
     * Streaming mode. If this is `undefined` it is calculated based on the
     * application context.
     */
    private _streaming;
    /**
     * Set to `true` when the streaming mode cannot be changed anymore.
     */
    private _streamingModeLocked;
    /**
     * Set to `true` by `this.end()` and `'pending'` by `this.send()`. Whenever
     * this is truthy, the `this.json()`, `this.send()` and `this.sendChunk()`
     * send methods can no longer add data. A closed, buffered response remains
     * mutable for route response transformers until commit. Note the
     * `this.closed` accessor treats `'pending'` as `true`.
     */
    private _closed;
    /**
     * Set to true when all data has been truly sent, no modifications are
     * possible for anything. Stops transforms.
     */
    private _committed;
    /** The shared completion promises for idempotent lifecycle operations. */
    private _endPromise?;
    private _commitPromise?;
    /**
     * Creates a new response handler.
     *
     * @param serverResponse - The underlying server response
     */
    constructor(serverResponse: ServerResponse, context?: ResponseContext);
    /**
     * Returns the body of the response as it stands at this moment. Only works
     * when the streaming mode is disabled and locked. Otherwise, it'll return
     * `null`
     * @returns a data buffer when streaming mode is disabled and locked, `null`
     *  when streaming mode is enabled or it hasn't been locked in yet.
     */
    get body(): Buffer | null;
    /**
     * Sets or replaces a buffered response body. A closed buffered response can
     * be changed by route response transformers until it is committed. Assigning
     * the body locks the response into buffered mode.
     */
    set body(content: string | Buffer);
    get committed(): boolean;
    get headers(): Headers;
    get closed(): boolean;
    get statusCode(): number;
    set statusCode(newStatusCode: number);
    get streaming(): boolean;
    set streaming(mode: boolean);
    /**
     * Send the complete response. Stops future transformers from operating. Only
     * callable after `end()` is called. Idempotent, only the first call has
     * any effect. Always called after the transformers are complete.
     */
    commit(): Promise<void>;
    /**
     * Close the response. If in streaming mode, this will also end the
     * serverResponse.
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
    private lockStreamingMode;
    private prepareToSendData;
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
export default Response;
//# sourceMappingURL=response.d.ts.map