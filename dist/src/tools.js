function isObject(value) {
    return value !== null && typeof value === 'object';
}
function isPlainObject(value) {
    if (!isObject(value))
        return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
function deepClone(value, seen = new WeakMap()) {
    if (!isObject(value))
        return value;
    const existing = seen.get(value);
    if (existing)
        return existing;
    if (value instanceof Date) {
        return new Date(value.getTime());
    }
    if (value instanceof RegExp) {
        return new RegExp(value.source, value.flags);
    }
    if (value instanceof Map) {
        const clone = new Map();
        seen.set(value, clone);
        for (const [key, item] of value) {
            clone.set(deepClone(key, seen), deepClone(item, seen));
        }
        return clone;
    }
    if (value instanceof Set) {
        const clone = new Set();
        seen.set(value, clone);
        for (const item of value) {
            clone.add(deepClone(item, seen));
        }
        return clone;
    }
    const clone = Array.isArray(value)
        ? []
        : Object.create(Object.getPrototypeOf(value));
    seen.set(value, clone);
    for (const key of Reflect.ownKeys(value)) {
        if (Array.isArray(value) && key === 'length')
            continue;
        clone[key] = deepClone(value[key], seen);
    }
    return clone;
}
function mergeInto(result, source) {
    for (const key of Reflect.ownKeys(source)) {
        const sourceValue = source[key];
        const resultValue = result[key];
        if (isPlainObject(sourceValue) && isPlainObject(resultValue)) {
            mergeInto(resultValue, sourceValue);
        }
        else {
            result[key] = deepClone(sourceValue);
        }
    }
}
function deepFreeze(value, seen = new WeakSet()) {
    if (!isObject(value) || seen.has(value))
        return value;
    seen.add(value);
    for (const key of Reflect.ownKeys(value)) {
        deepFreeze(value[key], seen);
    }
    return Object.freeze(value);
}
export function deepMerge(defaultMeta, ...sourcesAndDeepFreeze) {
    const finalArgument = sourcesAndDeepFreeze.at(-1);
    const shouldFreeze = typeof finalArgument === 'boolean'
        ? sourcesAndDeepFreeze.pop()
        : false;
    const result = deepClone(defaultMeta);
    for (const source of sourcesAndDeepFreeze) {
        mergeInto(result, source);
    }
    return shouldFreeze ? deepFreeze(result) : result;
}
/**
 * Normalize a byte-size value. Unit suffixes are case-insensitive and use
 * binary multiples, so `2Mi`, `2MiB`, `2Mb`, and `2 MB` are all 2097152.
 */
export function normalizeByteSize(value) {
    if (typeof value === 'number') {
        if (!Number.isSafeInteger(value) || value < 0) {
            throw new TypeError('Byte size must be a non-negative safe integer');
        }
        return value;
    }
    const match = value.match(/^\s*(\d+(?:\.\d+)?)\s*([kmgtp]?)(?:i)?b?\s*$/i);
    if (!match) {
        throw new TypeError(`Invalid byte size: ${value}`);
    }
    const unitPowers = {
        '': 0,
        k: 1,
        m: 2,
        g: 3,
        t: 4,
        p: 5,
    };
    const result = Number(match[1]) * 1024 ** unitPowers[match[2].toLowerCase()];
    if (!Number.isSafeInteger(result)) {
        throw new TypeError(`Byte size must resolve to a safe integer: ${value}`);
    }
    return result;
}
/**
 * Present a header name in conventional upper-kebab form. Camel case, spaces,
 * and underscores are accepted, with explicit casing for common acronyms and
 * compound field-name fragments.
 */
export function normalizeHeaderName(name) {
    const normalized = name
        .trim()
        .replace(/[\s_]+/g, '-')
        .replace(/([a-z\d])([A-Z])/g, '$1-$2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();
    const fixedHeaders = {
        'contentmd5': 'Content-MD5',
        'e-tag': 'ETag',
        'etag': 'ETag',
        'te': 'TE',
    };
    if (fixedHeaders[normalized])
        return fixedHeaders[normalized];
    const specialTokens = {
        api: 'API',
        cdn: 'CDN',
        ch: 'CH',
        dnt: 'DNT',
        dns: 'DNS',
        md5: 'MD5',
        mime: 'MIME',
        nel: 'NEL',
        te: 'TE',
        ua: 'UA',
        www: 'WWW',
        xss: 'XSS',
    };
    const tokens = normalized ? normalized.split('-') : [];
    const result = [];
    for (let index = 0; index < tokens.length; index++) {
        const token = tokens[index];
        const nextToken = tokens[index + 1];
        if (token === 'rate' && nextToken === 'limit') {
            result.push('RateLimit');
            index++;
        }
        else if (token === 'web' && nextToken === 'socket') {
            result.push('WebSocket');
            index++;
        }
        else if (token === 'websocket') {
            result.push('WebSocket');
        }
        else {
            result.push(specialTokens[token] ?? token.charAt(0).toUpperCase() + token.slice(1));
        }
    }
    return result.join('-');
}
//# sourceMappingURL=tools.js.map