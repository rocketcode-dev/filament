import { normalizeHeaderName } from "./tools.js";
// Only singleton fields belong here. List-valued fields are repeatable, and
// Set-Cookie is the standard response-field exception that must remain as
// separate lines. Unknown fields default to repeatable and can be overridden.
const defaultNonRepeatingHeaders = {
    request: new Set([
        'Access-Control-Request-Method',
        'Authorization',
        'Content-Length',
        'Content-Location',
        'Content-Range',
        'Content-Type',
        'Cookie',
        'Date',
        'From',
        'Host',
        'If-Modified-Since',
        'If-Range',
        'If-Unmodified-Since',
        'Max-Forwards',
        'Origin',
        'Proxy-Authorization',
        'Range',
        'Referer',
        'Sec-WebSocket-Key',
        'User-Agent',
        'X-Content-Type-Options',
    ].map(h => h.toLowerCase())),
    response: new Set([
        'Access-Control-Allow-Credentials',
        'Access-Control-Allow-Origin',
        'Access-Control-Max-Age',
        'Age',
        'Content-Disposition',
        'Content-Length',
        'Content-Location',
        'Content-MD5',
        'Content-Range',
        'Content-Type',
        'Date',
        'ETag',
        'Expires',
        'Last-Modified',
        'Location',
        'Retry-After',
        'Server',
        'Strict-Transport-Security',
        'X-Content-Type-Options',
        'X-Frame-Options',
        'X-XSS-Protection',
    ].map(h => h.toLowerCase()))
};
export class Headers {
    constructor(headerRepeatability, ...initialHeaders) {
        this._frozen = false;
        this._headerPairs = [];
        this.headerRepeatability = typeof headerRepeatability === 'string'
            ? { defaultNonRepeatableSet: headerRepeatability }
            : headerRepeatability;
        if (initialHeaders.length > 0) {
            this.addMany(...initialHeaders);
        }
    }
    /**
     * Returns a copy of all the headers in `Record<string, string|string[]> form.
     * Repeatable headers are always expressed as a string array, non-repeatable
     * headers are expressed as a single string.
     * @returns The headers
     */
    get headers() {
        const result = {};
        for (const [name, value] of this.headerPairs) {
            const nname = normalizeHeaderName(name);
            if (result[nname]) {
                if (Array.isArray(result[nname])) {
                    // already known to be repeatable
                    result[nname].push(value);
                }
                else {
                    // already known to be non-repeatable
                    result[nname] = value;
                }
            }
            else {
                result[nname] = this.isRepeatable(name) ? [value] : value;
            }
        }
        return result;
    }
    /**
     * Returns all the headers. This object cannot be changed. Use `add()` and
     * `set()` to change headers.
     * @returns The headers
     */
    get headerPairs() {
        const headersRepeat = {};
        const result = [];
        for (const headerPair of this._headerPairs) {
            const nname = normalizeHeaderName(headerPair[0]);
            switch (headersRepeat[nname]) {
                case true:
                    // no action necessary
                    break;
                case false:
                    // the header is known to be in the result already, but only once -- so
                    // search from the end and get rid of it.
                    for (let i = result.length - 1; i >= 0; i--) {
                        if (result[i][0] === nname) {
                            result.splice(i, 1);
                            break;
                        }
                    }
                    break;
                case undefined:
                    headersRepeat[nname] = this.isRepeatable(headerPair[0]);
                    break;
            }
            result.push(Object.freeze([nname, headerPair[1]]));
        }
        return Object.freeze(result);
    }
    get frozen() {
        return this._frozen;
    }
    set frozen(freeze) {
        if (freeze === true) {
            this._frozen = freeze;
        }
        else {
            throw 'Cannot unfreeze headers';
        }
    }
    /**
     * Add a response header. If a header with the name name already exists,
     * another header will be added with the same name.
     *
     * Headers can only be changed before they are frozen, such as when the
     * response headers are sent or the request headers are read.
     *
     * @param name - Header name
     * @param value - Header value(s), can be a string or array of strings
     * @returns this object for chaining
     * @throws Error if headers have already been sent
     */
    add(name, ...value) {
        this.checkFrozen();
        const lname = name.toLowerCase();
        // non-repeatable headers should always `set` instead of `add` -- so there
        // is only one header with that name and the last one added is taken to be
        // the correct one
        if (!this.isRepeatable(name)) {
            return this.set(name, ...value);
        }
        for (const v of value.flat()) {
            this._headerPairs.push(Object.freeze([lname, v]));
        }
        return this;
    }
    /**
     * Add response headers _en masse_. If a header with the same name already
     * exists, another header will be added with the same name.
     *
     * Headers can only be changed before they are frozen, such as when the
     * response headers are sent or the request headers are read.
     *
     * @param name - Header name
     * @param value - Header value(s), can be a string or array of strings
     * @returns this object for chaining
     * @throws Error if headers have already been sent
     */
    addMany(...newHeaders) {
        this.checkFrozen();
        for (let nh of newHeaders) {
            if (!Array.isArray(nh) || (typeof nh[0] === 'string')) {
                nh = [nh];
            }
            for (const nhi of nh) {
                if (Array.isArray(nhi)) {
                    this.add(nhi[0], ...Array.isArray(nhi[1]) ? nhi[1] : [nhi[1]]);
                }
                else {
                    for (const k in nhi) {
                        this.add(k, ...Array.isArray(nhi[k]) ? nhi[k] : [nhi[k]]);
                    }
                }
            }
        }
        return this;
    }
    checkFrozen() {
        if (this.frozen) {
            throw new Error('Cannot change headers after they are frozen');
        }
    }
    /**
     * Returns the value of a header. If there are multiple headers of the same
     * name, this will return an array in insertion order.
     * @param name the name of the header to retrieve.
     * @returns the header value or values, or `null` if the header does not
     *  exist. If the header is repeatable, the value will be expressed as an
     *  array. If the header is not repeatable, the value will be expressed as
     *  `null` if it does not exist, and a single string if it does exist.
     */
    get(name) {
        const result = [];
        const lname = name.toLowerCase();
        for (const [k, v] of this._headerPairs) {
            if (k === lname) {
                result.push(v);
            }
        }
        if (this.isRepeatable(name)) {
            return result;
        }
        else {
            switch (result.length) {
                case 0: return null;
                case 1: return result[0];
                default: return result[result.length - 1];
            }
        }
    }
    isRepeatable(name) {
        const r = this.headerRepeatability;
        const lname = name.toLowerCase();
        const includes = (headers) => {
            if (!headers)
                return false;
            return (Array.isArray(headers) ? headers : [headers])
                .some(header => header.toLowerCase() === lname);
        };
        if (includes(r.repeatable)) {
            return true;
        }
        else if (includes(r.nonRepeatable)) {
            return false;
        }
        else if (r.defaultNonRepeatableSet &&
            defaultNonRepeatingHeaders[r.defaultNonRepeatableSet].has(lname)) {
            return false;
        }
        else {
            return true;
        }
    }
    /**
     * Remove a response header.
     *
     * Headers can only be changed before they are frozen, such as when the
     * response headers are sent or the request headers are read.
     *
     * @param name - Header name
     * @returns this object for chaining
     * @throws Error if headers have already been sent
     */
    remove(name) {
        this.checkFrozen();
        const lname = name.toLowerCase();
        this._headerPairs = this._headerPairs.filter(hp => hp[0] !== lname);
        return this;
    }
    /**
     * Remove response headers _en masse_. Headers can only be changed before they
     * are frozen (e.g. when the response is sent).
     * @param name - Header name
     * @param value - Header value(s), can be a string or array of strings
     * @returns this object for chaining
     * @throws Error if headers have already been sent
     */
    removeMany(...name) {
        this.checkFrozen();
        name.flat().forEach(headerName => this.remove(headerName));
        return this;
    }
    /**
     * Set a response header. If a header with the same name already exists, the
     * header will be replaced with this one.
     *
     * Headers can only be changed before they are frozen, such as when the
     * response headers are sent or the request headers are read.
     *
     * @param name - Header name
     * @param value - Header value(s), can be a string or array of strings
     * @returns this object for chaining
     * @throws Error if headers have already been sent
     */
    set(name, ...value) {
        this.checkFrozen();
        const lname = name.toLowerCase();
        this._headerPairs = this._headerPairs.filter(hp => hp[0] !== lname);
        for (const v of value.flat()) {
            this._headerPairs.push(Object.freeze([lname, v]));
        }
        return this;
    }
    /**
     * Set response headers _en masse_. If a header with the same name already
     * exists, the header will be replaced with this one.
     *
     * Headers can only be changed before they are frozen, such as when the
     * response headers are sent or the request headers are read.
     *
     * @param name - Header name
     * @param value - Header value(s), can be a string or array of strings
     * @returns this object for chaining
     * @throws Error if headers have already been sent
     */
    setMany(...newHeaders) {
        this.checkFrozen();
        for (let nh of newHeaders) {
            if (!Array.isArray(nh) || (typeof nh[0] === 'string')) {
                nh = [nh];
            }
            for (const nhi of nh) {
                if (Array.isArray(nhi)) {
                    this.set(nhi[0], ...Array.isArray(nhi[1]) ? nhi[1] : [nhi[1]]);
                }
                else {
                    for (const k in nhi) {
                        this.set(k, ...Array.isArray(nhi[k]) ? nhi[k] : [nhi[k]]);
                    }
                }
            }
        }
        return this;
    }
    /**
     * Set a header (or many headers) to be repeatable or non-repeatable. Note
     * this does not consolidate newly non-repeatable headers into a single one,
     * but the get methods will check repeatability to ensure a non-repeatable
     * header is returned as a single value, the most recently added one taking
     * priority
     *
     * Headers can only be changed before they are frozen, such as when the
     * response headers are sent or the request headers are read.
     *
     * @param repeatable set to `true` to make a header repeatable, `false` to
     *  make it non-repeatable, or `"default"` to use the default value.
     * @param name the header name(s) to adjust the repeatability of.
     */
    setRepeatable(repeatable, ...name) {
        this.checkFrozen();
        const r = this.headerRepeatability;
        const names = name.flat().map(n => n.toLowerCase());
        // removes all references to names in `names` from one list
        const removeFrom = (listname) => {
            const removeList = r[listname];
            if (removeList) {
                if (Array.isArray(removeList)) {
                    r[listname] = removeList.filter(h => !names.includes(h.toLowerCase()));
                    // if there are fewer than two remaining items in the list, the list
                    // can be set to `undefined` or a single string.
                    switch (r[listname].length) {
                        case 0:
                            r[listname] = undefined;
                            break;
                        case 1:
                            r[listname] = r[listname][0];
                            break;
                    }
                }
                else if (names.includes(removeList.toLowerCase())) {
                    r[listname] = undefined;
                }
            }
        };
        // adds all names in `names` to one list
        const addTo = (listname) => {
            const addList = r[listname];
            if (addList) {
                if (Array.isArray(addList)) {
                    const existing = addList.map(item => item.toLowerCase());
                    addList.push(...names.filter(item => !existing.includes(item)));
                }
                else {
                    r[listname] = [
                        addList,
                        ...names.filter(item => item !== addList.toLowerCase()),
                    ];
                }
            }
            else {
                r[listname] = names;
            }
        };
        switch (repeatable) {
            case true:
                addTo('repeatable');
                removeFrom('nonRepeatable');
                break;
            case false:
                addTo('nonRepeatable');
                removeFrom('repeatable');
                break;
            case 'default':
                removeFrom('repeatable');
                removeFrom('nonRepeatable');
                break;
        }
    }
    toString() {
        const resultLines = [];
        for (const [name, value] of this.headerPairs) {
            resultLines.push(`${name}: ${value}`);
        }
        return resultLines.join('\n');
    }
}
export default Headers;
//# sourceMappingURL=headers.js.map