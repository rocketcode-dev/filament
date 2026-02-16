/**
 * Router utilities for path matching and parameter extraction
 */

export interface PathMatch {
  params: Record<string, string>;
}

/**
 * Convert Express-style path to RegExp and extract parameter names
 */
export function pathToRegex(path: string): { pattern: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];
  
  // Convert :param to named capture groups
  const regexPattern = path
    .replace(/:[^/]+/g, (match) => {
      const paramName = match.slice(1); // Remove the ':'
      paramNames.push(paramName);
      return '([^/]+)';
    })
    .replace(/\//g, '\\/'); // Escape forward slashes
  
  const pattern = new RegExp(`^${regexPattern}$`);
  
  return { pattern, paramNames };
}

/**
 * Match a request path against a route pattern
 */
export function matchPath(requestPath: string, pattern: RegExp, paramNames: string[]): PathMatch | null {
  const match = requestPath.match(pattern);
  
  if (!match) {
    return null;
  }
  
  const params: Record<string, string> = {};
  
  // Extract parameter values from capture groups
  for (let i = 0; i < paramNames.length; i++) {
    params[paramNames[i]] = match[i + 1];
  }
  
  return { params };
}
