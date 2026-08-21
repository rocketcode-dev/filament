import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { suite } from 'node:test';
import TestBattery from 'test-battery';
const DO_SUITE = 'all';
function doSuite(suiteName, suite) {
    if (DO_SUITE === 'none') {
        return undefined;
    }
    else if (DO_SUITE === 'all' || DO_SUITE === suiteName) {
        return suite;
    }
    else {
        return undefined;
    }
}
const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
const compiler = resolve(projectRoot, 'node_modules/typescript/bin/tsc');
const examples = {
    blog: { name: 'Blog API', source: 'examples/01-blog-api.ts' },
    versioning: { name: 'API Versioning', source: 'examples/02-api-versioning.ts' },
    performance: { name: 'Performance Controls', source: 'examples/03-performance-controls.ts' },
    observability: { name: 'Observability', source: 'examples/04-observability.ts' },
    content: { name: 'Content Negotiation', source: 'examples/05-content-negotiation.ts' },
    authorizationCodeServer: {
        name: 'Authorization Code Server',
        source: 'examples/06-authorization-code-server.ts',
    },
    authorizationCodeClient: {
        name: 'Authorization Code Client',
        source: 'examples/06-authorization-code-client.ts',
    },
    pkceServer: {
        name: 'Authorization Code with PKCE Server',
        source: 'examples/07-authorization-code-pkce-server.ts',
    },
    pkceClient: {
        name: 'Authorization Code with PKCE Client',
        source: 'examples/07-authorization-code-pkce-client.ts',
    },
    deviceServer: {
        name: 'Device Authorization Server',
        source: 'examples/08-device-authorization-server.ts',
    },
    deviceClient: {
        name: 'Device Authorization Client',
        source: 'examples/08-device-authorization-client.ts',
    },
    clientCredentialsServer: {
        name: 'Client Credentials Server',
        source: 'examples/09-client-credentials-server.ts',
    },
    clientCredentialsClient: {
        name: 'Client Credentials Client',
        source: 'examples/09-client-credentials-client.ts',
    },
    streaming: {
        name: 'Streaming Ozymandias',
        source: 'examples/10-streaming-ozymandias.ts',
    },
};
const compilations = new Map();
function compileExample(example) {
    let compilation = compilations.get(example.source);
    if (!compilation) {
        compilation = (async () => {
            const directory = await mkdtemp(join(tmpdir(), 'filament-example-'));
            let status = 0;
            let diagnostics = '';
            try {
                const result = await execFileAsync(process.execPath, [
                    compiler,
                    '--target', 'ES2020',
                    '--module', 'NodeNext',
                    '--moduleResolution', 'NodeNext',
                    '--strict',
                    '--esModuleInterop',
                    '--skipLibCheck',
                    '--noEmit',
                    resolve(projectRoot, example.source),
                ], { cwd: projectRoot });
                diagnostics = `${result.stdout}${result.stderr}`;
            }
            catch (error) {
                status = typeof error.code === 'number' ? error.code : 1;
                diagnostics = `${error.stdout || ''}${error.stderr || ''}`;
            }
            /*
             * Emit separately as CommonJS even when type checking fails. This is not
             * the build assertion above; it lets the HTTP contract tests exercise
             * the real example program instead of stopping at its first diagnostic.
             */
            try {
                await execFileAsync(process.execPath, [
                    compiler,
                    '--target', 'ES2020',
                    '--module', 'commonjs',
                    '--moduleResolution', 'node',
                    '--strict',
                    '--esModuleInterop',
                    '--skipLibCheck',
                    '--declaration', 'false',
                    '--sourceMap', 'false',
                    '--noEmitOnError', 'false',
                    '--outDir', directory,
                    resolve(projectRoot, example.source),
                ], { cwd: projectRoot });
            }
            catch {
                // TypeScript still emits runnable JavaScript with noEmitOnError=false.
            }
            return {
                directory,
                outputFile: join(directory, 'examples', basename(example.source, '.ts') + '.js'),
                status,
                diagnostics,
            };
        })();
        compilations.set(example.source, compilation);
    }
    return compilation;
}
async function stopProcess(child) {
    if (child.exitCode !== null || child.signalCode !== null)
        return;
    const exited = new Promise(resolveExit => {
        child.once('exit', () => resolveExit());
    });
    child.kill('SIGTERM');
    await exited;
}
async function findAvailablePort() {
    const server = net.createServer();
    await new Promise((resolveListen, rejectListen) => {
        server.once('error', rejectListen);
        server.listen(0, '127.0.0.1', resolveListen);
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    await new Promise((resolveClose, rejectClose) => {
        server.close(error => error ? rejectClose(error) : resolveClose());
    });
    return port;
}
async function waitForServer(child, port, readOutput) {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
        if (child.exitCode !== null || child.signalCode !== null) {
            throw new Error(`Example exited before listening:\n${readOutput()}`);
        }
        const listening = await new Promise(resolveConnection => {
            const socket = net.createConnection({ host: '127.0.0.1', port });
            socket.once('connect', () => {
                socket.destroy();
                resolveConnection(true);
            });
            socket.once('error', () => resolveConnection(false));
        });
        if (listening)
            return;
        await new Promise(resolveWait => setTimeout(resolveWait, 25));
    }
    throw new Error(`Example did not listen on port ${port}:\n${readOutput()}`);
}
async function withExample(example, run, serverArgs = []) {
    const compilation = await compileExample(example);
    if (!existsSync(compilation.outputFile)) {
        throw new Error(`TypeScript did not emit ${example.source}:\n${compilation.diagnostics}`);
    }
    let output = '';
    const port = await findAvailablePort();
    const child = spawn(process.execPath, [
        compilation.outputFile,
        '--port', String(port),
        '--silent',
        ...serverArgs,
    ], {
        cwd: compilation.directory,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout?.on('data', chunk => {
        output += chunk.toString();
        process.stdout.write(chunk);
    });
    child.stderr?.on('data', chunk => {
        output += chunk.toString();
        process.stderr.write(chunk);
    });
    try {
        await waitForServer(child, port, () => output);
        const baseUrl = `http://127.0.0.1:${port}`;
        await run(async (path, init = {}) => {
            const response = await fetch(`${baseUrl}${path}`, init);
            const text = await response.text();
            let json;
            if (text) {
                try {
                    json = JSON.parse(text);
                }
                catch {
                    // XML, CSV, and HTML responses are asserted as text.
                }
            }
            return { status: response.status, headers: response.headers, text, json };
        }, baseUrl);
    }
    finally {
        await stopProcess(child);
    }
}
async function runExampleClient(client, baseUrl) {
    const compilation = await compileExample(client);
    if (!existsSync(compilation.outputFile)) {
        throw new Error(`TypeScript did not emit ${client.source}:\n${compilation.diagnostics}`);
    }
    const result = await execFileAsync(process.execPath, [
        compilation.outputFile,
        '--base-url', baseUrl,
    ], { cwd: compilation.directory });
    return JSON.parse(result.stdout.trim());
}
function jsonRequest(method, body, token) {
    const headers = {};
    if (body !== undefined)
        headers['Content-Type'] = 'application/json';
    if (token)
        headers.Authorization = token;
    return {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    };
}
function testCompilation(example) {
    TestBattery.test('should compile', async (battery) => {
        const result = await compileExample(example);
        battery.test(result.diagnostics
            ? `should compile without diagnostics:\n${result.diagnostics}`
            : 'should compile without diagnostics').value(result.status).value(0).equal;
    });
}
suite('Documented examples', () => {
    suite('Blog API', doSuite('blog', () => {
        testCompilation(examples.blog);
        TestBattery.test('should expose the documented public endpoints', async (battery) => {
            await withExample(examples.blog, async (request) => {
                const list = await request('/posts');
                const post = await request('/posts/1');
                const missing = await request('/posts/999');
                battery.test('GET /posts should list posts')
                    .value({ status: list.status, count: list.json?.posts?.length })
                    .value({ status: 200, count: 2 }).deepEqual;
                battery.test('GET /posts/:id should return a post')
                    .value({ status: post.status, id: post.json?.post?.id })
                    .value({ status: 200, id: 1 }).deepEqual;
                battery.test('GET /posts/:id should return 404 when absent')
                    .value(missing.status).value(404).equal;
            });
        });
        TestBattery.test('should enforce authentication and RBAC', async (battery) => {
            await withExample(examples.blog, async (request) => {
                const anonymous = await request('/posts', jsonRequest('POST', { title: 'New', content: 'Post' }));
                const viewer = await request('/posts', jsonRequest('POST', { title: 'New', content: 'Post' }, 'token-viewer'));
                const editor = await request('/posts', jsonRequest('POST', { title: 'New', content: 'Post' }, 'token-editor'));
                const editorDelete = await request('/posts/1', jsonRequest('DELETE', undefined, 'token-editor'));
                const adminDelete = await request('/posts/1', jsonRequest('DELETE', undefined, 'token-admin'));
                battery.test('anonymous create should return 401')
                    .value(anonymous.status).value(401).equal;
                battery.test('viewer create should return 403')
                    .value(viewer.status).value(403).equal;
                battery.test('editor create should return 201')
                    .value(editor.status).value(201).equal;
                battery.test('editor delete should return 403')
                    .value(editorDelete.status).value(403).equal;
                battery.test('admin delete should return 204')
                    .value(adminDelete.status).value(204).equal;
            });
        });
        TestBattery.test('should restrict editors to their own posts', async (battery) => {
            await withExample(examples.blog, async (request) => {
                const other = await request('/posts/1', jsonRequest('PATCH', { title: 'Changed' }, 'token-editor'));
                const own = await request('/posts/2', jsonRequest('PATCH', { title: 'Changed' }, 'token-editor'));
                battery.test('editing another author\'s post should return 403')
                    .value(other.status).value(403).equal;
                battery.test('editing an owned post should succeed')
                    .value({ status: own.status, title: own.json?.post?.title })
                    .value({ status: 200, title: 'Changed' }).deepEqual;
            });
        });
    }));
    suite('API Versioning', doSuite('versioning', () => {
        testCompilation(examples.versioning);
        TestBattery.test('should serve deprecated v1 response formats', async (battery) => {
            await withExample(examples.versioning, async (request) => {
                const minimal = await request('/api/v1/user/123');
                const profile = await request('/api/v1/user/123/profile');
                battery.test('v1 should include version and deprecation headers')
                    .value({
                    version: minimal.headers.get('x-api-version'),
                    deprecated: minimal.headers.get('x-api-deprecated'),
                    sunset: minimal.headers.get('x-api-sunset'),
                })
                    .value({ version: 'v1', deprecated: 'true', sunset: '2026-12-31' })
                    .deepEqual;
                battery.test('minimal format should contain only basic fields')
                    .value(minimal.json)
                    .value({ id: 123, username: 'johndoe', email: 'john@example.com' })
                    .deepEqual;
                battery.test('profile format should wrap the user')
                    .value(profile.json?.user?.name).value('John Doe').equal;
            });
        });
        TestBattery.test('should serve current v2 response formats', async (battery) => {
            await withExample(examples.versioning, async (request) => {
                const standard = await request('/api/v2/user/123');
                const detailed = await request('/api/v2/user/123/full');
                battery.test('standard response should use v2 structure')
                    .value({
                    version: standard.headers.get('x-api-version'),
                    id: standard.json?.data?.id,
                    meta: standard.json?.meta?.version,
                })
                    .value({ version: 'v2', id: 123, meta: 'v2' }).deepEqual;
                battery.test('detailed response should include navigation links')
                    .value(detailed.json?.links)
                    .value({ self: '/api/v2/user/123/full', standard: '/api/v2/user/123' })
                    .deepEqual;
            });
        });
    }));
    suite('Performance Controls', doSuite('performance', () => {
        testCompilation(examples.performance);
        TestBattery.test('should cache products and expose rate-limit headers', async (battery) => {
            await withExample(examples.performance, async (request) => {
                const first = await request('/products');
                const second = await request('/products');
                battery.test('products should use the documented limit')
                    .value(first.headers.get('x-ratelimit-limit')).value('100').equal;
                battery.test('products should be normal priority')
                    .value(first.headers.get('x-request-priority')).value('normal').equal;
                battery.test('first request should be a cache miss')
                    .value(first.headers.get('x-cache')).value('MISS').equal;
                battery.test('second request should be a cache hit')
                    .value(second.headers.get('x-cache')).value('HIT').equal;
                battery.test('cached data should be unchanged')
                    .value(second.json).value(first.json).deepEqual;
            });
        });
        TestBattery.test('should apply order and search controls', async (battery) => {
            await withExample(examples.performance, async (request) => {
                const order = await request('/orders', jsonRequest('POST', { items: ['widget'] }));
                const search = await request('/search?q=filament');
                battery.test('orders should be high priority')
                    .value(order.headers.get('x-request-priority')).value('high').equal;
                battery.test('orders should accept request items')
                    .value({ status: order.status, items: order.json?.items })
                    .value({ status: 201, items: ['widget'] }).deepEqual;
                battery.test('search should echo the query')
                    .value(search.json?.query).value('filament').equal;
                battery.test('search should be cacheable')
                    .value(search.headers.get('x-cache')).value('MISS').equal;
            });
        });
        TestBattery.test('should enforce the analytics rate limit', async (battery) => {
            await withExample(examples.performance, async (request) => {
                let response;
                for (let requestNumber = 0; requestNumber < 6; requestNumber += 1) {
                    response = await request('/analytics/dashboard', {
                        headers: { 'X-Client-Id': 'analytics-test' },
                    });
                }
                battery.test('sixth request should return 429')
                    .value(response.status).value(429).equal;
                battery.test('rate-limit response should include Retry-After')
                    .value(response.headers.get('retry-after')).is.not.nil;
            });
        });
    }));
    suite('Observability', doSuite('observability', () => {
        testCompilation(examples.observability);
        TestBattery.test('should trace service requests', async (battery) => {
            await withExample(examples.observability, async (request) => {
                const user = await request('/users/42', {
                    headers: { Forwarded: 'for=203.0.113.42;proto=https' },
                });
                const userObservation = await request('/observations?limit=1');
                const analytics = await request('/analytics/events');
                const traces = await request('/traces?limit=1');
                battery.test('response should include the gathered request ID')
                    .value(/^\d{8}-\d{6}-\d{4}-[0-9a-z]{5}$/.test(user.headers.get('x-request-id') ?? '')).is.true;
                battery.test('exact 200 policy should prune user response details')
                    .value({
                    origin: userObservation.json?.observations?.[0]?.requestInfo?.origin,
                    body: userObservation.json?.observations?.[0]?.responseInfo?.body,
                    headers: userObservation.json?.observations?.[0]?.responseInfo?.headers,
                })
                    .value({
                    origin: '203.0.113.42',
                    body: undefined,
                    headers: undefined,
                }).deepEqual;
                battery.test('analytics endpoint should return events')
                    .value(analytics.json?.events?.[0]?.type).value('page_view').equal;
                battery.test('traces endpoint should honor limit')
                    .value(traces.json?.traces?.length).value(1).equal;
                battery.test('trace should contain named policy steps')
                    .value(traces.json?.traces?.[0]?.trace
                    ?.some((entry) => entry.name === 'listEvents')).is.true;
            });
        });
        TestBattery.test('should collect metrics and exclude health from tracing', async (battery) => {
            await withExample(examples.observability, async (request) => {
                await request('/users/42');
                const metrics = await request('/metrics');
                const health = await request('/health');
                battery.test('metrics endpoint should contain user-service data')
                    .value(Object.keys(metrics.json?.metrics || {})
                    .some(key => key.includes('user-service'))).is.true;
                battery.test('health should return healthy status')
                    .value(health.json?.status).value('healthy').equal;
                battery.test('health should not include trace headers')
                    .value(health.headers.get('x-request-id')).is.nil;
            });
        });
        TestBattery.test('should process payments without exposing sensitive data', async (battery) => {
            await withExample(examples.observability, async (request) => {
                const payment = await request('/payments', jsonRequest('POST', {
                    amount: 49.95,
                    cardNumber: '4111111111111111',
                    cvv: '123',
                }));
                const observations = await request('/observations?limit=1');
                battery.test('payment should succeed with the requested amount')
                    .value({ status: payment.json?.status, amount: payment.json?.amount })
                    .value({ status: 'success', amount: 49.95 }).deepEqual;
                battery.test('payment response should not expose card data')
                    .value(payment.text.includes('4111111111111111')).is.false;
                battery.test('successful payment observation should not retain bodies')
                    .value({
                    request: observations.json?.observations?.[0]?.requestInfo?.body,
                    response: observations.json?.observations?.[0]?.responseInfo?.body,
                })
                    .value({ request: undefined, response: undefined }).deepEqual;
            });
        });
        TestBattery.test('should let request context reduce observation', async (battery) => {
            await withExample(examples.observability, async (request) => {
                const retainedResponse = await request('/echo?message=visible&responseBody=true');
                const retainedObservation = await request('/observations?limit=1');
                const suppressedResponse = await request('/echo?message=private&responseBody=false');
                const suppressedObservation = await request('/observations?limit=1');
                battery.test('both echo requests should return their response bodies')
                    .value({
                    retained: retainedResponse.json?.echo,
                    suppressed: suppressedResponse.json?.echo,
                })
                    .value({ retained: 'visible', suppressed: 'private' }).deepEqual;
                battery.test('true should retain the observed response body')
                    .value(JSON.parse(retainedObservation.json?.observations?.[0]?.responseInfo?.body))
                    .value({ echo: 'visible', responseBody: true }).deepEqual;
                battery.test('false should suppress the observed response body')
                    .value(suppressedObservation.json?.observations?.[0]?.responseInfo?.body).is.nil;
            });
        });
    }));
    suite('Content Negotiation', doSuite('content-negotiation', () => {
        testCompilation(examples.content);
        TestBattery.test('should return JSON with metadata by default', async (battery) => {
            await withExample(examples.content, async (request) => {
                const books = await request('/books');
                const stats = await request('/stats');
                battery.test('books should default to JSON')
                    .value(books.headers.get('content-type')).value('application/json').equal;
                battery.test('books should include response metadata')
                    .value(books.json?.meta?.format).value('json').equal;
                battery.test('stats should remain JSON-only')
                    .value({ type: stats.headers.get('content-type'), total: stats.json?.data?.totalBooks })
                    .value({ type: 'application/json', total: 3 }).deepEqual;
            });
        });
        TestBattery.test('should negotiate XML, CSV, and HTML', async (battery) => {
            await withExample(examples.content, async (request) => {
                const xml = await request('/books?format=xml');
                const csv = await request('/books', { headers: { Accept: 'text/csv' } });
                const html = await request('/books?format=html');
                battery.test('format query should select XML')
                    .value({
                    type: xml.headers.get('content-type'),
                    document: xml.text.startsWith('<?xml'),
                })
                    .value({ type: 'application/xml', document: true }).deepEqual;
                battery.test('Accept header should select CSV')
                    .value({
                    type: csv.headers.get('content-type'),
                    heading: csv.text.split('\n')[0],
                })
                    .value({ type: 'text/csv', heading: 'id,title,author,year,genre' })
                    .deepEqual;
                battery.test('format query should select HTML')
                    .value({ type: html.headers.get('content-type'), table: html.text.includes('<table>') })
                    .value({ type: 'text/html', table: true }).deepEqual;
            });
        });
        TestBattery.test('should enforce endpoint format restrictions', async (battery) => {
            await withExample(examples.content, async (request) => {
                const book = await request('/books/1?format=csv');
                const missing = await request('/books/999?format=xml');
                battery.test('single books should fall back from CSV to JSON')
                    .value({ type: book.headers.get('content-type'), id: book.json?.data?.id })
                    .value({ type: 'application/json', id: 1 }).deepEqual;
                battery.test('route errors should use supported response formats')
                    .value({
                    status: missing.status,
                    type: missing.headers.get('content-type'),
                })
                    .value({ status: 404, type: 'application/xml' }).deepEqual;
            });
        });
    }));
    suite('OAuth 2.0 flows', doSuite('oauth', () => {
        for (const example of [
            examples.authorizationCodeServer,
            examples.authorizationCodeClient,
            examples.pkceServer,
            examples.pkceClient,
            examples.deviceServer,
            examples.deviceClient,
            examples.clientCredentialsServer,
            examples.clientCredentialsClient,
        ])
            testCompilation(example);
        TestBattery.test('authorization code client should fetch a protected profile', async (battery) => {
            await withExample(examples.authorizationCodeServer, async (_request, baseUrl) => {
                const result = await runExampleClient(examples.authorizationCodeClient, baseUrl);
                battery.test('client should complete the flow and do useful work')
                    .value({ flow: result.flow, poem: result.work?.favoritePoem })
                    .value({ flow: 'authorization_code', poem: 'Ozymandias' }).deepEqual;
            });
        });
        TestBattery.test('PKCE client should prove possession and update a reading list', async (battery) => {
            await withExample(examples.pkceServer, async (request, baseUrl) => {
                const unauthorized = await request('/api/reading-list', jsonRequest('POST', {
                    title: 'untrusted',
                }));
                const redirectUri = 'http://127.0.0.1/pkce/callback';
                const verifier = 'correct-verifier-that-is-long-enough-for-this-test-value';
                const challenge = createHash('sha256').update(verifier).digest('base64url');
                const authorization = await request(`/authorize?${new URLSearchParams({
                    response_type: 'code',
                    client_id: 'poetry-app',
                    redirect_uri: redirectUri,
                    state: 'pkce-test-state',
                    code_challenge: challenge,
                    code_challenge_method: 'S256',
                })}`, { redirect: 'manual' });
                const code = new URL(authorization.headers.get('location')).searchParams.get('code');
                const rejectedVerifier = await request('/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        grant_type: 'authorization_code',
                        code,
                        client_id: 'poetry-app',
                        redirect_uri: redirectUri,
                        code_verifier: 'wrong-verifier',
                    }),
                });
                const result = await runExampleClient(examples.pkceClient, baseUrl);
                battery.test('protected endpoint should reject a missing bearer token')
                    .value(unauthorized.status).value(401).equal;
                battery.test('token endpoint should reject the wrong PKCE verifier')
                    .value({ status: rejectedVerifier.status, error: rejectedVerifier.json?.error })
                    .value({ status: 400, error: 'invalid_grant' }).deepEqual;
                battery.test('public client should complete S256 PKCE and add a title')
                    .value({ flow: result.flow, title: result.work?.added })
                    .value({
                    flow: 'authorization_code_pkce',
                    title: 'The Complete Poems of Emily Dickinson',
                }).deepEqual;
            });
        });
        TestBattery.test('device client should obtain approval and save a note', async (battery) => {
            await withExample(examples.deviceServer, async (request, baseUrl) => {
                const authorization = await request('/device_authorization', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ client_id: 'television-poetry-app' }),
                });
                const pending = await request('/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
                        device_code: authorization.json?.device_code,
                        client_id: 'television-poetry-app',
                    }),
                });
                const result = await runExampleClient(examples.deviceClient, baseUrl);
                battery.test('token polling should remain pending before user approval')
                    .value({ status: pending.status, error: pending.json?.error })
                    .value({ status: 400, error: 'authorization_pending' }).deepEqual;
                battery.test('device flow should save work for the approved user')
                    .value({ flow: result.flow, saved: result.work?.saved, owner: result.work?.owner })
                    .value({ flow: 'device_authorization', saved: true, owner: 'device-user' })
                    .deepEqual;
            });
        });
        TestBattery.test('client credentials client should run machine-to-machine analysis', async (battery) => {
            await withExample(examples.clientCredentialsServer, async (_request, baseUrl) => {
                const result = await runExampleClient(examples.clientCredentialsClient, baseUrl);
                battery.test('service client should analyze text with its scoped token')
                    .value({ flow: result.flow, words: result.work?.words, by: result.work?.performedBy })
                    .value({ flow: 'client_credentials', words: 8, by: 'analysis-worker' })
                    .deepEqual;
            });
        });
    }));
    suite('Streaming response', doSuite('streaming', () => {
        testCompilation(examples.streaming);
        TestBattery.test('should deliver Ozymandias progressively in streaming mode', async (battery) => {
            await withExample(examples.streaming, async (_request, baseUrl) => {
                const startedAt = Date.now();
                const response = await fetch(`${baseUrl}/poem`);
                const reader = response.body.getReader();
                const first = await reader.read();
                const firstChunkAt = Date.now() - startedAt;
                const chunks = first.value ? [first.value] : [];
                while (true) {
                    const chunk = await reader.read();
                    if (chunk.done)
                        break;
                    chunks.push(chunk.value);
                }
                const text = Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString();
                battery.test('first line should arrive before the stream finishes')
                    .value(firstChunkAt < 100).is.true;
                battery.test('response should use chunked transfer without Content-Length')
                    .value({
                    transfer: response.headers.get('transfer-encoding'),
                    length: response.headers.get('content-length'),
                }).value({ transfer: 'chunked', length: null }).deepEqual;
                battery.test('stream should contain the complete fourteen-line sonnet')
                    .value({
                    lines: text.trim().split('\n').length,
                    opening: text.startsWith('I met a traveller from an antique land,'),
                    ending: text.trim().endsWith('The lone and level sands stretch far away.”'),
                }).value({ lines: 14, opening: true, ending: true }).deepEqual;
            }, ['--interval', '10']);
        });
    }));
});
process.once('beforeExit', async () => {
    const results = await Promise.all(compilations.values());
    await Promise.all(results.map(result => rm(result.directory, {
        recursive: true,
        force: true,
    })));
});
//# sourceMappingURL=examples.test.js.map