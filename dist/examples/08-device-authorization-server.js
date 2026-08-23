import { parseArgs } from 'node:util';
import { createApp } from '../src/index.js';
import { activeToken, formBody, header, issueToken, randomToken, } from './lib/oauth.js';
const { values } = parseArgs({
    options: { port: { type: 'string' }, silent: { type: 'boolean' } },
});
const port = Number(values.port ?? 0);
const silent = values.silent ?? false;
const app = createApp({ application: { maxRequestSize: '2MiB' } }, {});
const devices = new Map();
const deviceByUserCode = new Map();
const tokens = new Map();
// Metadata-driven bearer middleware protects only resource endpoints and puts
// the validated token in request-local context for the endpoint handler.
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
// Device authorization endpoint: issue a secret device code for polling and a
// short user code that can safely be typed on a second device.
app.post('/device_authorization', async (req, res) => {
    const form = formBody(req);
    if (form.get('client_id') !== 'television-poetry-app') {
        await res.status(400).json({ error: 'invalid_client' });
        return;
    }
    const deviceCode = randomToken();
    const userCode = randomToken(6).slice(0, 8).toUpperCase();
    devices.set(deviceCode, {
        userCode,
        clientId: 'television-poetry-app',
        approved: false,
        expiresAt: Date.now() + 10 * 60000,
    });
    deviceByUserCode.set(userCode, deviceCode);
    await res.json({
        device_code: deviceCode,
        user_code: userCode,
        verification_uri: `http://${header(req, 'host')}/device/verify`,
        expires_in: 600,
        interval: 1,
    });
});
// Verification endpoint: simulate the resource owner entering the user code
// and approving this device grant in a browser on another device.
app.post('/device/verify', async (req, res) => {
    const form = formBody(req);
    const deviceCode = deviceByUserCode.get(form.get('user_code') ?? '');
    const grant = deviceCode ? devices.get(deviceCode) : undefined;
    if (!grant || grant.expiresAt <= Date.now()) {
        await res.status(400).json({ error: 'invalid_user_code' });
        return;
    }
    grant.approved = true;
    await res.json({ approved: true, user_code: grant.userCode });
});
// Token endpoint: devices poll until approval, then exchange the one-time
// device code for a bearer token.
app.post('/token', async (req, res) => {
    const form = formBody(req);
    const deviceCode = form.get('device_code') ?? '';
    const grant = devices.get(deviceCode);
    if (form.get('grant_type') !== 'urn:ietf:params:oauth:grant-type:device_code'
        || !grant || form.get('client_id') !== grant.clientId
        || grant.expiresAt <= Date.now()) {
        await res.status(400).json({ error: 'invalid_grant' });
        return;
    }
    if (!grant.approved) {
        await res.status(400).json({ error: 'authorization_pending' });
        return;
    }
    devices.delete(deviceCode);
    deviceByUserCode.delete(grant.userCode);
    await res.json(issueToken(tokens, 'device-user', ['notes:write']));
});
// Protected resource: save a note after middleware enforces `notes:write`.
app.post('/api/notes', { requiredScope: 'notes:write' }, async (req, res) => {
    const token = req.context.accessToken;
    const text = JSON.parse(req.body?.toString() ?? '{}').text;
    await res.status(201).json({ saved: true, text, owner: token.subject });
});
app.listen(port).then(actualPort => {
    if (!silent) {
        console.log(`\n📺 Device Authorization server running on http://127.0.0.1:${actualPort}`);
        console.log('\nEndpoints:');
        console.log('  POST /device_authorization   - Issue device and user codes');
        console.log('  POST /device/verify          - Approve a user code');
        console.log('  POST /token                  - Poll for and obtain a token');
        console.log('  POST /api/notes              - Save a protected note (notes:write)');
        console.log('\nTry:');
        console.log(`  curl -X POST http://127.0.0.1:${actualPort}/device_authorization -d "client_id=television-poetry-app&scope=notes:write"`);
        console.log(`  curl -X POST http://127.0.0.1:${actualPort}/device/verify -d "user_code=USER_CODE"`);
        console.log(`  curl -X POST http://127.0.0.1:${actualPort}/token -d "grant_type=urn:ietf:params:oauth:grant-type:device_code&device_code=DEVICE_CODE&client_id=television-poetry-app"`);
        console.log(`  curl -X POST -H "Authorization: Bearer ACCESS_TOKEN" -H "Content-Type: application/json" -d '{"text":"Remember the milk"}' http://127.0.0.1:${actualPort}/api/notes\n`);
    }
});
//# sourceMappingURL=08-device-authorization-server.js.map