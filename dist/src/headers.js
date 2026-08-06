import { normalizeHeaderName } from "./tools.js";
export class Headers {
    constructor(...initialHeaders) {
        this._headersSent = false;
        this._headerPairs = [];
        if (initialHeaders.length > 0) {
            this.addHeaders(...initialHeaders);
        }
    }
    /**
     * Returns a copy of all the headers in object form
     * @returns The headers
     */
    get headers() {
        const result = {};
        for (const k in this.headerPairs) {
            if (result[k[0]]) {
                result[k[0]].push(k[1]);
            }
            else {
                result[k[0]] = [k[1]];
            }
        }
        return result;
    }
    /**
     * Returns all the headers. This object cannot be changed. Use addHeader and
     * setHeader to change the response headers.
     * @returns The headers
     */
    get headerPairs() {
        return Object.freeze([...this._headerPairs]);
    }
    get headersSent() {
        return this._headersSent;
    }
    set headersSent(sent) {
        if (sent === true) {
            this._headersSent = sent;
        }
        else {
            throw 'Cannot mark headers unsent';
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
            throw new Error('Cannot set headers after they are sent');
        }
        const normalName = normalizeHeaderName(name);
        for (const v of value.flat()) {
            this._headerPairs.push(Object.freeze([normalName, v]));
        }
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
        for (let nh of newHeaders) {
            if (!Array.isArray(nh) || (typeof nh[0] === 'string')) {
                nh = [nh];
            }
            for (const nhi of nh) {
                if (Array.isArray(nhi)) {
                    this.addHeader(nhi[0], ...Array.isArray(nhi[1]) ? nhi[1] : [nhi[1]]);
                }
                else {
                    for (const k in nhi) {
                        this.addHeader(k, ...Array.isArray(nhi[1]) ? nhi[1] : [nhi[1]]);
                    }
                }
            }
        }
    }
    /**
     * Returns the value of a header. If there are multiple headers of the same
     * name, this will return an array in insertion order.
     * @param name the name of the header to retrieve.
     * @returns the header value or values, or `null` if the header does not exist
     */
    getHeader(name) {
        const result = [];
        const normalName = normalizeHeaderName(name);
        for (const [k, v] of this._headerPairs) {
            if (k === normalName) {
                result.push(v);
            }
        }
        if (result.length === 0) {
            return null;
        }
        else if (result.length === 1) {
            return result[0];
        }
        else {
            return result;
        }
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
            throw new Error('Cannot set headers after they are sent');
        }
        const normalName = normalizeHeaderName(name);
        this._headerPairs = this._headerPairs.filter(hp => hp[0] !== normalName);
        for (const v of value.flat()) {
            this._headerPairs.push(Object.freeze([normalName, v]));
        }
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
        for (let nh of newHeaders) {
            if (!Array.isArray(nh) || (typeof nh[0] === 'string')) {
                nh = [nh];
            }
            for (const nhi of nh) {
                if (Array.isArray(nhi)) {
                    this.setHeader(nhi[0], ...Array.isArray(nhi[1]) ? nhi[1] : [nhi[1]]);
                }
                else {
                    for (const k in nhi) {
                        this.setHeader(k, ...Array.isArray(nhi[1]) ? nhi[1] : [nhi[1]]);
                    }
                }
            }
        }
        return this;
    }
}
export default Headers;
//# sourceMappingURL=headers.js.map