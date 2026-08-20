import type { ContextMeta, FrameworkMeta, Request } from './types.js';
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
export declare function contextGet<T extends FrameworkMeta, C extends ContextMeta>(req: Pick<Request<T, C>, 'context' | 'endpointMeta'>, path: string): unknown;
/**
 * Deeply clones default metadata, then merges zero or more sources into the
 * clone. Nested plain objects merge; arrays and other values replace.
 *
 * A final boolean argument controls whether the result is deeply frozen.
 */
export declare function deepMerge<T extends object>(defaultMeta: T, ...sources: Partial<T>[]): T;
export declare function deepMerge<T extends object>(defaultMeta: T, ...sourcesAndDeepFreeze: [...Partial<T>[], boolean]): T;
/**
 * Normalize a byte-size value. Unit suffixes are case-insensitive and use
 * binary multiples, so `2Mi`, `2MiB`, `2Mb`, and `2 MB` are all 2097152.
 */
export declare function normalizeByteSize(value: number | string): number;
/**
 * Present a header name in conventional upper-kebab form. Camel case, spaces,
 * and underscores are accepted, with explicit casing for common acronyms and
 * compound field-name fragments.
 */
export declare function normalizeHeaderName(name: string): string;
//# sourceMappingURL=tools.d.ts.map