import { createApp, FrameworkMeta } from '../src/index';

/**
 * Example 3: Advanced Rate Limiting and Caching
 * Demonstrates sophisticated metadata-driven performance controls
 */

interface PerformanceMeta extends FrameworkMeta {
  rateLimit: {
    requests: number;
    window: number; // seconds
    strategy: 'fixed' | 'sliding';
  };
  cache: {
    enabled: boolean;
    ttl: number; // seconds
    key?: string;
  };
  priority: 'low' | 'normal' | 'high';
}

const app = createApp<PerformanceMeta>({
  rateLimit: {
    requests: 60,
    window: 60,
    strategy: 'fixed',
  },
  cache: {
    enabled: false,
    ttl: 0,
  },
  priority: 'normal',
});

// Simple in-memory rate limiter
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Simple in-memory cache
const cacheStore = new Map<string, { data: any; expiresAt: number }>();

// Rate limiting middleware
app.use(async (req, res, next) => {
  const { requests, window, strategy } = req.endpointMeta.rateLimit;
  
  // Use IP or a header as identifier (simplified)
  const identifier = req.headers['x-client-id']?.toString() || 'anonymous';
  const key = `${identifier}:${req.path}`;
  
  const now = Date.now();
  const windowMs = window * 1000;
  
  let bucket = rateLimitStore.get(key);
  
  if (!bucket || now >= bucket.resetAt) {
    // New window
    bucket = {
      count: 0,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(key, bucket);
  }
  
  bucket.count++;
  
  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', requests.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, requests - bucket.count).toString());
  res.setHeader('X-RateLimit-Reset', Math.floor(bucket.resetAt / 1000).toString());
  
  if (bucket.count > requests) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader('Retry-After', retryAfter.toString());
    res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter,
    });
    return;
  }
  
  await next();
});

// Cache middleware (check before handler)
app.use(async (req, res, next) => {
  if (!req.endpointMeta.cache.enabled) {
    await next();
    return;
  }
  
  const cacheKey = req.endpointMeta.cache.key || `${req.method}:${req.path}`;
  const cached = cacheStore.get(cacheKey);
  
  if (cached && Date.now() < cached.expiresAt) {
    res.setHeader('X-Cache', 'HIT');
    res.json(cached.data);
    return;
  }
  
  res.setHeader('X-Cache', 'MISS');
  await next();
});

// Priority queue middleware
app.use(async (req, res, next) => {
  const priority = req.endpointMeta.priority;
  
  // Add priority header
  res.setHeader('X-Request-Priority', priority);
  
  // In real implementation, this would queue low-priority requests
  if (priority === 'low') {
    // Simulate slight delay for low priority
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  await next();
});

// Endpoints with different performance characteristics

// High-frequency, cacheable endpoint
app.get('/products',
  {
    rateLimit: { requests: 100, window: 60, strategy: 'fixed' },
    cache: { enabled: true, ttl: 300, key: 'products:all' },
    priority: 'normal',
  },
  async (req, res) => {
    const products = [
      { id: 1, name: 'Widget', price: 9.99 },
      { id: 2, name: 'Gadget', price: 19.99 },
      { id: 3, name: 'Doohickey', price: 29.99 },
    ];
    
    res.json({ products, timestamp: Date.now() });
  }
);

// Critical endpoint with high priority
app.post('/orders',
  {
    rateLimit: { requests: 10, window: 60, strategy: 'sliding' },
    cache: { enabled: false, ttl: 0 },
    priority: 'high',
  },
  async (req, res) => {
    const order = req.body as any;
    
    res.status(201).json({
      orderId: Math.random().toString(36).substr(2, 9),
      status: 'processing',
      items: order.items,
    });
  }
);

// Analytics endpoint with strict rate limits
app.get('/analytics/dashboard',
  {
    rateLimit: { requests: 5, window: 60, strategy: 'fixed' },
    cache: { enabled: true, ttl: 60 },
    priority: 'low',
  },
  async (req, res) => {
    // Simulate expensive computation
    await new Promise(resolve => setTimeout(resolve, 500));
    
    res.json({
      metrics: {
        views: 12543,
        uniqueVisitors: 3421,
        conversionRate: 2.3,
      },
      generatedAt: new Date().toISOString(),
    });
  }
);

// Search endpoint with custom cache key
app.get('/search',
  {
    rateLimit: { requests: 30, window: 60, strategy: 'sliding' },
    cache: { enabled: true, ttl: 120 },
    priority: 'normal',
  },
  async (req, res) => {
    const query = req.query.q as string;
    
    res.json({
      query,
      results: [
        { id: 1, title: 'Result 1', relevance: 0.95 },
        { id: 2, title: 'Result 2', relevance: 0.87 },
      ],
    });
  }
);

// Cache responses on transform
app.onTransform(async (req, res) => {
  const { enabled, ttl, key } = req.endpointMeta.cache;
  
  if (enabled && res.body) {
    const cacheKey = key || `${req.method}:${req.path}`;
    
    try {
      const data = JSON.parse(res.body as string);
      cacheStore.set(cacheKey, {
        data,
        expiresAt: Date.now() + (ttl * 1000),
      });
    } catch (e) {
      // Skip caching if body isn't JSON
    }
  }
});

// Performance logging
app.onFinalize(async (req, res) => {
  const duration = Date.now() - (req._startTime || Date.now());
  const priority = req.endpointMeta.priority;
  const cached = res.headers['X-Cache'] === 'HIT';
  
  console.log(
    `[${priority.toUpperCase()}] ${req.method} ${req.path} - ` +
    `${res.statusCode} - ${duration}ms ${cached ? '(cached)' : ''}`
  );
});

const PORT = 3003;
app.listen(PORT, () => {
  console.log(`\n⚡ Performance controls example running on http://localhost:${PORT}`);
  console.log('\nEndpoints:');
  console.log('  GET  /products              - High rate limit, cached (5min)');
  console.log('  POST /orders                - Low rate limit, high priority');
  console.log('  GET  /analytics/dashboard   - Very low rate limit, cached (1min), low priority');
  console.log('  GET  /search?q=term         - Medium rate limit, cached (2min)');
  console.log('\nTry making multiple requests to see rate limiting in action!');
  console.log('Add header: X-Client-Id: your-id to track limits per client\n');
});
