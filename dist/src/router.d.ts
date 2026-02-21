/**
 * Router utilities for path matching and parameter extraction.
 *
 * Provides functions to convert Express-style path patterns to regular expressions
 * and to match incoming request paths against route patterns.
 */
export interface PathMatch {
    params: Record<string, string>;
}
/**
 * Convert Express-style path to RegExp and extract parameter names.
 *
 * Converts path patterns like '/users/:id/posts/:postId' into a regular expression
 * and extracts the parameter names for later matching.
 *
 * @param path - Path pattern with optional parameters using colon syntax (e.g., ':id')
 * @returns Object with compiled regex pattern and extracted parameter names
 *
 * @example
 * ```typescript
 * const { pattern, paramNames } = pathToRegex('/users/:id/posts/:postId');
 * // pattern: /^\\/users\\/([^\\/]+)\\/posts\\/([^\\/]+)$/
 * // paramNames: ['id', 'postId']
 * ```
 */
export declare function pathToRegex(path: string): {
    pattern: RegExp;
    paramNames: string[];
};
/**
 * Match a request path against a route pattern.
 *
 * Checks if a request path matches a pre-compiled route pattern and extracts
 * parameter values if present.
 *
 * @param requestPath - The incoming request path to match
 * @param pattern - Compiled regex pattern from {@link pathToRegex}
 * @param paramNames - Parameter names extracted from {@link pathToRegex}
 * @returns Object with extracted parameters, or null if path doesn't match
 *
 * @example
 * ```typescript
 * const { pattern, paramNames } = pathToRegex('/users/:id');
 * const match = matchPath('/users/123', pattern, paramNames);
 * if (match) {
 *   console.log(match.params.id); // '123'
 * }
 * ```
 */
export declare function matchPath(requestPath: string, pattern: RegExp, paramNames: string[]): PathMatch | null;
//# sourceMappingURL=router.d.ts.map