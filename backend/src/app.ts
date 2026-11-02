import express, { Express } from 'express';
import cors from 'cors';
import { requestLogger } from './middleware/logging.js';
import { injectDemoUser } from './middleware/auth.js';
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
import { configRouter } from './routes/config.js';

export function createApp(): Express {
  const app = express();

  // Basic middleware with raw-body preservation for webhooks
  app.use(cors());
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as any).rawBody = buf;
      },
    })
  );
  app.use(requestLogger);
  app.use(injectDemoUser);

  // Mount API routers
  app.use('/api', healthRouter);
  app.use('/api', stateRouter);
  app.use('/api', pantryRouter);
  app.use('/api', policyRouter);
  app.use('/api', timeRouter);
  app.use('/api', quotesRouter);
  app.use('/api', runsRouter);
  app.use('/api', auditRouter);
  app.use('/api', checkoutRouter);
  app.use('/api', webhookRouter);
  app.use('/api', configRouter);
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
