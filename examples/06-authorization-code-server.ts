import { parseArgs } from 'node:util';
import { ContextMeta, createApp, FrameworkMeta } from '../src/index.js';
import {
  AccessToken,
  activeToken,
  formBody,
  issueToken,
  randomToken,
  sameSecret,
} from './lib/oauth.js';

const { values } = parseArgs({
  options: { port: { type: 'string' }, silent: { type: 'boolean' } },
});
const port = Number(values.port ?? 0);
const silent = values.silent ?? false;

interface OAuthMeta extends FrameworkMeta { requiredScope?: string }
interface OAuthContext extends ContextMeta { accessToken?: AccessToken }
interface AuthorizationCode {
  clientId: string;
  redirectUri: string;
  subject: string;
  scope: string[];
}

const app = createApp<OAuthMeta, OAuthContext>(
  { application: { maxRequestSize: '2MiB' } },
  {},
);
const codes = new Map<string, AuthorizationCode>();
const tokens = new Map<string, AccessToken>();
const client = {
  id: 'reading-client',
  secret: 'reading-secret',
  redirectUri: 'http://127.0.0.1/client/callback',
};

// Protect only routes that declare `requiredScope` in their endpoint metadata.
// Public OAuth endpoints pass through; protected API routes receive the
// validated token through request-local context.
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

// Authorization endpoint: validate the registered client and redirect URI,
// simulate resource-owner approval, then return a short-lived one-time code.
app.get('/authorize', async (req, res) => {
  const clientId = String(req.query.client_id ?? '');
  const redirectUri = String(req.query.redirect_uri ?? '');
  const state = String(req.query.state ?? '');
  if (req.query.response_type !== 'code' || clientId !== client.id
    || redirectUri !== client.redirectUri || !state) {
    await res.status(400).json({ error: 'invalid_request' });
    return;
  }

  // A real server would authenticate the resource owner and ask for consent.
  const code = randomToken();
  codes.set(code, {
    clientId,
    redirectUri,
    subject: 'shelley-reader',
    scope: ['profile:read'],
  });
  const location = new URL(redirectUri);
  location.searchParams.set('code', code);
  location.searchParams.set('state', state);
  res.status(302).headers.set('Location', location.toString());
  await res.end();
});

// Token endpoint: authenticate the confidential client and exchange its
// single-use authorization code for a scoped bearer token.
app.post('/token', async (req, res) => {
  const form = formBody(req);
  const code = codes.get(form.get('code') ?? '');
  if (form.get('grant_type') !== 'authorization_code' || !code
    || form.get('client_id') !== client.id
    || !sameSecret(form.get('client_secret') ?? '', client.secret)
    || form.get('redirect_uri') !== code.redirectUri) {
    await res.status(400).json({ error: 'invalid_grant' });
    return;
  }

  codes.delete(form.get('code')!); // Authorization codes are single-use.
  await res.json(issueToken(tokens, code.subject, code.scope));
});

// Protected resource: the middleware has already enforced `profile:read` and
// attached the corresponding access-token record to this request.
app.get('/api/profile', { requiredScope: 'profile:read' }, async (req, res) => {
  const token = req.context.accessToken as AccessToken;
  await res.json({
    id: token.subject,
    displayName: 'Percy Bysshe Shelley Reader',
    favoritePoem: 'Ozymandias',
  });
});

app.listen(port).then(actualPort => {
  if (!silent) {
    console.log(`\n🔐 Authorization Code server running on http://127.0.0.1:${actualPort}`);
    console.log('\nEndpoints:');
    console.log('  GET  /authorize     - Approve a client and issue an authorization code');
    console.log('  POST /token         - Exchange a code and client secret for a token');
    console.log('  GET  /api/profile   - Read the protected profile (profile:read)');
    console.log('\nTry:');
    console.log(`  curl -i "http://127.0.0.1:${actualPort}/authorize?response_type=code&client_id=reading-client&redirect_uri=http%3A%2F%2F127.0.0.1%2Fclient%2Fcallback&state=demo-state"`);
    console.log(`  curl -X POST http://127.0.0.1:${actualPort}/token -d "grant_type=authorization_code&code=CODE_FROM_LOCATION&client_id=reading-client&client_secret=reading-secret&redirect_uri=http://127.0.0.1/client/callback"`);
    console.log(`  curl -H "Authorization: Bearer ACCESS_TOKEN" http://127.0.0.1:${actualPort}/api/profile\n`);
  }
});
