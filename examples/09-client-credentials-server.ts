import { parseArgs } from 'node:util';
import { ContextMeta, createApp, FrameworkMeta } from '../src/index.js';
import {
  AccessToken,
  activeToken,
  basicCredentials,
  formBody,
  issueToken,
  sameSecret,
} from './lib/oauth.js';

const { values } = parseArgs({
  options: { port: { type: 'string' }, silent: { type: 'boolean' } },
});
const port = Number(values.port ?? 0);
const silent = values.silent ?? false;

interface OAuthMeta extends FrameworkMeta { requiredScope?: string }
interface OAuthContext extends ContextMeta { accessToken?: AccessToken }
const app = createApp<OAuthMeta, OAuthContext>(
  { application: { maxRequestSize: '2MiB' } },
  {},
);
const tokens = new Map<string, AccessToken>();
const clients = new Map([
  ['analysis-worker', { secret: 'analysis-secret', scopes: ['text:analyze'] }],
]);

// Metadata-driven bearer middleware ensures that only tokens containing the
// endpoint's required scope reach the protected handler.
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

// Token endpoint: authenticate the service with HTTP Basic, restrict requested
// scopes to its registration, and issue a token representing the client itself.
app.post('/token', async (req, res) => {
  const form = formBody(req);
  const credentials = basicCredentials(req);
  const registered = credentials ? clients.get(credentials[0]) : undefined;
  const requestedScopes = (form.get('scope') ?? '').split(' ').filter(Boolean);
  if (form.get('grant_type') !== 'client_credentials' || !credentials
    || !registered || !sameSecret(credentials[1], registered.secret)
    || requestedScopes.some(scope => !registered.scopes.includes(scope))) {
    res.headers.set('WWW-Authenticate', 'Basic realm="token"');
    await res.status(401).json({ error: 'invalid_client' });
    return;
  }
  await res.json(issueToken(tokens, credentials[0], requestedScopes));
});

// Protected machine-to-machine resource: perform text analysis after the
// middleware enforces `text:analyze`.
app.post('/api/analyze', { requiredScope: 'text:analyze' }, async (req, res) => {
  const token = req.context.accessToken as AccessToken;
  const text = String(JSON.parse(req.body?.toString() ?? '{}').text ?? '');
  const words = text.trim() ? text.trim().split(/\s+/) : [];
  await res.json({ words: words.length, characters: text.length, performedBy: token.subject });
});

app.listen(port).then(actualPort => {
  if (!silent) {
    console.log(`\n🤖 Client Credentials server running on http://127.0.0.1:${actualPort}`);
    console.log('\nEndpoints:');
    console.log('  POST /token         - Authenticate a service and issue a scoped token');
    console.log('  POST /api/analyze   - Analyze protected text (text:analyze)');
    console.log('\nTry:');
    console.log(`  curl -u analysis-worker:analysis-secret -X POST http://127.0.0.1:${actualPort}/token -d "grant_type=client_credentials&scope=text:analyze"`);
    console.log(`  curl -X POST -H "Authorization: Bearer ACCESS_TOKEN" -H "Content-Type: application/json" -d '{"text":"I met a traveller from an antique land"}' http://127.0.0.1:${actualPort}/api/analyze\n`);
  }
});
