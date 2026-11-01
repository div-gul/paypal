import { Router, Request, Response, NextFunction } from 'express';
import { getDatabase } from '../db/connection.js';
import { WebhookEventRepository } from '../repositories/WebhookEventRepository.js';
import { config } from '../config.js';

export const webhookRouter = Router();

/**
 * Signature verification stub for PayPal webhook events.
 * A teammate will wire in the live PayPal SDK verifyWebhookSignature call.
 */
function verifyPayPalWebhookSignature(req: Request): boolean {
  // In mock mode or local test, allow simulation payloads
  if (config.PAYPAL_MODE === 'mock') {
    return true;
  }

  const transmissionId = req.headers['paypal-transmission-id'];
  const transmissionTime = req.headers['paypal-transmission-time'];
  const transmissionSig = req.headers['paypal-transmission-sig'];
  const certUrl = req.headers['paypal-cert-url'];
  const authAlgo = req.headers['paypal-auth-algo'];

  // =========================================================================
  // TODO: Teammate implementing live PayPal Sandbox webhook verification:
  // Call POST https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature
  // with {
  //   auth_algo: authAlgo,
  //   cert_url: certUrl,
  //   transmission_id: transmissionId,
  //   transmission_sig: transmissionSig,
  //   transmission_time: transmissionTime,
  //   webhook_id: config.PAYPAL_WEBHOOK_ID,
  //   webhook_event: req.body
  // }
  // =========================================================================

  if (!transmissionId || !transmissionSig || !transmissionTime || !certUrl || !authAlgo) {
    console.warn('[Webhook] Missing required PayPal transmission headers');
    return false;
  }

  return true;
}

webhookRouter.post('/webhooks/paypal', (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawBody = (req as any).rawBody ? (req as any).rawBody.toString('utf8') : JSON.stringify(req.body);
    const event = typeof req.body === 'object' && req.body ? req.body : JSON.parse(rawBody || '{}');

    const eventId = event.id || req.headers['paypal-transmission-id'] as string;
    if (!eventId) {
      res.status(400).json({ error: { code: 'INVALID_WEBHOOK', message: 'Missing event ID' } });
      return;
    }

    // 1. Signature verification
    const isValidSignature = verifyPayPalWebhookSignature(req);
    if (!isValidSignature && config.PAYPAL_MODE === 'sandbox') {
      res.status(401).json({ error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed' } });
      return;
    }

    // 2. Idempotency check via webhook_events table
    const db = getDatabase();
    const webhookRepo = new WebhookEventRepository(db);

    const { recorded, event: dbEvent } = webhookRepo.recordEvent({
      id: eventId,
      userId: req.user?.id || 'demo-user',
      eventType: event.event_type || 'PAYMENT.UNKNOWN',
      resourceId: event.resource?.id || null,
      payloadJson: rawBody,
    });

    if (!recorded) {
      console.log(`[Webhook] Duplicate event "${eventId}" received. Skipping (idempotent no-op).`);
      res.status(200).json({ received: true, duplicate: true, eventId });
      return;
    }

    // 3. Process event type
    console.log(`[Webhook] Processing PayPal event "${dbEvent.eventType}" (${eventId})`);
    switch (dbEvent.eventType) {
      case 'PAYMENT.CAPTURE.COMPLETED':
      case 'CHECKOUT.ORDER.APPROVED':
        // Event processing handled idempotently
        break;
      default:
        console.log(`[Webhook] Event type "${dbEvent.eventType}" logged.`);
    }

    webhookRepo.markProcessed(eventId);
    res.status(200).json({ received: true, processed: true, eventId });
  } catch (err) {
    next(err);
  }
});
