
function isObject(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && typeof value === 'object';
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

export function normalizeHeaderName(name: string): string {

    // handle whole-header-name special cases. These are standard headers with
    // multiple uppercase letters in a row that would not be common in
    // non-standard headers
    const fixedHeaders = ['ETag', 'TE']
    const fixedHeaderFound =
      fixedHeaders.find(h => h.toLowerCase() === name.toLowerCase());
    if (fixedHeaderFound) {
      return fixedHeaderFound;
    }

    // Normalize to kebab case
    name = name
      .replace(/ /g, '-')
      // uppercase letters that do not follow other uppercase letters
      .replace(/(?<!^|[A-Z])([A-Z])/g, '-$1')
      .replace(/\-+/g, '-')
      .replace(/^\-/, '')
      .toLowerCase();
    // raise the case to initial caps
    let raiseNextCase = true;
    let charArray = [];
    for (let idx = 0; idx < name.length; idx++) {
      let ca = name.charAt(idx);
      if (raiseNextCase) {
        ca = ca.toUpperCase();
        raiseNextCase = false;
      } else if (ca === '-') {
        raiseNextCase = true;
      }
      charArray.push(ca);
    }
    let result = charArray.join('');

    // dehyphenate certain fragments
    const dehyphenate = ['Rate-Limit'];
    for (const d of dehyphenate) {
      result = result.replace(d, d.replace(/\-/g, ''));
    }

    // handle certain fragments that should have a specific casing that is not initial caps.
    const specialCases = ['API', 'MD5', 'WWW', 'XSS', 'RateLimit'];
    for (const sc of specialCases) {
      let lastScIndex = -1;
      let scIndex!:number
      while (
        (scIndex = result.toLowerCase().indexOf(sc.toLowerCase(), lastScIndex))
        > -1
      ) {
        result =
          result.substring(0, scIndex) + sc +
          result.substring(scIndex + sc.length);
        lastScIndex = scIndex + sc.length;
      }
    }

    return result;
}
