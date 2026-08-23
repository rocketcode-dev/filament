import { setTimeout as delay } from 'node:timers/promises';
import { bearer, clientBaseUrl, jsonResponse, postForm } from './lib/oauth-client.js';

const baseUrl = clientBaseUrl();
const clientId = 'television-poetry-app';
// Ask the authorization server for the two codes and verification URL.
const authorization = await postForm(`${baseUrl}/device_authorization`, {
  client_id: clientId,
  scope: 'notes:write',
});

// This simulates the resource owner approving the user code on a second device.
await postForm(new URL(authorization.verification_uri, baseUrl).toString(), {
  user_code: authorization.user_code,
});

// A television or CLI without a convenient browser polls at the server-provided
// interval until the resource owner approves or the flow expires.
let token: any;
for (let attempt = 0; attempt < 5 && !token; attempt += 1) {
  const response = await fetch(`${baseUrl}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: authorization.device_code,
      client_id: clientId,
    }),
  });
  const body = await response.json() as any;
  if (response.ok) token = body;
  else if (body.error === 'authorization_pending') await delay(authorization.interval * 1000);
  else throw new Error(JSON.stringify(body));
}
if (!token) throw new Error('Device authorization timed out');

// Use the resulting scoped token to save a note.
const work = await jsonResponse(await fetch(`${baseUrl}/api/notes`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...bearer(token.access_token) },
  body: JSON.stringify({ text: 'Look on my Works, ye Mighty, and despair!' }),
}));
console.log(JSON.stringify({ flow: 'device_authorization', work }));
