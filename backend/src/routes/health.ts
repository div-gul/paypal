import { Router, Request, Response } from 'express';
import { config } from '../config.js';

export const healthRouter = Router();

healthRouter.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    service: 'ShopPilot AI Backend',
    mode: {
      paypal: config.PAYPAL_MODE,
    },
    user: req.user ? { id: req.user.id } : null,
  });
});
