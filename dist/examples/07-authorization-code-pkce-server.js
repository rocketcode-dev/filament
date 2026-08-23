import { parseArgs } from 'node:util';
import { createApp } from '../src/index.js';
import { activeToken, formBody, issueToken, randomToken, sha256Base64Url, } from './lib/oauth.js';
const { values } = parseArgs({
    options: { port: { type: 'string' }, silent: { type: 'boolean' } },
});
const port = Number(values.port ?? 0);
const silent = values.silent ?? false;
const app = createApp({ application: { maxRequestSize: '2MiB' } }, {});
const codes = new Map();
const tokens = new Map();
const redirectUri = 'http://127.0.0.1/pkce/callback';
// Apply bearer-token and scope validation only to routes whose metadata names
// a required scope. OAuth protocol endpoints remain public.
app.use(async (req, res) => {
    const requiredScope = req.endpointMeta.requiredScope;
    if (!requiredScope) {
        return;
    }
    const token = activeToken(req, tokens, requiredScope);
    if (!token) {
        res.headers.set('WWW-Authenticate', `Bearer scope="${requiredScope}"`);
        await res.status(401).json({ error: 'invalid_token' });
        return;
    }
    req.context.accessToken = token;
});
// Authorization endpoint: require the S256 PKCE method and bind the generated
// authorization code to the client's code challenge and redirect URI.
app.get('/authorize', async (req, res) => {
    const state = String(req.query.state ?? '');
    if (req.query.response_type !== 'code' || req.query.client_id !== 'poetry-app'
        || req.query.redirect_uri !== redirectUri
        || req.query.code_challenge_method !== 'S256'
        || typeof req.query.code_challenge !== 'string' || !state) {
        await res.status(400).json({ error: 'invalid_request' });
        return;
    }
    const code = randomToken();
    codes.set(code, {
        clientId: 'poetry-app',
        redirectUri,
        challenge: req.query.code_challenge,
        subject: 'public-client-user',
    });
    const location = new URL(redirectUri);
    location.searchParams.set('code', code);
    location.searchParams.set('state', state);
    res.status(302).headers.set('Location', location.toString());
    await res.end();
});
// Token endpoint: hash the presented verifier and compare it with the stored
// challenge, proving that the same public client started the flow.
app.post('/token', async (req, res) => {
    const form = formBody(req);
    const rawCode = form.get('code') ?? '';
    const code = codes.get(rawCode);
    const verifier = form.get('code_verifier') ?? '';
    if (form.get('grant_type') !== 'authorization_code' || !code
        || form.get('client_id') !== code.clientId
        || form.get('redirect_uri') !== code.redirectUri
        || sha256Base64Url(verifier) !== code.challenge) {
        await res.status(400).json({ error: 'invalid_grant' });
        return;
    }
    codes.delete(rawCode);
    await res.json(issueToken(tokens, code.subject, ['reading-list:write']));
});
// Protected resource: add a title after middleware validates the
// `reading-list:write` scope.
app.post('/api/reading-list', { requiredScope: 'reading-list:write' }, async (req, res) => {
    const token = req.context.accessToken;
    const title = JSON.parse(req.body?.toString() ?? '{}').title;
    await res.status(201).json({ added: title, owner: token.subject, position: 1 });
});
app.listen(port).then(actualPort => {
    if (!silent) {
        console.log(`\n🔑 Authorization Code + PKCE server running on http://127.0.0.1:${actualPort}`);
        console.log('\nEndpoints:');
        console.log('  GET  /authorize          - Issue a code bound to an S256 challenge');
        console.log('  POST /token              - Verify the code verifier and issue a token');
        console.log('  POST /api/reading-list   - Add a protected reading-list entry');
        console.log('\nTry:');
        console.log(`  curl -i "http://127.0.0.1:${actualPort}/authorize?response_type=code&client_id=poetry-app&redirect_uri=http%3A%2F%2F127.0.0.1%2Fpkce%2Fcallback&state=demo-state&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256"`);
        console.log(`  curl -X POST http://127.0.0.1:${actualPort}/token -d "grant_type=authorization_code&code=CODE_FROM_LOCATION&client_id=poetry-app&redirect_uri=http://127.0.0.1/pkce/callback&code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"`);
        console.log(`  curl -X POST -H "Authorization: Bearer ACCESS_TOKEN" -H "Content-Type: application/json" -d '{"title":"Frankenstein"}' http://127.0.0.1:${actualPort}/api/reading-list\n`);
    }
});
//# sourceMappingURL=07-authorization-code-pkce-server.js.map