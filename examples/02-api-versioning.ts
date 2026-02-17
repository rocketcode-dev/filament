import { createApp, FrameworkMeta } from '../src/index';

/**
 * Example 2: API Versioning
 * Demonstrates handling multiple API versions with metadata
 */

interface ApiMeta extends FrameworkMeta {
  apiVersion: 'v1' | 'v2';
  deprecated?: boolean;
  responseFormat: 'minimal' | 'standard' | 'detailed';
}

const app = createApp<ApiMeta>({
  apiVersion: 'v2',
  responseFormat: 'standard',
});

// Deprecation warning middleware
app.use(async (req, res, next) => {
  if (req.endpointMeta.deprecated) {
    res.setHeader('X-API-Deprecated', 'true');
    res.setHeader('X-API-Sunset', '2026-12-31');
  }
  await next();
});

// Version header middleware
app.use(async (req, res, next) => {
  res.setHeader('X-API-Version', req.endpointMeta.apiVersion);
  await next();
});

// Mock data
const userData = {
  id: 123,
  username: 'johndoe',
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe',
  createdAt: '2024-01-15T10:30:00Z',
  lastLogin: '2026-02-17T08:15:00Z',
  preferences: {
    theme: 'dark',
    notifications: true,
  },
  stats: {
    postsCount: 42,
    followersCount: 1337,
    followingCount: 256,
  },
};

// V1 endpoints (deprecated)
app.get('/api/v1/user/:id',
  { apiVersion: 'v1', deprecated: true, responseFormat: 'minimal' },
  async (req, res) => {
    // V1 returns minimal data
    res.json({
      id: userData.id,
      username: userData.username,
      email: userData.email,
    });
  }
);

app.get('/api/v1/user/:id/profile',
  { apiVersion: 'v1', deprecated: true, responseFormat: 'standard' },
  async (req, res) => {
    // V1 profile format
    res.json({
      user: {
        id: userData.id,
        username: userData.username,
        name: `${userData.firstName} ${userData.lastName}`,
        email: userData.email,
      },
    });
  }
);

// V2 endpoints (current)
app.get('/api/v2/user/:id',
  { apiVersion: 'v2', responseFormat: 'standard' },
  async (req, res) => {
    // V2 returns more structured data
    res.json({
      data: {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        profile: {
          firstName: userData.firstName,
          lastName: userData.lastName,
        },
        metadata: {
          createdAt: userData.createdAt,
          lastLogin: userData.lastLogin,
        },
      },
      meta: {
        version: 'v2',
        timestamp: new Date().toISOString(),
      },
    });
  }
);

app.get('/api/v2/user/:id/full',
  { apiVersion: 'v2', responseFormat: 'detailed' },
  async (req, res) => {
    // V2 detailed format with all data
    res.json({
      data: userData,
      meta: {
        version: 'v2',
        format: 'detailed',
        timestamp: new Date().toISOString(),
      },
      links: {
        self: `/api/v2/user/${userData.id}/full`,
        standard: `/api/v2/user/${userData.id}`,
      },
    });
  }
);

// Response transformer based on format
app.onTransform(async (req, res) => {
  const format = req.endpointMeta.responseFormat;
  
  // Add HATEOAS links for detailed format
  if (format === 'detailed') {
    res.setHeader('Link', '</api/v2/docs>; rel="documentation"');
  }
  
  // Add caching headers based on format
  if (format === 'minimal') {
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
  } else if (format === 'standard') {
    res.setHeader('Cache-Control', 'public, max-age=60'); // 1 minute
  } else {
    res.setHeader('Cache-Control', 'no-cache'); // No cache for detailed
  }
});

// Log deprecated endpoint usage
app.onFinalize(async (req, res) => {
  if (req.endpointMeta.deprecated) {
    console.warn(`⚠️  Deprecated endpoint used: ${req.method} ${req.path}`);
  }
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`\n🔄 API Versioning example running on http://localhost:${PORT}`);
  console.log('\nV1 Endpoints (deprecated):');
  console.log('  GET /api/v1/user/:id          - Minimal user data');
  console.log('  GET /api/v1/user/:id/profile  - Standard user profile');
  console.log('\nV2 Endpoints (current):');
  console.log('  GET /api/v2/user/:id          - Standard user data');
  console.log('  GET /api/v2/user/:id/full     - Detailed user data');
  console.log('\nTry:');
  console.log('  curl http://localhost:3002/api/v1/user/123');
  console.log('  curl http://localhost:3002/api/v2/user/123');
  console.log('  curl http://localhost:3002/api/v2/user/123/full\n');
});
