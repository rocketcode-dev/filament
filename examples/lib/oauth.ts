import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Request } from '../../src/index.js';

export interface AccessToken {
  subject: string;
  scope: string[];
  expiresAt: number;
}

// Generate URL-safe cryptographic material for codes and opaque access tokens.
export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}

// PKCE's S256 method is SHA-256 encoded with unpadded base64url.
export function sha256Base64Url(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}

// OAuth token endpoints conventionally consume URL-encoded form bodies.
export function formBody(req: Request): URLSearchParams {
  return new URLSearchParams(req.body?.toString('utf8') ?? '');
}

// Filament request headers can be singular or repeated; OAuth uses one value.
export function header(req: Request, name: string): string | undefined {
  const value = req.headers.get(name);
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

// Decode the client ID and secret from HTTP Basic authentication.
export function basicCredentials(req: Request): [string, string] | undefined {
  const authorization = header(req, 'authorization');
  if (!authorization?.startsWith('Basic ')) return undefined;

  try {
    const decoded = Buffer.from(authorization.slice(6), 'base64').toString();
    const separator = decoded.indexOf(':');
    if (separator < 0) return undefined;
    return [decoded.slice(0, separator), decoded.slice(separator + 1)];
  } catch {
    return undefined;
  }
}

// Avoid a content-dependent comparison once equally sized secrets are present.
export function sameSecret(actual: string, expected: string): boolean {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

// Extract an OAuth bearer credential without accepting another auth scheme.
export function bearerToken(req: Request): string | undefined {
  const authorization = header(req, 'authorization');
  return authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : undefined;
}

// Resolve only a live token containing the scope required by the route.
export function activeToken(
  req: Request,
  tokens: ReadonlyMap<string, AccessToken>,
  requiredScope: string,
): AccessToken | undefined {
  const token = bearerToken(req);
  const record = token ? tokens.get(token) : undefined;
  return record && record.expiresAt > Date.now()
    && record.scope.includes(requiredScope)
    ? record
    : undefined;
}

// Mint an opaque one-hour token and retain its server-side authorization data.
export function issueToken(
  tokens: Map<string, AccessToken>,
  subject: string,
  scope: string[],
): { access_token: string; token_type: 'Bearer'; expires_in: number; scope: string } {
  const accessToken = randomToken();
  const expiresIn = 3600;
  tokens.set(accessToken, {
    subject,
    scope,
    expiresAt: Date.now() + expiresIn * 1000,
  });
  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: expiresIn,
    scope: scope.join(' '),
  };
}
