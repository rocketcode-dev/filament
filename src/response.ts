import { ServerResponse } from 'http';
import { Headers } from './headers.js';
import { InitHeader, Response } from './types.js';
import EventEmitter from 'events';

interface ResponseEvents {
  send: [data: Buffer, length: number],
  sendChunk: [data: Buffer, length: number],
  end: []
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
export class ResponseImpl
  extends EventEmitter<ResponseEvents>
  implements Response
{
  private bodyBuffers:(string|Buffer)[]|null = null;
  private _closed = false;
  private _sendingInChunks = false;
  private _statusCode = 200
  private serverResponse:ServerResponse;

  private _headers = new Headers('response');

  /**
   * Creates a new response handler.
   * 
   * @param serverResponse - The underlying server response
   */
  constructor(serverResponse:ServerResponse) {
    super()
    this.serverResponse = serverResponse;
  }

  get body(): Buffer|null {
    if (this.bodyBuffers === null) {
      return null;
    } else {
      let totalLength = 0;
      this.bodyBuffers = this.bodyBuffers.map(bb => {
        let result!:Buffer
        if (typeof bb === 'string') {          
          result = Buffer.from(bb);
        } else {
          result = bb;
        }
        totalLength += result.length;
        return result;
      })
      const result = 
        Buffer.concat(this.bodyBuffers as Buffer[], totalLength)
      this.bodyBuffers = [result];
      return result;
    }
  }

  get headers(): Headers {
    return this._headers;
  }

  get closed(): boolean {
    return this._closed;
  }

  set keepBody(doKeep: boolean) {
    if (doKeep && this.bodyBuffers === null) {
      this.bodyBuffers = [];
    } else if (!doKeep) {
      this.bodyBuffers = null;
    }
  }

  get sendingInChunks(): boolean {
    return this._sendingInChunks;
  }
  
  get statusCode(): number {
    return this._statusCode;
  }

  set statusCode(newStatusCode: number) {
    if (this.headers.isFrozen) {
      throw Error('Cannot set the status code after it\'s already been sent');
    } else {
      this._statusCode = newStatusCode;
    }
  }

  /**
   * Send the response to the client with previously set status and headers.
   * If nothing has been sent yet, sends an empty response.
   * Can be called multiple times safely - subsequent calls are ignored.
   */
  end(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this.closed) {
        this.sendHeadersIfNotSentAlready();
        this.emit('end');
        this.serverResponse.end(() => {
          this._closed = true;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Send a JSON response with Content-Type: application/json header.
   * Automatically serializes the data to JSON.
   * 
   * @param data - Data to serialize as JSON
   * @throws Error if response has already been sent
   */
  json(data: unknown): Promise<void> {
    if (this.closed) {
      throw new Error('Cannot send json after the response has been closed');
    }
    this.headers.set('Content-Type', 'application/json');
    return this.send(data === undefined ? 'undefined' : JSON.stringify(data));
  }

  /**
   * Send response data to the client.
   * Once called, no more headers can be set or data sent.
   * 
   * @param data - Response body as a string or buffer
   * @throws Error if response has already been sent
   */
  send(data: string | Buffer): Promise<void> {
    if (this.closed) {
      throw new Error('Cannot send data after the response has been closed');
    }
    if (typeof data === 'string') {
      data = Buffer.from(data);
    }
    const byteLength = data.byteLength;

    if (!this.sendingInChunks) {
      this.headers.set('Content-Length', byteLength.toString());
    }
    this.sendHeadersIfNotSentAlready();
    this.emit('send', data, byteLength);
    this.serverResponse.write(data);
    this.bodyBuffers?.push(data);
    return this.end();
  }

  /**
   * Send a chunk of data to the client.
   * @param data - Response chunk
   * @throws Error if the response has already been sent
   */
  sendChunk(data: string | Buffer): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.closed) {
        throw new Error('Cannot send data after the response has been closed');
      }
      this.sendHeadersIfNotSentAlready();
      this._sendingInChunks = true;
      if (typeof data === 'string') {
        data = Buffer.from(data);
      }
      this.emit('sendChunk', data, data.byteLength)
      this.serverResponse.write(data, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
      this.bodyBuffers?.push(data);
    })
  }

  private sendHeadersIfNotSentAlready() {
    if (this.headers.isFrozen) {
      return;
    }
    this.serverResponse.writeHead(
      this.statusCode,
      this.headers.headerPairs.flat()
    );
    this.headers.isFrozen = true;
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
