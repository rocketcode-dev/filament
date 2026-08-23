import { randomBytes } from 'node:crypto';
import { bearer, clientBaseUrl, jsonResponse, postForm } from './lib/oauth-client.js';
import { sha256Base64Url } from './lib/oauth.js';
const baseUrl = clientBaseUrl();
// Public clients generate a high-entropy verifier and send only its S256 hash
// through the browser-facing authorization request.
const state = randomBytes(18).toString('base64url');
const verifier = randomBytes(48).toString('base64url');
const redirectUri = 'http://127.0.0.1/pkce/callback';
const authorize = new URL(`${baseUrl}/authorize`);
authorize.search = new URLSearchParams({
    response_type: 'code',
    client_id: 'poetry-app',
    redirect_uri: redirectUri,
    state,
    code_challenge: sha256Base64Url(verifier),
    code_challenge_method: 'S256',
}).toString();
// Capture the simulated browser redirect and verify that it belongs to the
// transaction this client initiated.
const approval = await fetch(authorize, { redirect: 'manual' });
const callback = new URL(approval.headers.get('location') ?? '');
if (callback.searchParams.get('state') !== state)
    throw new Error('OAuth state mismatch');
// Redeeming the code with the original verifier proves possession without a
// client secret.
const token = await postForm(`${baseUrl}/token`, {
    grant_type: 'authorization_code',
    code: callback.searchParams.get('code') ?? '',
    client_id: 'poetry-app',
    redirect_uri: redirectUri,
    code_verifier: verifier,
});
// Use the scoped token to add a book to the protected reading list.
const work = await jsonResponse(await fetch(`${baseUrl}/api/reading-list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...bearer(token.access_token) },
    body: JSON.stringify({ title: 'The Complete Poems of Emily Dickinson' }),
}));
console.log(JSON.stringify({ flow: 'authorization_code_pkce', work }));
//# sourceMappingURL=07-authorization-code-pkce-client.js.map