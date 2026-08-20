import { bearer, clientBaseUrl, jsonResponse, postForm } from './lib/oauth-client.js';
const baseUrl = clientBaseUrl();
// Confidential services authenticate directly; no user or browser participates.
const basic = Buffer.from('analysis-worker:analysis-secret').toString('base64');
const token = await postForm(`${baseUrl}/token`, {
    grant_type: 'client_credentials',
    scope: 'text:analyze',
}, { Authorization: `Basic ${basic}` });
// Use the service token to invoke the protected text-analysis operation.
const work = await jsonResponse(await fetch(`${baseUrl}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...bearer(token.access_token) },
    body: JSON.stringify({ text: 'I met a traveller from an antique land' }),
}));
console.log(JSON.stringify({ flow: 'client_credentials', work }));
//# sourceMappingURL=09-client-credentials-client.js.map