import { parseArgs } from 'node:util';

// All example clients target a separately running OAuth example server.
export function clientBaseUrl(): string {
  const { values } = parseArgs({
    options: { 'base-url': { type: 'string' } },
  });
  const baseUrl = values['base-url'];
  if (!baseUrl) throw new Error('Usage: --base-url http://127.0.0.1:PORT');
  return baseUrl.replace(/\/$/, '');
}

// Send an OAuth-style URL-encoded request and require a successful JSON reply.
export async function postForm(
  url: string,
  values: Record<string, string>,
  headers: Record<string, string> = {},
): Promise<any> {
  return jsonResponse(await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...headers,
    },
    body: new URLSearchParams(values),
  }));
}

// Convert non-2xx protocol or resource responses into actionable client errors.
export async function jsonResponse(response: globalThis.Response): Promise<any> {
  const body = await response.json() as any;
  if (!response.ok) {
    throw new Error(`${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

// Build the Authorization header used for protected resource calls.
export function bearer(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}
