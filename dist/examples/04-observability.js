import { createApp } from '../src/index.js';
const app = createApp({
    trace: {
        enabled: true,
        sampleRate: 1.0,
        includeHeaders: false,
        includeBody: false,
    },
    metrics: {
        enabled: true,
        dimensions: ['endpoint', 'status'],
    },
    logging: {
        level: 'info',
        structured: true,
    },
    service: 'api-gateway',
});
const traces = [];
const metrics = new Map();
// Generate trace ID
function generateId() {
    return Math.random().toString(36).substring(2, 15);
}
// Tracing middleware
app.use(async (req, res, next) => {
    const { enabled, sampleRate, includeHeaders, includeBody } = req.endpointMeta.trace;
    if (!enabled || Math.random() > sampleRate) {
        await next();
        return;
    }
    // Extract or create trace ID
    const traceId = req.headers.get('x-trace-id') || generateId();
    const parentSpanId = req.headers.get('x-span-id');
    const spanId = generateId();
    // Attach to request
    req.traceId = traceId;
    req.spanId = spanId;
    // Add trace headers to response
    res.headers.set('X-Trace-Id', traceId);
    res.headers.set('X-Span-Id', spanId);
    const trace = {
        traceId,
        spanId,
        parentSpanId,
        service: req.endpointMeta.service,
        endpoint: req.path,
        startTime: Date.now(),
        status: 200,
        metadata: {
            method: req.method,
            ...(includeHeaders && { headers: req.headers }),
            ...(includeBody && { body: req.body }),
        },
    };
    // Store trace
    req.trace = trace;
    await next();
});
// Metrics middleware
app.use(async (req, res, next) => {
    if (!req.endpointMeta.metrics.enabled) {
        await next();
        return;
    }
    const startTime = Date.now();
    await next();
    const duration = Date.now() - startTime;
    const dimensions = req.endpointMeta.metrics.dimensions;
    // Record metrics based on dimensions
    const metricKey = dimensions
        .map(dim => {
        if (dim === 'endpoint')
            return req.path;
        if (dim === 'status')
            return res.statusCode.toString();
        if (dim === 'method')
            return req.method;
        if (dim === 'service')
            return req.endpointMeta.service;
        return dim;
    })
        .join(':');
    metrics.set(`${metricKey}:count`, (metrics.get(`${metricKey}:count`) || 0) + 1);
    metrics.set(`${metricKey}:duration`, (metrics.get(`${metricKey}:duration`) || 0) + duration);
});
// Structured logging middleware
app.use(async (req, res, next) => {
    const { level, structured, sensitiveFields } = req.endpointMeta.logging;
    if (level === 'debug' || level === 'info') {
        const logEntry = structured
            ? {
                timestamp: new Date().toISOString(),
                level: 'INFO',
                service: req.endpointMeta.service,
                traceId: req.traceId,
                spanId: req.spanId,
                method: req.method,
                path: req.path,
                event: 'request.start',
            }
            : `[${req.endpointMeta.service}] ${req.method} ${req.path}`;
        process.env.IS_TEST ||
            console.log(structured ? JSON.stringify(logEntry) : logEntry);
    }
    await next();
});
// Service endpoints
// User service endpoint
app.get('/users/:id', {
    trace: { enabled: true, sampleRate: 1.0, includeHeaders: false, includeBody: false },
    metrics: { enabled: true, dimensions: ['service', 'endpoint', 'status'] },
    logging: { level: 'info', structured: true },
    service: 'user-service',
}, async (req, res) => {
    // Simulate external service call
    await new Promise(resolve => setTimeout(resolve, 50));
    res.json({
        id: req.params.id,
        name: 'John Doe',
        email: 'john@example.com',
    });
});
// Payment service endpoint (sensitive data)
app.post('/payments', {
    trace: { enabled: true, sampleRate: 0.1, includeHeaders: false, includeBody: false },
    metrics: { enabled: true, dimensions: ['service', 'status'] },
    logging: { level: 'warn', structured: true, sensitiveFields: ['cardNumber', 'cvv'] },
    service: 'payment-service',
}, async (req, res) => {
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 200));
    const bodyObj = JSON.parse(req.body?.toString() || '');
    res.json({
        transactionId: generateId(),
        status: 'success',
        amount: bodyObj.amount,
    });
});
// Analytics service endpoint (debug logging)
app.get('/analytics/events', {
    trace: { enabled: true, sampleRate: 1.0, includeHeaders: true, includeBody: true },
    metrics: { enabled: true, dimensions: ['service', 'endpoint'] },
    logging: { level: 'debug', structured: true },
    service: 'analytics-service',
}, async (req, res) => {
    await new Promise(resolve => setTimeout(resolve, 100));
    res.json({
        events: [
            { type: 'page_view', count: 1234 },
            { type: 'button_click', count: 567 },
        ],
    });
});
// Health check (minimal tracing)
app.get('/health', {
    trace: { enabled: false, sampleRate: 0, includeHeaders: false, includeBody: false },
    metrics: { enabled: false, dimensions: [] },
    logging: { level: 'error', structured: false },
    service: 'api-gateway',
}, async (req, res) => {
    res.json({ status: 'healthy', timestamp: Date.now() });
});
// Internal metrics endpoint
app.get('/metrics', {
    trace: { enabled: false, sampleRate: 0, includeHeaders: false, includeBody: false },
    metrics: { enabled: false, dimensions: [] },
    logging: { level: 'info', structured: false },
    service: 'api-gateway',
}, async (req, res) => {
    const metricsData = {};
    metrics.forEach((value, key) => {
        metricsData[key] = value;
    });
    res.json({ metrics: metricsData });
});
// Internal traces endpoint
app.get('/traces', {
    trace: { enabled: false, sampleRate: 0, includeHeaders: false, includeBody: false },
    metrics: { enabled: false, dimensions: [] },
    logging: { level: 'info', structured: false },
    service: 'api-gateway',
}, async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    res.json({ traces: traces.slice(-limit) });
});
// Finalize traces
app.onFinalize(async (req, res) => {
    const trace = req.trace;
    if (trace) {
        trace.duration = Date.now() - trace.startTime;
        trace.status = res.statusCode;
        traces.push(trace);
        // Keep only last 1000 traces
        if (traces.length > 1000) {
            traces.shift();
        }
    }
    // Structured logging for completion
    const { structured, level } = req.endpointMeta.logging;
    if (level === 'debug' || level === 'info') {
        const duration = Date.now() - (req._startTime || Date.now());
        const logEntry = structured
            ? {
                timestamp: new Date().toISOString(),
                level: 'INFO',
                service: req.endpointMeta.service,
                traceId: req.traceId,
                spanId: req.spanId,
                method: req.method,
                path: req.path,
                status: res.statusCode,
                duration,
                event: 'request.complete',
            }
            : `[${req.endpointMeta.service}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`;
        process.env.IS_TEST ||
            console.log(structured ? JSON.stringify(logEntry) : logEntry);
    }
});
const PORT = 3004;
app.listen(PORT).then(() => {
    if (!(process.env.IS_TEST)) {
        console.log(`\n🔍 Observability example running on http://localhost:${PORT}`);
        console.log('\nService Endpoints:');
        console.log('  GET  /users/:id          - User service (full tracing)');
        console.log('  POST /payments           - Payment service (10% sample rate, sensitive)');
        console.log('  GET  /analytics/events   - Analytics service (debug logging)');
        console.log('  GET  /health             - Health check (no tracing)');
        console.log('\nObservability Endpoints:');
        console.log('  GET  /metrics            - View collected metrics');
        console.log('  GET  /traces?limit=10    - View recent traces');
        console.log('\nMake some requests and then check /metrics and /traces!\n');
    }
});
//# sourceMappingURL=04-observability.js.map