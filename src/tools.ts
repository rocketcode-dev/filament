
import type {
  ContextMeta,
  FrameworkMeta,
  Request,
} from './types.js';

function isObject(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && typeof value === 'object';
}

interface PathResult {
  found: boolean;
  value?: unknown;
}

function getOwnPath(root: unknown, segments: readonly string[]): PathResult {
  let value = root;
  for (const segment of segments) {
    if (!isObject(value) ||
      !Object.prototype.hasOwnProperty.call(value, segment)) {
      return { found: false };
    }
    value = value[segment];
  }
  return { found: true, value };
}

/**
 * Read request policy state using the mutable request context as an overlay on
 * the immutable endpoint metadata.
 *
 * The complete dotted path is resolved against `req.context` first. If that
 * path is not present there, it is resolved against `req.endpointMeta`.
 * Existing context values such as `undefined`, `null`, or `false` take
 * precedence over endpoint metadata. Only own properties are traversed.
 *
 * @example
 * ```typescript
 * const enabled = contextGet(req, 'trace.enabled');
 * ```
 */
export function contextGet<
  T extends FrameworkMeta,
  C extends ContextMeta,
>(
  req: Pick<Request<T, C>, 'context' | 'endpointMeta'>,
  path: string,
): unknown {
  const segments = path.split('.');
  if (!path || segments.some(segment => !segment)) {
    throw new TypeError('Context path must contain non-empty dot-separated keys');
  }

  const contextResult = getOwnPath(req.context, segments);
  if (contextResult.found) return contextResult.value;

  return getOwnPath(req.endpointMeta, segments).value;
}

function isPlainObject(
  value: unknown,
): value is Record<PropertyKey, unknown> {
  if (!isObject(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function deepClone<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (!isObject(value)) return value;

  const existing = seen.get(value);
  if (existing) return existing as T;

  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }
  if (value instanceof RegExp) {
    return new RegExp(value.source, value.flags) as T;
  }
  if (value instanceof Map) {
    const clone = new Map();
    seen.set(value, clone);
    for (const [key, item] of value) {
      clone.set(deepClone(key, seen), deepClone(item, seen));
    }
    return clone as T;
  }
  if (value instanceof Set) {
    const clone = new Set();
    seen.set(value, clone);
    for (const item of value) {
      clone.add(deepClone(item, seen));
    }
    return clone as T;
  }

  const clone: Record<PropertyKey, unknown> | unknown[] = Array.isArray(value)
    ? []
    : Object.create(Object.getPrototypeOf(value));
  seen.set(value, clone);

  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === 'length') continue;
    (clone as Record<PropertyKey, unknown>)[key] = deepClone(value[key], seen);
  }

  return clone as T;
}

function mergeInto(
  result: Record<PropertyKey, unknown>,
  source: Record<PropertyKey, unknown>,
): void {
  for (const key of Reflect.ownKeys(source)) {
    const sourceValue = source[key];
    const resultValue = result[key];
    if (isPlainObject(sourceValue) && isPlainObject(resultValue)) {
      mergeInto(resultValue, sourceValue);
    } else {
      result[key] = deepClone(sourceValue);
    }
  }
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (!isObject(value) || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze(value[key], seen);
  }
  return Object.freeze(value);
}

/**
 * Deeply clones default metadata, then merges zero or more sources into the
 * clone. Nested plain objects merge; arrays and other values replace.
 *
 * A final boolean argument controls whether the result is deeply frozen.
 */
export function deepMerge<T extends object>(
  defaultMeta: T,
  ...sources: Partial<T>[]
): T;
export function deepMerge<T extends object>(
  defaultMeta: T,
  ...sourcesAndDeepFreeze: [...Partial<T>[], boolean]
): T;
export function deepMerge<T extends object>(
  defaultMeta: T,
  ...sourcesAndDeepFreeze: (Partial<T> | boolean)[]
): T {
  const finalArgument = sourcesAndDeepFreeze.at(-1);
  const shouldFreeze = typeof finalArgument === 'boolean'
    ? sourcesAndDeepFreeze.pop() as boolean
    : false;
  const result = deepClone(defaultMeta);

  for (const source of sourcesAndDeepFreeze as Partial<T>[]) {
    mergeInto(
      result as Record<PropertyKey, unknown>,
      source as Record<PropertyKey, unknown>,
    );
  }

  return shouldFreeze ? deepFreeze(result) : result;
}

/**
 * Normalize a byte-size value. Unit suffixes are case-insensitive and use
 * binary multiples, so `2Mi`, `2MiB`, `2Mb`, and `2 MB` are all 2097152.
 */
export function normalizeByteSize(value: number | string): number {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new TypeError('Byte size must be a non-negative safe integer');
    }
    return value;
  }

  const match = value.match(
    /^\s*(\d+(?:\.\d+)?)\s*([kmgtp]?)(?:i)?b?\s*$/i,
  );
  if (!match) {
    throw new TypeError(`Invalid byte size: ${value}`);
  }

  const unitPowers: Record<string, number> = {
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
export function normalizeHeaderName(name: string): string {
  const normalized = name
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  const fixedHeaders: Record<string, string> = {
    'contentmd5': 'Content-MD5',
    'e-tag': 'ETag',
    'etag': 'ETag',
    'te': 'TE',
  };
  if (fixedHeaders[normalized]) return fixedHeaders[normalized];

  const specialTokens: Record<string, string> = {
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
  const result: string[] = [];

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const nextToken = tokens[index + 1];
    if (token === 'rate' && nextToken === 'limit') {
      result.push('RateLimit');
      index++;
    } else if (token === 'web' && nextToken === 'socket') {
      result.push('WebSocket');
      index++;
    } else if (token === 'websocket') {
      result.push('WebSocket');
    } else {
      result.push(
        specialTokens[token] ?? token.charAt(0).toUpperCase() + token.slice(1),
      );
    }
  }

  return result.join('-');
}
