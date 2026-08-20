import { parseArgs } from 'node:util';
// All example clients target a separately running OAuth example server.
export function clientBaseUrl() {
    const { values } = parseArgs({
        options: { 'base-url': { type: 'string' } },
    });
    const baseUrl = values['base-url'];
    if (!baseUrl)
        throw new Error('Usage: --base-url http://127.0.0.1:PORT');
    return baseUrl.replace(/\/$/, '');
}
// Send an OAuth-style URL-encoded request and require a successful JSON reply.
export async function postForm(url, values, headers = {}) {
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
export async function jsonResponse(response) {
    const body = await response.json();
    if (!response.ok) {
        throw new Error(`${response.status} ${JSON.stringify(body)}`);
    }
    return body;
}
// Build the Authorization header used for protected resource calls.
export function bearer(accessToken) {
    return { Authorization: `Bearer ${accessToken}` };
}
//# sourceMappingURL=oauth-client.js.map