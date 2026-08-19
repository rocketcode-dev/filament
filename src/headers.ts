import { normalizeHeaderName } from "./tools.js";
import { InitHeader } from "./types.js";

export type HeaderSetEnum = 'request'|'response';

export type HeaderRepeatability = {
  /**
   * The type of headers, `request` or `response`. This defines a default list
   * of headers that can be overridden by the 'nonRepeatable' and 'repeatable'
   * list.
   */
  defaultNonRepeatableSet?: HeaderSetEnum,
  /**
   * All headers that are non-repeatable. If this conflicts with the
   * `repeatable` list, that list takes priority, but if this conflicts with the
   * `defaultNonRepeatableSet`, this takes priority.
   */
  nonRepeatable?: string|string[],
  /**
   * All headers that are repeatable. If this conflicts with the `nonRepeatable`
   * list or the `defaultNonRepeatableSet`, this takes priority
   */
  repeatable?: string|string[]
}

const defaultNonRepeatingHeaders: Record<HeaderSetEnum, Set<string>> = {
  request: new Set([
    'Accept',
    'Accept-Charset',
    'Accept-Encoding',
    'Accept-Language',
    'Authorization',
    'Expect',
    'From',
    'Host',
    'Location',
    'Max-Forwards',
    'Referer',
    'TE',
    'Trailer',
    'Transfer-Encoding',
    'Upgrade',
    'User-Agent',
    'Via',
    'Warning',
    'WWW-Authenticate',
  ].map(h => h.toLowerCase())),
  response: new Set([
    'Allow',
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
    'Proxy-Authenticate',
    'Retry-After',
    'Server',
    'Vary',
    'WWW-Authenticate',
  ].map(h => h.toLowerCase()))
};

export class Headers {

  private _frozen: boolean = false;
  private _headerPairs:(readonly [string, string])[] = [];

  private headerRepeatability: HeaderRepeatability;

  constructor(
    headerRepeatability:HeaderRepeatability|HeaderSetEnum,
    ...initialHeaders:(InitHeader|InitHeader[])[]
  ) {
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
  get headers(): Record<string, string|string[]> {
    const result:Record<string, string|string[]> = {};
    for (const [name, value] of this.headerPairs) {
      const nname = normalizeHeaderName(name);
      if (result[nname]) {
        if (Array.isArray(result[nname])) {
          // already known to be repeatable
          result[nname].push(value);
        } else {
          // already known to be non-repeatable
          result[nname] = value as string;
        }
      } else {
        result[nname] = this.isRepeatable(name) ? [value] : value;
      }
    }
    return result;
  }

  /**
   * Returns all the headers. This object cannot be changed. Use addHeader and
   * setHeader to change the response headers.
   * @returns The headers
   */
  get headerPairs(): readonly (readonly [string, string])[] {
    const headersRepeat:Record<string, boolean> = {};
    const result:(readonly [string, string])[] = [];
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

  get frozen(): boolean {
    return this._frozen;
  }

  set frozen(freeze: boolean) {
    if (freeze === true) {
      this._frozen = freeze;
    } else {
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
  add(name: string, ...value: (string | string[])[]): Headers {
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
  addMany(...newHeaders:(InitHeader|InitHeader[])[]) {
    this.checkFrozen();
    for (let nh of newHeaders) {
      if (!Array.isArray(nh) || (typeof nh[0] === 'string')) {
        nh = [nh as InitHeader];
      }
      for (const nhi of nh as InitHeader[]) {
        if (Array.isArray(nhi)) {
          this.add(nhi[0], ...Array.isArray(nhi[1]) ? nhi[1] : [nhi[1]]);
        } else {
          for (const k in nhi) {
            this.add(k, ...Array.isArray(nhi[1]) ? nhi[1] : [nhi[k]]);
          }
        }
      }
    }
  }

  private checkFrozen() {
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
  get(name: string):string|string[]|null {
    const result = [];
    const lname = name.toLowerCase();
    for (const [k,v] of this._headerPairs) {
      if (k === lname) {
        result.push(v);
      }
    }
    if (this.isRepeatable(name)) {
      return result;
    } else {
      switch (result.length) {
      case 0: return null;
      case 1: return result[0];
      default: return result[result.length-1];
      }
    }
  }

  isRepeatable(name: string) {
    const r = this.headerRepeatability;
    const lname = name.toLowerCase();
    if (r.repeatable?.includes(lname)) {
      return true;
    } else if (r.nonRepeatable?.includes(lname)) {
      return true;
    } else if (
      r.defaultNonRepeatableSet &&
      defaultNonRepeatingHeaders[r.defaultNonRepeatableSet].has(lname)
    ) {
      return false;
    } else {
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
  remove(name: string): Headers {
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
  removeMany(...name:(string|string[])[]): Headers {
    this.checkFrozen();
    name.flat().forEach(this.remove);
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
  set(name: string, ...value: (string | string[])[]): Headers {
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
  setMany(...newHeaders:(InitHeader|InitHeader[])[]): Headers {
    this.checkFrozen();
    for (let nh of newHeaders) {
      if (!Array.isArray(nh) || (typeof nh[0] === 'string')) {
        nh = [nh as InitHeader];
      }
      for (const nhi of nh as InitHeader[]) {
        if (Array.isArray(nhi)) {
          this.set(nhi[0], ...Array.isArray(nhi[1]) ? nhi[1] : [nhi[1]]);
        } else {
          for (const k in nhi) {
            this.set(k, ...Array.isArray(nhi[1]) ? nhi[1] : [nhi[k]]);
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
  setRepeatable(
    repeatable: boolean|'default', ...name:(string|string[])[]
  ): void {
    this.checkFrozen();
    const r = this.headerRepeatability;
    const names = name.flat().map(n => n.toLowerCase());

    // removes all references to names in `names` from one list
    const removeFrom = (listname:'repeatable'|'nonRepeatable') => {
      const removeList = r[listname];
      if (removeList) {
        if (Array.isArray(removeList)) {
          r[listname] = removeList.filter(h => !names.includes(h));
          // if there are fewer than two remaining items in the list, the list
          // can be set to `undefined` or a single string.
          switch(r[listname].length) {
          case 0: r[listname] = undefined     ; break;
          case 1: r[listname] = r[listname][0]; break;
          }
        } else if (names.includes(removeList)) {
          r[listname] = undefined;
        }
      }
    }

    // adds all names in `names` to one list
    const addTo = (listname:'repeatable'|'nonRepeatable') => {
      const addList = r[listname];
      if (addList) {
        if (Array.isArray(addList)) {
          addList.push(...names);
        } else {
          r[listname] = [addList, ...names];
        }
      } else {
        r[listname] = names;
      }
    }

    switch(repeatable) {
    case true:
      addTo('repeatable');
      removeFrom('nonRepeatable');
    case false:
      addTo('nonRepeatable');
      removeFrom('repeatable');
    case 'default':
      removeFrom('repeatable');
      removeFrom('nonRepeatable');
    }
  }

  toString(): string {
    const resultLines:string[] = [];
    for (const [name, value] of this.headerPairs) {
      resultLines.push(`${name}: ${value}`);
    }
    return resultLines.join('\n');
  }

}

export default Headers;