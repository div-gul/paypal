import { Router, Request, Response } from 'express';
import { config } from '../config.js';

export const configRouter = Router();

/**
 * GET /api/config/public
 * Exposes safe public configuration needed by frontend client.
 * Strictly returns only safe non-sensitive configuration:
 * { paypalClientId, paypalMode, currency: "USD", usdRate }
 * NEVER exposes client secrets, webhook keys, or private tokens.
 */
configRouter.get('/config/public', (_req: Request, res: Response) => {
  res.json({
    paypalClientId: config.PAYPAL_CLIENT_ID || '',
    paypalMode: config.PAYPAL_MODE,
    currency: 'USD',
    usdRate: config.PAYPAL_USD_RATE,
  });
});
