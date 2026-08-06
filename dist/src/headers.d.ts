import { InitHeader } from "./types.js";
export declare class Headers {
    private _headersSent;
    private _headerPairs;
    constructor(...initialHeaders: (InitHeader | InitHeader[])[]);
    /**
     * Returns a copy of all the headers in object form
     * @returns The headers
     */
    get headers(): Record<string, string[]>;
    /**
     * Returns all the headers. This object cannot be changed. Use addHeader and
     * setHeader to change the response headers.
     * @returns The headers
     */
    get headerPairs(): readonly (readonly [string, string])[];
    get headersSent(): boolean;
    set headersSent(sent: boolean);
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
    addHeader(name: string, ...value: (string | string[])[]): Headers;
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
    addHeaders(...newHeaders: (InitHeader | InitHeader[])[]): void;
    /**
     * Returns the value of a header. If there are multiple headers of the same
     * name, this will return an array in insertion order.
     * @param name the name of the header to retrieve.
     * @returns the header value or values, or `null` if the header does not exist
     */
    getHeader(name: string): string | string[] | null;
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
    setHeader(name: string, ...value: (string | string[])[]): Headers;
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
    setHeaders(...newHeaders: (InitHeader | InitHeader[])[]): Headers;
}
export default Headers;
//# sourceMappingURL=headers.d.ts.map