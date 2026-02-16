import { Response } from './types';

/**
 * Response implementation for meta-express
 */
export class ResponseImpl implements Response {
  statusCode: number = 200;
  headers: Record<string, string | string[]> = {};
  body?: unknown;
  headersSent: boolean = false;

  private onSend?: (res: Response) => void;

  constructor(onSend?: (res: Response) => void) {
    this.onSend = onSend;
  }

  status(code: number): Response {
    this.statusCode = code;
    return this;
  }

  setHeader(name: string, value: string | string[]): Response {
    if (this.headersSent) {
      throw new Error('Cannot set headers after they are sent');
    }
    this.headers[name] = value;
    return this;
  }

  json(data: unknown): void {
    this.setHeader('Content-Type', 'application/json');
    this.body = JSON.stringify(data);
    this.send(this.body as string);
  }

  send(data: string | Buffer): void {
    if (this.headersSent) {
      throw new Error('Cannot send response after it has been sent');
    }
    this.body = data;
    this.headersSent = true;
    if (this.onSend) {
      this.onSend(this);
    }
  }

  end(): void {
    if (!this.headersSent) {
      this.headersSent = true;
      if (this.onSend) {
        this.onSend(this);
      }
    }
  }
}
