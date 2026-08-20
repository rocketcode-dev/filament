import { createApp, HttpError } from '../src/index.js';
import { parseArgs } from 'node:util';
const { port: portOption, silent = false } = parseArgs({
    options: { port: { type: 'string' }, silent: { type: 'boolean' } },
}).values;
const port = Number(portOption ?? 0);
const app = createApp({
    application: { maxRequestSize: '2MiB' },
    requiresAuth: false,
    rateLimit: 100,
});
// Mock user database
const users = new Map([
    ['token-admin', { id: 1, role: 'admin' }],
    ['token-editor', { id: 2, role: 'editor' }],
    ['token-viewer', { id: 3, role: 'viewer' }],
]);
// Mock posts database
const posts = new Map([
    [1, { id: 1, title: 'Getting Started with Filament', content: 'Learn the basics...', authorId: 1 }],
    [2, { id: 2, title: 'Advanced Metadata Patterns', content: 'Deep dive...', authorId: 2 }],
]);
// Authentication middleware
app.use(async (req, res) => {
    if (req.endpointMeta.requiresAuth) {
        let token = req.headers.get('authorization');
        if (Array.isArray(token)) {
            token = token[0];
        }
        if (!token) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const user = users.get(token);
        if (!user) {
            res.status(401).json({ error: 'Invalid token' });
            return;
        }
        // Attach user to request (in real app, extend Request type)
        req.user = user;
    }
});
// Role-based authorization middleware
app.use(async (req, res) => {
    const requiredRole = req.endpointMeta.role;
    if (requiredRole) {
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const roleHierarchy = { viewer: 1, editor: 2, admin: 3 };
        if (roleHierarchy[user.role] < roleHierarchy[requiredRole]) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
    }
});
// Public endpoints
app.get('/posts', {}, async (req, res) => {
    const postList = Array.from(posts.values());
    res.json({ posts: postList });
});
app.get('/posts/:id', {}, async (req, res) => {
    const post = posts.get(parseInt(req.params.id));
    if (!post) {
        res.status(404).json({ error: 'Post not found' });
        return;
    }
    res.json({ post });
});
// Editor endpoints
app.post('/posts', { requiresAuth: true, role: 'editor', rateLimit: 10 }, async (req, res) => {
    const { title, content } = JSON.parse(req.body?.toString() || '{}');
    const user = req.user;
    const newPost = {
        id: posts.size + 1,
        title,
        content,
        authorId: user.id,
    };
    posts.set(newPost.id, newPost);
    res.status(201).json({ post: newPost });
});
app.patch('/posts/:id', { requiresAuth: true, role: 'editor' }, async (req, res) => {
    const postId = parseInt(req.params.id);
    const post = posts.get(postId);
    if (!post) {
        res.status(404).json({ error: 'Post not found' });
        return;
    }
    const user = req.user;
    // Editors can only edit their own posts
    if (user.role === 'editor' && post.authorId !== user.id) {
        res.status(403).json({ error: 'Can only edit your own posts' });
        return;
    }
    const { title, content } = JSON.parse(req.body?.toString() || '{}');
    const updated = { ...post, title, content };
    posts.set(postId, updated);
    res.json({ post: updated });
});
// Admin endpoints
app.delete('/posts/:id', { requiresAuth: true, role: 'admin' }, async (req, res) => {
    const postId = parseInt(req.params.id);
    if (!posts.has(postId)) {
        res.status(404).json({ error: 'Post not found' });
        return;
    }
    posts.delete(postId);
    res.status(204).end();
});
// Error handling
app.onError(async (err, req, res) => {
    if (err instanceof HttpError) {
        return;
    }
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});
// Request logging
if (!silent) {
    app.onFinalize(async (req, res) => {
        const user = req.user;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} ${user ? `(user: ${user.id})` : '(anonymous)'}`);
    });
}
app.listen(port).then(port => {
    if (!silent) {
        console.log(`\n📝 Blog API running on http://localhost:${port}`);
        console.log('\nEndpoints:');
        console.log('  GET    /posts          - List all posts (public)');
        console.log('  GET    /posts/:id      - Get post by ID (public)');
        console.log('  POST   /posts          - Create post (editor+)');
        console.log('  PATCH  /posts/:id      - Update post (editor+, own posts only)');
        console.log('  DELETE /posts/:id      - Delete post (admin only)');
        console.log('\nAuth tokens:');
        console.log('  token-admin   - Admin user');
        console.log('  token-editor  - Editor user');
        console.log('  token-viewer  - Viewer user\n');
    }
});
//# sourceMappingURL=01-blog-api.js.map