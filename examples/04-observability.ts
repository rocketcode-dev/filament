import {
  ContextMeta,
  createApp,
  FrameworkMeta,
  NegativeObservabilityForStatus,
  ObservedInfo,
} from '../src/index.js';
import { parseArgs } from 'node:util';

const { port: portOption, silent = false } = parseArgs({
  options: { port: { type: 'string' }, silent: { type: 'boolean' } },
}).values;
const port = Number(portOption ?? 0);

/**
 * Example 4: Gathering observability data
 *
 * Filament gathers request facts and policy timings. It deliberately does not
 * decide where they go: this example's finalizer keeps a small in-memory list
 * which the diagnostic endpoints summarize.
 */

interface ObservabilityMeta extends FrameworkMeta {
  service: string;
}

interface ObservabilityContext extends ContextMeta {}

const app = createApp<ObservabilityMeta, ObservabilityContext>(
  {
    application: {
      maxRequestSize: '2MiB',
      observability: {
        enabled: true,
        // IDs, timing, origin, method, path, search, status, and policy trace
        // use their defaults. Failures may retain response details, while the
        // exact 200 policy explicitly removes them.
        success: { responseHeaders: true },
        failure: {
          statusText: true,
          responseHeaders: true,
          responseBody: true,
        },
        200: { responseBody: false, responseHeaders: false },
      },
    },
    service: 'api-gateway',
  },
  {},
);

const observations: Array<ObservedInfo & { service: string }> = [];
const metrics = new Map<string, number>();

function copyObservation(observed: ObservedInfo): ObservedInfo {
  return JSON.parse(JSON.stringify(observed)) as ObservedInfo;
}

// This is application behavior, not reporting built into Filament. It makes
// the framework-generated ID available to callers for log correlation.
app.use(async function publishCorrelationId(req, res) {
  if (!req.endpointMeta.application.observability?.enabled) return;
  const requestId = req.context.application?.observed?.requestId;
  if (requestId) res.headers.set('X-Request-Id', requestId);
});

app.get('/users/:id', { service: 'user-service' }, async function getUser(req, res) {
  await new Promise(resolve => setTimeout(resolve, 20));
  await res.json({
    id: req.params.id,
    name: 'John Doe',
    email: 'john@example.com',
  });
});

app.post('/payments', {
  application: {
    maxRequestSize: '2MiB',
    observability: {
      enabled: true,
      // A successful payment deliberately retains neither request nor response
      // bodies. Failure responses remain available through the application
      // default, illustrating outcome-dependent collection.
      success: {
        requestBody: false,
        responseHeaders: false,
        responseBody: false,
      },
    },
  },
  service: 'payment-service',
}, async function createPayment(req, res) {
  const body = JSON.parse(req.body?.toString() || '{}') as { amount?: number };
  await res.status(201).json({
    transactionId: Math.random().toString(36).slice(2, 15),
    status: 'success',
    amount: body.amount,
  });
});

app.get('/analytics/events', {
  application: {
    maxRequestSize: '2MiB',
    observability: {
      enabled: true,
      success: { requestHeaders: true },
    },
  },
  service: 'analytics-service',
}, async function listEvents(_req, res) {
  await res.json({
    events: [
      { type: 'page_view', count: 1234 },
      { type: 'button_click', count: 567 },
    ],
  });
});

// The endpoint policy permits retaining a successful response body. The
// request-local context can only reduce that policy, so every value other than
// `responseBody=true` suppresses the body before finalizers consume it.
app.get('/echo', {
  application: {
    maxRequestSize: '2MiB',
    observability: {
      enabled: true,
      200: { responseBody: true },
    },
  },
  service: 'echo-service',
}, async function echo(req, res) {
  const retainResponseBody = req.query.responseBody === 'true';
  const retainTrace = req.query.trace === 'true';
  if (!retainResponseBody || !retainTrace) {
    const suppression: NegativeObservabilityForStatus = {};
    if (!retainResponseBody) suppression.responseBody = false;
    if (!retainTrace) suppression.trace = false;
    req.context.application ??= {};
    req.context.application.observability = {
      200: suppression,
    };
  }

  await res.json({
    echo: req.query.message ?? 'Hello from Filament',
    responseBody: retainResponseBody,
  });
});

const diagnosticMeta = {
  application: {
    maxRequestSize: '2MiB',
    observability: { enabled: false },
  },
  service: 'api-gateway',
};

app.get('/health', diagnosticMeta, async function health(_req, res) {
  await res.json({ status: 'healthy', timestamp: Date.now() });
});

app.get('/metrics', diagnosticMeta, async function listMetrics(_req, res) {
  await res.json({ metrics: Object.fromEntries(metrics) });
});

app.get('/traces', diagnosticMeta, async function listTraces(req, res) {
  const limit = Number(req.query.limit) || 10;
  await res.json({
    traces: observations.slice(-limit).map(({ requestId, service, trace }) => ({
      requestId,
      service,
      trace,
    })),
  });
});

app.get('/observations', diagnosticMeta, async function listObservations(req, res) {
  const limit = Number(req.query.limit) || 10;
  await res.json({ observations: observations.slice(-limit) });
});

app.onFinalize(function retainObservation(req, res) {
  const observed = req.context.application?.observed;
  // Disabled endpoints still receive their requestId and startTime, but have no
  // gathered details to retain.
  if (!observed?.requestInfo && !observed?.responseInfo && !observed?.trace) {
    return;
  }

  observations.push({
    ...copyObservation(observed),
    service: req.endpointMeta.service,
  });
  if (observations.length > 1000) observations.shift();

  const key = `${req.endpointMeta.service}:${res.statusCode}`;
  metrics.set(key, (metrics.get(key) ?? 0) + 1);

  if (!silent) console.log(JSON.stringify(observed));
});

app.listen(port).then(actualPort => {
  if (!silent) {
    console.log(`\n🔍 Observability example running on http://localhost:${actualPort}`);
    console.log('\nService Endpoints:');
    console.log('  GET  /users/:id          - User trace without response details');
    console.log('  POST /payments           - Payment service without retained bodies');
    console.log('  GET  /analytics/events   - Analytics service with request headers');
    console.log('  GET  /echo               - Request-local response-body collection');
    console.log('  GET  /health             - Health check without observation');
    console.log('\nObservability Endpoints:');
    console.log('  GET  /metrics                  - View finalizer-derived counters');
    console.log('  GET  /traces?limit=10          - View recent policy traces');
    console.log('  GET  /observations?limit=10    - View gathered observations');
    console.log('\nTry:');
    console.log(`  curl -i http://localhost:${actualPort}/users/42`);
    console.log(`  curl http://localhost:${actualPort}/analytics/events`);
    console.log(`  curl "http://localhost:${actualPort}/echo?message=hello&responseBody=true"`);
    console.log(`  curl "http://localhost:${actualPort}/echo?message=secret&responseBody=false"`);
    console.log(`  curl http://localhost:${actualPort}/observations?limit=5\n`);
  }
});
