/**
 * Router utilities for path matching and parameter extraction
 */
export interface PathMatch {
    params: Record<string, string>;
}
/**
 * Convert Express-style path to RegExp and extract parameter names
 */
export declare function pathToRegex(path: string): {
    pattern: RegExp;
    paramNames: string[];
};
/**
 * Match a request path against a route pattern
 */
export declare function matchPath(requestPath: string, pattern: RegExp, paramNames: string[]): PathMatch | null;
//# sourceMappingURL=router.d.ts.map