import { createApp } from './index.js';
// Create default metadata (must fully implement AppMeta)
const defaultMeta = {
    requiresAuth: false,
    rateLimit: 100,
    logLevel: 'info',
    tags: [],
};
// Create application with typed metadata
const app = createApp(defaultMeta);
// Authentication middleware - inspects endpointMeta
app.use(async (req, res, next) => {
    if (req.endpointMeta.requiresAuth) {
        const token = req.headers.authorization;
        if (!token) {
            res.status(401).json({ error: 'Unauthorized - No token provided' });
            return;
        }
        // In real app, validate token here
        console.log(`[Auth] Validating token for ${req.path}`);
    }
    await next();
});
// Rate limiting middleware - uses rateLimit from meta
app.use(async (req, res, next) => {
    const limit = req.endpointMeta.rateLimit;
    console.log(`[RateLimit] Endpoint ${req.path} has limit: ${limit} req/min`);
    // In real app, implement actual rate limiting here
    await next();
});
// Logging middleware - uses logLevel from meta
app.use(async (req, res, next) => {
    const level = req.endpointMeta.logLevel;
    if (level === 'debug' || level === 'info') {
        console.log(`[${level.toUpperCase()}] ${req.method} ${req.path}`);
    }
    await next();
});
// Public endpoint - uses default meta
app.get('/public', {}, async (req, res) => {
    res.json({
        message: 'This is a public endpoint',
        meta: req.endpointMeta,
    });
});
// Protected endpoint - overrides requiresAuth
app.get('/admin', { requiresAuth: true, logLevel: 'debug', tags: ['admin', 'sensitive'] }, async (req, res) => {
    res.json({
        message: 'Admin panel',
        meta: req.endpointMeta,
    });
});
// API endpoint with custom rate limit
app.post('/api/data', { rateLimit: 10, tags: ['api', 'data'] }, async (req, res) => {
    res.json({
        message: 'Data received',
        data: req.body,
        meta: req.endpointMeta,
    });
});
// User detail endpoint with path parameter
app.get('/users/:id', { logLevel: 'debug' }, async (req, res) => {
    const userId = req.params.id;
    res.json({
        message: `User details for ID: ${userId}`,
        userId,
        meta: req.endpointMeta,
    });
});
// Response transformer - adds headers based on tags
app.onTransform(async (req, res) => {
    if (req.endpointMeta.tags.includes('api')) {
        res.setHeader('X-API-Version', '1.0');
    }
    if (req.endpointMeta.tags.includes('sensitive')) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
    }
});
// Error handler
app.onError(async (err, req, res) => {
    const level = req.endpointMeta.logLevel;
    if (level === 'debug' || level === 'error') {
        console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
    }
    res.status(500).json({
        error: err.message,
        path: req.path,
    });
});
// Finalizer - always runs
app.onFinalize(async (req, res) => {
    const duration = Date.now() - (req._startTime || Date.now());
    const level = req.endpointMeta.logLevel;
    if (level === 'debug' || level === 'info') {
        console.log(`[Finalizer] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    }
});
// Start server
const PORT = 3000;
app.listen(PORT).then(port => {
    console.log(`\n🔥 Filament server running on http://localhost:${port}\n`);
    console.log('Try these endpoints:');
    console.log(`  GET  http://localhost:${port}/public`);
    console.log(`  GET  http://localhost:${port}/admin (requires auth)`);
    console.log(`  POST http://localhost:${port}/api/data`);
    console.log(`  GET  http://localhost:${port}/users/123`);
    console.log('');
});
//# sourceMappingURL=example.js.map