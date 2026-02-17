/**
 * Response implementation for meta-express
 */
export class ResponseImpl {
    constructor(onSend) {
        this.statusCode = 200;
        this.headers = {};
        this.headersSent = false;
        this.onSend = onSend;
    }
    status(code) {
        this.statusCode = code;
        return this;
    }
    setHeader(name, value) {
        if (this.headersSent) {
            throw new Error('Cannot set headers after they are sent');
        }
        this.headers[name] = value;
        return this;
    }
    json(data) {
        this.setHeader('Content-Type', 'application/json');
        this.body = JSON.stringify(data);
        this.send(this.body);
    }
    send(data) {
        if (this.headersSent) {
            throw new Error('Cannot send response after it has been sent');
        }
        this.body = data;
        this.headersSent = true;
        if (this.onSend) {
            this.onSend(this);
        }
    }
    end() {
        if (!this.headersSent) {
            this.headersSent = true;
            if (this.onSend) {
                this.onSend(this);
            }
        }
    }
}
//# sourceMappingURL=response.js.map