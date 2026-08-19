import { InitHeader } from "./types.js";
export type HeaderSetEnum = 'request' | 'response';
export type HeaderRepeatability = {
    /**
     * The type of headers, `request` or `response`. This defines a default list
     * of headers that can be overridden by the 'nonRepeatable' and 'repeatable'
     * list.
     */
    defaultNonRepeatableSet?: HeaderSetEnum;
    /**
     * All headers that are non-repeatable. If this conflicts with the
     * `repeatable` list, that list takes priority, but if this conflicts with the
     * `defaultNonRepeatableSet`, this takes priority.
     */
    nonRepeatable?: string | string[];
    /**
     * All headers that are repeatable. If this conflicts with the `nonRepeatable`
     * list or the `defaultNonRepeatableSet`, this takes priority
     */
    repeatable?: string | string[];
};
export declare class Headers {
    private _frozen;
    private _headerPairs;
    private headerRepeatability;
    constructor(headerRepeatability: HeaderRepeatability | HeaderSetEnum, ...initialHeaders: (InitHeader | InitHeader[])[]);
    /**
     * Returns a copy of all the headers in `Record<string, string|string[]> form.
     * Repeatable headers are always expressed as a string array, non-repeatable
     * headers are expressed as a single string.
     * @returns The headers
     */
    get headers(): Record<string, string | string[]>;
    /**
     * Returns all the headers. This object cannot be changed. Use addHeader and
     * setHeader to change the response headers.
     * @returns The headers
     */
    get headerPairs(): readonly (readonly [string, string])[];
    get frozen(): boolean;
    set frozen(freeze: boolean);
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
    add(name: string, ...value: (string | string[])[]): Headers;
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
    addMany(...newHeaders: (InitHeader | InitHeader[])[]): void;
    private checkFrozen;
    /**
     * Returns the value of a header. If there are multiple headers of the same
     * name, this will return an array in insertion order.
     * @param name the name of the header to retrieve.
     * @returns the header value or values, or `null` if the header does not
     *  exist. If the header is repeatable, the value will be expressed as an
     *  array. If the header is not repeatable, the value will be expressed as
     *  `null` if it does not exist, and a single string if it does exist.
     */
    get(name: string): string | string[] | null;
    isRepeatable(name: string): boolean;
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
    remove(name: string): Headers;
    /**
     * Remove response headers _en masse_. Headers can only be changed before they
     * are frozen (e.g. when the response is sent).
     * @param name - Header name
     * @param value - Header value(s), can be a string or array of strings
     * @returns this object for chaining
     * @throws Error if headers have already been sent
     */
    removeMany(...name: (string | string[])[]): Headers;
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
    set(name: string, ...value: (string | string[])[]): Headers;
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
    setMany(...newHeaders: (InitHeader | InitHeader[])[]): Headers;
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
    setRepeatable(repeatable: boolean | 'default', ...name: (string | string[])[]): void;
    toString(): string;
}
export default Headers;
//# sourceMappingURL=headers.d.ts.map