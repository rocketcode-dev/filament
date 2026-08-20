import { randomBytes } from 'node:crypto';
import { bearer, clientBaseUrl, jsonResponse, postForm } from './lib/oauth-client.js';
const baseUrl = clientBaseUrl();
// `state` binds the redirect to this client-initiated transaction.
const state = randomBytes(18).toString('base64url');
const redirectUri = 'http://127.0.0.1/client/callback';
const authorize = new URL(`${baseUrl}/authorize`);
authorize.search = new URLSearchParams({
    response_type: 'code',
    client_id: 'reading-client',
    redirect_uri: redirectUri,
    state,
}).toString();
// A browser normally follows this request; manual redirect handling lets this
// terminal client inspect the callback and validate `state`.
const approval = await fetch(authorize, { redirect: 'manual' });
const callback = new URL(approval.headers.get('location') ?? '');
if (callback.searchParams.get('state') !== state)
    throw new Error('OAuth state mismatch');
// A confidential client authenticates with its secret while redeeming the
// authorization code. The server invalidates the code after this exchange.
const token = await postForm(`${baseUrl}/token`, {
    grant_type: 'authorization_code',
    code: callback.searchParams.get('code') ?? '',
    client_id: 'reading-client',
    client_secret: 'reading-secret',
    redirect_uri: redirectUri,
});
// Use the bearer token to perform useful work at the protected resource.
const profile = await jsonResponse(await fetch(`${baseUrl}/api/profile`, {
    headers: bearer(token.access_token),
}));
console.log(JSON.stringify({ flow: 'authorization_code', work: profile }));
//# sourceMappingURL=06-authorization-code-client.js.map