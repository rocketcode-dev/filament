import { Headers } from './headers.js';
import EventEmitter from 'events';
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
 *   .setHeader('Content-Type', 'application/json')
 *   .json({ success: true });
 * ```
 */
export class Response extends EventEmitter {
    /**
     * Creates a new response handler.
     *
     * @param serverResponse - The underlying server response
     */
    constructor(serverResponse, context = {}) {
        super();
        this._statusCode = 200;
        this._body = null;
        this._headers = new Headers('response');
        /**
         * Set to `true` if a chunk has been sent in streaming mode. This will
         * prevent `send()` from calculating `Content-Length`.
         */
        this._chunked = false;
        /**
         * Set to `true` when the streaming mode cannot be changed anymore.
         */
        this._streamingModeLocked = false;
        /**
         * Set to `true` by `this.end()` and `'pending'` by `this.send()`. Whenever
         * this is truthy, the `this.json()`, `this.send()` and `this.sendChunk()`
         * methods can no longer be used to change the body. However, when streaming
         * mode is disabled, you can change the body by setting `this.body` to the
         * new body. Note the `this.closed` accessor treats `'pending'` as `true`.
         */
        this._closed = false;
        /**
         * Set to true when all data has been truly sent, no modifications are
         * possible for anything. Stops transforms.
         */
        this._committed = false;
        this.context = context;
        this.serverResponse = serverResponse;
    }
    /**
     * Returns the body of the response as it stands at this moment. Only works
     * when the streaming mode is disabled and locked. Otherwise, it'll return
     * `null`
     * @returns a data buffer when streaming mode is disabled and locked, `null`
     *  when streaming mode is enabled or it hasn't been locked in yet.
     */
    get body() {
        if (!this._streamingModeLocked || this.streaming) {
            return null;
        }
        const b = this._body || [];
        let totalLength = 0;
        // compact the bodyBuffers array
        this._body = b.map(bb => {
            let result;
            if (typeof bb === 'string') {
                result = Buffer.from(bb);
            }
            else {
                result = bb;
            }
            totalLength += result.length;
            return result;
        });
        const result = Buffer.concat(this._body, totalLength);
        this._body = [result];
        return result;
    }
    /**
     * Sets the body of the response. Replaces the current response body. Will
     * throw an exception if streaming mode is enabled and locked. Will disabled
     * and lock streaming mode if it isn't already.
     */
    set body(content) {
        if (this.streaming && this._streamingModeLocked) {
            throw Error('Cannot change existing body content in streaming mode.');
        }
        else {
            if (this.committed) {
                throw Error('Cannot change body after it\'s been committed');
            }
            this.lockStreamingMode(false);
        }
        if (this.headers.get('Content-Length')) {
            if (this.headers.frozen) {
                throw Error('Cannot change existing body content after headers are ' +
                    'frozen with a Content-Length header');
            }
            else {
                // automatically update the Content-Length header
                content = Buffer.from(content);
                this.headers.set('Content-Length', content.length.toString());
            }
        }
        this._body = [content];
    }
    get committed() {
        return this._committed;
    }
    get headers() {
        return this._headers;
    }
    get closed() {
        return !!this._closed;
    }
    get statusCode() {
        return this._statusCode;
    }
    set statusCode(newStatusCode) {
        if (this.headers.frozen) {
            throw Error('Cannot set the status code after it\'s already been sent');
        }
        else {
            this._statusCode = newStatusCode;
        }
    }
    get streaming() {
        if (typeof this._streaming === 'boolean') {
            return this._streaming;
        }
        else {
            // calculate defaults from the application context
            if (typeof this.context.hasTransformers) {
                return !this.context.hasTransformers;
            }
            else {
                // default value is true
                return true;
            }
        }
    }
    set streaming(mode) {
        if (this._streamingModeLocked && mode !== this.streaming) {
            throw Error('Cannot change the streaming mode after data is sent');
        }
        this._streaming = mode;
    }
    /**
     * Send the complete response. Stops future transformers from operating. Only
     * callable after `end()` is called. Idempotent, only the first call has
     * any effect. Always called after the transformers are complete.
     */
    commit() {
        if (!this.closed) {
            throw new Error('Cannot commit an open response');
        }
        if (this._commitPromise) {
            return this._commitPromise;
        }
        if (this.streaming) {
            this._commitPromise = (this._endPromise || Promise.resolve()).then(() => {
                this._committed = true;
            });
            return this._commitPromise;
        }
        const b = this.body;
        this.sendHeadersIfNotSentAlready();
        this._body = null;
        this._commitPromise = new Promise((resolve, reject) => {
            const finish = () => {
                this._committed = true;
                resolve();
            };
            if (b === null) {
                this.serverResponse.end(finish);
            }
            else {
                this.serverResponse.write(b, (err) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        this.serverResponse.end(finish);
                    }
                });
            }
        });
        return this._commitPromise;
    }
    /**
     * Close the response. If in streaming mode, this will also end the
     * serverResponse.
     * Can be called multiple times safely - subsequent calls are ignored.
     */
    end() {
        if (this._endPromise) {
            return this._endPromise;
        }
        this.prepareToSendData(true);
        this.emit('end');
        this._closed = true;
        if (this.streaming) {
            this._endPromise = new Promise((resolve) => {
                this.serverResponse.end(() => {
                    this._committed = true;
                    resolve();
                });
            });
        }
        else {
            this._endPromise = Promise.resolve();
        }
        return this._endPromise;
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
        this.headers.set('Content-Type', 'application/json');
        return this.send(data === undefined ? 'undefined' : JSON.stringify(data));
    }
    lockStreamingMode(enabled) {
        if (this._streamingModeLocked) {
            if (enabled !== undefined && enabled !== this.streaming) {
                throw Error('Cannot change streaming mode after it\'s locked');
            }
        }
        else {
            if (enabled !== undefined) {
                this.streaming = enabled;
            }
            else {
                // fix streaming mode in case it's calculated from defaults
                this.streaming = this.streaming;
            }
            this._streamingModeLocked = true;
        }
    }
    prepareToSendData(ending = false) {
        if ((this._closed === false) || (ending && this._closed === 'pending')) {
            if (!this._streamingModeLocked) {
                // fix streaming mode in case it's calculated from defaults
                this.lockStreamingMode();
            }
            if (this.streaming) {
                this.sendHeadersIfNotSentAlready();
            }
        }
        else {
            throw new Error('Cannot send data after the response has been closed');
        }
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
        if (!this.headers.frozen && !this._chunked) {
            this.headers.set('Content-Length', byteLength.toString());
        }
        this.prepareToSendData();
        // `pending` means data cannot be sent but the `end` method hasn't been
        // run yet.
        this._closed = 'pending';
        this.emit('send', data, byteLength);
        if (this.streaming) {
            return new Promise((resolve, reject) => {
                this.serverResponse.write(data, err => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        this.end().then(resolve);
                    }
                });
            });
        }
        else {
            (this._body || (this._body = [])).push(data);
            return this.end();
        }
    }
    /**
     * Send a chunk of data to the client.
     * @param data - Response chunk
     * @throws Error if the response has already been sent
     */
    sendChunk(data) {
        return new Promise((resolve, reject) => {
            if (typeof data === 'string') {
                data = Buffer.from(data);
            }
            this.prepareToSendData();
            this._chunked = true;
            this.emit('sendChunk', data, data.byteLength);
            if (this.streaming) {
                this.serverResponse.write(data, (error) => {
                    if (error) {
                        reject(error);
                    }
                    else {
                        resolve();
                    }
                });
            }
            else {
                (this._body || (this._body = [])).push(data);
                resolve();
            }
        });
    }
    sendHeadersIfNotSentAlready() {
        if (this.headers.frozen) {
            return;
        }
        this.serverResponse.writeHead(this.statusCode, this.headers.headerPairs.flat());
        // fix streaming mode to a value
        this.headers.frozen = true;
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
export default Response;
//# sourceMappingURL=response.js.map