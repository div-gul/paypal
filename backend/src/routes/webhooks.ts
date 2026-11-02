import { Router, Request, Response, NextFunction } from 'express';
import { getDatabase } from '../db/connection.js';
import { WebhookEventRepository } from '../repositories/WebhookEventRepository.js';
import { RunRepository } from '../repositories/RunRepository.js';
import { PaymentService } from '../services/payment/PaymentService.js';
import { PayPalSandboxProvider } from '../services/payment/PayPalSandboxProvider.js';
import { config } from '../config.js';

export const webhookRouter = Router();

/**
 * Signature verification for PayPal webhook events.
 * Calls PayPal REST API POST /v1/notifications/verify-webhook-signature in sandbox mode.
 * Bypasses with warning in mock mode or when PAYPAL_WEBHOOK_ID is unset.
 */
export async function verifyPayPalWebhookSignature(req: Request, rawBody: string, event: any): Promise<boolean> {
  // In mock mode or when no webhook ID configured, allow events through with warning
  if (config.PAYPAL_MODE === 'mock' || !config.PAYPAL_WEBHOOK_ID) {
    if (config.PAYPAL_MODE === 'sandbox' && !config.PAYPAL_WEBHOOK_ID) {
      console.warn('[Webhook] PAYPAL_WEBHOOK_ID is not configured. Allowing webhook event without signature verification for local testing.');
    }
    return true;
  }

  const transmissionId = req.headers['paypal-transmission-id'] as string;
  const transmissionTime = req.headers['paypal-transmission-time'] as string;
  const transmissionSig = req.headers['paypal-transmission-sig'] as string;
  const certUrl = req.headers['paypal-cert-url'] as string;
  const authAlgo = req.headers['paypal-auth-algo'] as string;

  if (!transmissionId || !transmissionSig || !transmissionTime || !certUrl || !authAlgo) {
    console.warn('[Webhook] Missing required PayPal transmission headers');
    return false;
  }

  try {
    const provider = new PayPalSandboxProvider();
    const token = await provider.getAccessToken();

    const verifyUrl = `${config.PAYPAL_BASE_URL.replace(/\/+$/, '')}/v1/notifications/verify-webhook-signature`;

    const res = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: config.PAYPAL_WEBHOOK_ID,
        webhook_event: typeof event === 'object' && event ? event : JSON.parse(rawBody || '{}'),
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.warn(`[Webhook] Signature verification API returned status ${res.status}`);
      return false;
    }

    const data = (await res.json()) as { verification_status?: string };
    return data.verification_status === 'SUCCESS';
  } catch (err: any) {
    console.error('[Webhook] Failed to verify webhook signature:', err.message);
    return false;
  }
}

webhookRouter.post('/webhooks/paypal', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawBody = (req as any).rawBody ? (req as any).rawBody.toString('utf8') : JSON.stringify(req.body);
    const event = typeof req.body === 'object' && req.body ? req.body : JSON.parse(rawBody || '{}');

    const eventId = event.id || (req.headers['paypal-transmission-id'] as string);
    if (!eventId) {
      res.status(400).json({ error: { code: 'INVALID_WEBHOOK', message: 'Missing event ID' } });
      return;
    }

    // 1. Signature verification
    const isValidSignature = await verifyPayPalWebhookSignature(req, rawBody, event);
    if (!isValidSignature) {
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
    const runRepo = new RunRepository(db);
    const paymentService = new PaymentService(db);

    const orderId =
      event.resource?.supplementary_data?.related_ids?.order_id ||
      event.resource?.custom_id ||
      event.resource?.invoice_id ||
      event.resource?.order_id;
    const captureId = event.resource?.id;

    let run = orderId ? runRepo.findByOrderId(orderId) : null;
    if (!run && captureId) {
      run = runRepo.findByOrderId(captureId);
    }

    switch (dbEvent.eventType) {
      case 'PAYMENT.CAPTURE.COMPLETED': {
        if (run) {
          if (run.status === 'paid') {
            console.log(`[Webhook] Run ${run.id} is already paid. Skipping duplicate settlement.`);
          } else {
            paymentService.settleRunAtomically(run.userId, run.id, orderId || run.orderId || captureId, {
              captureId: captureId || `CAP-${run.id}`,
              currency: event.resource?.amount?.currency_code || 'USD',
              usdAmount: event.resource?.amount?.value || run.usdAmount,
              usdRate: run.usdRate || config.PAYPAL_USD_RATE,
              payerEmail: event.resource?.payer?.email_address,
            });
            console.log(`[Webhook] Run ${run.id} successfully settled via webhook PAYMENT.CAPTURE.COMPLETED.`);
          }
        } else {
          console.warn(`[Webhook] No restock run found for completed capture ${captureId || orderId}`);
        }
        break;
      }

      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.DECLINED': {
        if (run && run.status !== 'paid') {
          paymentService.failRun(
            run.userId,
            run.id,
            orderId || run.orderId || captureId || 'unknown',
            event.resource?.status_details?.reason || 'PayPal payment capture was denied/declined'
          );
          console.log(`[Webhook] Run ${run.id} marked as failed via webhook ${dbEvent.eventType}.`);
        }
        break;
      }

      case 'CHECKOUT.ORDER.APPROVED':
      default:
        console.log(`[Webhook] Event type "${dbEvent.eventType}" logged.`);
    }

    webhookRepo.markProcessed(eventId);
    res.status(200).json({ received: true, processed: true, eventId });
  } catch (err) {
    next(err);
  }
});
