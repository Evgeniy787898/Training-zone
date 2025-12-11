import { Router, Request, Response } from 'express';
import { serviceRegistry } from '../services/serviceRegistry';

const router = Router();

// Simple internal auth middleware
const requireInternalAuth = (req: Request, res: Response, next: Function) => {
    // In production, this should be a robust shared secret check
    // For now, we assume this endpoint is only accessible within the private network or via localhost
    // We can also check a header like x-internal-secret
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET || 'dev-secret';
    const requestSecret = req.headers['x-internal-secret'];

    if (process.env.NODE_ENV !== 'production' || requestSecret === internalSecret) {
        return next();
    }

    return res.status(403).json({ error: 'Unauthorized internal access' });
};

/**
 * Register a service
 * POST /api/internal/discovery/register
 * Body: { name, url, version }
 */
router.post('/register', requireInternalAuth, async (req: Request, res: Response) => {
    try {
        const { name, url, version } = req.body;

        if (!name || !url) {
            return res.status(400).json({ error: 'Missing name or url' });
        }

        await serviceRegistry.register(name, url, version || '1.0.0');
        return res.json({ success: true, message: `Registered ${name}` });
    } catch (error) {
        console.error('[Discovery] Registration error:', error);
        return res.status(500).json({ error: 'Registration failed' });
    }
});

/**
 * Get service status
 * GET /api/internal/discovery/status/:name
 */
router.get('/status/:name', requireInternalAuth, async (req: Request, res: Response) => {
    try {
        const { name } = req.params;
        const url = await serviceRegistry.getServiceUrl(name);

        if (!url) {
            return res.status(404).json({ status: 'offline' });
        }

        return res.json({ status: 'online', url });
    } catch (error) {
        return res.status(500).json({ error: 'Status check failed' });
    }
});

export default router;
