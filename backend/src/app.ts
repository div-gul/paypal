import express, { Express } from 'express';
import cors from 'cors';
import { requestLogger } from './middleware/logging.js';
import { injectTestUser, requireAuthentication, resolveSessionIfPresent } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { stateRouter } from './routes/state.js';
import { pantryRouter } from './routes/pantry.js';
import { policyRouter } from './routes/policy.js';
import { timeRouter } from './routes/time.js';
import { quotesRouter } from './routes/quotes.js';
import { runsRouter } from './routes/runs.js';
import { auditRouter } from './routes/audit.js';
import { checkoutRouter } from './routes/checkout.js';
import { webhookRouter } from './routes/webhooks.js';
import { createAiRouter } from './routes/ai.js';
import { authRouter } from './routes/auth.js';
import { workspaceRouter } from './routes/workspace.js';
import { config } from './config.js';
import { rateLimit, unauthenticatedApiRateLimit } from './middleware/rateLimit.js';

export function createApp(options: { testAuth?: boolean } = {}): Express {
  const app = express();
  const testAuth = options.testAuth === true;
  if (testAuth && process.env.NODE_ENV === 'production') throw new Error('Test authentication cannot be enabled in production.');
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "script-src 'self' https://www.paypal.com https://www.sandbox.paypal.com",
      "style-src 'self' 'unsafe-inline' https://www.paypal.com https://www.paypalobjects.com",
      "connect-src 'self' https://api-m.sandbox.paypal.com https://api-m.paypal.com https://www.paypal.com https://www.paypalobjects.com",
      "frame-src https://www.paypal.com https://www.sandbox.paypal.com https://*.paypal.com",
      "img-src 'self' data: https://*.paypalobjects.com",
      "font-src 'self' data:",
    ].join('; '));
    if (config.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
    next();
  });

  // Basic middleware with raw-body preservation for webhooks
  const publicOrigin = config.PUBLIC_APP_URL || new URL(config.APP_BASE_URL).origin;
  app.use(cors({ origin: publicOrigin, credentials: true }));
  app.use(
    express.json({
      limit: '100kb',
      verify: (req, _res, buf) => {
        (req as any).rawBody = buf;
      },
    })
  );
  app.use(requestLogger);
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && origin && origin !== publicOrigin) {
      res.status(403).json({ error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Request origin is not allowed.' } });
      return;
    }
    next();
  });

  // Tests use a deterministic fixture identity. Runtime requests must use
  // the persistent, HTTP-only cookie session.
  app.use('/api/auth', authRouter);

  // Mount API routers
  app.use('/api', healthRouter);
  // PayPal's signed webhook is an external callback and has its own signature validation.
  app.use('/api', rateLimit({ windowMs: 60 * 60 * 1000, max: 300 }, 'webhook'), webhookRouter);

  if (testAuth) app.use(injectTestUser);
  else app.use('/api', resolveSessionIfPresent);
  app.use('/api', unauthenticatedApiRateLimit);

  if (!testAuth) app.use('/api', requireAuthentication);
  app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }, 'api'));
  app.use('/api', stateRouter);
  app.use('/api', pantryRouter);
  app.use('/api', policyRouter);
  app.use('/api', timeRouter);
  app.use('/api', quotesRouter);
  app.use('/api', runsRouter);
  app.use('/api', auditRouter);
  app.use('/api', workspaceRouter);
  app.use('/api', checkoutRouter);
  app.use('/api/ai', createAiRouter());

  // 404 handler for unknown API routes
  app.use('/api', (_req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
      },
    });
  });

  // Global centralized error handler
  app.use(errorHandler);

  return app;
}
