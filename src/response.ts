import { ServerResponse } from 'http';
import { Headers } from './headers.js';
import EventEmitter from 'events';

interface ResponseEvents {
  send: [data: Buffer, length: number],
  sendChunk: [data: Buffer, length: number],
  end: [],
  /** Emitted synchronously when the status and headers become immutable. */
  headers: [],
  /** Emitted once when the client disconnects before the response finishes. */
  disconnect: [],
}

export interface ResponseContext {
  hasTransformers?: boolean,
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
export class Response extends EventEmitter<ResponseEvents> {

  /**
   * The NodeJS native HTTP(S) response
   */
  private serverResponse:ServerResponse;
  private context: ResponseContext;

  private _statusCode = 200
  private _body:(string|Buffer)[]|null = null;

  private _headers = new Headers('response');
  private _headersSent = false;

  /**
   * Set to `true` if a chunk has been sent in streaming mode. This will
   * prevent `send()` from calculating `Content-Length`.
   */
  private _chunked = false;

  /**
   * Streaming mode. If this is `undefined` it is calculated based on the
   * application context.
   */
  private _streaming: boolean|undefined;

  /**
   * Set to `true` when the streaming mode cannot be changed anymore.
   */
  private _streamingModeLocked = false;

  /**
   * Set to `true` by `this.end()` and `'pending'` by `this.send()`. Whenever
   * this is truthy, the `this.json()`, `this.send()` and `this.sendChunk()`
   * send methods can no longer add data. A closed, buffered response remains
   * mutable for route response transformers until commit. Note the
   * `this.closed` accessor treats `'pending'` as `true`.
   */
  private _closed:boolean|'pending' = false;

  /**
   * Set to true when all data has been truly sent, no modifications are
   * possible for anything. Stops transforms.
   */
  private _committed = false;

  /** Set when the native response closes before it finishes. */
  private _disconnected = false;

  /** Lets pending native operations settle promptly after a disconnect. */
  private _disconnectPromise: Promise<void>;
  private _resolveDisconnect!: () => void;

  /** The shared completion promises for idempotent lifecycle operations. */
  private _endPromise?: Promise<void>;
  private _commitPromise?: Promise<void>;

  /**
   * Creates a new response handler.
   *
   * @param serverResponse - The underlying server response
   */
  constructor(
    serverResponse: ServerResponse,
    context: ResponseContext = {}
  ) {
    super()
    this.context = context;
    this.serverResponse = serverResponse;
    this._disconnectPromise = new Promise(resolve => {
      this._resolveDisconnect = resolve;
    });
    this.serverResponse.once('close', () => {
      if (!this.serverResponse.writableFinished) {
        this.markDisconnected();
      }
    });
    if (this.serverResponse.destroyed && !this.serverResponse.writableFinished) {
      this.markDisconnected();
    }
  }

  /**
   * Returns the body of the response as it stands at this moment. Only works
   * when the streaming mode is disabled and locked. Otherwise, it'll return
   * `null`
   * @returns a data buffer when streaming mode is disabled and locked, `null`
   *  when streaming mode is enabled or it hasn't been locked in yet.
   */
  get body(): Buffer|null {

    if (!this._streamingModeLocked || this.streaming) {
      return null;
    }

    const b = this._body || [];

    let totalLength = 0;
    // compact the bodyBuffers array
    this._body = b.map(bb => {
      let result!:Buffer
      if (typeof bb === 'string') {
        result = Buffer.from(bb);
      } else {
        result = bb;
      }
      totalLength += result.length;
      return result;
    });
    const result =
      Buffer.concat(this._body as Buffer[], totalLength)
    this._body = [result];
    return result;
  }

  /**
   * Sets or replaces a buffered response body. A closed buffered response can
   * be changed by route response transformers until it is committed. Assigning
   * the body locks the response into buffered mode.
   */
  set body(content: string|Buffer) {
    if (this.streaming && this._streamingModeLocked) {
      throw Error('Cannot change existing body content in streaming mode.');
    } else {
      if (this.committed) {
        throw Error('Cannot change body after it\'s been committed');
      }
      this.lockStreamingMode(false);
    }
    if (this.headers.get('Content-Length')) {
      if (this.headers.frozen) {
        throw Error('Cannot change existing body content after headers are ' +
          'frozen with a Content-Length header');
      } else {
        // automatically update the Content-Length header
        content = Buffer.from(content);
        this.headers.set('Content-Length', content.length.toString())
      }
    }
    this._body = [content];
  }

  get committed(): boolean {
    return this._committed;
  }

  /** Whether the client disconnected before the response finished. */
  get disconnected(): boolean {
    return this._disconnected;
  }

  /**
   * Run a callback once if the client disconnects before the response finishes.
   * If the disconnect already happened, the callback runs immediately.
   */
  onDisconnect(listener: () => void): this {
    if (this.disconnected) {
      listener();
    } else {
      this.once('disconnect', listener);
    }
    return this;
  }

  get headers(): Headers {
    return this._headers;
  }

  get closed(): boolean {
    return !! this._closed;
  }

  get statusCode(): number {
    return this._statusCode;
  }

  set statusCode(newStatusCode: number) {
    if (this.headers.frozen) {
      throw Error('Cannot set the status code after it\'s already been sent');
    } else {
      this._statusCode = newStatusCode;
    }
  }

  get streaming(): boolean {
    if (typeof this._streaming === 'boolean') {
      return this._streaming;
    } else {
      // calculate defaults from the application context
      if (typeof this.context.hasTransformers) {
        return !this.context.hasTransformers;
      } else {
        // default value is true
        return true;
      }
    }
  }

  set streaming(mode: boolean) {
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
  commit(): Promise<void> {
    if (this.disconnected) {
      this._closed = true;
      return this._commitPromise ||= Promise.resolve();
    }
    if (!this.closed) {
      throw new Error('Cannot commit an open response');
    }
    if (this._commitPromise) {
      return this._commitPromise;
    }
    if (this.streaming) {
      this._commitPromise = (this._endPromise || Promise.resolve()).then(() => {
        if (!this.disconnected) {
          this._committed = true;
        }
      });
      return this._commitPromise;
    }

    const b = this.body;
    this.sendHeadersIfNotSentAlready();
    this._body = null;
    const nativeCommit = new Promise<void>((resolve, reject) => {
      const finish = () => {
        if (!this.disconnected) {
          this._committed = true;
        }
        resolve();
      };
      if (b === null) {
        this.serverResponse.end(finish);
      } else {
        this.serverResponse.write(b, (err) => {
          if (err) {
            reject(err);
          } else if (this.disconnected) {
            resolve();
          } else {
            this.serverResponse.end(finish);
          }
        });
      }
    });
    this._commitPromise = Promise.race([
      nativeCommit,
      this._disconnectPromise,
    ]);
    return this._commitPromise;
  }

  /**
   * Close the response. If in streaming mode, this will also end the
   * serverResponse.
   * Can be called multiple times safely - subsequent calls are ignored.
   */
  end(): Promise<void> {
    if (this._endPromise) {
      return this._endPromise;
    }
    if (this.disconnected) {
      this._closed = true;
      return this._endPromise = Promise.resolve();
    }
    this.prepareToSendData(true);
    this.emit('end');
    this._closed = true;
    if (this.streaming) {
      const nativeEnd = new Promise<void>((resolve) => {
        this.serverResponse.end(() => {
          if (!this.disconnected) {
            this._committed = true;
          }
          resolve();
        });
      });
      this._endPromise = Promise.race([
        nativeEnd,
        this._disconnectPromise,
      ]);
    } else {
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
  json(data: unknown): Promise<void> {
    if (this.disconnected) {
      return Promise.resolve();
    }
    if (this.closed) {
      throw new Error('Cannot send json after the response has been closed');
    }
    this.headers.set('Content-Type', 'application/json');
    return this.send(data === undefined ? 'undefined' : JSON.stringify(data));
  }

  private lockStreamingMode(enabled?: boolean) {
    if (this._streamingModeLocked) {
      if (enabled !== undefined && enabled !== this.streaming) {
        throw Error('Cannot change streaming mode after it\'s locked');
      }
    } else {
      if (enabled !== undefined) {
        this.streaming = enabled;
      } else {
        // fix streaming mode in case it's calculated from defaults
        this.streaming = this.streaming;
      }
      this._streamingModeLocked = true;
    }
  }

  private prepareToSendData(ending: boolean = false) {
    if ((this._closed === false) || (ending && this._closed === 'pending')) {
      if (!this._streamingModeLocked) {
        // fix streaming mode in case it's calculated from defaults
        this.lockStreamingMode();
      }
      if (this.streaming) {
        this.sendHeadersIfNotSentAlready();
      }
    } else {
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
  send(data: string | Buffer): Promise<void> {
    if (this.disconnected) {
      return Promise.resolve();
    }
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
      const nativeWrite = new Promise<void>((resolve, reject) => {
        this.serverResponse.write(data, err => {
          if (err) {
            reject(err);
          } else {
            this.end().then(resolve);
          }
        });
      });
      return Promise.race([nativeWrite, this._disconnectPromise]);
    } else {
      (this._body ||= []).push(data);
      return this.end();
    }
  }

  /**
   * Send a chunk of data to the client.
   * @param data - Response chunk
   * @throws Error if the response has already been sent
   */
  sendChunk(data: string | Buffer): Promise<void> {
    if (this.disconnected) {
      return Promise.resolve();
    }
    const nativeWrite = new Promise<void>((resolve, reject) => {
      if (typeof data === 'string') {
        data = Buffer.from(data);
      }

      this.prepareToSendData();
      this._chunked = true;
      this.emit('sendChunk', data, data.byteLength)
      if (this.streaming) {
        this.serverResponse.write(data, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      } else {
        (this._body ||= []).push(data);
        resolve();
      }
    });
    return Promise.race([nativeWrite, this._disconnectPromise]);
  }

  private sendHeadersIfNotSentAlready() {
    if (this._headersSent || this.disconnected) {
      return;
    }
    this.serverResponse.writeHead(
      this.statusCode,
      this.headers.headerPairs.flat()
    );
    this._headersSent = true;
    if (!this.headers.frozen) {
      this.headers.frozen = true;
    }
    this.emit('headers');
  }

  private markDisconnected(): void {
    if (this._disconnected) return;
    this._disconnected = true;
    this._closed = true;
    this._resolveDisconnect();
    this.emit('disconnect');
  }

  /**
   * Set the HTTP response status code.
   *
   * @param code - HTTP status code
   * @returns This response object for method chaining
   */
  status(code: number): Response {
    this.statusCode = code;
    return this;
  }
}

export default Response;
