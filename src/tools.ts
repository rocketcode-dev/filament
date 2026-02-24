
/**
 * Deep Merge -- assigns properties from source to target, merging nested
 * objects instead of replacing them. Arrays are replaced, not merged.
 * @param target The target object to merge into
 * @param source The source object to merge from
 * @returns The merged object
 */
export function deepMerge<T>(target: T, source: Partial<T>): T {
  const result: any = { ...target };

  for (const key in source) {
    if ( source[key] && typeof source[key] === 'object' &&
        !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(result[key] || {}, source[key] as any);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}