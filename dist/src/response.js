import { Headers } from './headers.js';
import EventEmitter from 'events';
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
export class ResponseImpl extends EventEmitter {
    /**
     * Creates a new response handler.
     *
     * @param serverResponse - The underlying server response
     */
    constructor(serverResponse) {
        super();
        this._closed = false;
        this._sendingInChunks = false;
        this._statusCode = 200;
        this.headers = new Headers();
        this.serverResponse = serverResponse;
    }
    get closed() {
        return this._closed;
    }
    /**
     * Returns all the headers. This object cannot be changed. Use addHeader and
     * setHeader to change the response headers.
     * @returns The headers
     */
    get headerPairs() {
        return this.headers.headerPairs;
    }
    /**
     * Returns `true` if the response headers have been sent
     */
    get headersSent() {
        return this.headers.headersSent || this.serverResponse.headersSent;
    }
    get sendingInChunks() {
        return this._sendingInChunks;
    }
    get statusCode() {
        return this._statusCode;
    }
    set statusCode(newStatusCode) {
        if (this.headersSent) {
            throw Error('Cannot set the status code after it\'s already been sent');
        }
        else {
            this._statusCode = newStatusCode;
        }
    }
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
    addHeader(name, ...value) {
        if (this.headersSent) {
            throw Error('Cannot add a header after the headers have been sent');
        }
        this.headers.addHeader(name, value.flat());
        return this;
    }
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
    addHeaders(...newHeaders) {
        if (this.headersSent) {
            throw Error('Cannot add to headers after they have been sent');
        }
        this.headers.addHeaders(...newHeaders);
        return this;
    }
    /**
     * Send the response to the client with previously set status and headers.
     * If nothing has been sent yet, sends an empty response.
     * Can be called multiple times safely - subsequent calls are ignored.
     */
    end() {
        return new Promise((resolve) => {
            if (!this.closed) {
                this.sendHeadersIfNotSentAlready();
                this.emit('end');
                this.serverResponse.end(() => {
                    this._closed = true;
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
    /**
     * Returns the value of a header. If there are multiple headers of the same
     * name, this will return an array in insertion order.
     * @param name the name of the header to retrieve.
     * @returns the header value or values, or null if the header does not exist
     */
    getHeader(name) {
        return this.headers.getHeader(name);
    }
    /**
     * Send a JSON response with Content-Type: application/json header.
     * Automatically serializes the data to JSON.
     *
     * @param data - Data to serialize as JSON
     * @throws Error if response has already been sent
     */
    json(data) {
        if (this.closed) {
            throw new Error('Cannot send json after the response has been closed');
        }
        this.headers.setHeader('Content-Type', 'application/json');
        return this.send(data === undefined ? 'undefined' : JSON.stringify(data));
    }
    /**
     * Send response data to the client.
     * Once called, no more headers can be set or data sent.
     *
     * @param data - Response body as a string or buffer
     * @throws Error if response has already been sent
     */
    send(data) {
        if (this.closed) {
            throw new Error('Cannot send data after the response has been closed');
        }
        if (typeof data === 'string') {
            data = Buffer.from(data);
        }
        const byteLength = data.byteLength;
        if (!this.sendingInChunks) {
            this.headers.setHeader('Content-Length', byteLength.toString());
        }
        this.sendHeadersIfNotSentAlready();
        this.emit('send', data, byteLength);
        this.serverResponse.write(data);
        return this.end();
    }
    /**
     * Send a chunk of data to the client.
     * @param data - Response chunk
     * @throws Error if the response has already been sent
     */
    sendChunk(data) {
        return new Promise((resolve, reject) => {
            if (this.closed) {
                throw new Error('Cannot send data after the response has been closed');
            }
            this.sendHeadersIfNotSentAlready();
            this._sendingInChunks = true;
            if (typeof data === 'string') {
                data = Buffer.from(data);
            }
            this.emit('sendChunk', data, data.byteLength);
            this.serverResponse.write(data, (error) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve();
                }
            });
        });
    }
    sendHeadersIfNotSentAlready() {
        if (this.headersSent) {
            return;
        }
        this.serverResponse.writeHead(this.statusCode, this.headers.headerPairs.flat());
        this.headers.headersSent = true;
    }
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
    setHeader(name, ...value) {
        if (this.headersSent) {
            throw Error('Cannot set a header after the headers have been sent');
        }
        this.headers.setHeader(name, value.flat());
        return this;
    }
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
    setHeaders(...newHeaders) {
        if (this.headersSent) {
            throw Error('Cannot set headers after the headers have been sent');
        }
        this.headers.setHeaders(...newHeaders);
        return this;
    }
    /**
     * Set the HTTP response status code.
     *
     * @param code - HTTP status code
     * @returns This response object for method chaining
     */
    status(code) {
        this.statusCode = code;
        return this;
    }
}
//# sourceMappingURL=response.js.map