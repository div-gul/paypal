import { Router, Request, Response, NextFunction } from 'express';
import { getDatabase } from '../db/connection.js';
import { WebhookEventRepository } from '../repositories/WebhookEventRepository.js';
import { RunRepository } from '../repositories/RunRepository.js';
import { PaymentService } from '../services/payment/PaymentService.js';
import { PayPalSandboxProvider } from '../services/payment/PayPalSandboxProvider.js';
import { config } from '../config.js';

export function createWebhookRouter(testVerifier?: (headers: Record<string, string>, event: Record<string, unknown>) => Promise<boolean>): Router {
  const router = Router();

router.post('/webhooks/paypal', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (config.PAYPAL_MODE === 'mock' && !testVerifier) {
      res.status(401).json({ error: { code: 'WEBHOOKS_DISABLED', message: 'PayPal webhooks are disabled in mock mode.' } });
      return;
    }

    const rawBody = (req as any).rawBody ? (req as any).rawBody.toString('utf8') : JSON.stringify(req.body);
    const event = typeof req.body === 'object' && req.body ? req.body : JSON.parse(rawBody || '{}');
    const eventId = event.id || req.headers['paypal-transmission-id'] as string;
    if (!eventId) {
      res.status(400).json({ error: { code: 'INVALID_WEBHOOK', message: 'Missing event ID' } });
      return;
    }

    if (config.PAYPAL_MODE !== 'mock' || testVerifier) {
      const transmissionTime = req.headers['paypal-transmission-time'];
      const transmissionTimestamp = typeof transmissionTime === 'string' ? Date.parse(transmissionTime) : NaN;
      if (!Number.isFinite(transmissionTimestamp) || Math.abs(Date.now() - transmissionTimestamp) > 5 * 60 * 1000) {
        res.status(401).json({ error: { code: 'STALE_WEBHOOK', message: 'PayPal webhook transmission is outside the accepted time window.' } });
        return;
      }
      const headers: Record<string, string> = {};
      for (const [name, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') headers[name] = value;
      }
      const verified = testVerifier
        ? await testVerifier(headers, event)
        : await new PayPalSandboxProvider().verifyWebhookSignature(headers, event);
      if (!verified) {
        res.status(401).json({ error: { code: 'INVALID_SIGNATURE', message: 'PayPal webhook signature verification failed' } });
        return;
      }
    }

    const db = getDatabase();
    const webhookRepo = new WebhookEventRepository(db);
    const relatedIds = event.resource?.supplementary_data?.related_ids;
    const orderId = event.event_type === 'CHECKOUT.ORDER.APPROVED'
      ? event.resource?.id
      : relatedIds?.order_id;
    const run = typeof orderId === 'string' ? new RunRepository(db).findByOrderId(orderId) : null;
    const { recorded, event: storedEvent } = webhookRepo.recordEvent({
      id: eventId,
      userId: run?.userId || req.user?.id || 'demo-user',
      eventType: event.event_type || 'PAYMENT.UNKNOWN',
      resourceId: event.resource?.id || null,
      payloadJson: rawBody,
    });

    if (!recorded) {
      res.status(200).json({ received: true, duplicate: true, eventId });
      return;
    }

    if (
      orderId &&
      (storedEvent.eventType === 'PAYMENT.CAPTURE.COMPLETED' || storedEvent.eventType === 'CHECKOUT.ORDER.APPROVED')
    ) {
      await new PaymentService(db).syncOrderFromWebhook(orderId);
    }

    webhookRepo.markProcessed(eventId);
    res.status(200).json({ received: true, processed: true, eventId });
  } catch (err) {
    next(err);
  }
});

  return router;
}

export const webhookRouter = createWebhookRouter();
