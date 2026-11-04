import express, { Express } from 'express';
import cors from 'cors';
import { requestLogger } from './middleware/logging.js';
import { injectTestUser, requireAuthentication } from './middleware/auth.js';
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

export function createApp(options: { testAuth?: boolean } = {}): Express {
  const app = express();
  const testAuth = options.testAuth === true;

  // Basic middleware with raw-body preservation for webhooks
  app.use(cors({ origin: config.APP_BASE_URL, credentials: true }));
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as any).rawBody = buf;
      },
    })
  );
  app.use(requestLogger);

  // Tests use a deterministic fixture identity. Runtime requests must use
  // the persistent, HTTP-only cookie session.
  app.use('/api/auth', authRouter);
  if (testAuth) app.use(injectTestUser);

  // Mount API routers
  app.use('/api', healthRouter);
  // PayPal's signed webhook is an external callback and has its own signature validation.
  app.use('/api', webhookRouter);

  if (!testAuth) app.use('/api', requireAuthentication);
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
