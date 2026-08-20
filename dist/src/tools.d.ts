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
export declare function normalizeHeaderName(name: string): string;
//# sourceMappingURL=tools.d.ts.map